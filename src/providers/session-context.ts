import { createContext } from 'react'
import type {
  AuthMode,
  CurrentUserMembershipResponse,
  RequestAuth,
} from '../lib/irods-rest'

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
  currentUserMembership: CurrentUserMembershipResponse | null
  signInBasic: (input: {
    username: string
    password: string
    baseUrl: string
    basicAuthType: string
    currentUserMembership: CurrentUserMembershipResponse
  }) => void
  signInOidc: (input: {
    token: string
    baseUrl: string
    currentUserMembership: CurrentUserMembershipResponse
  }) => void
  updateBaseUrl: (baseUrl: string) => void
  setPreferredAuthMode: (mode: AuthMode) => void
  clearSession: () => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)
