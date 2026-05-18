import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { RequestAuth } from '../lib/irods-rest'
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
      : Boolean(secrets.token)

  const value = useMemo<SessionContextValue>(
    () => ({
      isAuthenticated,
      connection,
      preferences,
      oidcToken: secrets.token,
      basicUsername: secrets.username,
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
        setPreferences({
          authMode: 'oidc',
          baseUrl: baseUrl.trim(),
          basicAuthType: preferences.basicAuthType,
        })
        setSecrets({
          token: token.trim(),
          username: '',
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
    [connection, isAuthenticated, preferences, secrets],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
