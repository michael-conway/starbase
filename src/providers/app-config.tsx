import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  defaultStarbaseConfig,
  loadStarbaseConfig,
  resolveStarbaseConfigPath,
  type StarbaseConfig,
} from '../config/starbase-config'
import { AppConfigContext, type AppConfigContextValue } from './app-config-context'

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const configPath = resolveStarbaseConfigPath()
  const [config, setConfig] = useState<StarbaseConfig>(defaultStarbaseConfig)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    const load = async () => {
      console.info(`[starbase] Loading startup config from ${configPath}`)
      try {
        const loaded = await loadStarbaseConfig(configPath)
        if (!isCancelled) {
          setConfig(loaded)
          setError(null)
        }
        console.info(`[starbase] Loaded startup config from ${configPath}`)
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : 'Unable to load startup configuration'
        console.warn(`[starbase] ${message}. Falling back to defaults.`)
        if (!isCancelled) {
          setError(message)
          setConfig(defaultStarbaseConfig)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [configPath])

  const value = useMemo<AppConfigContextValue>(
    () => ({
      config,
      configPath,
      isLoading,
      error,
    }),
    [config, configPath, isLoading, error],
  )

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>
}
