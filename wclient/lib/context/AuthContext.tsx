'use client';

/**
 * Authentication Context
 * Provides global authentication state and methods throughout the app
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';
import { authService, UserRole } from '@/lib/services/auth';

// User interface (decoded from JWT or stored)
export interface User {
  id?: string;
  name?: string;
  email?: string;
  role?: UserRole;
}

// Auth context type
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
}

// Create context with undefined default
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication Provider Component
 * Wraps the app to provide auth state and methods
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const router = useRouter();

  // Check for stored auth on mount
  useEffect(() => {
    const token = authService.getStoredToken();
    const userToken = authService.getStoredUserToken();

    if (token && userToken) {
      // We have tokens, consider user authenticated
      // In a real app, you might want to decode the JWT here
      // or make a /me API call to get current user
      setUser({ email: 'stored' }); // Placeholder user object
    }

    setIsInitializing(false);
  }, []);

  /**
   * Login user
   */
  const login = async (email: string, password: string): Promise<void> => {
    console.log('AuthContext login called with:', { email, password: '***' });
    setIsLoading(true);
    try {
      console.log('Making API call to authService.login...');
      const response = await authService.login({ email, password });
      console.log('API response:', response);

      if (response.success) {
        // Store tokens in localStorage
        authService.storeTokens(response.data.token, response.data.user);

        // Also store in cookies for middleware access
        Cookies.set('auth_token', response.data.token, { expires: 7 }); // 7 days
        Cookies.set('user_token', response.data.user, { expires: 7 });

        // Set user state (using token as placeholder, you could decode JWT here)
        setUser({ email });

        toast.success(response.message || 'Амжилттай нэвтэрлээ!');

        // Redirect to dashboard
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Signup new user
   */
  const signup = async (
    name: string,
    email: string,
    password: string,
    role: UserRole
  ): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await authService.signup({ name, email, password, role });

      if (response.success) {
        toast.success(response.message || 'Бүртгэл амжилттай үүслээ!');

        // Redirect to login
        router.push('/auth/login');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Бүртгүүлэхэд алдаа гарлаа. Дахин оролдоно уу.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout user
   */
  const logout = (): void => {
    authService.logout();
    // Remove cookies
    Cookies.remove('auth_token');
    Cookies.remove('user_token');
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
