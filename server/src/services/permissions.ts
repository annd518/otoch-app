// Back-office rights (spec slide 109, "Эрх (RBAC)"). One table, checked on the
// server for every admin API; the admin web only hides what is not allowed.
// Default deny: an action not listed for a role is refused.
//
// Spec ◐ ("хязгаартай") cells are read as view-only here:
//  - Finance sees orders (to trace a payment), Ops sees refunds/payouts and
//    the catalog/settings but does not change them.
//  - Support sees orders and customers; cancelling stays with Ops (◐ in the
//    spec needs a ticket workflow that does not exist yet).
import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/http";

export const ADMIN_ROLES = ["SUPER_ADMIN", "OPS", "FINANCE", "SUPPORT"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Супер админ",
  OPS: "Ops (үйл ажиллагаа)",
  FINANCE: "Санхүү",
  SUPPORT: "Тусламжийн ажилтан",
};

const ALL: readonly AdminRole[] = ADMIN_ROLES;
export const PERMISSIONS = {
  "orders.view": ALL,
  "orders.manage": ["SUPER_ADMIN", "OPS"], // assign by hand, cancel with refund
  "customers.view": ["SUPER_ADMIN", "OPS", "SUPPORT"],
  "nurses.verify": ["SUPER_ADMIN", "OPS"], // applications and their documents
  "money.view": ["SUPER_ADMIN", "OPS", "FINANCE"], // refunds and payouts
  "money.manage": ["SUPER_ADMIN", "FINANCE"],
  "catalog.view": ["SUPER_ADMIN", "OPS"], // catalog prices and settings
  "catalog.manage": ["SUPER_ADMIN"],
  "reports.view": ["SUPER_ADMIN", "OPS", "FINANCE"],
  "staff.manage": ["SUPER_ADMIN"], // accounts and roles
  "audit.view": ["SUPER_ADMIN"],
  "legacy.manage": ["SUPER_ADMIN"], // the old Visit flow endpoints
} as const satisfies Record<string, readonly AdminRole[]>;
export type Permission = keyof typeof PERMISSIONS;

export function can(role: string | null | undefined, action: Permission): boolean {
  return !!role && (PERMISSIONS[action] as readonly string[]).includes(role);
}

/** Every permission a role has (for the admin web menu). */
export const permissionsOf = (role: string | null | undefined): Permission[] =>
  (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(role, p));

interface AdminRequest extends Request {
  user?: { userId: string; role: string; adminRole?: string | null };
}

/** Express guard: the admin guard (routes/admin.ts) has loaded adminRole. */
export const allow =
  (action: Permission) =>
  (req: AdminRequest, _res: Response, next: NextFunction) => {
    if (!can(req.user?.adminRole, action))
      throw new ApiError(403, "FORBIDDEN", "Танд энэ үйлдлийн эрх байхгүй");
    next();
  };
