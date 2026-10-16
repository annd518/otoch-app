// Booking step 3: the medicine name, dose and route are either typed in or
// given as a photo of the prescription (next step). The expiry date and the
// dose number are always asked: they are safety checks (server: MED_EXPIRED,
// FIRST_DOSE_NOT_ALLOWED) and are not on a prescription.
import type { BookingForm } from "../services/apiTypes";

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
