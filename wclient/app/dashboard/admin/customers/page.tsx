"use client";

import { UserManagement } from "../components/UserManagement";
import { useRoleProtection } from "@/lib/hooks/useRoleProtection";
import type { UserRole } from "@/lib/auth/session-core";

const ROLES: UserRole[] = ["ADMIN"];

export default function CustomersPage() {
  useRoleProtection(ROLES);
  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-2xl font-bold text-[#0F2A4A]">Үйлчлүүлэгч</h1>
      <p className="mb-5 text-sm text-slate-600">Захиалагчийн бүртгэлийг зөвхөн харна. Бүртгэлийг хэрэглэгч өөрөө аппаас устгана.</p>
      <UserManagement initialGroup="customers" />
    </div>
  );
}
