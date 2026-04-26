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
  mime_type?: string
  display_size?: string
  created_at?: string
  updated_at?: string
  parent?: ParentLink
  path_segments: PathSegmentLink[]
  hasChildren?: boolean
  childCount?: number
  checksum?: PathChecksum
  size?: number
  resource?: string
  replicas?: PathReplica[]
  metadata?: Record<string, string>
}

export interface PathReplica {
  number: number
  owner?: string
  resource_name?: string
  resource_hierarchy?: string
  size?: number
  display_size?: string
  updated_at?: string
  status?: string
  status_symbol?: string
  status_description?: string
  checksum?: string
  data_type?: string
  physical_path?: string
}

export interface PathChildrenResponse {
  irods_path: string
  path_segments: PathSegmentLink[]
  children: PathEntry[]
}

export interface AVUEntry {
  id: string
  attrib: string
  value: string
  unit?: string
  created_at?: string
  updated_at?: string
}

export interface PathAVUResponse {
  irods_path: string
  path_segments: PathSegmentLink[]
  avus: AVUEntry[]
}

export interface PathChecksumResponse {
  irods_path: string
  path_segments: PathSegmentLink[]
  checksum?: string
  type?: string
}

export interface PathChecksum {
  checksum?: string
  type?: string
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
    method?: string
  },
): Promise<T> {
  const response = await fetch(buildUrl(path, options?.baseUrl), {
    method: options?.method,
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

function withPath(path: string, options?: { verbose?: number }) {
  const params = new URLSearchParams({
    irods_path: path,
  })

  if (options?.verbose !== undefined) {
    params.set('verbose', `${options.verbose}`)
  }

  return `?${params.toString()}`
}

export function getHealth(baseUrl?: string) {
  return request<HealthResponse>('/healthz', { baseUrl })
}

export function getPath(
  irodsPath: string,
  auth: RequestAuth,
  baseUrl?: string,
  options?: { verbose?: number },
) {
  return request<PathEntry>(`/api/v1/path${withPath(irodsPath, options)}`, {
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

export function getPathAVUs(irodsPath: string, auth: RequestAuth, baseUrl?: string) {
  return request<PathAVUResponse>(`/api/v1/path/avu${withPath(irodsPath)}`, {
    auth,
    baseUrl,
  })
}

export function computePathChecksum(irodsPath: string, auth: RequestAuth, baseUrl?: string) {
  return request<PathChecksumResponse>(`/api/v1/path/checksum${withPath(irodsPath)}`, {
    auth,
    baseUrl,
    method: 'POST',
  })
}

export function downloadPathUrl(irodsPath: string, baseUrl?: string) {
  return buildUrl(`/api/v1/path/contents${withPath(irodsPath)}`, baseUrl)
}
