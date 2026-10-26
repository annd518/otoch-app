"use client";

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  BarChart3,
  ClipboardList,
  History,
  LayoutGrid,
  Search,
  Settings,
  Stethoscope,
  Tag,
  TriangleAlert,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api/client";
import { clearSession, getSessionUser } from "@/lib/auth/session";
import { WEB_ROLE_REFUSED, canUseWeb, type SessionUser } from "@/lib/auth/session-core";

const noSubscribe = () => () => {};
// a string snapshot is stable between renders (getSessionUser builds a new object)
const sessionSnapshot = () => JSON.stringify(getSessionUser());

type NavItem = {
  href: string;
  title: string;
  icon: LucideIcon;
  count?: "orders" | "applications";
  // the page is not built yet: shown greyed out, not a link
  soon?: boolean;
};

// Admin menu (spec slide 84). Items marked soon are on the roadmap, not working pages.
const NAV: NavItem[] = [
  { href: "/dashboard/admin", title: "Самбар", icon: LayoutGrid },
  { href: "/dashboard/orders", title: "Захиалга", icon: ClipboardList, count: "orders" },
  { href: "/dashboard/admin/nurses", title: "Баталгаажуулалт", icon: BadgeCheck, count: "applications" },
  { href: "/dashboard/admin/staff", title: "Сувилагч, ажилтан", icon: Stethoscope },
  { href: "/dashboard/admin/customers", title: "Үйлчлүүлэгч", icon: Users },
  { href: "/dashboard/admin/payouts", title: "Сувилагчийн төлбөр", icon: Wallet },
  { href: "/dashboard/admin/catalog", title: "Каталог, үнэ", icon: Tag },
  { href: "#reports", title: "Тайлан", icon: BarChart3, soon: true },
  { href: "#disputes", title: "Маргаан", icon: TriangleAlert, soon: true },
  { href: "/dashboard/admin/settings", title: "Тохиргоо", icon: Settings },
  { href: "/dashboard/admin/audit", title: "Аудит лог", icon: History },
];

const REFRESH_MS = 60_000;

function Logo() {
  return (
    <Link href="/dashboard/admin" className="flex shrink-0 items-center gap-2" aria-label="ОТОЧ Админ">
      {/* eslint-disable-next-line @next/next/no-img-element -- small static brand files */}
      <img src="/brand/otoch-mark.png" alt="" className="h-9 w-auto" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/otoch-wordmark.png" alt="ОТОЧ" className="h-6 w-auto" />
      <span className="ml-1 text-lg font-semibold tracking-wide text-white/90">Админ</span>
    </Link>
  );
}

function NavLinks({
  counts,
  isActive,
  compact,
}: {
  counts: { orders: number | null; applications: number | null };
  isActive: (href: string) => boolean;
  compact?: boolean;
}) {
  return (
    <>
      {NAV.map((item) => {
        const Icon = item.icon;
        const count = item.count ? counts[item.count] : null;
        const base = compact
          ? "flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm"
          : "flex items-center gap-3 rounded-xl px-3 py-3 text-[15px]";
        if (item.soon)
          return (
            <span
              key={item.href}
              title="Удахгүй нэмэгдэнэ"
              className={`${base} cursor-not-allowed text-slate-400 ${compact ? "hidden" : ""}`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.6} />
              <span className="flex-1">{item.title}</span>
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                удахгүй
              </span>
            </span>
          );
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${base} transition-colors ${
              active
                ? "bg-[#DCE6F2] font-semibold text-[#0F2A4A]"
                : "text-slate-700 hover:bg-white/70"
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.6} />
            <span className={compact ? "" : "flex-1"}>
              {item.title}
              {count ? <span className="font-semibold"> · {count}</span> : null}
            </span>
          </Link>
        );
      })}
    </>
  );
}

function HeaderSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const current = pathname === "/dashboard/orders" ? (params.get("q") ?? "") : "";
  const [value, setValue] = useState(current);
  return (
    <form
      role="search"
      className="relative hidden w-full max-w-md md:block"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        router.push(q ? `/dashboard/orders?q=${encodeURIComponent(q)}` : "/dashboard/orders");
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Хайлт: захиалга №, үйлчлүүлэгч, сувилагч"
        aria-label="Захиалга хайх"
        className="w-full rounded-lg border border-white/10 bg-white/10 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
      />
    </form>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Validated user object saved at login (not a JWT decode); browser only
  const raw = useSyncExternalStore(noSubscribe, sessionSnapshot, () => "null");
  const userData = useMemo(() => JSON.parse(raw) as SessionUser | null, [raw]);
  const [counts, setCounts] = useState<{ orders: number | null; applications: number | null }>({
    orders: null,
    applications: null,
  });

  // A session from before the web became super-admin only (nurse, ...)
  useEffect(() => {
    if (userData && !canUseWeb(userData.role)) {
      clearSession();
      toast.error(WEB_ROLE_REFUSED);
      router.replace("/auth/login");
    }
  }, [userData, router]);

  const loadCounts = useCallback(async () => {
    try {
      const [board, summary] = await Promise.all([api.get("/admin/board"), api.get("/admin/summary")]);
      setCounts({
        orders: board.data.data.kpis.active,
        applications: summary.data.data.nurseApplications ?? 0,
      });
    } catch {
      // the menu works without the numbers
    }
  }, []);

  useEffect(() => {
    if (!userData || !canUseWeb(userData.role)) return;
    // first load right after mount, then every minute
    const first = setTimeout(() => void loadCounts(), 0);
    const t = setInterval(() => void loadCounts(), REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [userData, loadCounts]);

  const isActive = (href: string) => pathname === href;

  const handleLogout = () => {
    clearSession();
    toast.success("Амжилттай гарлаа");
    router.push("/auth/login");
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 bg-[#0F2A4A] px-4 text-white shadow-sm lg:px-6">
        <Logo />
        <div className="flex flex-1 justify-center">
          <React.Suspense fallback={null}>
            <HeaderSearch />
          </React.Suspense>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm text-white/85">
          <span className="hidden sm:inline">{userData?.name ?? ""}</span>
          <span className="hidden text-white/40 sm:inline">·</span>
          <button onClick={handleLogout} className="rounded-md px-2 py-1 hover:bg-white/10 hover:text-white">
            гарах
          </button>
        </div>
      </header>

      {/* phone and tablet: the menu scrolls sideways under the bar */}
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-[#EEF2F6] px-3 py-2 lg:hidden">
        <NavLinks counts={counts} isActive={isActive} compact />
      </nav>

      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-[#EEF2F6] px-3 py-5 lg:block">
          <nav className="space-y-1">
            <NavLinks counts={counts} isActive={isActive} />
          </nav>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
