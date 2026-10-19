"use client"

import { AdminSummary } from "./AdminSummary"
import { useRoleProtection } from "@/lib/hooks/useRoleProtection"
import type { UserRole } from "@/lib/auth/session-core"

// The API (/api/admin/summary) checks the role again from the database.
const ROLES: UserRole[] = ["ADMIN", "MEDICAL_ADMIN"]

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
      </div>
    </div>
  )
}
