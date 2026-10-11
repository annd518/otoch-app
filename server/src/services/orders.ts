import { Prisma } from "@prisma/client";
import prisma from "../db/db.config";
import { ApiError, FieldErrors } from "../utils/http";
import { getStorage } from "./storage";

/**
 * Draft order domain helpers. Order is a PROPOSED separate model (docs/l1-1-api.md D2);
 * the legacy Visit flow is not touched.
 */

// Placeholder shown when an order is blocked. Not medical advice; must be replaced by
// clinician-approved text (docs/l1-1-api.md D4).
export const RED_FLAG_BLOCK_ADVICE = {
  text: "Туршилтын мэдэгдэл: таны хариултын улмаас энэ захиалгыг үргэлжлүүлэх боломжгүй. (Эмнэлзүйн бичвэр батлагдаагүй)",
  isFixture: true,
};

export const MAX_ATTACHMENTS = 5;
export const QUOTE_TTL_MINUTES = 15;
// Pricing rule identifier: catalog list price × quantity. No travel fee, discount or VAT
// because none of them are approved (docs/l1-1-api.md D3).
export const PRICING_VERSION = "LIST_PRICE_ONLY_V1";
export const PRICE_EXCLUDES = ["TRAVEL_FEE", "DISCOUNT", "VAT"] as const;

export const orderInclude = {
  parent: true,
  assignedNurse: { select: { name: true } },
  events: { orderBy: { createdAt: "asc" } },
  items: { include: { service: true }, orderBy: { serviceCode: "asc" } },
  attachments: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } },
  quotes: { orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.OrderInclude;

export type OrderWithItems = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;
type QuoteRow = OrderWithItems["quotes"][number];

/** Loads an order owned by the user. Foreign and missing orders look identical (404). */
export async function loadOwnedOrder(
  orderId: string,
  userId: string,
): Promise<OrderWithItems> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, childId: userId },
    include: orderInclude,
  });
  if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Захиалга олдсонгүй");
  return order;
}

/** Questionnaire codes required by the order's services (sorted, unique). */
export function questionnairesFor(order: OrderWithItems): string[] {
  return [
    ...new Set(
      order.items
        .map((i) => i.service.questionnaire)
        .filter((q): q is string => !!q),
    ),
  ].sort();
}

export const requiresReferral = (order: OrderWithItems) =>
  order.items.some(
    (i) =>
      i.service.requiresReferral ||
      (i.serviceCode === "S04" &&
        (order.bookingForm as { postoperative?: boolean } | null)
          ?.postoperative === true),
  );
const hasReferral = (order: OrderWithItems) =>
  order.attachments.some((a) => a.kind === "REFERRAL");

/** A quote is usable only for the exact order version it was made for, and before it expires. */
export function isQuoteValid(
  quote: QuoteRow | undefined,
  order: { version: number },
  now = new Date(),
): quote is QuoteRow {
  return (
    !!quote && quote.orderVersion === order.version && quote.expiresAt > now
  );
}

export function serializeQuote(q: QuoteRow) {
  return {
    id: q.id,
    orderVersion: q.orderVersion,
    catalogVersion: q.catalogVersion,
    pricingVersion: q.pricingVersion,
    currency: q.currency,
    lines: q.lines,
    subtotalMnt: q.subtotalMnt,
    // 0 = not included in this quote (no approved fee/discount rule yet, see `excludes`)
    travelFeeMnt: 0,
    discountMnt: 0,
    totalMnt: q.totalMnt,
    excludes: PRICE_EXCLUDES,
    isFixture: q.isFixture,
    expiresAt: q.expiresAt.toISOString(),
    // A quote is a price snapshot only — never a payment or an order confirmation
    isPayment: false,
  };
}

export function serializeAttachment(a: OrderWithItems["attachments"][number]) {
  return {
    id: a.id,
    kind: a.kind,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt.toISOString(),
  };
}

/** API shape. Only fields the server actually stores are returned. */
export function serializeOrder(order: OrderWithItems) {
  const questionnaires = questionnairesFor(order);
  const redFlagRequired = questionnaires.length > 0;
  const latestQuote = order.quotes[0];
  return {
    id: order.id,
    status: order.status,
    version: order.version,
    parentId: order.parentId,
    bookingForm: order.bookingForm,
    zoneId: order.zoneId,
    nurse: order.assignedNurse,
    eta: order.eta?.toISOString() ?? null,
    timeline: order.events
      .filter((e) => e.toStatus)
      .map((e) => ({
        id: e.id,
        status: e.toStatus,
        at: e.createdAt.toISOString(),
      })),
    catalogVersion: order.catalogVersion,
    items: order.items.map((i) => ({
      serviceCode: i.serviceCode,
      name: i.service.name,
      quantity: i.quantity,
      requiresReferral: i.service.requiresReferral,
      isFixture: i.service.isFixture,
    })),
    scheduledFor: order.scheduledFor ? order.scheduledFor.toISOString() : null,
    timeSlot: order.timeSlot,
    address: order.addressText
      ? { text: order.addressText, lat: order.lat, lng: order.lng }
      : null,
    notes: order.notes,
    redFlag: {
      status: order.redFlagStatus,
      required: redFlagRequired,
      questionnaires,
      answeredAt: order.redFlagAnsweredAt
        ? order.redFlagAnsweredAt.toISOString()
        : null,
    },
    attachments: order.attachments.map(serializeAttachment),
    requirements: {
      redFlagAnswers: redFlagRequired && order.redFlagStatus !== "CLEAR",
      referralAttachment: requiresReferral(order) && !hasReferral(order),
      referralUploadAvailable: getStorage() !== null,
    },
    // Only a quote that still matches this exact order version is returned
    quote: isQuoteValid(latestQuote, order)
      ? serializeQuote(latestQuote)
      : null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

/**
 * Server-side guard for anything that moves an order towards payment
 * (quote, payment invoice). Must be called again at every such step,
 * so the red flag check cannot be skipped by calling a later endpoint directly.
 */
export function assertOrderReadyForPricing(
  order: OrderWithItems,
  now = new Date(),
) {
  if (
    order.status === "BLOCKED_RED_FLAG" ||
    order.redFlagStatus === "FLAGGED"
  ) {
    throw new ApiError(
      422,
      "RED_FLAG_BLOCKED",
      "Энэ захиалга аюулын шинжийн асуулгаар хаагдсан тул үргэлжлэх боломжгүй",
    );
  }
  if (order.status !== "DRAFT") {
    throw new ApiError(
      409,
      "ORDER_NOT_EDITABLE",
      `Захиалгын төлөв (${order.status}) энэ үйлдлийг зөвшөөрөхгүй`,
    );
  }
  if (questionnairesFor(order).length > 0 && order.redFlagStatus !== "CLEAR") {
    throw new ApiError(
      422,
      "RED_FLAG_REQUIRED",
      "Эхлээд аюулын шинжийн асуулгад хариулна уу",
    );
  }

  if (order.items.some((i) => /^S\d{2}$/.test(i.serviceCode)))
    assertV2Form(order, now);
  const fields: FieldErrors = {};
  if (!order.scheduledFor) fields.scheduledFor = "Огноо, цагаа сонгоно уу";
  else if (order.scheduledFor.getTime() <= now.getTime())
    fields.scheduledFor = "Ирээдүйн огноо сонгоно уу";
  if (!order.addressText) fields.address = "Хаягаа оруулна уу";
  if (order.items.some((i) => !i.service.isActive))
    fields.items = "Идэвхгүй болсон үйлчилгээ байна";
  if (Object.keys(fields).length) {
    throw new ApiError(
      422,
      "ORDER_INCOMPLETE",
      "Захиалгын мэдээлэл дутуу байна",
      fields,
    );
  }

  if (requiresReferral(order) && !hasReferral(order)) {
    throw new ApiError(
      422,
      "REFERRAL_REQUIRED",
      "Энэ үйлчилгээнд эмчийн заалтын зураг шаардлагатай",
    );
  }
}

/**
 * Fixture prices and unapproved (fixture) red flag questions are demo data.
 * In NODE_ENV=production they are refused unless ALLOW_FIXTURE_DATA=true is set explicitly
 * (a staging deployment that knowingly runs on fixtures). Never set it for real customers.
 */
export const fixtureDataAllowed = () =>
  process.env.NODE_ENV !== "production" ||
  process.env.ALLOW_FIXTURE_DATA === "true";

export async function assertNoFixtureDataInProduction(order: OrderWithItems) {
  if (order.items.some((i) => /^S\d{2}$/.test(i.serviceCode))) {
    const slot = await prisma.availabilitySlot.findFirst({
      where: {
        zoneId: order.zoneId ?? "",
        startsAt: order.scheduledFor ?? new Date(0),
        zone: { isActive: true },
      },
      include: { zone: true },
    });
    const minWindow = order.items.some((i) =>
      ["S03", "S06"].includes(i.serviceCode),
    )
      ? 120
      : 60;
    if (
      !slot ||
      order.lat === null ||
      order.lng === null ||
      order.lat < slot.zone.minLat ||
      order.lat > slot.zone.maxLat ||
      order.lng < slot.zone.minLng ||
      order.lng > slot.zone.maxLng ||
      slot.endsAt.getTime() - slot.startsAt.getTime() < minWindow * 60000
    )
      throw new ApiError(
        422,
        "AVAILABILITY_REQUIRED",
        "Сонгосон хаяг эсвэл цагийн цонх боломжгүй байна",
      );
    const time = (date: Date) =>
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ulaanbaatar",
      }).format(date);
    if (order.timeSlot !== `${time(slot.startsAt)}-${time(slot.endsAt)}`)
      throw new ApiError(
        422,
        "AVAILABILITY_REQUIRED",
        "Цагийн цонх серверийн сул цагтай тохирохгүй байна",
      );
    const booked = await prisma.order.count({
      where: {
        id: { not: order.id },
        zoneId: order.zoneId,
        scheduledFor: order.scheduledFor,
        status: { in: ["AWAITING_PAYMENT", "PAID", "ASSIGNED", "IN_PROGRESS"] },
      },
    });
    if (booked >= slot.capacity)
      throw new ApiError(
        409,
        "AVAILABILITY_REQUIRED",
        "Сонгосон цаг дүүрсэн байна. Өөр цаг сонгоно уу",
      );
  }
  if (fixtureDataAllowed()) return;
  const fixturePrice = order.items.some((i) => i.service.isFixture);
  const questionnaires = questionnairesFor(order);
  const fixtureQuestions =
    questionnaires.length > 0 &&
    (await prisma.redFlagQuestion.count({
      where: { questionnaire: { in: questionnaires }, isFixture: true },
    })) > 0;
  if (fixturePrice || fixtureQuestions) {
    throw new ApiError(
      503,
      "FIXTURE_DATA_NOT_ALLOWED",
      "Үнэ эсвэл аюулын шинжийн асуулга батлагдаагүй байгаа тул захиалга түр боломжгүй",
    );
  }
}

/** Server-side price from the current catalog. Integer MNT only. */
export function computeQuote(order: OrderWithItems) {
  const lines = order.items.map((i) => {
    if (!Number.isInteger(i.service.priceMnt) || i.service.priceMnt < 0) {
      throw new ApiError(500, "INTERNAL_ERROR", "Каталогийн үнэ буруу байна");
    }
    return {
      type: "SERVICE",
      serviceCode: i.serviceCode,
      name: i.service.name,
      quantity: i.quantity,
      unitPriceMnt: i.service.priceMnt,
      amountMnt: i.service.priceMnt * i.quantity,
      isFixture: i.service.isFixture,
    };
  });
  const subtotalMnt = lines.reduce((sum, l) => sum + l.amountMnt, 0);
  if (!Number.isSafeInteger(subtotalMnt))
    throw new ApiError(500, "INTERNAL_ERROR", "Үнийн дүн хэт их байна");
  return {
    lines,
    subtotalMnt,
    totalMnt: subtotalMnt,
    isFixture: lines.some((l) => l.isFixture),
  };
}

function assertV2Form(order: OrderWithItems, now: Date) {
  const form = order.bookingForm as Record<string, unknown> | null;
  const consent = form?.consent as Record<string, unknown> | undefined;
  if (
    !consent ||
    consent.service !== true ||
    consent.sensitiveData !== true ||
    consent.version !== "V2_2026_10" ||
    typeof consent.acceptedAt !== "string"
  ) {
    throw new ApiError(
      422,
      "CONSENT_REQUIRED",
      "Үйлчилгээ болон эрүүл мэндийн мэдээллийн зөвшөөрөл шаардлагатай",
    );
  }
  if (order.parent.birthYear === null)
    throw new ApiError(
      422,
      "PATIENT_DETAILS_REQUIRED",
      "Өвчтөний төрсөн оныг бүртгэнэ үү",
    );
  const year = Number(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "Asia/Ulaanbaatar",
    }).format(now),
  );
  if (
    (year - order.parent.birthYear < 18 || order.parent.needsRepresentative) &&
    (form?.familyPresent !== true || consent.signer !== "REPRESENTATIVE")
  )
    throw new ApiError(
      422,
      "FAMILY_REQUIRED",
      "Насанд хүрсэн гэр бүлийн гишүүн байлцах шаардлагатай",
    );
  const medication = form?.medication as Record<string, unknown> | undefined;
  if (
    order.items.some((i) =>
      ["S02", "S03", "S09", "S10"].includes(i.serviceCode),
    )
  ) {
    if (
      !medication ||
      !["name", "dose", "route", "expiresAt"].every(
        (k) =>
          typeof medication[k] === "string" &&
          String(medication[k]).trim().length > 0,
      )
    )
      throw new ApiError(
        422,
        "MEDICATION_REQUIRED",
        "Эмийн нэр, тун, арга, хугацааг бүрэн оруулна уу",
      );
    if (
      order.items.some((i) => ["S02", "S03"].includes(i.serviceCode)) &&
      (!Number.isInteger(medication.doseNumber) ||
        Number(medication.doseNumber) < 2)
    )
      throw new ApiError(
        422,
        "FIRST_DOSE_NOT_ALLOWED",
        "Эхний тунг гэрт хийх боломжгүй",
      );
    if (
      !Number.isFinite(Date.parse(String(medication.expiresAt))) ||
      Date.parse(String(medication.expiresAt)) <=
        (order.scheduledFor?.getTime() ?? now.getTime())
    )
      throw new ApiError(
        422,
        "MED_EXPIRED",
        "Эмийн хугацаа үйлчилгээний өдрөөс хойш байх шаардлагатай",
      );
  }
  if (
    order.items.some((i) => i.serviceCode === "S04") &&
    form?.postoperative === true &&
    !hasReferral(order)
  )
    throw new ApiError(
      422,
      "REFERRAL_REQUIRED",
      "Мэс заслын дараах шарханд эпикриз шаардлагатай",
    );
  if (
    !order.zoneId ||
    order.lat === null ||
    order.lng === null ||
    !order.timeSlot ||
    !order.scheduledFor ||
    order.scheduledFor.getTime() < now.getTime() + 2 * 3600000
  )
    throw new ApiError(
      422,
      "AVAILABILITY_REQUIRED",
      "Үйлчлэх бүс, координат болон хамгийн эрт 2 цагийн дараах цагийг сонгоно уу",
    );
}
