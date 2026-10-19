"use client"

import { AdminSummary } from "./AdminSummary"
import { UserManagement } from "./UserManagement"
import { useRoleProtection } from "@/lib/hooks/useRoleProtection"
import type { UserRole } from "@/lib/auth/session-core"

// Super-admin only; the API (/api/admin/*) checks the role again from the database.
const ROLES: UserRole[] = ["ADMIN"]

export default function AdminDashboard() {
  useRoleProtection(ROLES);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Админы хянах самбар</h1>
          <p className="text-gray-600">
            Захиалга, төлбөр, хэрэглэгчдийн бодит тоо. Сувилагч томилох нь
            “Үйлчилгээний захиалгууд” хэсэгт.
          </p>
        </div>
        <AdminSummary />
        <section className="mt-10">
            <h2 className="mb-1 text-2xl font-semibold text-gray-800">
              Хэрэглэгч, ажилтан
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              Сувилагч (OTOCH Nurse апп) болон супер админ нэмэх, эрх солих,
              идэвхгүй болгох, нууц үг шинэчлэх. Захиалагчийн бүртгэлийг зөвхөн
              харна.
            </p>
            <UserManagement />
          </section>
      </div>
    </div>
  )
}
