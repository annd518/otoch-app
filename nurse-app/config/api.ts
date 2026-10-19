// API paths relative to the server root (utils/apiConfig.ts resolves the root).
// Only endpoints the nurse app calls are listed here.
export const API_PATHS = {
  auth: {
    login: '/api/auth/login',
    otpRequest: '/api/auth/otp/request',
    otpVerify: '/api/auth/otp/verify',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
  },
  // Request to join as a nurse (no account yet).
  applications: {
    create: '/api/nurse-applications',
  },
  // Orders assigned to the signed-in nurse (server/src/routes/staffOrders.ts).
  staffOrders: {
    list: '/api/staff/orders',
    byId: (id: string) => `/api/staff/orders/${encodeURIComponent(id)}`,
    eta: (id: string) => `/api/staff/orders/${encodeURIComponent(id)}/eta`,
  },
  // Dispatch: offers to accept or decline, and the nurse's own profile / online toggle.
  nurse: {
    offers: '/api/nurse/offers',
    accept: (id: string) => `/api/nurse/offers/${encodeURIComponent(id)}/accept`,
    decline: (id: string) => `/api/nurse/offers/${encodeURIComponent(id)}/decline`,
    me: '/api/nurse/me',
  },
  // Visit flow for the assigned nurse (server/src/routes/nurseOrders.ts,
  // docs/nurse-app-api-proposal.md).
  nurseOrders: {
    byId: (id: string) => `/api/nurse/orders/${encodeURIComponent(id)}`,
    action: (id: string, action: 'en-route' | 'checkin' | 'finish' | 'reject' | 'incident') =>
      `/api/nurse/orders/${encodeURIComponent(id)}/${action}`,
    record: (id: string) => `/api/nurse/orders/${encodeURIComponent(id)}/record`,
    attachment: (id: string, attachmentId: string) =>
      `/api/nurse/orders/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/content`,
  },
} as const
