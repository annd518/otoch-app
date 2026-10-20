"use client"

import { AdminSummary } from "./AdminSummary"
import { LiveBoard } from "./LiveBoard"
import { useRoleProtection } from "@/lib/hooks/useRoleProtection"
import type { UserRole } from "@/lib/auth/session-core"

// Super-admin only; the API (/api/admin/*) checks the role again from the database.
const ROLES: UserRole[] = ["ADMIN"]

export default function AdminDashboard() {
  useRoleProtection(ROLES);

  return (
    <div className="space-y-10 p-4 sm:p-6">
      <LiveBoard />
      <section>
        <h2 className="mb-4 text-xl font-bold text-[#0F2A4A]">Төлбөр, хэрэглэгчийн тойм</h2>
        <AdminSummary />
      </section>
    </div>
  )
}
