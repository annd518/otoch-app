// A nurse's application and its admin review (spec N-01, A-01, slide 35).
// The nurse fills it in the nurse app and sends it; only an admin turns it
// into VERIFIED (or REJECTED with a reason). Dispatch already offers orders to
// VERIFIED nurses with a valid licence only (services/dispatch.ts).
import type { NurseDocument, NurseProfile } from "@prisma/client";

export const DOCUMENT_KINDS = ["LICENSE", "DIPLOMA", "ID_CARD", "PORTRAIT"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  LICENSE: "Мэргэжлийн зөвшөөрөл",
  DIPLOMA: "Диплом",
  ID_CARD: "Иргэний үнэмлэх",
  PORTRAIT: "Цээж зураг",
};

/** A licence must stay valid at least this long when the application is sent (slide 35). */
export const MIN_LICENSE_DAYS = 30;
/** Slide 35 asks for this much experience; shown to the admin, not enforced. */
export const RECOMMENDED_EXPERIENCE_YEARS = 3;

export type ApplicationState = "DRAFT" | "SUBMITTED" | "VERIFIED" | "REJECTED" | "SUSPENDED";

/** DRAFT = not sent yet; SUBMITTED = waiting for an admin. */
export function applicationState(p: Pick<NurseProfile, "status" | "submittedAt">): ApplicationState {
  if (p.status === "PENDING") return p.submittedAt ? "SUBMITTED" : "DRAFT";
  return p.status;
}

/** The nurse can change the application only before sending it or after a rejection. */
export const isEditable = (p: Pick<NurseProfile, "status" | "submittedAt">) => {
  const s = applicationState(p);
  return s === "DRAFT" || s === "REJECTED";
};

type ProfileWithDocs = Pick<
  NurseProfile,
  "licenseNo" | "licenseExpiresAt" | "employer" | "experienceYears" | "districts"
> & { documents: Pick<NurseDocument, "kind">[] };

/** What is still missing before the application can be sent (Mongolian labels). */
export function missingItems(p: ProfileWithDocs, name: string, now: Date): string[] {
  const missing: string[] = [];
  if (name.trim().length < 2) missing.push("Овог нэр");
  if (!p.licenseNo) missing.push("Зөвшөөрлийн дугаар");
  if (!p.licenseExpiresAt) missing.push("Зөвшөөрлийн дуусах огноо");
  else if (p.licenseExpiresAt.getTime() < now.getTime() + MIN_LICENSE_DAYS * 86400000)
    missing.push(`Зөвшөөрөл ${MIN_LICENSE_DAYS}-аас дээш хоног хүчинтэй байх`);
  if (!p.employer) missing.push("Ажлын газар");
  if (p.experienceYears === null || p.experienceYears === undefined) missing.push("Ажилласан жил");
  if (p.districts.length === 0) missing.push("Ажиллах дүүрэг");
  const have = new Set(p.documents.map((d) => d.kind));
  for (const kind of DOCUMENT_KINDS) if (!have.has(kind)) missing.push(DOCUMENT_LABEL[kind]);
  return missing;
}

/** "YYYY-MM-DD" as the end of that day in Ulaanbaatar (UTC+8). */
export function ubEndOfDay(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = Date.UTC(y, mo - 1, d, 23, 59, 59) - 8 * 3600000;
  const check = new Date(utc + 8 * 3600000);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d)
    return null;
  return new Date(utc);
}

/** The date part of a stored expiry, in Ulaanbaatar time ("YYYY-MM-DD"). */
export const ubDate = (d: Date) => new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 10);
