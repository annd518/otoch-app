import type { Parent } from "../services/apiTypes";

// Compatibility for old synthetic seed data only. Real accounts are unchanged.
export function demoPatientName(
  email: string | undefined,
  name: string,
): string {
  if (email !== "child@demo.com") return name;
  return (
    (
      { "Anita Sharma": "Д. Цэцэг", "Hari Sharma": "Б. Бат" } as Record<
        string,
        string
      >
    )[name] ?? name
  );
}

export function demoPatient(
  email: string | undefined,
  patient: Parent,
): Parent {
  const name = demoPatientName(email, patient.name);
  if (name === patient.name) return patient;
  return {
    ...patient,
    name,
    address: "Улаанбаатар, Баянзүрх дүүрэг, 26-р хороо, Дүнжингарав хороолол",
    emergencyContact: patient.name === "Anita Sharma" ? "99000001" : "99000002",
    diseases:
      patient.name === "Anita Sharma"
        ? "Даралт ихсэлт, чихрийн шижин"
        : "Үе мөчний өвдөлт",
    medications: null,
  };
}
