// GET /api/catalog/services. Whether the request goes to the server or to the
// development mock is decided by the HTTP client's routing (services/api.ts);
// `source` only labels the result for the UI.
import { API_PATHS } from '../config/api'
import { markNotImplemented, type ApiResult } from './apiResult'
import type { Catalog } from './apiTypes'
import type { HttpClient } from './httpClient'
import { parseCatalog } from './validators'
import type { ApiMode } from '../utils/apiConfig'

export type CatalogResult = ApiResult<Catalog> & { source: ApiMode }

export const CATALOG_NOT_IMPLEMENTED_MESSAGE =
  'Каталогийн API серверт хараахан нэмэгдээгүй байна (GET /api/catalog/services).'

export async function fetchCatalog(client: HttpClient, source: ApiMode): Promise<CatalogResult> {
  const result = await client.request({ method: 'GET', path: API_PATHS.catalog.services, parse: parseCatalog })
  return { ...markNotImplemented(result, CATALOG_NOT_IMPLEMENTED_MESSAGE), source }
}
