'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { label } from '@/lib/labels';
import type { UserRole } from '@/lib/auth/session-core';
import { clearSession, getSessionUser } from '@/lib/auth/session';

/**
 * Hook to protect routes based on user role.
 * UI convenience only — the API enforces roles on every request.
 */
export function useRoleProtection(allowedRoles: UserRole[]) {
  const router = useRouter();

  useEffect(() => {
    const user = getSessionUser();

    if (!user) {
      // Missing, expired or legacy (JWT-in-data.user) session
      clearSession();
      toast.error('Энэ хуудсыг үзэхийн тулд нэвтэрнэ үү');
      router.push('/auth/login');
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      toast.error(`Хандах эрхгүй. Энэ хуудас зөвхөн ${allowedRoles.map(label).join(', ')} хэрэглэгчдэд зориулагдсан.`);
      router.push('/dashboard');
    }
  }, [allowedRoles, router]);
}
