import { env } from '../utils/env';

// API Configuration
const API_BASE_URL = `${env.baseUrl}api`;

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    SIGNUP: `${API_BASE_URL}/auth/signup`,
    LOGIN: `${API_BASE_URL}/auth/login`,
  },
  // Parents
  PARENTS: {
    BASE: `${API_BASE_URL}/parents`,
    BY_ID: (id: string) => `${API_BASE_URL}/parents/${id}`,
  },
  // Visits
  VISITS: {
    BASE: `${API_BASE_URL}/visits`,
    CHILD: `${API_BASE_URL}/visits/child`,
    NURSE: `${API_BASE_URL}/visits/nurse`,
    BY_ID: (id: string) => `${API_BASE_URL}/visits/${id}`,
    ASSIGN: (id: string) => `${API_BASE_URL}/visits/${id}/assign`,
    START: (id: string) => `${API_BASE_URL}/visits/${id}/start`,
    VITALS: (id: string) => `${API_BASE_URL}/visits/${id}/vitals`,
    COMPLETE: (id: string) => `${API_BASE_URL}/visits/${id}/complete`,
  },
  // Users
  USERS: {
    BASE: `${API_BASE_URL}/users`,
    BY_ID: (id: string) => `${API_BASE_URL}/users/${id}`,
  },
  // Nurses
  NURSES: {
    BASE: `${API_BASE_URL}/nurses`,
  },
  // Analytics
  ANALYTICS: {
    PARENT_TRENDS: (id: string) => `${API_BASE_URL}/analytics/parent/${id}/trends`,
  },
};

export default API_BASE_URL;
