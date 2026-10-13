import { timingSafeEqual } from "node:crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { Payment } from "@prisma/client";
import prisma from "../db/db.config";
import { ApiError, ok, validationError } from "../utils/http";
import { logError } from "../utils/logger";
import { getCatalogVersion } from "../services/catalog";
import {
  assertNoFixtureDataInProduction,
  assertOrderReadyForPricing,
  computeQuote,
  loadOwnedOrder,
} from "../services/orders";
import { isUniqueViolation, readIdempotencyKey } from "../services/idempotency";
import {
  QPayAdapter,
  QPayConfigError,
  QPayProviderError,
  currentQPayMode,
  getQPayAdapter,
  qpayMock,
} from "../services/qpay";

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; role: string };
}

const PAYMENT_TTL_MINUTES = 30;
const CHECK_THROTTLE_MS = 2_000;
// Real QPay (sandbox): status reads by the app poll at most this often; the
// callback still forces an immediate check. QPay asks clients not to poll
// payment/check aggressively.
const PROVIDER_CHECK_THROTTLE_MS = 10_000;

const createSchema = z.object({
  quoteId: z.string().trim().min(1, "quoteId шаардлагатай"),
});

export function serializePayment(p: Payment) {
  return {
    id: p.id,
    provider: p.provider,
    mode: p.mode,
    // mock = in-process fake, never QPay; sandbox = QPay merchant sandbox
    isMock: p.mode === "mock",
    status: p.status,
    amountMnt: p.amountMnt,
    currency: p.currency,
    qrText: p.qrText,
    qrImageBase64: p.qrImage,
    deeplinks: p.deeplinks ?? [],
    expiresAt: p.expiresAt.toISOString(),
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    failureCode: p.failureCode,
  };
}

function adapterOrUnavailable(): QPayAdapter {
  try {
    return getQPayAdapter();
  } catch (err) {
    if (err instanceof QPayConfigError) {
      throw new ApiError(
        503,
        "PAYMENT_UNAVAILABLE",
        "Төлбөрийн үйлчилгээ тохируулагдаагүй байна",
      );
    }
    throw err;
  }
}

function callbackUrl(paymentId: string, mode: string) {
  const base = process.env.PUBLIC_BASE_URL;
  const secret = process.env.QPAY_CALLBACK_SECRET;
  if (mode === "sandbox" && (!base?.startsWith("https://") || !secret)) {
    throw new ApiError(
      503,
      "PAYMENT_UNAVAILABLE",
      "Төлбөрийн callback HTTPS хаяг тохируулагдаагүй байна",
    );
  }
  return `${base ?? "http://localhost"}/api/payments/qpay/callback/${secret ?? "mock"}?paymentId=${encodeURIComponent(paymentId)}`;
}

/**
 * Recovery hints in error.fields (docs/l1-1-api.md §7.1.1):
 *   RESUME          pending invoice exists → poll GET payment with paymentId
 *   DONE            already paid
 *   WAIT            provider answer was lost; no new invoice until expiresAt, then a new quote
 *   NEW_QUOTE       no invoice exists; get a new quote and pay with a new key
 *   CONTACT_SUPPORT money may have moved outside our records; manual reconciliation
 */
type Recovery = "RESUME" | "DONE" | "WAIT" | "NEW_QUOTE" | "CONTACT_SUPPORT";
const RECONCILIATION_CODES = ["NEEDS_RECONCILIATION", "PAID_AFTER_EXPIRY"];

const recoveryFields = (p: Payment, recovery: Recovery) => ({
  paymentId: p.id,
  paymentStatus: p.status,
  recovery,
  expiresAt: p.expiresAt.toISOString(),
});

/** Error for a payment that blocks a new invoice on its order, or null when it does not block. */
function blockingPaymentError(p: Payment): ApiError | null {
  if (p.failureCode && RECONCILIATION_CODES.includes(p.failureCode)) {
    return new ApiError(
      409,
      "PAYMENT_RECONCILIATION_REQUIRED",
      "Төлбөрийг гараар шалгах шаардлагатай. Тусламжийн төвтэй холбогдоно уу",
      recoveryFields(p, "CONTACT_SUPPORT"),
    );
  }
  if (p.status === "PAID") {
    return new ApiError(
      409,
      "PAYMENT_ALREADY_PAID",
      "Энэ захиалгын төлбөр төлөгдсөн байна",
      recoveryFields(p, "DONE"),
    );
  }
  if (p.status === "PENDING") {
    return new ApiError(
      409,
      "PAYMENT_IN_PROGRESS",
      "Энэ захиалгад төлбөр хүлээгдэж байна",
      recoveryFields(p, p.providerInvoiceId ? "RESUME" : "WAIT"),
    );
  }
  return null;
}

const unconfirmedError = (p: Payment) =>
  new ApiError(
    502,
    "PAYMENT_UNCONFIRMED",
    "Нэхэмжлэх үүссэн эсэх тодорхойгүй байна. Давхар төлбөрөөс сэргийлж түр хүлээнэ үү",
    recoveryFields(p, "WAIT"),
  );

const providerFailedError = (p: Payment) =>
  new ApiError(
    502,
    "PAYMENT_PROVIDER_ERROR",
    "Төлбөрийн үйлчилгээ түр алдаатай байна. Шинэ үнийн санал авч дахин оролдоно уу",
    recoveryFields(p, "NEW_QUOTE"),
  );

const safeSync = (p: Payment) =>
  syncPayment(p.id).catch((err) => {
    logError("qpay check", err);
    return p;
  });

// POST /api/orders/:id/payments/qpay  (Idempotency-Key required, body { quoteId })
export const createQPayPayment = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const userId = req.user!.userId;
  const key = readIdempotencyKey(req, true)!;
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) throw validationError(parsed.error);
  const { quoteId } = parsed.data;

  // Ownership first: someone else's order is a 404 and no payment detail is revealed
  let order = await loadOwnedOrder(req.params.id, userId);

  // Same key + same quote → the same outcome as the first request
  const replay = async () => {
    let existing = await prisma.payment.findUnique({
      where: {
        orderId_idempotencyKey: { orderId: order.id, idempotencyKey: key },
      },
    });
    if (!existing) return null;
    if (existing.quoteId !== quoteId) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "Энэ Idempotency-Key өөр хүсэлтэд ашиглагдсан байна",
      );
    }
    if (existing.status === "PENDING") existing = await safeSync(existing);
    if (!existing.providerInvoiceId) {
      // No invoice on our side: the same error again, never a second provider call
      if (
        existing.failureCode &&
        RECONCILIATION_CODES.includes(existing.failureCode)
      )
        throw blockingPaymentError(existing)!;
      if (existing.status === "PENDING") throw unconfirmedError(existing);
      throw providerFailedError(existing);
    }
    res.setHeader("Idempotent-Replayed", "true");
    const current = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    return ok(
      res,
      {
        payment: serializePayment(existing),
        orderStatus: current.status,
        idempotentReplay: true,
      },
      "Нэхэмжлэх үүссэн байна",
      201,
    );
  };
  const replayed = await replay();
  if (replayed) return replayed;

  // A different key while a payment is pending, paid or unreconciled → point to that payment
  const blocking = await prisma.payment.findFirst({
    where: {
      orderId: order.id,
      OR: [
        { status: { in: ["PENDING", "PAID"] } },
        { failureCode: { in: RECONCILIATION_CODES } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  if (blocking) {
    const current =
      blocking.status === "PENDING" ? await safeSync(blocking) : blocking;
    const conflict = blockingPaymentError(current);
    if (conflict) throw conflict;
    // it expired just now: the order is back in DRAFT, continue with fresh data
    order = await loadOwnedOrder(order.id, userId);
  }

  // Same guards as quote, run again: red flag, status, completeness, referral
  assertOrderReadyForPricing(order);
  await assertNoFixtureDataInProduction(order);

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, orderId: order.id },
  });
  if (!quote)
    throw new ApiError(404, "QUOTE_NOT_FOUND", "Үнийн санал олдсонгүй");
  if (quote.orderVersion !== order.version) {
    throw new ApiError(
      409,
      "QUOTE_MISMATCH",
      "Захиалга үнийн саналаас хойш өөрчлөгдсөн. Шинэ үнийн санал авна уу",
    );
  }
  if (quote.expiresAt <= new Date())
    throw new ApiError(
      409,
      "QUOTE_EXPIRED",
      "Үнийн саналын хугацаа дууссан. Шинэ санал авна уу",
    );
  const catalogVersion = await getCatalogVersion();
  if (catalogVersion !== quote.catalogVersion) {
    throw new ApiError(
      409,
      "CATALOG_OUTDATED",
      "Каталог шинэчлэгдсэн байна. Шинэ үнийн санал авна уу",
    );
  }
  // Amount is always the server's quote, re-derived and compared — never from the client
  const recomputed = computeQuote(order);
  if (recomputed.totalMnt !== quote.totalMnt || quote.currency !== "MNT") {
    throw new ApiError(
      409,
      "QUOTE_MISMATCH",
      "Үнийн дүн зөрж байна. Шинэ үнийн санал авна уу",
    );
  }

  const adapter = adapterOrUnavailable();
  callbackUrl("preflight", adapter.mode); // callback config errors (503) before anything is written
  const lockedOrder = order;

  let payment: Payment;
  try {
    payment = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('otoch-content-publication'))`;
      const latest = await tx.serviceCatalogItem.aggregate({
        where: { isActive: true },
        _max: { updatedAt: true },
      });
      if (latest._max.updatedAt?.toISOString() !== quote.catalogVersion)
        throw new ApiError(
          409,
          "CATALOG_OUTDATED",
          "Каталог шинэчлэгдсэн байна",
        );
      assertOrderReadyForPricing(lockedOrder);
      await tx.$executeRaw`SELECT 1 FROM "Order" WHERE "id" = ${lockedOrder.id} FOR UPDATE`;
      const current = await tx.order.findUniqueOrThrow({
        where: { id: lockedOrder.id },
      });
      if (
        current.status !== "DRAFT" ||
        current.version !== lockedOrder.version
      ) {
        const other = await tx.payment.findFirst({
          where: {
            orderId: lockedOrder.id,
            status: { in: ["PENDING", "PAID"] },
          },
          orderBy: { createdAt: "desc" },
        });
        const conflict = other && blockingPaymentError(other);
        if (conflict) throw conflict;
        throw new ApiError(
          409,
          "QUOTE_MISMATCH",
          "Захиалга өөрчлөгдсөн байна. Шинэ үнийн санал авна уу",
        );
      }
      if (/^S\d{2}$/.test(lockedOrder.items[0]?.serviceCode ?? "")) {
        // Serialize capacity claims in the same transaction as payment/order status.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${lockedOrder.zoneId}:${lockedOrder.scheduledFor?.toISOString()}`}))`;
        const slot = await tx.availabilitySlot.findFirst({
          where: {
            zoneId: lockedOrder.zoneId ?? "",
            startsAt: lockedOrder.scheduledFor ?? new Date(0),
          },
        });
        const booked = await tx.order.count({
          where: {
            id: { not: lockedOrder.id },
            zoneId: lockedOrder.zoneId,
            scheduledFor: lockedOrder.scheduledFor,
            status: {
              in: ["AWAITING_PAYMENT", "PAID", "ASSIGNED", "IN_PROGRESS"],
            },
          },
        });
        await assertNoFixtureDataInProduction(lockedOrder, tx);
        if (!slot || booked >= slot.capacity)
          throw new ApiError(
            409,
            "AVAILABILITY_REQUIRED",
            "Сонгосон цаг дүүрсэн байна",
          );
      }
      const created = await tx.payment.create({
        data: {
          orderId: lockedOrder.id,
          quoteId: quote.id,
          userId,
          mode: adapter.mode,
          idempotencyKey: key,
          amountMnt: quote.totalMnt,
          currency: "MNT",
          expiresAt: new Date(Date.now() + PAYMENT_TTL_MINUTES * 60_000),
        },
      });
      await tx.order.update({
        where: { id: lockedOrder.id },
        data: { status: "AWAITING_PAYMENT", version: { increment: 1 } },
      });
      await tx.orderEvent.create({
        data: {
          orderId: lockedOrder.id,
          type: "PAYMENT_CREATED",
          fromStatus: "DRAFT",
          toStatus: "AWAITING_PAYMENT",
          actorId: userId,
          metadata: { mode: adapter.mode },
        },
      });
      return created;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const again = await replay();
      if (again) return again;
    }
    throw err;
  }

  try {
    const invoice = await adapter.createInvoice({
      senderInvoiceNo: payment.id,
      amountMnt: payment.amountMnt,
      description: `OTOCH захиалга ${order.id}`,
      callbackUrl: callbackUrl(payment.id, adapter.mode),
    });
    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerInvoiceId: invoice.invoiceId,
        qrText: invoice.qrText,
        qrImage: invoice.qrImage,
        deeplinks: invoice.deeplinks,
      },
    });
  } catch (err) {
    logError("qpay createInvoice", err);
    const definite =
      err instanceof ApiError ||
      (err instanceof QPayProviderError && err.definite);
    if (!definite) {
      // The invoice may exist at the provider. Keep the order locked (AWAITING_PAYMENT) so no
      // second invoice is created; it is released when this payment expires (§7.1.1).
      const [held] = await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: { failureCode: "PROVIDER_UNCONFIRMED" },
        }),
        prisma.orderEvent.create({
          data: {
            orderId: order.id,
            type: "PAYMENT_UNCONFIRMED",
            metadata: { mode: adapter.mode },
          },
        }),
      ]);
      throw unconfirmedError(held);
    }
    const [failed] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", failureCode: "PROVIDER_REJECTED" },
      }),
      prisma.order.updateMany({
        where: { id: order.id, status: "AWAITING_PAYMENT" },
        data: { status: "DRAFT", version: { increment: 1 } },
      }),
      prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "PAYMENT_FAILED",
          fromStatus: "AWAITING_PAYMENT",
          toStatus: "DRAFT",
        },
      }),
    ]);
    if (err instanceof ApiError) throw err;
    throw providerFailedError(failed);
  }

  return ok(
    res,
    {
      payment: serializePayment(payment),
      orderStatus: "AWAITING_PAYMENT",
      idempotentReplay: false,
    },
    "Нэхэмжлэх үүслээ",
    201,
  );
};

/**
 * Confirms a payment ONLY through the provider's payment check (never from callback data).
 * Transitions are conditional (status = PENDING), so duplicate callbacks/polls apply once.
 */
export async function syncPayment(
  paymentId: string,
  opts: { force?: boolean } = {},
): Promise<Payment> {
  let payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
  });
  if (payment.status !== "PENDING") return payment;
  if (
    !opts.force &&
    payment.lastCheckedAt &&
    Date.now() - payment.lastCheckedAt.getTime() <
      (payment.mode === "mock" ? CHECK_THROTTLE_MS : PROVIDER_CHECK_THROTTLE_MS)
  )
    return payment;

  const mode = currentQPayMode();
  if (payment.providerInvoiceId && mode === payment.mode) {
    const check = await getQPayAdapter().checkInvoice(
      payment.providerInvoiceId,
    );
    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: { lastCheckedAt: new Date() },
    });
    if (check.paid) {
      const amountOk =
        check.paidAmountMnt === payment.amountMnt &&
        (check.currency === null || check.currency === "MNT");
      if (!amountOk) {
        if (payment.failureCode !== "AMOUNT_MISMATCH") {
          await prisma.$transaction([
            prisma.payment.update({
              where: { id: payment.id },
              data: { failureCode: "AMOUNT_MISMATCH" },
            }),
            prisma.orderEvent.create({
              data: {
                orderId: payment.orderId,
                type: "PAYMENT_AMOUNT_MISMATCH",
              },
            }),
          ]);
        }
        return prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      }
      await prisma.$transaction(async (tx) => {
        const moved = await tx.payment.updateMany({
          where: { id: payment.id, status: "PENDING" },
          data: {
            status: "PAID",
            paidAt: new Date(),
            providerPaymentId: check.paymentId,
            failureCode: null,
          },
        });
        if (moved.count === 1) {
          await tx.order.updateMany({
            where: { id: payment.orderId, status: "AWAITING_PAYMENT" },
            data: { status: "PAID", version: { increment: 1 } },
          });
          await tx.orderEvent.create({
            data: {
              orderId: payment.orderId,
              type: "PAYMENT_PAID",
              fromStatus: "AWAITING_PAYMENT",
              toStatus: "PAID",
              metadata: { mode: payment.mode },
            },
          });
        }
      });
      return prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    }
  }

  // A payment waiting for manual reconciliation keeps the order locked even after expiry
  if (
    payment.expiresAt <= new Date() &&
    payment.failureCode !== "NEEDS_RECONCILIATION"
  ) {
    await prisma.$transaction(async (tx) => {
      const moved = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      if (moved.count === 1) {
        await tx.order.updateMany({
          where: { id: payment.orderId, status: "AWAITING_PAYMENT" },
          data: { status: "DRAFT", version: { increment: 1 } },
        });
        await tx.orderEvent.create({
          data: {
            orderId: payment.orderId,
            type: "PAYMENT_EXPIRED",
            fromStatus: "AWAITING_PAYMENT",
            toStatus: "DRAFT",
          },
        });
      }
    });
    return prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  }
  return payment;
}

// GET /api/orders/:id/payments/:paymentId — owner; checks the provider when still pending
export const getPayment = async (req: AuthenticatedRequest, res: Response) => {
  const order = await loadOwnedOrder(req.params.id, req.user!.userId);
  const found = await prisma.payment.findFirst({
    where: { id: req.params.paymentId, orderId: order.id },
  });
  if (!found) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Төлбөр олдсонгүй");
  let payment = found;
  try {
    payment = await syncPayment(found.id);
  } catch (err) {
    logError("qpay check", err);
  }
  const current = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
  });
  return ok(
    res,
    { payment: serializePayment(payment), orderStatus: current.status },
    "Төлбөрийн төлөв",
  );
};

const secretMatches = (given: string) => {
  const expected =
    process.env.QPAY_CALLBACK_SECRET ||
    (currentQPayMode() === "mock" ? "mock" : "");
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * The callback is only a hint: the provider's payment check decides.
 * Two cases cannot be settled automatically and are flagged for manual reconciliation:
 *  - no provider invoice id on our side (creation answer was lost) → NEEDS_RECONCILIATION, order stays locked
 *  - the provider reports a payment for an invoice we already expired → PAID_AFTER_EXPIRY
 */
async function handleCallback(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return;
  if (payment.status === "PENDING" && !payment.providerInvoiceId) {
    const flagged = await prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: "PENDING",
        OR: [
          { failureCode: null },
          { failureCode: { not: "NEEDS_RECONCILIATION" } },
        ],
      },
      data: { failureCode: "NEEDS_RECONCILIATION" },
    });
    if (flagged.count === 1) {
      await prisma.orderEvent.create({
        data: {
          orderId: payment.orderId,
          type: "PAYMENT_NEEDS_RECONCILIATION",
          metadata: { mode: payment.mode },
        },
      });
    }
    return;
  }
  if (
    payment.status === "EXPIRED" &&
    payment.providerInvoiceId &&
    payment.mode === currentQPayMode() &&
    payment.failureCode !== "PAID_AFTER_EXPIRY"
  ) {
    const check = await getQPayAdapter().checkInvoice(
      payment.providerInvoiceId,
    );
    if (check.paid) {
      const flagged = await prisma.payment.updateMany({
        where: {
          id: payment.id,
          status: "EXPIRED",
          OR: [
            { failureCode: null },
            { failureCode: { not: "PAID_AFTER_EXPIRY" } },
          ],
        },
        data: {
          failureCode: "PAID_AFTER_EXPIRY",
          providerPaymentId: check.paymentId,
        },
      });
      if (flagged.count === 1) {
        await prisma.orderEvent.create({
          data: {
            orderId: payment.orderId,
            type: "PAYMENT_PAID_AFTER_EXPIRY",
            metadata: { mode: payment.mode },
          },
        });
      }
    }
    return;
  }
  await syncPayment(paymentId, { force: true });
}

// GET|POST /api/payments/qpay/callback/:secret?paymentId=… — provider → backend (public, no JWT)
export const qpayCallback = async (req: Request, res: Response) => {
  if (!secretMatches(req.params.secret ?? ""))
    return res.status(404).json({ success: false });
  const paymentId =
    typeof req.query.paymentId === "string" ? req.query.paymentId : "";
  if (paymentId) {
    await handleCallback(paymentId).catch((err) =>
      logError("qpay callback check", err),
    );
  }
  // Same response whatever happened (no information for probes)
  return res.status(200).json({ success: true });
};

// POST /api/dev/qpay-mock/orders/:id/payments/:paymentId/pay — dev/test only, mock mode only
export const devMockPay = async (req: AuthenticatedRequest, res: Response) => {
  if (process.env.NODE_ENV === "production" || currentQPayMode() !== "mock") {
    throw new ApiError(404, "NOT_FOUND", "Хүссэн зам олдсонгүй");
  }
  const order = await loadOwnedOrder(req.params.id, req.user!.userId);
  const payment = await prisma.payment.findFirst({
    where: { id: req.params.paymentId, orderId: order.id },
  });
  if (!payment?.providerInvoiceId)
    throw new ApiError(404, "PAYMENT_NOT_FOUND", "Төлбөр олдсонгүй");
  qpayMock.markPaid(payment.providerInvoiceId);
  return ok(
    res,
    {
      mockPaid: true,
      note: "MOCK: QPay биш. GET payment-ээр төлөвийг шалгана",
    },
    "Mock төлбөр тэмдэглэгдлээ",
  );
};
