export interface StarbaseAuthModeOption {
  mode: string
  authName: string
}

export interface StarbaseConfig {
  title: string
  subtitle: string
  restApiBaseUrl: string
  oidcAuthorizationEndpoint: string
  oidcTokenEndpoint: string
  oidcClientId: string
  oidcScope: string
  oidcRedirectPath: string
  authModes: StarbaseAuthModeOption[]
  s3AdminEnabled: boolean
}

const buildTimeRestApiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL ?? '')

export const defaultStarbaseConfig: StarbaseConfig = {
  title: 'Starbase',
  subtitle: 'iRODS Explorer',
  restApiBaseUrl: buildTimeRestApiBaseUrl,
  oidcAuthorizationEndpoint: '',
  oidcTokenEndpoint: '',
  oidcClientId: '',
  oidcScope: 'openid profile email',
  oidcRedirectPath: '/auth/callback',
  authModes: [
    {
      mode: 'native',
      authName: 'irods auth',
    },
    {
      mode: 'pam',
      authName: 'pam auth',
    },
  ],
  s3AdminEnabled: false,
}

function parseYamlScalar(value: string) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '/') {
    return ''
  }

  return trimmed.replace(/\/+$/, '')
}

function normalizeOptionalOidcUrlOrPath(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function normalizeOidcScope(value: string) {
  const trimmed = value.trim()
  return trimmed || defaultStarbaseConfig.oidcScope
}

function normalizeOidcRedirectPath(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return defaultStarbaseConfig.oidcRedirectPath
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export function resolveOidcPkceUrl(pathOrUrl: string) {
  const normalized = normalizeOptionalOidcUrlOrPath(pathOrUrl)
  if (!normalized) {
    return ''
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized
  }

  return `${window.location.origin}${normalized}`
}

export function resolveOidcPkceRedirectUri(redirectPath: string) {
  const normalizedPath = normalizeOidcRedirectPath(redirectPath)
  return `${window.location.origin}${normalizedPath}`
}

export function hasDirectOidcPkceConfig(config: StarbaseConfig) {
  return Boolean(
    config.oidcAuthorizationEndpoint.trim() &&
      config.oidcTokenEndpoint.trim() &&
      config.oidcClientId.trim(),
  )
}

function parseStringKey(lines: string[], key: string, fallback: string) {
  const pattern = new RegExp(`^${key}\\s*:\\s*(.*)$`, 'i')

  for (const rawLine of lines) {
    const lineWithoutComment = rawLine.replace(/\s+#.*$/, '')
    const trimmed = lineWithoutComment.trim()
    if (!trimmed) {
      continue
    }

    const match = trimmed.match(pattern)
    if (!match) {
      continue
    }

    return parseYamlScalar(match[1])
  }

  return fallback
}

function parseAuthModes(lines: string[]) {
  const parsed: StarbaseAuthModeOption[] = []
  let current: Partial<StarbaseAuthModeOption> | null = null
  let inAuthMode = false

  const flush = () => {
    if (!current) {
      return
    }

    const mode = current.mode?.trim()
    const authName = current.authName?.trim()
    if (mode && authName) {
      parsed.push({ mode, authName })
    }
    current = null
  }

  for (const rawLine of lines) {
    const lineWithoutComment = rawLine.replace(/\s+#.*$/, '')
    const trimmed = lineWithoutComment.trim()
    if (!trimmed) {
      continue
    }

    if (!inAuthMode) {
      if (/^AuthMode\s*:/i.test(trimmed)) {
        inAuthMode = true
      }
      continue
    }

    if (!lineWithoutComment.startsWith(' ') && !lineWithoutComment.startsWith('\t')) {
      flush()
      break
    }

    if (trimmed.startsWith('-')) {
      flush()
      current = {}

      const afterDash = trimmed.slice(1).trim()
      if (!afterDash) {
        continue
      }

      const modeInline = afterDash.match(/^Mode\s*:\s*(.+)$/i)
      if (modeInline) {
        current.mode = parseYamlScalar(modeInline[1])
        continue
      }

      const modeKey = afterDash.match(/^([A-Za-z0-9_-]+)\s*:\s*$/)
      if (modeKey) {
        current.mode = modeKey[1]
        continue
      }

      current.mode = parseYamlScalar(afterDash)
      continue
    }

    if (!current) {
      continue
    }

    const modeLine = trimmed.match(/^Mode\s*:\s*(.+)$/i)
    if (modeLine) {
      current.mode = parseYamlScalar(modeLine[1])
      continue
    }

    const authNameLine = trimmed.match(/^AuthName\s*:\s*(.+)$/i)
    if (authNameLine) {
      current.authName = parseYamlScalar(authNameLine[1])
    }
  }

  flush()

  return parsed
}

function parseTitle(lines: string[]) {
  for (const rawLine of lines) {
    const lineWithoutComment = rawLine.replace(/\s+#.*$/, '')
    const trimmed = lineWithoutComment.trim()
    if (!trimmed) {
      continue
    }

    const titleLine = trimmed.match(/^Title\s*:\s*(.+)$/i)
    if (!titleLine) {
      continue
    }

    const parsed = parseYamlScalar(titleLine[1]).trim()
    if (parsed) {
      return parsed
    }
  }

  return defaultStarbaseConfig.title
}

function parseSubtitle(lines: string[]) {
  for (const rawLine of lines) {
    const lineWithoutComment = rawLine.replace(/\s+#.*$/, '')
    const trimmed = lineWithoutComment.trim()
    if (!trimmed) {
      continue
    }

    const subtitleLine = trimmed.match(/^Subtitle\s*:\s*(.+)$/i)
    if (!subtitleLine) {
      continue
    }

    const parsed = parseYamlScalar(subtitleLine[1]).trim()
    if (parsed) {
      return parsed
    }
  }

  return defaultStarbaseConfig.subtitle
}

function parseBooleanKey(lines: string[], key: string, fallback: boolean) {
  const pattern = new RegExp(`^${key}\\s*:\\s*(.+)$`, 'i')

  for (const rawLine of lines) {
    const lineWithoutComment = rawLine.replace(/\s+#.*$/, '')
    const trimmed = lineWithoutComment.trim()
    if (!trimmed) {
      continue
    }

    const match = trimmed.match(pattern)
    if (!match) {
      continue
    }

    const parsed = parseYamlScalar(match[1]).trim().toLowerCase()
    if (['true', 'yes', 'on', '1'].includes(parsed)) {
      return true
    }
    if (['false', 'no', 'off', '0'].includes(parsed)) {
      return false
    }
  }

  return fallback
}

export function parseStarbaseYamlConfig(yaml: string): StarbaseConfig {
  const lines = yaml.split(/\r?\n/)
  const title = parseTitle(lines)
  const subtitle = parseSubtitle(lines)
  const restApiBaseUrl = normalizeBaseUrl(
    parseStringKey(lines, 'RestAPIBaseURL', defaultStarbaseConfig.restApiBaseUrl),
  )
  const oidcAuthorizationEndpoint = normalizeOptionalOidcUrlOrPath(
    parseStringKey(
      lines,
      'OIDCAuthorizationEndpoint',
      defaultStarbaseConfig.oidcAuthorizationEndpoint,
    ),
  )
  const oidcTokenEndpoint = normalizeOptionalOidcUrlOrPath(
    parseStringKey(lines, 'OIDCTokenEndpoint', defaultStarbaseConfig.oidcTokenEndpoint),
  )
  const oidcClientId = parseStringKey(lines, 'OIDCClientID', defaultStarbaseConfig.oidcClientId)
    .trim()
  const oidcScope = normalizeOidcScope(
    parseStringKey(lines, 'OIDCScope', defaultStarbaseConfig.oidcScope),
  )
  const oidcRedirectPath = normalizeOidcRedirectPath(
    parseStringKey(lines, 'OIDCRedirectPath', defaultStarbaseConfig.oidcRedirectPath),
  )
  const authModes = parseAuthModes(lines)
  const s3AdminEnabled = parseBooleanKey(
    lines,
    'S3AdminEnabled',
    defaultStarbaseConfig.s3AdminEnabled,
  )

  return {
    title,
    subtitle,
    restApiBaseUrl,
    oidcAuthorizationEndpoint,
    oidcTokenEndpoint,
    oidcClientId,
    oidcScope,
    oidcRedirectPath,
    authModes: authModes.length > 0 ? authModes : defaultStarbaseConfig.authModes,
    s3AdminEnabled,
  }
}

const defaultConfigPath = '/config/starbase.yaml'

function looksLikeFilesystemPath(value: string) {
  const normalized = value.trim()
  return (
    normalized.startsWith('/Users/') ||
    normalized.startsWith('/home/') ||
    normalized.startsWith('/var/') ||
    /^[A-Za-z]:[\\/]/.test(normalized)
  )
}

function isSupportedConfigPath(value: string) {
  return (
    value.startsWith('/') ||
    value.startsWith('http://') ||
    value.startsWith('https://')
  )
}

export function resolveStarbaseConfigPath() {
  const configured = import.meta.env.VITE_STARBASE_CONFIG_PATH?.trim()
  if (!configured) {
    return defaultConfigPath
  }

  if (looksLikeFilesystemPath(configured)) {
    console.warn(
      `[starbase] Ignoring VITE_STARBASE_CONFIG_PATH=${configured} because browser config must be an HTTP(S) or site-relative path.`,
    )
    return defaultConfigPath
  }

  if (isSupportedConfigPath(configured)) {
    return configured
  }

  console.warn(
    `[starbase] Ignoring VITE_STARBASE_CONFIG_PATH=${configured} because it is not an HTTP(S) or site-relative path.`,
  )
  return defaultConfigPath
}

export async function loadStarbaseConfig(path = resolveStarbaseConfigPath()) {
  const response = await fetch(path, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Unable to load config from ${path} (${response.status})`)
  }

  const raw = await response.text()
  return parseStarbaseYamlConfig(raw)
}
