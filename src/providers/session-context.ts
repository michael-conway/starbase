import { createContext } from 'react'
import type { AuthMode, RequestAuth } from '../lib/irods-rest'

export interface StoredPreferences {
  authMode: AuthMode
  baseUrl: string
  basicAuthType: string
}

export interface SessionContextValue {
  isAuthenticated: boolean
  connection: {
    auth: RequestAuth
    baseUrl: string
  }
  preferences: StoredPreferences
  oidcToken: string
  basicUsername: string
  signInBasic: (input: {
    username: string
    password: string
    baseUrl: string
    basicAuthType: string
  }) => void
  signInOidc: (input: { token: string; baseUrl: string }) => void
  updateBaseUrl: (baseUrl: string) => void
  setPreferredAuthMode: (mode: AuthMode) => void
  clearSession: () => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)
