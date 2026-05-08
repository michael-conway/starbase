import { createContext } from 'react'
import type { StarbaseConfig } from '../config/starbase-config'

export interface AppConfigContextValue {
  config: StarbaseConfig
  configPath: string
  isLoading: boolean
  error: string | null
}

export const AppConfigContext = createContext<AppConfigContextValue | null>(null)
