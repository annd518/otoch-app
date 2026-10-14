import { strict as assert } from "node:assert";
import { test } from "node:test";
import { demoPatient, demoPatientName } from "../utils/demoPersona";
import type { Parent } from "../services/apiTypes";

const patient: Parent = {
  id: "sample-patient",
  name: "Anita Sharma",
  age: 78,
  gender: "Female",
  address: "Legacy demo address",
  diseases: null,
  medications: null,
  emergencyContact: "Legacy demo phone",
};

test("legacy synthetic patient is Mongolian only for the demo account", () => {
  const result = demoPatient("child@demo.com", patient);
  assert.equal(result.name, "Д. Цэцэг");
  assert.match(result.address, /^Улаанбаатар/);
  assert.equal(result.emergencyContact, "99000001");
  assert.equal(result.id, patient.id);
  assert.equal(patient.name, "Anita Sharma");
});
test("real accounts and unknown patients are not rewritten", () => {
  assert.equal(demoPatient("real@example.com", patient), patient);
  assert.equal(demoPatient(undefined, patient), patient);
  const custom = { ...patient, name: "Хэрэглэгчийн өөрийн нэр" };
  assert.equal(demoPatient("child@demo.com", custom), custom);
});
test("record patient names use the same account-scoped mapping", () => {
  assert.equal(demoPatientName("child@demo.com", "Hari Sharma"), "Б. Бат");
  assert.equal(
    demoPatientName("real@example.com", "Hari Sharma"),
    "Hari Sharma",
  );
});
