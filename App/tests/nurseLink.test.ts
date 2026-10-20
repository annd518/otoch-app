import { strict as assert } from "node:assert";
import { test } from "node:test";
import { orderStatus } from "../design/catalog";
import { clientV2 } from "../services/clientV2";
import { createHttpClient } from "../services/httpClient";
test("customer tracking labels all nurse lifecycle outcomes without guessing a refund", () => {
  assert.equal(orderStatus("EN_ROUTE"), "Сувилагч замдаа");
  assert.equal(orderStatus("REFUSED"), "Үйлчилгээнээс татгалзсан");
  assert.equal(orderStatus("INCIDENT"), "Осол, хүндрэл бүртгэгдсэн");
  assert.equal(orderStatus("UNRECOGNIZED"), "Төлөв шинэчлэгдэж байна");
});
test("records client retains signed nurse source/order linkage alongside legacy notes", async () => {
  const rows = [
    {
      id: "order:test",
      orderId: "test",
      source: "nurse",
      patientName: "Тест",
      at: "2026-10-20T00:00:00Z",
      notes: "Тэмдэглэл",
      nurseName: "Тест сувилагч",
      pdfAvailable: true,
    },
    {
      id: "old",
      patientName: "Тест",
      at: "2026-10-19T00:00:00Z",
      notes: null,
      pdfAvailable: true,
    },
  ];
  const client = createHttpClient({
    config: {
      ok: true,
      baseUrl: "https://example.invalid",
      mode: "real",
      source: "explicit",
      mockRequestIgnored: false,
    },
    getToken: async () => null,
    fetch: async () => ({
      status: 200,
      text: async () =>
        JSON.stringify({ success: true, data: { records: rows } }),
    }),
  });
  const r = await clientV2(client).records();
  if (!r.ok) throw Error(r.message);
  assert.deepEqual(r.data, rows);
});
