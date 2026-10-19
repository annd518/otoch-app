import { redirect } from "next/navigation";

// The web is the super-admin panel; the old overview linked to nurse and
// medical-admin dashboards that are no longer part of it.
export default function DashboardPage() {
  redirect("/dashboard/admin");
}
