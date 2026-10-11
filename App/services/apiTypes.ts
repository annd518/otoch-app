// Shared API types. Field names follow the current server code and the
// backend proposal in docs/l1-1-api.md (not yet approved).

export const USER_ROLES = ["CHILD", "NURSE", "MEDICAL_ADMIN", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Parent {
  birthYear?: number | null;
  needsRepresentative?: boolean;
  id: string;
  name: string;
  age: number;
  gender: string;
  address: string;
  diseases: string | null;
  medications: string | null;
  emergencyContact: string;
}

export interface NewParentInput {
  birthYear?: number;
  needsRepresentative?: boolean;
  name: string;
  age: number;
  gender: string;
  address: string;
  diseases?: string;
  medications?: string;
  emergencyContact: string;
}

export type VisitType = "BASIC" | "FULL";

export interface Visit {
  id: string;
  parentId: string;
  scheduledFor: string;
  visitType: VisitType;
  status: string;
}

export interface NewVisitInput {
  parentId: string;
  scheduledFor: string;
  visitType: VisitType;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

// Catalog contract: docs/l1-1-api.md §2 and docs/l1-1-acceptance/README.md
export interface CatalogService {
  contentVersion?: string;
  approval?: {
    approved: boolean;
    approvedAt: string | null;
    approvedBy: string | null;
  };
  group?: string;
  sortOrder?: number;
  includes?: string[];
  preparation?: string[];
  nurseSupplies?: string[];
  exclusions?: string[];
  formConfig?: {
    windowMin: number;
    referral: string;
    medicationRequired: boolean;
    medicationFieldsVisible?: boolean;
    firstDoseCheck: boolean;
    familyPresence: string;
    attachmentLimit: number;
    approved: boolean;
  };

  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  priceMnt: number;
  durationMin: number;
  requiresReferral: boolean;
  redFlagQuestionnaire: string | null;
  isActive: boolean;
  // Backend marks fictional seed rows (work/backend-l1-1). Defaults to false.
  isFixture: boolean;
}

export interface Catalog {
  // null when the catalog has no active rows (backend implementation).
  catalogVersion: string | null;
  currency: "MNT";
  containsFixtures: boolean;
  services: CatalogService[];
}

// docs/l1-1-api.md §6 (proposal). The app only displays these values.
export interface QuoteLine {
  name: string;
  amountMnt: number;
  serviceId?: string;
  code?: string;
  quantity?: number;
  unitPriceMnt?: number;
}

export interface Quote {
  id: string;
  currency: "MNT";
  lines: QuoteLine[];
  subtotalMnt: number;
  // null when the server does not price them (listed in `excludes`)
  travelFeeMnt: number | null;
  discountMnt: number | null;
  totalMnt: number;
  pricingVersion: string;
  expiresAt: string;
  // true when prices come from fixture catalog rows
  isFixture: boolean;
  // order version the quote was made for; a newer order version makes it stale
  orderVersion: number | null;
  // price components not included (e.g. TRAVEL_FEE, DISCOUNT, VAT)
  excludes: string[];
}

// ---- Orders, red flags, attachments: docs/l1-1-api.md §3-§5 (proposal, not
// implemented on the server yet). Field names follow the proposal.

export type NurseGenderPreference = "ANY" | "FEMALE" | "MALE";

export interface DraftOrderItemInput {
  // The implemented server (work/backend-l1-1 d842241) resolves the service by
  // serviceCode and ignores serviceId; serviceId is kept for the original
  // proposal and for tracing.
  serviceId: string;
  serviceCode: string;
  quantity: number;
}

export interface BookingForm {
  consent: {
    catalogVersion?: string | null;
    service: boolean;
    sensitiveData: boolean;
    signer?: "RECIPIENT" | "REPRESENTATIVE";
    version: "V2_2026_10";
    acceptedAt: string;
  };
  familyPresent: boolean;
  postoperative: boolean;
  medication: {
    name: string;
    dose: string;
    route: string;
    expiresAt: string;
    doseNumber: number;
  } | null;
}
export interface DraftOrderInput {
  bookingForm?: BookingForm;
  zoneId?: string;
  parentId: string;
  items: DraftOrderItemInput[];
  // The server answers 409 CATALOG_OUTDATED when this does not match.
  catalogVersion: string | null;
  scheduledFor: string;
  timeSlot: string;
  address: { text: string; lat?: number; lng?: number };
  notes?: string;
  // In the proposal; the implemented server ignores it (GAP-16), so the app does not send it.
  nurseGenderPreference?: NurseGenderPreference;
}

// `notes: null` clears the note on the server.
export type DraftOrderPatch = Partial<
  Omit<DraftOrderInput, "parentId" | "notes">
> & { version: number; notes?: string | null };

export interface Order {
  catalogVersion?: string;
  address?: { text: string; lat?: number; lng?: number } | null;
  bookingForm?: BookingForm | null;
  zoneId?: string | null;
  isMock?: boolean;
  attachments?: Attachment[];

  nurse?: { name: string } | null;
  eta?: string | null;
  timeline?: { id: string; status: string; at: string }[];

  id: string;
  status: string;
  version: number;
  parentId: string;
  serviceCodes: string[];
  scheduledFor: string | null;
  timeSlot: string | null;
  redFlagStatus: string;
  requiresReferral: boolean;
  // null when the server does not say (proposal shape)
  referralUploadAvailable: boolean | null;
  // body fields the server did not store (data.ignoredFields)
  ignoredFields: string[];
}

export interface RedFlagQuestion {
  id: string;
  code: string;
  text: string;
  required: boolean;
  isFixture: boolean;
}

export interface RedFlagQuestionnaire {
  // Questionnaire codes for this order; empty means no questionnaire is required.
  questionnaires: string[];
  // true only when the server says a medical owner approved the wording.
  approved: boolean;
  containsFixtures: boolean;
  orderStatus: string | null;
  redFlagStatus: string | null;
  questions: RedFlagQuestion[];
}

export interface RedFlagAdvice {
  text: string;
  phone: string | null;
  isFixture: boolean;
}

export type RedFlagOutcome =
  | { status: "CLEAR"; orderStatus: string; version: number | null }
  | {
      status: "FLAGGED";
      orderStatus: string;
      version: number | null;
      triggeredCodes: string[];
      advice: RedFlagAdvice | null;
    };

export interface Attachment {
  id: string;
  kind: string;
  mimeType: string;
  sizeBytes: number;
  // server storage adapter, e.g. "local-dev" (development only) or null when not reported
  storage: string | null;
}
