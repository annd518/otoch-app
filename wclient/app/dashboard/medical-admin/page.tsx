import { redirect } from "next/navigation";

// OTOCH v2.0 has no medical-admin role: the super-admin holds every right.
export default function MedicalAdminDashboardPage() {
  redirect("/dashboard/admin");
}
