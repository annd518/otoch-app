// FABRICATED catalog data for development only. Shapes follow the backend
// proposal docs/l1-1-api.md §2; names and prices are not real and must not be
// shown to users outside a development build.

export type CatalogMockScenario = 'ok' | 'empty' | 'error'

export interface MockHttpResponse {
  status: number
  body: unknown
}

const OK_BODY = {
  success: true,
  message: 'Каталог (mock)',
  data: {
    catalogVersion: 'mock-2026-10-12',
    currency: 'MNT',
    services: [
      {
        id: 'svc_mock_basic',
        code: 'MOCK_HOME_BASIC',
        name: '[MOCK] Гэрийн ердийн үзлэг',
        description: 'Зохиомол тайлбар. Даралт, сахар, хүчилтөрөгч хэмжих.',
        category: 'HOME_VISIT',
        priceMnt: 45000,
        durationMin: 45,
        requiresReferral: false,
        redFlagQuestionnaire: 'GENERAL_V1',
        isActive: true,
      },
      {
        id: 'svc_mock_iv',
        code: 'MOCK_HOME_IV',
        name: '[MOCK] Гэрт дусал тавих',
        description: 'Зохиомол тайлбар. Эмчийн заалтын дагуу.',
        category: 'HOME_VISIT',
        priceMnt: 60000,
        durationMin: 90,
        requiresReferral: true,
        redFlagQuestionnaire: 'GENERAL_V1',
        isActive: true,
      },
      {
        id: 'svc_mock_inactive',
        code: 'MOCK_INACTIVE',
        name: '[MOCK] Идэвхгүй үйлчилгээ',
        description: 'Жагсаалтад харагдах ёсгүй.',
        category: 'HOME_VISIT',
        priceMnt: 1000,
        durationMin: 30,
        requiresReferral: false,
        redFlagQuestionnaire: null,
        isActive: false,
      },
    ],
  },
}

const EMPTY_BODY = {
  success: true,
  message: 'Каталог (mock)',
  data: { catalogVersion: 'mock-2026-10-12', currency: 'MNT', services: [] },
}

const ERROR_BODY = {
  success: false,
  message: 'Каталог ачаалахад алдаа гарлаа (mock)',
  error: { code: 'MOCK_SERVER_ERROR' },
}

export function parseCatalogMockScenario(value: string | undefined): CatalogMockScenario {
  return value === 'empty' || value === 'error' ? value : 'ok'
}

export function mockCatalogResponse(scenario: CatalogMockScenario): MockHttpResponse {
  if (scenario === 'empty') return { status: 200, body: EMPTY_BODY }
  if (scenario === 'error') return { status: 500, body: ERROR_BODY }
  return { status: 200, body: OK_BODY }
}
