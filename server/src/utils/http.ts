import { Response } from "express";
import { ZodError } from "zod";

/**
 * Unified API response contract (docs/l1-1-api.md §0.1):
 *   success → { success: true,  message, data }
 *   failure → { success: false, message, error: { code, fields? } }
 * `message` is for people (Mongolian), `error.code` is for program logic.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "UNAUTHENTICATED"
  | "TOKEN_EXPIRED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "ROLE_NOT_ALLOWED"
  | "NOT_FOUND"
  | "PARENT_NOT_FOUND"
  | "VISIT_NOT_FOUND"
  | "NURSE_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "EMAIL_TAKEN"
  | "INVALID_STATUS"
  | "CONFLICT"
  | "ORDER_NOT_FOUND"
  | "ORDER_NOT_EDITABLE"
  | "VERSION_CONFLICT"
  | "CATALOG_OUTDATED"
  | "ORDER_INCOMPLETE"
  | "RED_FLAG_REQUIRED"
  | "RED_FLAG_INCOMPLETE"
  | "RED_FLAG_BLOCKED"
  | "QUESTIONNAIRE_OUTDATED"
  | "QUESTIONNAIRE_UNAVAILABLE"
  | "REFERRAL_REQUIRED"
  | "NOT_IMPLEMENTED"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "FILE_TOO_LARGE"
  | "ATTACHMENT_LIMIT"
  | "ATTACHMENT_NOT_FOUND"
  | "STORAGE_UNAVAILABLE"
  | "QUOTE_NOT_FOUND"
  | "QUOTE_EXPIRED"
  | "QUOTE_MISMATCH"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_IN_PROGRESS"
  | "PAYMENT_ALREADY_PAID"
  | "FIXTURE_DATA_NOT_ALLOWED"
  | "PAYMENT_UNCONFIRMED"
  | "PAYMENT_RECONCILIATION_REQUIRED"
  | "PAYMENT_PROVIDER_ERROR"
  | "PAYMENT_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE"
  | "CONSENT_REQUIRED"
  | "PATIENT_DETAILS_REQUIRED"
  | "FAMILY_REQUIRED"
  | "MEDICATION_REQUIRED"
  | "FIRST_DOSE_NOT_ALLOWED"
  | "MED_EXPIRED"
  | "AVAILABILITY_REQUIRED"
  | "OTP_INVALID"
  | "OTP_LOCKED"
  | "OTP_RATE_LIMIT"
  | "SMS_UNAVAILABLE"
  | "OFFER_NOT_FOUND"
  | "OFFER_EXPIRED"
  | "ORDER_TAKEN"
  | "NOT_ELIGIBLE"
  | "CHECKIN_TOO_FAR"
  | "CHECKIN_TIME_WINDOW"
  | "RECORD_INCOMPLETE"
  | "RECORD_REQUIRED"
  | "INTERNAL_ERROR";

export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public fields?: FieldErrors,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const ok = <T>(res: Response, data: T, message: string, status = 200) =>
  res.status(status).json({ success: true, message, data });

export const fail = (
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  fields?: FieldErrors,
) =>
  res
    .status(status)
    .json({
      success: false,
      message,
      error: fields ? { code, fields } : { code },
    });

/** Flatten a ZodError into { "field.path": "first message" } */
export const zodFields = (error: ZodError): FieldErrors => {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
};

export const validationError = (error: ZodError) =>
  new ApiError(
    400,
    "VALIDATION_ERROR",
    "Оруулсан мэдээлэл буруу байна",
    zodFields(error),
  );
