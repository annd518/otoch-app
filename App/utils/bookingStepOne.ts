// What still blocks "Үргэлжлүүлэх" on booking step 1 (address, map point, zone, date, time).
// The button is enabled exactly when this list is empty, and the list is shown to the user,
// so a disabled button always says why. Unit tested in tests/bookingStepOne.test.ts.
export interface StepOneDetails {
  addressText: string;
  zoneId?: string;
  lat?: number;
  lng?: number;
  date?: string;
  timeSlot?: string;
}

export const MIN_ADDRESS_LENGTH = 5;

export function missingForStepOne(d: StepOneDetails): string[] {
  const missing: string[] = [];
  if (d.addressText.trim().length < MIN_ADDRESS_LENGTH)
    missing.push(`дэлгэрэнгүй хаяг (${MIN_ADDRESS_LENGTH}+ тэмдэгт)`);
  if (typeof d.lat !== "number" || typeof d.lng !== "number")
    missing.push("газрын зураг дээрх цэг");
  // the zone follows the map point: no zone = the point is outside every zone
  if (!d.zoneId && typeof d.lat === "number" && typeof d.lng === "number")
    missing.push("үйлчилгээний бүс доторх цэг");
  if (!d.date) missing.push("огноо");
  if (!d.timeSlot) missing.push("цаг");
  return missing;
}
