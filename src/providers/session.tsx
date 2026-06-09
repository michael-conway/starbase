import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { addBearerTokenExpiredListener, type RequestAuth } from '../lib/irods-rest'
import {
  SessionContext,
  type SessionContextValue,
  type StoredPreferences,
} from './session-context'
import { useAppConfig } from './use-app-config'

interface SessionSecretState {
  token: string
  username: string
  password: string
}

const preferencesStorageKey = 'starbase.preferences'
const secretsStorageKey = 'starbase.session'

const defaultPreferences: StoredPreferences = {
  authMode: 'basic',
  baseUrl: '',
  basicAuthType: 'native',
}

const defaultSecrets: SessionSecretState = {
  token: '',
  username: '',
  password: '',
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) {
    return null
  }

  const payloadSegment = parts[1]
  const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`

  try {
    const decoded = window.atob(padded)
    const parsed = JSON.parse(decoded) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function oidcUsernameFromToken(token: string) {
  const payload = decodeJwtPayload(token.trim())
  if (!payload) {
    return ''
  }

  const candidates = [
    payload.preferred_username,
    payload.username,
    payload.upn,
    payload.email,
    payload.sub,
  ]

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue
    }

    const trimmed = candidate.trim()
    if (!trimmed) {
      continue
    }

    if (trimmed.includes('@')) {
      const localPart = trimmed.split('@')[0]?.trim()
      if (localPart) {
        return localPart
      }
    }

    return trimmed
  }

  return ''
}

function isJwtExpired(token: string) {
  const payload = decodeJwtPayload(token.trim())
  const expiresAt = payload?.exp

  if (typeof expiresAt !== 'number') {
    return false
  }

  return Date.now() >= expiresAt * 1000
}

function readLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function readSessionStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const appConfig = useAppConfig()
  const [preferences, setPreferences] = useState<StoredPreferences>(() => {
    const configuredBaseUrl = appConfig.config.restApiBaseUrl.trim()
    const stored = readLocalStorage<StoredPreferences | Partial<StoredPreferences>>(
      preferencesStorageKey,
      defaultPreferences,
    )

    return {
      ...defaultPreferences,
      ...stored,
      baseUrl:
        typeof stored.baseUrl === 'string' && stored.baseUrl.trim()
          ? stored.baseUrl.trim()
          : configuredBaseUrl,
      basicAuthType:
        typeof stored.basicAuthType === 'string' && stored.basicAuthType.trim()
          ? stored.basicAuthType.trim()
          : defaultPreferences.basicAuthType,
    }
  })
  const [secrets, setSecrets] = useState<SessionSecretState>(() =>
    readSessionStorage(secretsStorageKey, defaultSecrets),
  )

  useEffect(() => {
    window.localStorage.setItem(preferencesStorageKey, JSON.stringify(preferences))
  }, [preferences])

  useEffect(() => {
    window.sessionStorage.setItem(secretsStorageKey, JSON.stringify(secrets))
  }, [secrets])

  useEffect(() => {
    return addBearerTokenExpiredListener(() => {
      setSecrets((current) => ({
        ...current,
        token: '',
      }))
    })
  }, [])

  useEffect(() => {
    if (preferences.authMode !== 'oidc' || !secrets.token || !isJwtExpired(secrets.token)) {
      return
    }

    setSecrets((current) => ({
      ...current,
      token: '',
    }))
  }, [preferences.authMode, secrets.token])

  const connection = useMemo(() => {
    const auth: RequestAuth =
      preferences.authMode === 'basic'
        ? {
            mode: 'basic',
            username: secrets.username,
            password: secrets.password,
            basicAuthType: preferences.basicAuthType,
          }
        : {
            mode: 'oidc',
            token: secrets.token,
          }

    return {
      auth,
      baseUrl: preferences.baseUrl,
    }
  }, [preferences, secrets])

  const isAuthenticated =
    preferences.authMode === 'basic'
      ? Boolean(secrets.username && secrets.password)
      : Boolean(secrets.token && !isJwtExpired(secrets.token))
  const oidcDerivedUsername = useMemo(
    () => oidcUsernameFromToken(secrets.token),
    [secrets.token],
  )
  const effectiveUsername =
    preferences.authMode === 'oidc'
      ? (secrets.username.trim() || oidcDerivedUsername)
      : secrets.username

  const value = useMemo<SessionContextValue>(
    () => ({
      isAuthenticated,
      connection,
      preferences,
      oidcToken: secrets.token,
      basicUsername: effectiveUsername,
      signInBasic: ({ username, password, baseUrl, basicAuthType }) => {
        setPreferences({
          authMode: 'basic',
          baseUrl: baseUrl.trim(),
          basicAuthType: basicAuthType.trim() || defaultPreferences.basicAuthType,
        })
        setSecrets({
          token: '',
          username: username.trim(),
          password,
        })
      },
      signInOidc: ({ token, baseUrl }) => {
        const normalizedToken = token.trim()
        setPreferences({
          authMode: 'oidc',
          baseUrl: baseUrl.trim(),
          basicAuthType: preferences.basicAuthType,
        })
        setSecrets({
          token: normalizedToken,
          username: oidcUsernameFromToken(normalizedToken),
          password: '',
        })
      },
      updateBaseUrl: (baseUrl) => {
        setPreferences((current) => ({
          ...current,
          baseUrl: baseUrl.trim(),
        }))
      },
      setPreferredAuthMode: (mode) => {
        setPreferences((current) => ({
          ...current,
          authMode: mode,
        }))
      },
      clearSession: () => {
        setSecrets(defaultSecrets)
      },
    }),
    [connection, effectiveUsername, isAuthenticated, preferences, secrets],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
