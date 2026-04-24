import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthMode, RequestAuth } from '../lib/irods-rest'

interface StoredPreferences {
  authMode: AuthMode
  baseUrl: string
}

interface SessionSecretState {
  token: string
  username: string
  password: string
}

interface SessionContextValue {
  isAuthenticated: boolean
  connection: {
    auth: RequestAuth
    baseUrl: string
  }
  preferences: StoredPreferences
  oidcToken: string
  basicUsername: string
  signInBasic: (input: { username: string; password: string; baseUrl: string }) => void
  signInOidc: (input: { token: string; baseUrl: string }) => void
  updateBaseUrl: (baseUrl: string) => void
  setPreferredAuthMode: (mode: AuthMode) => void
  clearSession: () => void
}

const preferencesStorageKey = 'starbase.preferences'
const secretsStorageKey = 'starbase.session'

const defaultPreferences: StoredPreferences = {
  authMode: 'basic',
  baseUrl: '',
}

const defaultSecrets: SessionSecretState = {
  token: '',
  username: '',
  password: '',
}

const SessionContext = createContext<SessionContextValue | null>(null)

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
  const [preferences, setPreferences] = useState<StoredPreferences>(() =>
    readLocalStorage(preferencesStorageKey, defaultPreferences),
  )
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
      signInBasic: ({ username, password, baseUrl }) => {
        setPreferences({
          authMode: 'basic',
          baseUrl: baseUrl.trim(),
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

export function useSession() {
  const context = useContext(SessionContext)

  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }

  return context
}
