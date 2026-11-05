import type { HttpClient } from './httpClient'
import { parseAvatar, type AvatarParts } from '../utils/avatarParts'

// The nurse's self-made avatar (optional): null = none. Customers see it on
// their order once this nurse is assigned.
const parseEnvelope = (data: unknown) =>
  typeof data === 'object' && data !== null && 'avatar' in data
    ? { avatar: parseAvatar((data as { avatar: unknown }).avatar) }
    : null

export const fetchMyAvatar = (client: HttpClient) =>
  client.request({ method: 'GET', path: '/api/users/me/avatar', parse: parseEnvelope })

export const saveMyAvatar = (client: HttpClient, avatar: AvatarParts | null) =>
  client.request({ method: 'PUT', path: '/api/users/me/avatar', body: { avatar }, parse: parseEnvelope })
