"use client";

// The signed-in admin's back-office role and rights (GET /api/admin/me,
// server/src/services/permissions.ts). The server checks every request; this
// only hides menu items and buttons the role cannot use.
import { useEffect, useState, useSyncExternalStore } from "react";
import api from "@/lib/api/client";
import { getSessionUser } from "@/lib/auth/session";

export type Permission =
  | "orders.view"
  | "orders.manage"
  | "customers.view"
  | "nurses.verify"
  | "money.view"
  | "money.manage"
  | "catalog.view"
  | "catalog.manage"
  | "reports.view"
  | "staff.manage"
  | "audit.view"
  | "legacy.manage";

export type AdminAccess = {
  adminRole: string;
  adminRoleLabel: string;
  permissions: Permission[];
};

// one request per signed-in account and page load
let cache: { userId: string; value: Promise<AdminAccess | null> } | null = null;

export function loadAdminAccess(userId: string): Promise<AdminAccess | null> {
  if (cache?.userId !== userId)
    cache = {
      userId,
      value: api
        .get("/admin/me")
        .then((r) => r.data.data as AdminAccess)
        .catch(() => {
          cache = null;
          return null;
        }),
    };
  return cache.value;
}

/** undefined while loading, null when it could not be read. */
export function useAdminAccess(userId: string | null | undefined): AdminAccess | null | undefined {
  const [access, setAccess] = useState<{ userId: string; value: AdminAccess | null } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void loadAdminAccess(userId).then((value) => {
      if (alive) setAccess({ userId, value });
    });
    return () => {
      alive = false;
    };
  }, [userId]);
  return access && access.userId === userId ? access.value : undefined;
}

export const allowed = (access: AdminAccess | null | undefined, p: Permission) =>
  !!access?.permissions.includes(p);

const noSubscribe = () => () => {};
const userIdSnapshot = () => getSessionUser()?.id ?? "";

/** The access of whoever is signed in on this browser. */
export function useMyAdminAccess(): AdminAccess | null | undefined {
  const id = useSyncExternalStore(noSubscribe, userIdSnapshot, () => "");
  return useAdminAccess(id || null);
}
