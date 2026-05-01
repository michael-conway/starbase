export interface HealthResponse {
  status: string
  service: string
  environment?: string
  version?: string
  description?: string
}

export type ServiceInfoResponse = Record<string, unknown>

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

export interface PathACLItemLinks {
  update?: ActionLink
  remove?: ActionLink
}

export interface PathACLLinks {
  path?: ActionLink
  add_permission?: ActionLink
  add_user?: ActionLink
  set_inheritance?: ActionLink
  delete_inheritance?: ActionLink
}

export interface PathCommandCue {
  operation?: string
  gocmd?: string
  icommand?: string
}

export interface PathEntry {
  id: string
  path: string
  kind: 'data_object' | 'collection'
  zone: string
  cmd_cues?: PathCommandCue[]
  mime_type?: string
  display_size?: string
  created_at?: string
  updated_at?: string
  parent?: ParentLink
  links?: {
    self?: ActionLink
    details?: ActionLink
    parent?: ActionLink
    children?: ActionLink
    update?: ActionLink
    delete?: ActionLink
    relocate?: ActionLink
    move?: ActionLink
    copy?: ActionLink
    avus?: ActionLink
    acls?: ActionLink
    create_avu?: ActionLink
    create_ticket?: ActionLink
    resources?: ActionLink
    create_child_collection?: ActionLink
    create_child_data_object?: ActionLink
    upload_contents?: ActionLink
    replace_contents?: ActionLink
    download_contents?: ActionLink
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
  links?: {
    self?: ActionLink
    parent?: ActionLink
    next?: ActionLink
    prev?: ActionLink
    create_child_collection?: ActionLink
    create_child_data_object?: ActionLink
    upload_contents?: ActionLink
  }
  search?: {
    name_pattern?: string
    recursive?: boolean
    search_scope?: 'children' | 'subtree' | 'absolute'
    case_sensitive?: boolean
    matched_count?: number
  }
}

export interface PathReplicasResponse {
  irods_path: string
  path_segments: PathSegmentLink[]
  replicas: PathReplica[]
  links?: {
    self?: ActionLink
    add_replica?: ActionLink
    move_replica?: ActionLink
    trim_replica?: ActionLink
  }
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
    resources?: ActionLink
  }
  avus: AVUEntry[]
  count?: number
  total?: number
  offset?: number
  limit?: number
}

export interface PathACLEntry {
  id: string
  name: string
  zone?: string
  type: 'user' | 'group'
  irods_user_type?: string
  access_level: string
  links?: PathACLItemLinks
}

export interface PathACLResponse {
  irods_path: string
  kind: 'data_object' | 'collection'
  path_segments: PathSegmentLink[]
  inheritance_enabled?: boolean
  links?: PathACLLinks
  users: PathACLEntry[]
  groups: PathACLEntry[]
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

export interface ResourceRecord {
  id: number
  name: string
  zone?: string
  type?: string
  class?: string
  location?: string
  path?: string
  context?: string
  created_at?: string
  updated_at?: string
}

export interface ResourceCollectionResponse {
  resources: ResourceRecord[]
  count: number
  scope: 'top' | 'all'
  links: {
    self?: ActionLink
  }
}

export interface UserLookupEntry {
  id?: number
  name: string
  zone?: string
  type?: string
}

export interface UserLookupResponse {
  users: UserLookupEntry[]
}

export interface GroupLookupEntry {
  id?: number
  name: string
  zone?: string
  type?: string
}

export interface GroupLookupResponse {
  groups: GroupLookupEntry[]
}

export interface FavoriteLinks {
  self?: ActionLink
  details?: ActionLink
  update?: ActionLink
  delete?: ActionLink
}

export interface FavoriteCollectionLinks {
  self?: ActionLink
  create?: ActionLink
  update?: ActionLink
  delete?: ActionLink
}

export interface FavoriteEntry {
  name: string
  absolute_path: string
  links?: FavoriteLinks
}

export interface FavoriteCollectionResponse {
  favorites: FavoriteEntry[]
  count?: number
  links?: FavoriteCollectionLinks
}

function validateFavoriteCollectionResponse(
  response: FavoriteCollectionResponse,
): FavoriteCollectionResponse {
  const favorites = Array.isArray(response.favorites) ? response.favorites : []
  favorites.forEach((favorite, index) => {
    if (typeof favorite?.absolute_path !== 'string' || !favorite.absolute_path.trim()) {
      throw new ApiError(
        502,
        `Invalid favorites payload: favorites[${index}].absolute_path is required.`,
      )
    }
    if (!favorite.absolute_path.trim().startsWith('/')) {
      throw new ApiError(
        502,
        `Invalid favorites payload: favorites[${index}].absolute_path must be absolute.`,
      )
    }
    if (typeof favorite?.name !== 'string' || !favorite.name.trim()) {
      throw new ApiError(
        502,
        `Invalid favorites payload: favorites[${index}].name is required.`,
      )
    }
  })

  return response
}

export interface PathContentsUploadResponse {
  path: string
  parent_path: string
  file_name: string
  action: 'created' | 'replaced'
  size: number
  checksum?: {
    requested: boolean
    verified: boolean
    algorithm?: string
    value?: string
  }
  links?: {
    path?: ActionLink
    contents?: ActionLink
    parent?: ActionLink
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

function requireAbsolutePath(path: string, fieldName: string) {
  const normalized = path.trim()
  if (!normalized) {
    throw new ApiError(400, `${fieldName} is required.`)
  }

  if (!normalized.startsWith('/')) {
    throw new ApiError(400, `${fieldName} must be an absolute path.`)
  }

  return normalized
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

function buildApiError(status: number, payload?: ApiErrorPayload | null) {
  return new ApiError(
    status,
    payload?.message ?? `Request failed with status ${status}`,
    payload?.code,
  )
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
    let fallbackMessage: string | undefined

    try {
      payload = (await response.json()) as ApiErrorPayload
    } catch {
      try {
        const text = (await response.text()).trim()
        if (text) {
          fallbackMessage = text
        }
      } catch {
        // Fall back to the HTTP status when the response body is not JSON.
      }
    }

    throw new ApiError(
      response.status,
      payload?.message ?? fallbackMessage ?? `Request failed with status ${response.status}`,
      payload?.code,
    )
  }

  return (await response.json()) as T
}

function withPath(path: string, options?: { verbose?: number }) {
  const params = new URLSearchParams({
    irods_path: requireAbsolutePath(path, 'irods_path'),
  })

  if (options?.verbose !== undefined) {
    params.set('verbose', `${options.verbose}`)
  }

  return `?${params.toString()}`
}

export function getHealth(baseUrl?: string) {
  return request<HealthResponse>('/healthz', { baseUrl })
}

export function getServiceInfo(auth: RequestAuth, baseUrl?: string) {
  return request<ServiceInfoResponse>('/api/v1/server', {
    auth,
    baseUrl,
  })
}

export function getResources(
  auth: RequestAuth,
  baseUrl?: string,
  options?: { scope?: 'top' | 'all' },
) {
  const params = new URLSearchParams({
    scope: options?.scope ?? 'top',
  })

  return request<ResourceCollectionResponse>(`/api/v1/resource?${params.toString()}`, {
    auth,
    baseUrl,
  })
}

export function searchUsers(
  prefix: string,
  auth: RequestAuth,
  baseUrl?: string,
  options?: { zone?: string },
) {
  const params = new URLSearchParams({
    prefix,
  })

  const zone = options?.zone?.trim()
  if (zone) {
    params.set('zone', zone)
  }

  return request<UserLookupResponse>(`/api/v1/user?${params.toString()}`, {
    auth,
    baseUrl,
  })
}

export function searchGroups(
  prefix: string,
  auth: RequestAuth,
  baseUrl?: string,
  options?: { zone?: string },
) {
  const params = new URLSearchParams({
    prefix,
  })

  const zone = options?.zone?.trim()
  if (zone) {
    params.set('zone', zone)
  }

  return request<GroupLookupResponse>(`/api/v1/usergroup?${params.toString()}`, {
    auth,
    baseUrl,
  })
}

export function getFavorites(auth: RequestAuth, baseUrl?: string) {
  return request<FavoriteCollectionResponse>('/api/v1/ext/favorites', {
    auth,
    baseUrl,
  }).then((response) => validateFavoriteCollectionResponse(response))
}

export function addFavorite(
  action: ActionLink,
  payload: {
    name: string
    absolute_path: string
  },
  auth: RequestAuth,
  baseUrl?: string,
) {
  const absolutePath = requireAbsolutePath(payload.absolute_path, 'absolute_path')
  const trimmedName = payload.name.trim()

  return request<FavoriteCollectionResponse>(action.href, {
    auth,
    baseUrl,
    method: action.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: trimmedName,
      absolute_path: absolutePath,
    }),
  })
}

export function renameFavorite(
  action: ActionLink,
  payload: {
    name: string
    absolute_path: string
  },
  auth: RequestAuth,
  baseUrl?: string,
) {
  const absolutePath = requireAbsolutePath(payload.absolute_path, 'absolute_path')
  const trimmedName = payload.name.trim()

  return request<FavoriteCollectionResponse>(action.href, {
    auth,
    baseUrl,
    method: action.method ?? 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: trimmedName,
      absolute_path: absolutePath,
    }),
  })
}

export async function removeFavorite(
  action: ActionLink,
  payload: {
    absolute_path: string
  },
  auth: RequestAuth,
  baseUrl?: string,
) {
  const absolutePath = requireAbsolutePath(payload.absolute_path, 'absolute_path')
  const response = await fetch(buildUrl(action.href, baseUrl), {
    method: action.method ?? 'DELETE',
    headers: {
      ...buildHeaders(auth),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      absolute_path: absolutePath,
    }),
  })

  if (!response.ok) {
    let payloadError: ApiErrorPayload | null = null
    let fallbackMessage: string | undefined

    try {
      payloadError = (await response.json()) as ApiErrorPayload
    } catch {
      try {
        const text = (await response.text()).trim()
        if (text) {
          fallbackMessage = text
        }
      } catch {
        // Fall back to the HTTP status when the response body is not JSON.
      }
    }

    throw new ApiError(
      response.status,
      payloadError?.message ?? fallbackMessage ?? `Request failed with status ${response.status}`,
      payloadError?.code,
    )
  }
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
  options?: {
    name_pattern?: string
    search_scope?: 'children' | 'subtree' | 'absolute'
    recursive?: boolean
    case_sensitive?: boolean
    sort?: 'path' | 'name' | 'kind' | 'size' | 'created_at' | 'updated_at'
    order?: 'asc' | 'desc'
    limit?: number
    offset?: number
  },
) {
  const params = new URLSearchParams({
    irods_path: requireAbsolutePath(irodsPath, 'irods_path'),
  })

  const namePattern = options?.name_pattern?.trim()
  if (namePattern) {
    params.set('name_pattern', namePattern)
  }

  if (options?.search_scope) {
    params.set('search_scope', options.search_scope)
  }

  if (options?.recursive !== undefined) {
    params.set('recursive', `${options.recursive}`)
  }

  if (options?.case_sensitive !== undefined) {
    params.set('case_sensitive', `${options.case_sensitive}`)
  }

  if (options?.sort) {
    params.set('sort', options.sort)
  }

  if (options?.order) {
    params.set('order', options.order)
  }

  if (options?.limit !== undefined) {
    params.set('limit', `${options.limit}`)
  }

  if (options?.offset !== undefined) {
    params.set('offset', `${options.offset}`)
  }

  return request<PathChildrenResponse>(`/api/v1/path/children?${params.toString()}`, {
    auth,
    baseUrl,
  })
}

export function createPathChild(
  parentPath: string,
  payload: {
    child_name: string
    kind: 'collection' | 'data_object'
    mkdirs?: boolean
  },
  auth: RequestAuth,
  baseUrl?: string,
) {
  return request<PathEntry>(`/api/v1/path${withPath(parentPath)}`, {
    auth,
    baseUrl,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function deletePath(
  irodsPath: string,
  auth: RequestAuth,
  baseUrl?: string,
  options?: { force?: boolean },
) {
  const params = new URLSearchParams({
    irods_path: requireAbsolutePath(irodsPath, 'irods_path'),
  })

  if (options?.force) {
    params.set('force', 'true')
  }

  const response = await fetch(buildUrl(`/api/v1/path?${params.toString()}`, baseUrl), {
    method: 'DELETE',
    headers: buildHeaders(auth),
  })

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null

    try {
      payload = (await response.json()) as ApiErrorPayload
    } catch {
      // Fall back to the HTTP status when the response body is not JSON.
    }

    throw buildApiError(response.status, payload)
  }
}

export function renamePath(
  irodsPath: string,
  payload: { new_name: string },
  auth: RequestAuth,
  baseUrl?: string,
) {
  return request<PathEntry>(`/api/v1/path${withPath(irodsPath)}`, {
    auth,
    baseUrl,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function relocatePath(
  irodsPath: string,
  payload: {
    operation: 'move' | 'copy'
    destination_path: string
  },
  auth: RequestAuth,
  baseUrl?: string,
) {
  return request<PathEntry>(`/api/v1/path${withPath(irodsPath)}`, {
    auth,
    baseUrl,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operation: payload.operation,
      destination_path: requireAbsolutePath(payload.destination_path, 'destination_path'),
    }),
  })
}

export function createPathChildFromAction(
  action: ActionLink,
  payload: {
    child_name: string
    kind: 'collection' | 'data_object'
    mkdirs?: boolean
  },
  auth: RequestAuth,
  baseUrl?: string,
) {
  return request<PathEntry>(action.href, {
    auth,
    baseUrl,
    method: action.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function renamePathByAction(
  action: ActionLink,
  payload: { new_name: string },
  auth: RequestAuth,
  baseUrl?: string,
) {
  return request<PathEntry>(action.href, {
    auth,
    baseUrl,
    method: action.method ?? 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function relocatePathByAction(
  action: ActionLink,
  payload: {
    operation: 'move' | 'copy'
    destination_path: string
  },
  auth: RequestAuth,
  baseUrl?: string,
) {
  return request<PathEntry>(action.href, {
    auth,
    baseUrl,
    method: action.method ?? 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operation: payload.operation,
      destination_path: requireAbsolutePath(payload.destination_path, 'destination_path'),
    }),
  })
}

export async function deletePathByAction(
  action: ActionLink,
  auth: RequestAuth,
  baseUrl?: string,
  options?: { force?: boolean },
) {
  const href = new URL(buildAbsoluteUrl(action.href, baseUrl))
  if (options?.force) {
    href.searchParams.set('force', 'true')
  }

  const response = await fetch(href.toString(), {
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

    throw buildApiError(response.status, payload)
  }
}

export function uploadPathContents(
  payload: {
    parent_path: string
    file_name: string
    content: File
    checksum?: boolean
    overwrite?: boolean
  },
  auth: RequestAuth,
  baseUrl?: string,
  options?: {
    onProgress?: (progress: { loaded: number; total: number }) => void
    signal?: AbortSignal
  },
) {
  return new Promise<PathContentsUploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()

    formData.set('parent_path', requireAbsolutePath(payload.parent_path, 'parent_path'))
    formData.set('file_name', payload.file_name)
    formData.set('content', payload.content)

    if (payload.checksum !== undefined) {
      formData.set('checksum', `${payload.checksum}`)
    }

    if (payload.overwrite !== undefined) {
      formData.set('overwrite', `${payload.overwrite}`)
    }

    xhr.open('POST', buildUrl('/api/v1/path/contents', baseUrl))

    const headers = buildHeaders(auth)
    for (const [key, value] of Object.entries(headers ?? {})) {
      xhr.setRequestHeader(key, value)
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options?.onProgress?.({
          loaded: event.loaded,
          total: event.total,
        })
      }
    }

    xhr.onerror = () => {
      reject(new ApiError(0, 'Upload failed because the network request could not be completed.'))
    }

    xhr.onabort = () => {
      reject(new ApiError(0, 'Upload was cancelled.'))
    }

    xhr.onload = () => {
      const responseText = xhr.responseText?.trim() ?? ''
      let parsedPayload: unknown = null

      if (responseText) {
        try {
          parsedPayload = JSON.parse(responseText)
        } catch {
          parsedPayload = null
        }
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsedPayload as PathContentsUploadResponse)
        return
      }

      reject(buildApiError(xhr.status, (parsedPayload as ApiErrorPayload | null) ?? null))
    }

    if (options?.signal) {
      if (options.signal.aborted) {
        xhr.abort()
        return
      }

      options.signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(formData)
  })
}

export function getPathReplicas(
  irodsPath: string,
  auth: RequestAuth,
  baseUrl?: string,
  options?: { verbose?: number },
) {
  return request<PathReplicasResponse>(`/api/v1/path/replicas${withPath(irodsPath, options)}`, {
    auth,
    baseUrl,
  })
}

export function addPathReplica(
  irodsPath: string,
  payload: {
    resource: string
    update?: boolean
  },
  auth: RequestAuth,
  baseUrl?: string,
) {
  return request<PathReplicasResponse>(`/api/v1/path/replicas${withPath(irodsPath)}`, {
    auth,
    baseUrl,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function movePathReplica(
  irodsPath: string,
  payload: {
    source_resource: string
    destination_resource: string
    update?: boolean
    min_copies?: number
    min_age_minutes?: number
  },
  auth: RequestAuth,
  baseUrl?: string,
) {
  return request<PathReplicasResponse>(`/api/v1/path/replicas${withPath(irodsPath)}`, {
    auth,
    baseUrl,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function trimPathReplica(
  irodsPath: string,
  payload: {
    resource?: string
    replica_number?: number
    min_copies?: number
    min_age_minutes?: number
  },
  auth: RequestAuth,
  baseUrl?: string,
) {
  return request<PathReplicasResponse>(`/api/v1/path/replicas${withPath(irodsPath)}`, {
    auth,
    baseUrl,
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function getPathAVUs(irodsPath: string, auth: RequestAuth, baseUrl?: string) {
  return request<PathAVUResponse>(`/api/v1/path/avu${withPath(irodsPath)}`, {
    auth,
    baseUrl,
  })
}

export function getPathACL(irodsPath: string, auth: RequestAuth, baseUrl?: string) {
  return request<PathACLResponse>(`/api/v1/path/acl${withPath(irodsPath)}`, {
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

    throw buildApiError(response.status, payload)
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

    throw buildApiError(response.status, payload)
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

export function addPathACL(
  action: ActionLink,
  payload: {
    name: string
    type?: 'user' | 'group'
    zone?: string
    access_level: string
    recursive?: boolean
  },
  auth: RequestAuth,
  baseUrl?: string,
) {
  return request<{ acl?: PathACLEntry }>(action.href, {
    auth,
    baseUrl,
    method: action.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function updatePathACL(
  action: ActionLink,
  payload: {
    access_level: string
    recursive?: boolean
  },
  auth: RequestAuth,
  baseUrl?: string,
) {
  return request<{ acl?: PathACLEntry }>(action.href, {
    auth,
    baseUrl,
    method: action.method ?? 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function deletePathACL(action: ActionLink, auth: RequestAuth, baseUrl?: string) {
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

    throw buildApiError(response.status, payload)
  }
}

export async function invokeActionLink(
  action: ActionLink,
  auth: RequestAuth,
  baseUrl?: string,
  options?: {
    method?: string
    body?: BodyInit
    headers?: Record<string, string>
  },
) {
  const response = await fetch(buildUrl(action.href, baseUrl), {
    method: options?.method ?? action.method ?? 'POST',
    headers: {
      ...buildHeaders(auth),
      ...options?.headers,
    },
    body: options?.body,
  })

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null

    try {
      payload = (await response.json()) as ApiErrorPayload
    } catch {
      // Fall back to the HTTP status when the response body is not JSON.
    }

    throw buildApiError(response.status, payload)
  }
}

export async function setPathACLInheritance(
  action: ActionLink,
  payload: {
    enabled: boolean
    recursive?: boolean
  },
  auth: RequestAuth,
  baseUrl?: string,
) {
  const response = await fetch(buildUrl(action.href, baseUrl), {
    method: action.method ?? 'PUT',
    headers: {
      ...buildHeaders(auth),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null

    try {
      payload = (await response.json()) as ApiErrorPayload
    } catch {
      // Fall back to the HTTP status when the response body is not JSON.
    }

    throw buildApiError(response.status, payload)
  }
}

export async function deletePathACLInheritance(
  action: ActionLink,
  options: {
    recursive?: boolean
  },
  auth: RequestAuth,
  baseUrl?: string,
) {
  const href = new URL(buildAbsoluteUrl(action.href, baseUrl))
  if (options.recursive) {
    href.searchParams.set('recursive', 'true')
  }

  const response = await fetch(href.toString(), {
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

    throw buildApiError(response.status, payload)
  }
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
