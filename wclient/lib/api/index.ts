// Export all API functions and types
export {
  default as apiClient,
  authAPI,
  userAPI,
  parentAPI,
  visitAPI,
  nurseAPI,
  reviewAPI,
  analyticsAPI,
  setAuthToken,
  getAuthToken,
  getUserData,
  clearAuth,
  isAuthenticated,
} from './client';

// Export types
export type {
  ApiResponse,
  User,
  Parent,
  Visit,
  Vitals,
  HealthTrend,
} from './client';
