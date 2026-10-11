import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { BlobStorage } from "./storage";
import { ApiError } from "../utils/http";
export function s3Storage(clientOverride?: S3Client): BlobStorage | null {
  const {
    S3_BUCKET: bucket,
    S3_REGION: region,
    S3_ENDPOINT: endpoint,
    S3_ACCESS_KEY_ID: accessKeyId,
    S3_SECRET_ACCESS_KEY: secretAccessKey,
  } = process.env;
  if (
    !bucket ||
    !region ||
    (endpoint && !endpoint.startsWith("https://")) ||
    !!accessKeyId !== !!secretAccessKey
  )
    return null;
  const client =
    clientOverride ??
    new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
      maxAttempts: 2,
      requestHandler: { connectionTimeout: 5000, requestTimeout: 15000 },
    });
  const keyCheck = (key: string) => {
    if (!/^orders\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(key))
      throw new ApiError(
        503,
        "STORAGE_UNAVAILABLE",
        "Хадгалалтын key буруу байна",
      );
  };
  const call = async <T>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch {
      throw new ApiError(
        503,
        "STORAGE_UNAVAILABLE",
        "Зураг хадгалах үйлчилгээ түр боломжгүй байна",
      );
    }
  };
  return {
    driver: "s3",
    async put(key, data) {
      keyCheck(key);
      await call(() =>
        client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: data,
            ContentType: data[0] === 0xff ? "image/jpeg" : "image/png",
            CacheControl: "private, no-store",
          }),
          { abortSignal: AbortSignal.timeout(20000) },
        ),
      );
    },
    async get(key) {
      keyCheck(key);
      try {
        const r = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
          { abortSignal: AbortSignal.timeout(20000) },
        );
        if ((r.ContentLength ?? 0) > 10 * 1024 * 1024)
          throw new Error("oversize");
        const bytes = await r.Body?.transformToByteArray();
        if (bytes && bytes.length > 10 * 1024 * 1024)
          throw new Error("oversize");
        return bytes ? Buffer.from(bytes) : null;
      } catch (e) {
        if (e instanceof Error && e.name === "NoSuchKey") return null;
        throw new ApiError(
          503,
          "STORAGE_UNAVAILABLE",
          "Зураг унших үйлчилгээ түр боломжгүй байна",
        );
      }
    },
    async remove(key) {
      keyCheck(key);
      await call(() =>
        client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
          abortSignal: AbortSignal.timeout(20000),
        }),
      );
    },
  };
}
