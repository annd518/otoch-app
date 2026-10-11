// API paths relative to the server root (utils/apiConfig.ts resolves the root).
// Only endpoints the family (CHILD) app calls are listed here.
export const API_PATHS = {
  auth: {
    login: '/api/auth/login',
    signup: '/api/auth/signup',
  },
  users: {
    byId: (id: string) => `/api/users/${encodeURIComponent(id)}`,
  },
  parents: {
    list: '/api/parents',
    byId: (id: string) => `/api/parents/${encodeURIComponent(id)}`,
  },
  visits: {
    create: '/api/visits',
    child: '/api/visits/child',
  },
  // docs/l1-1-api.md §2. Proposal; not implemented on the server yet.
  catalog: {
    services: '/api/catalog/services',
  },
} as const
