"use client";

import React, { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { clearSession, getSessionUser } from "@/lib/auth/session";
import {
  WEB_ROLE_REFUSED,
  canUseWeb,
  type SessionUser,
} from "@/lib/auth/session-core";
import { label } from "@/lib/labels";
import toast from "react-hot-toast";

const noSubscribe = () => () => {};
// a string snapshot is stable between renders (getSessionUser builds a new object)
const sessionSnapshot = () => JSON.stringify(getSessionUser());

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Validated user object saved at login (not a JWT decode); browser only
  const raw = useSyncExternalStore(noSubscribe, sessionSnapshot, () => "null");
  const userData = useMemo(() => JSON.parse(raw) as SessionUser | null, [raw]);

  // A session from before the web became super-admin only (nurse, ...)
  useEffect(() => {
    if (userData && !canUseWeb(userData.role)) {
      clearSession();
      toast.error(WEB_ROLE_REFUSED);
      router.replace("/auth/login");
    }
  }, [userData, router]);

  const handleLogout = () => {
    clearSession();

    toast.success("Амжилттай гарлаа");
    router.push("/auth/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Shared navigation/sidebar can go here */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 hidden lg:block">
          <div className="h-full flex flex-col">
            {/* Profile Section */}
            <div className="px-3 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-3 px-3 py-2">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {userData?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {userData?.name || "User"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {userData?.role ? label(userData.role) : "Role"}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {(
                [
                  ["/dashboard/admin", "Самбар"],
                  ["/dashboard/admin/nurses", "Сувилагчийн баталгаажуулалт"],
                  ["/dashboard/orders", "Үйлчилгээний захиалгууд"],
                ] as const
              ).map(([href, title]) => (
                <Link
                  key={href}
                  href={href}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    pathname === href
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {title}
                </Link>
              ))}
            </nav>

            {/* Logout Button */}
            <div className="px-3 py-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <svg
                  className="w-5 h-5 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Гарах
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 lg:pl-64">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
