import { useContext } from 'react'
import { AppConfigContext } from './app-config-context'

export function useAppConfig() {
  const context = useContext(AppConfigContext)
  if (!context) {
    throw new Error('useAppConfig must be used within an AppConfigProvider')
  }

  return context
}
