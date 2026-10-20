import { s3Storage } from "./s3Storage";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Private blob storage for referral images.
 * - memory:    tests only (process memory)
 * - local-dev: development only, files under server/.local-uploads (gitignored, never served statically)
 * - s3:        staging/production private bucket, authenticated API access only
 * Nothing here is reachable through the public /uploads static route.
 */
export type StorageDriver = "memory" | "local-dev" | "s3";

export interface BlobStorage {
  driver: StorageDriver;
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

const memoryBlobs = new Map<string, Buffer>();

/** Test helper: keys currently held by the memory adapter (used to detect orphan blobs) */
export const memoryStorageKeys = () => [...memoryBlobs.keys()];

const memoryStorage: BlobStorage = {
  driver: "memory",
  async put(key, data) {
    memoryBlobs.set(key, Buffer.from(data));
  },
  async get(key) {
    return memoryBlobs.get(key) ?? null;
  },
  async remove(key) {
    memoryBlobs.delete(key);
  },
};

function localDevStorage(): BlobStorage {
  const root = path.resolve(process.cwd(), ".local-uploads");
  const resolve = (key: string) => {
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep))
      throw new Error("invalid storage key");
    return full;
  };
  return {
    driver: "local-dev",
    async put(key, data) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data, { flag: "wx" });
    },
    async get(key) {
      try {
        return await readFile(resolve(key));
      } catch {
        return null;
      }
    },
    async remove(key) {
      await rm(resolve(key), { force: true });
    },
  };
}

/** Returns the configured storage, or null when no private storage is available. */
export function getStorage(): BlobStorage | null {
  const env = process.env.NODE_ENV;
  const driver =
    process.env.STORAGE_DRIVER || (env === "development" ? "local-dev" : "");
  if (driver === "memory" && env === "test") return memoryStorage;
  if (driver === "local-dev" && env !== "production") return localDevStorage();
  if (driver === "s3") return s3Storage();
  return null;
}

/** A nurse document: an image or a PDF, by magic bytes (spec N-01: зураг/PDF). */
export function detectDocumentType(
  buf: Buffer,
): "image/jpeg" | "image/png" | "application/pdf" | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-")
    return "application/pdf";
  return detectImageType(buf);
}

/** Real file type from magic bytes (extension and Content-Type are ignored) */
export function detectImageType(
  buf: Buffer,
): "image/jpeg" | "image/png" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length >= 8 && png.every((b, i) => buf[i] === b)) return "image/png";
  return null;
}
