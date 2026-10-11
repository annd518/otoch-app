import axios, { AxiosInstance, AxiosError } from 'axios';
import Cookies from 'js-cookie';
import { clearSession, getSessionUser } from '@/lib/auth/session';

// Base API URL
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
apiClient.interceptors.request.use(
  (config) => {
    const token = Cookies.get('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear token and redirect to login
      clearSession();
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

// Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'CHILD' | 'NURSE' | 'MEDICAL_ADMIN' | 'ADMIN';
  createdAt: string;
}

export interface Parent {
  id: string;
  name: string;
  age: number;
  gender: string;
  address: string;
  diseases: string;
  medications: string;
  emergencyContact: string;
}

export interface Visit {
  id: string;
  parentId: string;
  nurseId?: string;
  scheduledFor: string;
  visitType: 'BASIC' | 'FULL';
  status: 'PENDING' | 'ASSIGNED' | 'STARTED' | 'WAITING_APPROVAL' | 'APPROVED' | 'REVISION_REQUIRED';
  completedAt?: string;
  approvedAt?: string;
  approvalNote?: string;
  rejectionNote?: string;
  Parent?: Parent;
  Nurse?: User;
  vitals?: Vitals;
  ApprovedBy?: User;
}

export interface Vitals {
  id?: string;
  visitId?: string;
  bp: string;
  sugar: string;
  pulse: string;
  oxygen: string;
  temperature: string;
  notes: string;
  medicines: string;
  createdAt?: string;
}

export interface HealthTrend {
  weekStart: string;
  bp: string;
  sugar: number;
  pulse: number;
  oxygen: number;
  temperature: number;
}

// API Functions

// 🔐 Authentication
export const authAPI = {
  signup: (data: {
    name: string;
    email: string;
    password: string;
    role: 'CHILD' | 'NURSE' | 'MEDICAL_ADMIN' | 'ADMIN';
  }) => apiClient.post<ApiResponse<{ token: string; user: User }>>('/auth/signup', data),

  login: (data: { email: string; password: string }) =>
    apiClient.post<ApiResponse<{ token: string; user: User }>>('/auth/login', data),
};

// 👥 User Management
export const userAPI = {
  getAllUsers: () => apiClient.get<ApiResponse<{ users: User[] }>>('/users'),

  getUserById: (id: string) => apiClient.get<ApiResponse<{ user: User }>>(`/users/${id}`),
};

// 👴 Parent Management
export const parentAPI = {
  addParent: (data: {
    name: string;
    age: number;
    gender: string;
    address: string;
    diseases: string;
    medications: string;
    emergencyContact: string;
  }) => apiClient.post<ApiResponse<{ parent: Parent }>>('/parents', data),

  getAllParents: () => apiClient.get<ApiResponse<{ parents: Parent[] }>>('/parents'),

  getParentById: (id: string) =>
    apiClient.get<ApiResponse<{ parent: Parent }>>(`/parents/${id}`),

  updateParent: (id: string, data: Partial<Parent>) =>
    apiClient.put<ApiResponse>(`/parents/${id}`, data),

  deleteParent: (id: string) => apiClient.delete<ApiResponse>(`/parents/${id}`),
};

// 🏥 Visit Management
export const visitAPI = {
  scheduleVisit: (data: {
    parentId: string;
    scheduledFor: string;
    visitType: 'BASIC' | 'FULL';
  }) => apiClient.post<ApiResponse<{ visit: Visit }>>('/visits', data),

  getChildVisits: () => apiClient.get<ApiResponse<{ visits: Visit[] }>>('/visits/child'),

  getNurseVisits: () => apiClient.get<ApiResponse<{ visits: Visit[] }>>('/visits/nurse'),

  assignNurse: (visitId: string, nurseId: string) =>
    apiClient.post<ApiResponse<{ visit: Visit }>>(`/visits/${visitId}/assign`, { nurseId }),

  startVisit: (visitId: string) =>
    apiClient.post<ApiResponse<{ visit: Visit }>>(`/visits/${visitId}/start`),

  submitVitals: (visitId: string, vitals: Vitals) =>
    apiClient.post<ApiResponse<{ visit: Visit; vitals: Vitals }>>(
      `/visits/${visitId}/vitals`,
      vitals
    ),
};

// 👩⚕️ Nurse Management
export const nurseAPI = {
  getAllNurses: () => apiClient.get<ApiResponse<{ nurses: User[] }>>('/nurses'),
};

// 🏥 Medical Review
export const reviewAPI = {
  getVisitsForReview: () =>
    apiClient.get<ApiResponse<{ visits: Visit[] }>>('/review/visits/review'),

  getVisitDetailsForReview: (visitId: string) =>
    apiClient.get<ApiResponse<{ visit: Visit }>>(`/review/visits/${visitId}/review`),

  approveVisit: (visitId: string, approvalNote: string) =>
    apiClient.post<ApiResponse<{ visit: Visit }>>(`/review/visits/${visitId}/approve`, {
      approvalNote,
    }),

  rejectVisit: (visitId: string, rejectionNote: string) =>
    apiClient.post<ApiResponse<{ visit: Visit }>>(`/review/visits/${visitId}/reject`, {
      rejectionNote,
    }),
};

// 📊 Analytics
export const analyticsAPI = {
  getParentHealthTrends: (parentId: string, period: 'weekly' | 'monthly' = 'weekly') =>
    apiClient.get<
      ApiResponse<{ parentId: string; period: string; vitalsTrend: HealthTrend[] }>
    >(`/analytics/parent/${parentId}/trends`, { params: { period } }),
};

// Helper functions
export const setAuthToken = (token: string) => {
  Cookies.set('auth_token', token, { expires: 7 }); // Token expires in 7 days
};

export const getAuthToken = () => {
  return Cookies.get('auth_token');
};

/** Validated user saved at login (lib/auth/session.ts); null if missing/expired */
export const getUserData = () => getSessionUser();

export const clearAuth = () => clearSession();

export const isAuthenticated = () => {
  return !!Cookies.get('auth_token');
};

export default apiClient;
