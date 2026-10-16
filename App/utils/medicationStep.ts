// Booking step 3: the medicine name, dose and route are either typed in or
// given as a photo of the prescription (next step). The expiry date and the
// dose number are always asked: they are safety checks (server: MED_EXPIRED,
// FIRST_DOSE_NOT_ALLOWED) and are not on a prescription.
import type { BookingForm } from "../services/apiTypes";
import { isValidCalendarDate } from "./datetime";

/** Digits only, formatted as YYYY-MM-DD while typing ("20270315" -> "2027-03-15"). */
export function formatDateInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join("-");
}

/** The stored expiry: end of that day in Ulaanbaatar, or "" until the date is complete and real. */
export function expiryFromInput(text: string): string {
  return isValidCalendarDate(text) ? `${text}T23:59:59+08:00` : "";
}

/** Message under the expiry field, or null (nothing typed yet / still typing / fine). */
export function expiryProblem(
  text: string,
  scheduledAt: number,
  now: Date,
): string | null {
  if (text.length < 10) return null;
  if (!isValidCalendarDate(text))
    return "Огноо буруу байна. Жишээ нь: 2027-03-15";
  const expires = Date.parse(expiryFromInput(text));
  if (expires < now.getTime()) return "Эмийн хугацаа дууссан байна.";
  if (Number.isFinite(scheduledAt) && expires <= scheduledAt)
    return "Эмийн хугацаа үйлчилгээний өдрөөс өмнө дуусна.";
  return null;
}

export type MedicationSource = NonNullable<BookingForm["medicationSource"]>;

export interface MedicationRules {
  required: boolean;
  firstDoseCheck: boolean;
  // service start (ms); NaN when the slot is not chosen yet
  scheduledAt: number;
  // prescription photos already stored on the server
  uploadedPhotos: number;
}

/** What is still missing in the medication part, in screen order; [] when done. */
export function medicationMissing(
  form: BookingForm,
  rules: MedicationRules,
): string[] {
  if (!rules.required && form.medication === null) return [];
  if (!form.medicationSource) return ["оруулах арга (зураг эсвэл гараар)"];
  const m = form.medication;
  if (!m) return ["эмийн мэдээлэл"];
  const missing: string[] = [];
  if (form.medicationSource === "PHOTO" && rules.uploadedPhotos === 0)
    missing.push("жорын зураг");
  if (form.medicationSource === "TEXT") {
    if (!m.name.trim()) missing.push("эмийн нэр");
    if (!m.dose.trim()) missing.push("тун");
    if (!m.route.trim()) missing.push("хэрэглэх арга");
  }
  const expires = Date.parse(m.expiresAt);
  if (!Number.isFinite(expires)) missing.push("хугацаа дуусах огноо");
  else if (!(expires > rules.scheduledAt))
    missing.push("үйлчилгээний өдрөөс хойш дуусах хугацаа");
  if (rules.firstDoseCheck && m.doseNumber < 2) missing.push("хэд дэх тун (2+)");
  return missing;
}
