// Customer rates a finished visit (spec SCR-C16): POST /api/orders/:id/rating
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../db/db.config";
import { ApiError, ok, validationError } from "../utils/http";
import { loadOwnedOrder, serializeOrder } from "../services/orders";
import { RATING_TAG_CODES, type RatingTag } from "../services/ratings";

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; role: string };
}

const ratingSchema = z
  .object({
    stars: z.number().int().min(1).max(5),
    tags: z
      .array(z.enum(RATING_TAG_CODES as [RatingTag, ...RatingTag[]]))
      .max(RATING_TAG_CODES.length)
      .optional(),
    comment: z.string().trim().max(1000).optional(),
  })
  .strict();

export const rateOrder = async (req: AuthenticatedRequest, res: Response) => {
  const p = ratingSchema.safeParse(req.body ?? {});
  if (!p.success) throw validationError(p.error);
  const userId = req.user!.userId;
  const order = await loadOwnedOrder(String(req.params.id), userId);
  if (order.status !== "COMPLETED" || !order.assignedNurseId)
    throw new ApiError(409, "NOT_RATEABLE", "Зөвхөн дууссан үйлчилгээг үнэлэх боломжтой");
  if (order.rating) throw new ApiError(409, "ALREADY_RATED", "Та энэ үйлчилгээг аль хэдийн үнэлсэн байна");
  const tags = [...new Set(p.data.tags ?? [])];
  try {
    await prisma.$transaction([
      prisma.nurseRating.create({
        data: {
          orderId: order.id,
          nurseId: order.assignedNurseId,
          clientId: userId,
          stars: p.data.stars,
          tags,
          comment: p.data.comment || null,
        },
      }),
      // the comment stays out of the audit trail (it may mention health details)
      prisma.orderEvent.create({
        data: { orderId: order.id, type: "RATING", actorId: userId, metadata: { stars: p.data.stars, tags } },
      }),
    ]);
  } catch (err) {
    // two taps at once: the unique orderId lets only one through
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
      throw new ApiError(409, "ALREADY_RATED", "Та энэ үйлчилгээг аль хэдийн үнэлсэн байна");
    throw err;
  }
  const updated = await loadOwnedOrder(order.id, userId);
  return ok(res, { order: serializeOrder(updated) }, "Үнэлгээ хадгалагдлаа. Баярлалаа!");
};
