/**
 * Authentication service
 * Handles all authentication-related API calls
 */

import { apiClient } from '@/lib/api';
import type { UserRole as SessionUserRole } from '@/lib/auth/session-core';

// Types
export type UserRole = SessionUserRole;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  name: string;
  email: string;
  password: string;
  // Public signup only accepts CHILD (server returns 403 ROLE_NOT_ALLOWED otherwise)
  role: 'CHILD';
}

/** docs/l1-1-api.md §1.1 — data.token is the JWT, data.user is the user object */
export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

/**
 * Authentication service object containing all auth-related methods
 */
export const authService = {
  /**
   * Login user with email and password
   * @param credentials - User login credentials
   * @returns Promise with auth response containing token and user
   */
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    return apiClient<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  /**
   * Register new family (CHILD) user
   * @param credentials - User signup credentials
   * @returns Promise with auth response containing token and user
   */
  signup: async (credentials: SignupCredentials): Promise<AuthResponse> => {
    return apiClient<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },
};
