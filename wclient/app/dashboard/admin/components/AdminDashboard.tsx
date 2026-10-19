"use client"

import { useSyncExternalStore } from "react"
import { AdminSummary } from "./AdminSummary"
import { UserManagement } from "./UserManagement"
import { useRoleProtection } from "@/lib/hooks/useRoleProtection"
import { getSessionUser } from "@/lib/auth/session"
import type { UserRole } from "@/lib/auth/session-core"

// The API (/api/admin/*) checks the role again from the database.
const ROLES: UserRole[] = ["ADMIN", "MEDICAL_ADMIN"]
const noSubscribe = () => () => {}

export default function AdminDashboard() {
  useRoleProtection(ROLES);
  // user management is for ADMIN only; medical admins see the numbers
  // read in the browser only (the page is prerendered without a session)
  const isAdmin = useSyncExternalStore(
    noSubscribe,
    () => getSessionUser()?.role === "ADMIN",
    () => false,
  )

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
        {isAdmin && (
          <section className="mt-10">
            <h2 className="mb-1 text-2xl font-semibold text-gray-800">
              Хэрэглэгч, ажилтан
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              Сувилагч болон админ нэмэх, эрх солих, идэвхгүй болгох, нууц үг
              шинэчлэх. Захиалагчийн бүртгэлийг зөвхөн харна.
            </p>
            <UserManagement />
          </section>
        )}
      </div>
    </div>
  )
}
