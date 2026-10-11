// Catalog source switch. Mock data is used only when the resolved API config
// says mode === 'mock', which utils/apiConfig.ts allows in development only.
import { API_PATHS } from '../config/api'
import { mockCatalogResponse, type CatalogMockScenario } from '../mocks/catalogMock'
import { interpretResponse, type ApiResult } from './apiResult'
import type { Catalog } from './apiTypes'
import type { HttpClient } from './httpClient'
import { parseCatalog } from './validators'
import type { ApiMode } from '../utils/apiConfig'

export type CatalogResult = ApiResult<Catalog> & { source: ApiMode }

export interface CatalogDeps {
  mode: ApiMode
  client: HttpClient
  mockScenario: CatalogMockScenario
  delay: (ms: number) => Promise<void>
}

export const CATALOG_NOT_IMPLEMENTED_MESSAGE =
  'Каталогийн API серверт хараахан нэмэгдээгүй байна (GET /api/catalog/services).'

const MOCK_DELAY_MS = 500

export async function fetchCatalog(deps: CatalogDeps): Promise<CatalogResult> {
  if (deps.mode === 'mock') {
    await deps.delay(MOCK_DELAY_MS)
    const response = mockCatalogResponse(deps.mockScenario)
    return { ...interpretResponse(response.status, response.body, parseCatalog), source: 'mock' }
  }

  const result = await deps.client.request({ method: 'GET', path: API_PATHS.catalog.services, parse: parseCatalog })
  if (!result.ok && result.kind === 'http' && result.status === 404) {
    return { ok: false, kind: 'not_implemented', status: 404, message: CATALOG_NOT_IMPLEMENTED_MESSAGE, source: 'real' }
  }
  return { ...result, source: 'real' }
}
