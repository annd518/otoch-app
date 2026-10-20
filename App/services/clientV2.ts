import type { HttpClient } from "./httpClient";
import { isRecord } from "./apiResult";
import { zoneBounds, type ZoneBounds } from "../utils/geo";
export interface Zone {
  id: string;
  name: string;
  // null when the server sends no/invalid bounds: the zone is listed but not drawn
  bounds: ZoneBounds | null;
}
export interface Slot {
  id: string;
  startsAt: string;
  endsAt: string;
}
export interface ClinicalRecord {
  source?: "legacy" | "nurse";
  orderId?: string;
  nurseName?: string | null;
  id: string;
  patientName: string;
  at: string;
  notes: string | null;
  pdfAvailable: boolean;
}
export const clientV2 = (client: HttpClient) => ({
  zones: () =>
    client.request<Zone[]>({
      method: "GET",
      path: "/api/client/zones",
      parse: (data) =>
        isRecord(data) &&
        Array.isArray(data.zones) &&
        data.zones.every(
          (z) =>
            isRecord(z) &&
            typeof z.id === "string" &&
            typeof z.name === "string",
        )
          ? data.zones.map((z: Record<string, unknown>) => ({
              id: z.id as string,
              name: z.name as string,
              bounds: zoneBounds(z),
            }))
          : null,
    }),
  availability: (zoneId: string, date: string, serviceCode: string) =>
    client.request<Slot[]>({
      method: "GET",
      path: `/api/client/availability?zoneId=${encodeURIComponent(zoneId)}&date=${encodeURIComponent(date)}&serviceCode=${encodeURIComponent(serviceCode)}`,
      parse: (data) =>
        isRecord(data) &&
        Array.isArray(data.slots) &&
        data.slots.every(
          (s) =>
            isRecord(s) &&
            typeof s.id === "string" &&
            typeof s.startsAt === "string" &&
            typeof s.endsAt === "string",
        )
          ? (data.slots as Slot[])
          : null,
    }),
  records: () =>
    client.request<ClinicalRecord[]>({
      method: "GET",
      path: "/api/client/records",
      parse: (data) =>
        isRecord(data) &&
        Array.isArray(data.records) &&
        data.records.every(
          (r) =>
            isRecord(r) &&
            typeof r.id === "string" &&
            typeof r.patientName === "string" &&
            typeof r.at === "string" &&
            (r.notes === null || typeof r.notes === "string"),
        )
          ? (data.records as ClinicalRecord[])
          : null,
    }),
  deleteAccount: () =>
    client.request<{ id: string }>({
      method: "POST",
      path: "/api/client/account/deletion-request",
      body: {},
      parse: (data) =>
        isRecord(data) && typeof data.id === "string" ? { id: data.id } : null,
    }),
});
