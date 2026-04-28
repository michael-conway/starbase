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

export interface ActionLink {
  href: string
  method?: string
}

export interface AVULinks {
  update?: ActionLink
  delete?: ActionLink
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
  links?: {
    avus?: ActionLink
    create_avu?: ActionLink
    create_ticket?: ActionLink
  }
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
  links?: AVULinks
}

export interface PathAVUResponse {
  irods_path: string
  path_segments: PathSegmentLink[]
  links?: {
    avus?: ActionLink
    create_avu?: ActionLink
    create_ticket?: ActionLink
  }
  avus: AVUEntry[]
  count?: number
  total?: number
  offset?: number
  limit?: number
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

export interface TicketLinks {
  self?: ActionLink
  update?: ActionLink
  delete?: ActionLink
  path?: ActionLink
  download?: ActionLink
}

export interface TicketEntry {
  name: string
  bearer_token?: string
  type?: string
  owner?: string
  owner_zone?: string
  object_type?: string
  irods_path?: string
  uses_limit?: number
  uses_count?: number
  write_file_limit?: number
  write_file_count?: number
  write_byte_limit?: number
  write_byte_count?: number
  expiration_time?: string
  links?: TicketLinks
}

export interface TicketResponse {
  ticket: TicketEntry
}

export interface TicketCollectionResponse {
  tickets: TicketEntry[]
  count?: number
  links?: {
    self?: ActionLink
    create?: ActionLink
  }
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

function buildAbsoluteUrl(path: string, baseUrl?: string) {
  const resolvedBaseUrl = resolveBaseUrl(baseUrl)
  if (resolvedBaseUrl) {
    return `${resolvedBaseUrl}${path}`
  }

  if (typeof window !== 'undefined') {
    return new URL(path, window.location.origin).toString()
  }

  return path
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

function parseFilenameFromContentDisposition(value: string | null) {
  if (!value) {
    return undefined
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  const plainMatch = value.match(/filename="?([^";]+)"?/i)
  return plainMatch?.[1]
}

async function request<T>(
  path: string,
  options?: {
    auth?: RequestAuth
    baseUrl?: string
    method?: string
    body?: BodyInit
    headers?: Record<string, string>
  },
): Promise<T> {
  const headers = {
    ...buildHeaders(options?.auth),
    ...options?.headers,
  }
  const response = await fetch(buildUrl(path, options?.baseUrl), {
    method: options?.method,
    headers,
    body: options?.body,
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

export async function downloadPath(
  irodsPath: string,
  auth: RequestAuth,
  baseUrl?: string,
) {
  const response = await fetch(buildUrl(`/api/v1/path/contents${withPath(irodsPath)}`, baseUrl), {
    headers: buildHeaders(auth),
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

  return {
    blob: await response.blob(),
    filename: parseFilenameFromContentDisposition(response.headers.get('Content-Disposition')),
  }
}

export function updateAVU(
  action: ActionLink,
  payload: { attrib: string; value: string; unit?: string },
  auth: RequestAuth,
  baseUrl?: string,
) {
  return request<{ avu?: AVUEntry }>(action.href, {
    auth,
    baseUrl,
    method: action.method ?? 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function deleteAVU(action: ActionLink, auth: RequestAuth, baseUrl?: string) {
  const response = await fetch(buildUrl(action.href, baseUrl), {
    method: action.method ?? 'DELETE',
    headers: buildHeaders(auth),
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
}

export function addAVU(
  action: ActionLink,
  payload: { attrib: string; value: string; unit?: string },
  auth: RequestAuth,
  baseUrl?: string,
) {
  return request<{ avu?: AVUEntry }>(action.href, {
    auth,
    baseUrl,
    method: action.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function downloadPathUrl(irodsPath: string, baseUrl?: string) {
  return buildAbsoluteUrl(`/api/v1/path/contents${withPath(irodsPath)}`, baseUrl)
}

export function actionLinkUrl(action: ActionLink, baseUrl?: string) {
  return buildAbsoluteUrl(action.href, baseUrl)
}

export function getTickets(auth: RequestAuth, baseUrl?: string) {
  return request<TicketCollectionResponse>('/api/v1/ticket', {
    auth,
    baseUrl,
  })
}

export function createPathTicket(
  action: ActionLink,
  payload: { maximum_uses?: number; lifetime_minutes?: number },
  auth: RequestAuth,
  baseUrl?: string,
) {
  return request<TicketResponse>(action.href, {
    auth,
    baseUrl,
    method: action.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function updateTicket(
  action: ActionLink,
  payload: { maximum_uses?: number; lifetime_minutes?: number },
  auth: RequestAuth,
  baseUrl?: string,
) {
  return request<TicketResponse>(action.href, {
    auth,
    baseUrl,
    method: action.method ?? 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function deleteTicket(action: ActionLink, auth: RequestAuth, baseUrl?: string) {
  const response = await fetch(buildUrl(action.href, baseUrl), {
    method: action.method ?? 'DELETE',
    headers: buildHeaders(auth),
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
}
