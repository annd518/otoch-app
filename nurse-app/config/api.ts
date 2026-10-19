// API paths relative to the server root (utils/apiConfig.ts resolves the root).
// Only endpoints the nurse app calls are listed here.
export const API_PATHS = {
  auth: {
    login: '/api/auth/login',
  },
  // Orders assigned to the signed-in nurse (server/src/routes/staffOrders.ts).
  staffOrders: {
    list: '/api/staff/orders',
    byId: (id: string) => `/api/staff/orders/${encodeURIComponent(id)}`,
    action: (id: string, action: 'eta' | 'start' | 'complete') =>
      `/api/staff/orders/${encodeURIComponent(id)}/${action}`,
  },
} as const
