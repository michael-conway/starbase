export interface StarbaseAuthModeOption {
  mode: string
  authName: string
}

export interface StarbaseConfig {
  title: string
  subtitle: string
  authModes: StarbaseAuthModeOption[]
  s3AdminEnabled: boolean
}

export const defaultStarbaseConfig: StarbaseConfig = {
  title: 'Starbase',
  subtitle: 'iRODS Explorer',
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
  const authModes = parseAuthModes(lines)
  const s3AdminEnabled = parseBooleanKey(
    lines,
    'S3AdminEnabled',
    defaultStarbaseConfig.s3AdminEnabled,
  )

  return {
    title,
    subtitle,
    authModes: authModes.length > 0 ? authModes : defaultStarbaseConfig.authModes,
    s3AdminEnabled,
  }
}

function configPathForEnvironment(configEnv?: string) {
  const normalizedEnv = configEnv?.trim()
  if (!normalizedEnv) {
    return '/config/starbase.yaml'
  }

  return `/config/starbase.${normalizedEnv}.yaml`
}

export function resolveStarbaseConfigPath() {
  return configPathForEnvironment(import.meta.env.STARBASE_CONFIG_ENV)
}

export async function loadStarbaseConfig(path = resolveStarbaseConfigPath()) {
  const response = await fetch(path, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Unable to load config from ${path} (${response.status})`)
  }

  const raw = await response.text()
  return parseStarbaseYamlConfig(raw)
}
