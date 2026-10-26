// Documents opened through a signed, short-lived link instead of a login
// header (the nurse app opens them in the phone's browser).
import { Router } from "express";
import prisma from "../db/db.config";
import { ApiError } from "../utils/http";
import { payoutReceiptPdf, readReceiptToken } from "../services/payoutReceipt";

export const receiptRoutes = Router();

// GET /api/receipts/payout/:token (from GET /api/nurse/payouts/:id/receipt-link)
receiptRoutes.get("/payout/:token", async (req, res) => {
  const claim = readReceiptToken(String(req.params.token));
  if (!claim) throw new ApiError(404, "PAYOUT_NOT_FOUND", "Холбоосын хугацаа дууссан эсвэл буруу байна");
  const pdf = await payoutReceiptPdf(prisma, claim.payoutId, claim.nurseId);
  if (!pdf) throw new ApiError(404, "PAYOUT_NOT_FOUND", "Шилжүүлэг олдсонгүй");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${pdf.fileName}"`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  return res.send(Buffer.from(pdf.bytes));
});
