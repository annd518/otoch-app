import { createHash, randomUUID } from "node:crypto";
import { CATALOG_V2 } from "../data/catalogV2";
import { Request, Response } from "express";
import type { UploadedFile } from "express-fileupload";
import prisma from "../db/db.config";
import { ApiError, ok } from "../utils/http";
import { logError } from "../utils/logger";
import {
  MAX_ATTACHMENTS,
  loadOwnedOrder,
  serializeAttachment,
} from "../services/orders";
import { detectImageType, getStorage } from "../services/storage";
import {
  findReplay,
  isUniqueViolation,
  purgeExpiredKey,
  readIdempotencyKey,
  recordKey,
} from "../services/idempotency";

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; role: string };
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const KINDS = ["REFERRAL"] as const;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

function requireStorage() {
  const storage = getStorage();
  if (!storage) {
    throw new ApiError(
      503,
      "STORAGE_UNAVAILABLE",
      "Файл хадгалах сан тохируулагдаагүй байна. Түр хүлээнэ үү",
    );
  }
  return storage;
}

function assertEditable(order: { status: string; redFlagStatus: string }) {
  if (
    order.status === "BLOCKED_RED_FLAG" ||
    order.redFlagStatus === "FLAGGED"
  ) {
    throw new ApiError(
      409,
      "RED_FLAG_BLOCKED",
      "Энэ захиалга аюулын шинжийн асуулгаар хаагдсан",
    );
  }
  if (order.status !== "DRAFT")
    throw new ApiError(
      409,
      "ORDER_NOT_EDITABLE",
      "Зөвхөн ноорог захиалгад файл нэмнэ/устгана",
    );
}

// POST /api/orders/:id/attachments  (multipart: file, kind=REFERRAL; optional Idempotency-Key)
export const uploadAttachment = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const userId = req.user!.userId;
  const order = await loadOwnedOrder(req.params.id, userId);
  assertEditable(order);
  const storage = requireStorage();

  const raw = req.files?.file;
  if (!raw)
    throw new ApiError(400, "VALIDATION_ERROR", "Файл сонгоно уу", {
      file: "Шаардлагатай",
    });
  if (Array.isArray(raw))
    throw new ApiError(400, "VALIDATION_ERROR", "Нэг удаад нэг файл илгээнэ", {
      file: "Нэг файл",
    });
  const file = raw as UploadedFile;
  const kind = (req.body?.kind ?? "REFERRAL") as string;
  if (!(KINDS as readonly string[]).includes(kind)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Файлын төрөл буруу", {
      kind: "Зөвхөн REFERRAL",
    });
  }
  if (file.truncated || file.size > MAX_FILE_BYTES) {
    throw new ApiError(413, "FILE_TOO_LARGE", "Файл 10 MB-аас их байна");
  }
  // Real type from the bytes; client filename/extension/Content-Type are ignored
  const mimeType = detectImageType(file.data);
  if (!mimeType) {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Зөвхөн JPEG эсвэл PNG зураг илгээнэ",
    );
  }
  const sha256 = createHash("sha256").update(file.data).digest("hex");

  const key = readIdempotencyKey(req);
  const scope = `attachments.create:${order.id}`;
  const requestHash = `${kind}:${sha256}`;
  const replay = async () => {
    const row = key && (await findReplay(userId, scope, key, requestHash));
    if (!row) return null;
    const existing = await prisma.attachment.findFirst({
      where: { id: row.resourceId, orderId: order.id },
    });
    if (!existing) return null;
    res.setHeader("Idempotent-Replayed", "true");
    return ok(
      res,
      {
        attachment: serializeAttachment(existing),
        storage: existing.storageDriver,
        idempotentReplay: true,
      },
      "Файл хадгалагдсан байна",
      201,
    );
  };
  if (key) {
    await purgeExpiredKey(userId, scope, key);
    const replayed = await replay();
    if (replayed) return replayed;
  }

  // Random object key; nothing derived from the user's filename
  const storageKey = `orders/${order.id}/${randomUUID()}.${EXT[mimeType]}`;
  await storage.put(storageKey, file.data);

  try {
    const attachment = await prisma.$transaction(async (tx) => {
      // Serialise uploads per order so the 5-file limit holds under concurrency
      await tx.$executeRaw`SELECT 1 FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
      const current = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      assertEditable(current);
      const count = await tx.attachment.count({
        where: { orderId: order.id, status: "ACTIVE" },
      });
      if (
        count >=
        Math.min(
          MAX_ATTACHMENTS,
          ...order.items.map(
            (i) =>
              CATALOG_V2.find((s) => s.code === i.serviceCode)?.formConfig
                .attachmentLimit ?? MAX_ATTACHMENTS,
          ),
        )
      ) {
        throw new ApiError(
          409,
          "ATTACHMENT_LIMIT",
          `Нэг захиалгад хамгийн ихдээ ${MAX_ATTACHMENTS} файл`,
        );
      }
      const created = await tx.attachment.create({
        data: {
          orderId: order.id,
          uploaderId: userId,
          kind,
          storageDriver: storage.driver,
          storageKey,
          mimeType,
          sizeBytes: file.data.length,
          sha256,
        },
      });
      // Attachments change what a quote is based on (referral requirement)
      await tx.order.update({
        where: { id: order.id },
        data: { version: { increment: 1 } },
      });
      if (key)
        await recordKey(tx, {
          userId,
          scope,
          key,
          requestHash,
          resourceType: "Attachment",
          resourceId: created.id,
        });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "ATTACHMENT_ADDED",
          actorId: userId,
          metadata: { kind },
        },
      });
      return created;
    });
    return ok(
      res,
      {
        attachment: serializeAttachment(attachment),
        storage: storage.driver,
        idempotentReplay: false,
      },
      "Файл хадгалагдлаа",
      201,
    );
  } catch (err) {
    await storage
      .remove(storageKey)
      .catch((e) => logError("attachment cleanup", e));
    if (key && isUniqueViolation(err)) {
      const replayed = await replay();
      if (replayed) return replayed;
    }
    throw err;
  }
};

// GET /api/orders/:id/attachments
export const listAttachments = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const order = await loadOwnedOrder(req.params.id, req.user!.userId);
  return ok(
    res,
    { attachments: order.attachments.map(serializeAttachment) },
    "Файлууд",
  );
};

async function loadOwnedAttachment(req: AuthenticatedRequest) {
  const order = await loadOwnedOrder(req.params.id, req.user!.userId);
  const attachment = await prisma.attachment.findFirst({
    where: { id: req.params.attachmentId, orderId: order.id, status: "ACTIVE" },
  });
  if (!attachment)
    throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Файл олдсонгүй");
  return { order, attachment };
}

// GET /api/orders/:id/attachments/:attachmentId/content — authorised read (owner only)
export const readAttachment = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const { attachment } = await loadOwnedAttachment(req);
  const storage = requireStorage();
  if (storage.driver !== attachment.storageDriver) {
    throw new ApiError(
      503,
      "STORAGE_UNAVAILABLE",
      "Файл хадгалсан сан одоо ашиглах боломжгүй",
    );
  }
  const data = await storage.get(attachment.storageKey);
  if (!data) throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Файл олдсонгүй");
  res.setHeader("Content-Type", attachment.mimeType);
  res.setHeader("Content-Length", String(data.length));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  res.status(200).end(data);
};

// DELETE /api/orders/:id/attachments/:attachmentId
export const deleteAttachment = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const { order, attachment } = await loadOwnedAttachment(req);
  assertEditable(order);
  const storage = requireStorage();

  await prisma.$transaction(async (tx) => {
    const updated = await tx.attachment.updateMany({
      where: { id: attachment.id, status: "ACTIVE" },
      data: { status: "DELETED", deletedAt: new Date() },
    });
    if (!updated.count)
      throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Файл олдсонгүй");
    await tx.order.update({
      where: { id: order.id },
      data: { version: { increment: 1 } },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "ATTACHMENT_DELETED",
        actorId: req.user!.userId,
        metadata: { kind: attachment.kind },
      },
    });
  });
  // Blob is removed after the record is marked deleted (private data is not kept)
  await storage
    .remove(attachment.storageKey)
    .catch((e) => logError("attachment delete blob", e));
  res.status(204).end();
};
