// Referral image rules (docs/l1-1-api.md §5): JPEG or PNG only, at most 10 MB
// each and 5 per order. HEIC must be converted before upload; PDF is not
// supported in L1-1 (decision D12 pending).

export const MAX_REFERRAL_FILES = 5;
export const MAX_REFERRAL_BYTES = 10 * 1024 * 1024;

export interface PickedAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}

export type AssetCheck =
  | {
      ok: true;
      name: string;
      mimeType: "image/jpeg" | "image/png";
      sizeBytes: number | null;
    }
  | {
      ok: false;
      reason: "heic" | "pdf" | "unsupported" | "too_large";
      message: string;
    };

function extensionOf(value: string): string {
  const clean = value.split(/[?#]/)[0] ?? "";
  const dot = clean.lastIndexOf(".");
  return dot === -1 ? "" : clean.slice(dot + 1).toLowerCase();
}

export function checkPickedAsset(asset: PickedAsset): AssetCheck {
  const mime = (asset.mimeType ?? "").toLowerCase();
  const ext = extensionOf(asset.fileName || asset.uri);
  let mimeType: "image/jpeg" | "image/png" | null = null;
  if (
    mime === "image/jpeg" ||
    mime === "image/jpg" ||
    (!mime && (ext === "jpg" || ext === "jpeg"))
  )
    mimeType = "image/jpeg";
  else if (mime === "image/png" || (!mime && ext === "png"))
    mimeType = "image/png";

  if (!mimeType) {
    if (
      mime.includes("heic") ||
      mime.includes("heif") ||
      ext === "heic" ||
      ext === "heif"
    ) {
      return {
        ok: false,
        reason: "heic",
        message:
          "HEIC зургийг JPEG болгож чадсангүй. Өөр зураг сонгох эсвэл камераар дахин авна уу.",
      };
    }
    if (mime === "application/pdf" || ext === "pdf") {
      return {
        ok: false,
        reason: "pdf",
        message: "PDF файл одоогоор дэмжигдэхгүй. Заалтын зургийг оруулна уу.",
      };
    }
    return {
      ok: false,
      reason: "unsupported",
      message: "Зөвхөн JPEG эсвэл PNG зураг оруулна уу.",
    };
  }
  const size =
    typeof asset.fileSize === "number" && asset.fileSize > 0
      ? asset.fileSize
      : null;
  if (size !== null && size > MAX_REFERRAL_BYTES) {
    return {
      ok: false,
      reason: "too_large",
      message: "Зургийн хэмжээ 10 MB-аас их байна.",
    };
  }
  const baseName =
    (asset.fileName || "").trim() ||
    `referral.${mimeType === "image/png" ? "png" : "jpg"}`;
  return { ok: true, name: baseName, mimeType, sizeBytes: size };
}

export function remainingSlots(
  currentCount: number,
  limit = MAX_REFERRAL_FILES,
): number {
  return Math.max(0, Math.min(MAX_REFERRAL_FILES, limit) - currentCount);
}

export type PermissionUiState = "granted" | "ask" | "blocked";

// expo-image-picker permission response -> what the screen should show.
export function permissionUiState(response: {
  granted: boolean;
  canAskAgain: boolean;
}): PermissionUiState {
  if (response.granted) return "granted";
  return response.canAskAgain ? "ask" : "blocked";
}
