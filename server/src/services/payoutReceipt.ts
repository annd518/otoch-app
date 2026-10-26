// Receipt of one payout to a nurse (spec slide 83: "долоо хоногийн төлбөрийн
// баримт PDF"): which visits it covered, the commission and the net. It is the
// company's own statement, not an e-barimt (tax receipt).
//
// The nurse app opens it in the phone's browser through a short-lived signed
// link (no login header there), like the signed URLs of the spec (10 minutes).
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { recordPdf } from "./recordPdf";

export const RECEIPT_LINK_TTL_MS = 10 * 60000;

const mnt = (n: number) => `${n.toLocaleString("en-US")}₮`;
const ub = (d: Date, withTime = false) => {
  const s = new Date(d.getTime() + 8 * 3600000).toISOString();
  return withTime ? `${s.slice(0, 10)} ${s.slice(11, 16)}` : s.slice(0, 10);
};
export const receiptNo = (payoutId: string) => payoutId.slice(-8).toUpperCase();

/** The PDF bytes, or null when the payout does not exist (or is not this nurse's). */
export async function payoutReceiptPdf(
  prisma: PrismaClient,
  payoutId: string,
  nurseId?: string,
): Promise<{ bytes: Uint8Array; fileName: string } | null> {
  const payout = await prisma.payout.findFirst({
    where: { id: payoutId, ...(nurseId && { nurseId }) },
    include: {
      nurse: { select: { name: true } },
      entries: {
        orderBy: { earnedAt: "asc" },
        include: { order: { select: { items: { select: { service: { select: { name: true } } } } } } },
      },
    },
  });
  if (!payout) return null;
  const gross = payout.entries.reduce((s, e) => s + e.grossMnt, 0);
  const commission = payout.entries.reduce((s, e) => s + e.commissionMnt, 0);
  const lines = [
    "ОТОЧ · Сувилагчийн орлогын баримт",
    `Баримт №: ${receiptNo(payout.id)}`,
    `Сувилагч: ${payout.nurse.name}`,
    `Хамрах хугацаа: ${ub(payout.periodFrom)} – ${ub(payout.periodTo)}`,
    `Шилжүүлсэн огноо: ${ub(payout.paidAt)}`,
    `Гүйлгээний утга: ${payout.reference}`,
    "",
    "Эргэлтүүд:",
    ...payout.entries.map(
      (e, i) =>
        `${i + 1}. ${ub(e.earnedAt, true)} · ${e.order.items.map((x) => x.service.name).join(", ") || "Үйлчилгээ"} · ` +
        `үнэ ${mnt(e.grossMnt)} · шимтгэл ${e.commissionPct}% ${mnt(e.commissionMnt)} · сувилагчид ${mnt(e.netMnt)}`,
    ),
    "",
    `Нийт эргэлт: ${payout.visits}`,
    `Нийт үнэ: ${mnt(gross)}`,
    `Компанийн шимтгэл: ${mnt(commission)}`,
    `Сувилагчид олгосон: ${mnt(payout.totalMnt)}`,
    "",
    "Энэ баримтыг ОТОЧ систем автоматаар үүсгэсэн. И-баримт (татварын баримт) биш.",
  ];
  return { bytes: await recordPdf(lines), fileName: `otoch-payout-${receiptNo(payout.id)}.pdf` };
}

// ---- signed link: payoutId.nurseId.expiresAtMs.signature (base64url)
const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return s;
};
const sign = (body: string) => createHmac("sha256", secret()).update(`payout-receipt:${body}`).digest("base64url");

export function receiptToken(payoutId: string, nurseId: string, now = Date.now()) {
  const expiresAt = now + RECEIPT_LINK_TTL_MS;
  const body = Buffer.from(JSON.stringify([payoutId, nurseId, expiresAt])).toString("base64url");
  return { token: `${body}.${sign(body)}`, expiresAt: new Date(expiresAt) };
}

/** {payoutId, nurseId} for a valid, unexpired token; null otherwise. */
export function readReceiptToken(token: string, now = Date.now()): { payoutId: string; nurseId: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const [payoutId, nurseId, expiresAt] = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payoutId !== "string" || typeof nurseId !== "string" || typeof expiresAt !== "number") return null;
    return expiresAt > now ? { payoutId, nurseId } : null;
  } catch {
    return null;
  }
}
