import { redirect } from "next/navigation";

// Nurses work in the OTOCH Nurse app, not on the web (super-admin panel only).
export default function NurseDashboardPage() {
  redirect("/dashboard/admin");
}
