'use client';

/**
 * Authentication Context
 * Provides global authentication state and methods throughout the app
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { authService } from '@/lib/services/auth';
import {
  WEB_ROLE_REFUSED,
  canUseWeb,
  homePathForRole,
  sessionFromAuthData,
  type SessionUser,
} from '@/lib/auth/session-core';
import { clearSession, getSessionUser, saveSession } from '@/lib/auth/session';

export type User = SessionUser;

// Auth context type
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

// Create context with undefined default
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const CONTRACT_ERROR = 'Серверийн хариу буруу байна. Дахин оролдоно уу.';

/**
 * Authentication Provider Component
 * Wraps the app to provide auth state and methods
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const router = useRouter();

  // Restore a valid (non-expired) session on mount; drop anything else
  useEffect(() => {
    const stored = getSessionUser();
    if (stored) setUser(stored);
    else clearSession();
    setIsInitializing(false);
  }, []);

  /**
   * Login user, then route by role
   */
  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await authService.login({ email, password });
      const session = sessionFromAuthData(response.data);
      if (!response.success || !session) throw { message: CONTRACT_ERROR, status: 0 };
      // Valid account, but not for the web (nurse / customer): keep no session
      if (!canUseWeb(session.user.role)) throw { message: WEB_ROLE_REFUSED, status: 403 };

      saveSession(session);
      setUser(session.user);
      toast.success(response.message || 'Амжилттай нэвтэрлээ!');
      router.push(homePathForRole(session.user.role));
    } catch (error: any) {
      // 401 INVALID_CREDENTIALS -> server message "Имэйл эсвэл нууц үг буруу байна"
      toast.error(error?.message || 'Нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Signup new family (CHILD) user. Staff accounts are created by an admin.
   */
  const signup = async (name: string, email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await authService.signup({ name, email, password, role: 'CHILD' });
      if (response.success) {
        toast.success(response.message || 'Бүртгэл амжилттай үүслээ!');
        router.push('/auth/login');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Бүртгүүлэхэд алдаа гарлаа. Дахин оролдоно уу.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout user
   */
  const logout = (): void => {
    clearSession();
    setUser(null);
    toast.success('Амжилттай гарлаа');
    router.push('/auth/login');
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
  };

  // Don't render children until we've checked for stored auth
  if (isInitializing) {
    return null; // Or a loading spinner
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to use auth context
 * Must be used within AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
