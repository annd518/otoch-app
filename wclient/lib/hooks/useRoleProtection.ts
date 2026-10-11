'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';
import { label } from '@/lib/labels';

type UserRole = 'CHILD' | 'NURSE' | 'MEDICAL_ADMIN' | 'ADMIN';

/**
 * Hook to protect routes based on user role
 * Redirects unauthorized users to the dashboard
 */
export function useRoleProtection(allowedRoles: UserRole[]) {
  const router = useRouter();

  useEffect(() => {
    // Get user token from cookies (stored by AuthContext)
    const userToken = Cookies.get('user_token');

    if (!userToken) {
      // No user data, redirect to login
      toast.error('Энэ хуудсыг үзэхийн тулд нэвтэрнэ үү');
      router.push('/auth/login');
      return;
    }

    // Decode JWT to get user data
    let userData;
    try {
      // Decode JWT manually (basic implementation)
      const base64Url = userToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      userData = JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding user token:', error);
      toast.error('Сесс хүчингүй байна');
      router.push('/auth/login');
      return;
    }

    const userRole = userData.role as UserRole;

    // Debug logging
    console.log('🔍 Role Protection Debug:', {
      userRole,
      allowedRoles,
      includes: allowedRoles.includes(userRole),
      userData
    });

    // Check if user's role is allowed
    if (!allowedRoles.includes(userRole)) {
      console.log('❌ Access denied:', userRole, 'not in', allowedRoles);
      toast.error(`Хандах эрхгүй. Энэ хуудас зөвхөн ${allowedRoles.map(label).join(', ')} хэрэглэгчдэд зориулагдсан.`);
      router.push('/dashboard');
    } else {
      console.log('✅ Access granted:', userRole, 'is in', allowedRoles);
    }
  }, [allowedRoles, router]);
}
