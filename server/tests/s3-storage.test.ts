import { it, after } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { S3Client } from "@aws-sdk/client-s3";
import { s3Storage } from "../src/services/s3Storage";
import { prisma, createUser, loginAs, startServer } from "./helpers";
import { cleanupBlobs } from "../src/services/blobCleanup";
import { getStorage } from "../src/services/storage";
after(() => prisma.$disconnect());
it("SDK signed PUT/GET/DELETE stays private, returns bytes and maps storage errors safely", async () => {
  process.env.S3_BUCKET = "test-private-bucket";
  process.env.S3_REGION = "test-region";
  const requests: { method: string; headers: Record<string, string> }[] = [];
  let fail = false;
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 1]);
  const client = new S3Client({
    region: "test-region",
    credentials: { accessKeyId: "test-key", secretAccessKey: "test-secret" },
    maxAttempts: 1,
    requestHandler: {
      handle: async (request: {
        method: string;
        headers: Record<string, string>;
      }) => {
        requests.push({ method: request.method, headers: request.headers });
        return {
          response: {
            statusCode: fail ? 503 : 200,
            headers: {
              "content-type": "application/octet-stream",
              "content-length":
                request.method === "GET" ? String(bytes.length) : "0",
            },
            body: Readable.from(
              request.method === "GET" && !fail ? [bytes] : [],
            ),
          },
        };
      },
    },
  });
  const storage = s3Storage(client)!;
  const key = "orders/test-order/image.jpg";
  await storage.put(key, bytes);
  assert.deepEqual(await storage.get(key), bytes);
  await storage.remove(key);
  assert.deepEqual(
    requests.map((r) => r.method),
    ["PUT", "GET", "DELETE"],
  );
  assert.equal(requests[0].headers["x-amz-acl"], undefined);
  assert.equal(requests[0].headers["cache-control"], "private, no-store");
  fail = true;
  await assert.rejects(
    () => storage.put(key, bytes),
    (e: unknown) =>
      e instanceof Error &&
      e.message === "Зураг хадгалах үйлчилгээ түр боломжгүй байна",
  );
  await assert.rejects(() => storage.get("../public"));
  client.destroy();
  delete process.env.S3_BUCKET;
  delete process.env.S3_REGION;
});
it("orphan cleanup retries queued blobs; cleanup records completion", async () => {
  process.env.STORAGE_DRIVER = "memory";
  const storage = getStorage()!;
  await storage.put("orphan", Buffer.from("test"));
  await prisma.blobCleanupJob.create({
    data: {
      storageKey: "orphan",
      storageDriver: "memory",
      createdAt: new Date(Date.now() - 11 * 60000),
    },
  });
  const result = await cleanupBlobs();
  assert.equal(result.removed, 1);
  assert.equal(await storage.get("orphan"), null);
  assert.ok(
    (
      await prisma.blobCleanupJob.findUniqueOrThrow({
        where: { storageKey: "orphan" },
      })
    ).completedAt,
  );
});

it("cleanup never removes an ACTIVE attachment after an interrupted response", async () => {
  process.env.STORAGE_DRIVER = "memory";
  const storage = getStorage()!;
  const user = await createUser("CHILD");
  const parent = await prisma.parent.create({
    data: {
      name: "Тест",
      age: 30,
      gender: "Other",
      address: "Тест",
      emergencyContact: "99112233",
      children: { connect: { id: user.id } },
    },
  });
  const order = await prisma.order.create({
    data: { childId: user.id, parentId: parent.id, catalogVersion: "TEST" },
  });
  const key = `orders/${order.id}/active.jpg`;
  await storage.put(key, Buffer.from("active"));
  await prisma.attachment.create({
    data: {
      orderId: order.id,
      uploaderId: user.id,
      storageKey: key,
      storageDriver: "memory",
      mimeType: "image/jpeg",
      sizeBytes: 6,
      sha256: "test",
    },
  });
  await prisma.blobCleanupJob.create({
    data: {
      storageKey: key,
      storageDriver: "memory",
      createdAt: new Date(Date.now() - 11 * 60000),
    },
  });
  await cleanupBlobs();
  assert.equal((await storage.get(key))?.toString(), "active");
  assert.ok(
    (
      await prisma.blobCleanupJob.findUniqueOrThrow({
        where: { storageKey: key },
      })
    ).completedAt,
  );
});

it("upload rollback and failed blob removal retain a durable job for retry", async () => {
  process.env.STORAGE_DRIVER = "memory";
  const srv = await startServer();
  const user = await createUser("CHILD");
  const token = await loginAs(srv.baseUrl, user.email);
  const parent = await prisma.parent.create({
    data: {
      name: "Тест",
      age: 30,
      gender: "Other",
      address: "Тест",
      emergencyContact: "99112233",
      children: { connect: { id: user.id } },
    },
  });
  const order = await prisma.order.create({
    data: { childId: user.id, parentId: parent.id, catalogVersion: "TEST" },
  });
  const storage = getStorage()!,
    originalPut = storage.put,
    originalRemove = storage.remove;
  let key = "";
  try {
    storage.put = async (k, bytes) => {
      key = k;
      await originalPut(k, bytes);
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "BLOCKED_RED_FLAG", redFlagStatus: "FLAGGED" },
      });
    };
    storage.remove = async () => {
      throw new Error("synthetic storage timeout");
    };
    const body = new FormData();
    body.append(
      "file",
      new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1])], { type: "image/jpeg" }),
      "test.jpg",
    );
    const response = await fetch(
      srv.baseUrl + `/api/orders/${order.id}/attachments`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` }, body },
    );
    assert.equal(response.status, 409);
    assert.equal(
      await prisma.attachment.count({ where: { orderId: order.id } }),
      0,
    );
    assert.ok(await storage.get(key));
    const job = await prisma.blobCleanupJob.findUniqueOrThrow({
      where: { storageKey: key },
    });
    assert.equal(job.completedAt, null);
    await prisma.blobCleanupJob.update({
      where: { id: job.id },
      data: { createdAt: new Date(Date.now() - 11 * 60000) },
    });
    assert.equal((await cleanupBlobs()).failed, 1);
    storage.remove = originalRemove;
    assert.equal((await cleanupBlobs()).removed, 1);
    assert.equal(await storage.get(key), null);
  } finally {
    storage.put = originalPut;
    storage.remove = originalRemove;
    await srv.close();
  }
});
