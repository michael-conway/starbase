export interface HealthResponse {
  status: string
  service: string
  environment?: string
  version?: string
  description?: string
}

export interface ParentLink {
  irods_path: string
  href: string
}

export interface PathSegmentLink {
  display_name: string
  irods_path: string
  href: string
}

export interface PathEntry {
  id: string
  path: string
  kind: 'data_object' | 'collection'
  zone: string
  parent?: ParentLink
  path_segments: PathSegmentLink[]
  hasChildren?: boolean
  childCount?: number
  checksum?: string
  size?: number
  resource?: string
  metadata?: Record<string, string>
}

export interface PathChildrenResponse {
  irods_path: string
  path_segments: PathSegmentLink[]
  children: PathEntry[]
}

export interface ApiErrorPayload {
  code: string
  message: string
}

export type AuthMode = 'basic' | 'oidc'

export interface RequestAuth {
  mode: AuthMode
  username?: string
  password?: string
  token?: string
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

function encodeBasicCredentials(username: string, password: string) {
  return btoa(`${username}:${password}`)
}

function buildHeaders(auth?: RequestAuth) {
  if (!auth) {
    return undefined
  }

  if (auth.mode === 'basic') {
    return {
      Authorization: `Basic ${encodeBasicCredentials(auth.username ?? '', auth.password ?? '')}`,
    }
  }

  return auth.token
    ? {
        Authorization: `Bearer ${auth.token}`,
      }
    : undefined
}

async function request<T>(
  path: string,
  options?: {
    auth?: RequestAuth
    baseUrl?: string
  },
): Promise<T> {
  const response = await fetch(buildUrl(path, options?.baseUrl), {
    headers: buildHeaders(options?.auth),
  })

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null

    try {
      payload = (await response.json()) as ApiErrorPayload
    } catch {
      // Fall back to the HTTP status when the response body is not JSON.
    }

    throw new ApiError(
      response.status,
      payload?.message ?? `Request failed with status ${response.status}`,
      payload?.code,
    )
  }

  return (await response.json()) as T
}

function withPath(path: string) {
  return `?irods_path=${encodeURIComponent(path)}`
}

export function getHealth(baseUrl?: string) {
  return request<HealthResponse>('/healthz', { baseUrl })
}

export function getPath(irodsPath: string, auth: RequestAuth, baseUrl?: string) {
  return request<PathEntry>(`/api/v1/path${withPath(irodsPath)}`, {
    auth,
    baseUrl,
  })
}

export function getPathChildren(
  irodsPath: string,
  auth: RequestAuth,
  baseUrl?: string,
) {
  return request<PathChildrenResponse>(`/api/v1/path/children${withPath(irodsPath)}`, {
    auth,
    baseUrl,
  })
}

export function downloadPathUrl(irodsPath: string, baseUrl?: string) {
  return buildUrl(`/api/v1/path/contents${withPath(irodsPath)}`, baseUrl)
}
