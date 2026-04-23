export interface HealthResponse {
  status: string
  service: string
  environment?: string
  version?: string
  description?: string
}

export interface ObjectRecord {
  id: string
  path: string
  checksum: string
  size: number
  zone: string
  resource?: string
  metadata?: Record<string, string>
}

export interface CollectionRecord {
  id: string
  path: string
  zone: string
  childCount?: number
  metadata?: Record<string, string>
}

export interface ApiErrorPayload {
  code: string
  message: string
}

export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''

function resolveBaseUrl(baseUrl?: string) {
  const trimmedBaseUrl = baseUrl?.trim().replace(/\/$/, '')
  return trimmedBaseUrl || configuredBaseUrl
}

function buildUrl(path: string, baseUrl?: string) {
  const resolvedBaseUrl = resolveBaseUrl(baseUrl)
  return resolvedBaseUrl ? `${resolvedBaseUrl}${path}` : path
}

async function request<T>(path: string, token?: string, baseUrl?: string): Promise<T> {
  const response = await fetch(buildUrl(path, baseUrl), {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  })

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null

    try {
      payload = (await response.json()) as ApiErrorPayload
    } catch {
      payload = null
    }

    throw new ApiError(
      response.status,
      payload?.message ?? `Request failed with status ${response.status}`,
      payload?.code,
    )
  }

  return (await response.json()) as T
}

export function getHealth(baseUrl?: string) {
  return request<HealthResponse>('/healthz', undefined, baseUrl)
}

export function getObject(objectId: string, token: string, baseUrl?: string) {
  return request<ObjectRecord>(
    `/api/v1/objects/${encodeURIComponent(objectId)}`,
    token,
    baseUrl,
  )
}

export function getCollection(
  collectionId: string,
  token: string,
  baseUrl?: string,
) {
  return request<CollectionRecord>(
    `/api/v1/collections/${encodeURIComponent(collectionId)}`,
    token,
    baseUrl,
  )
}
