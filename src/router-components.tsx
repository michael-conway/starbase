import { Loader, Stack } from '@mantine/core'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { StarbaseConfig } from './config/starbase-config'
import { useAppConfig } from './providers/use-app-config'
import { useSession } from './providers/use-session'

export function HomeRedirect() {
  const { isAuthenticated } = useSession()
  return <Navigate to={isAuthenticated ? '/app/explorer' : '/login'} replace />
}

export function RequireSession() {
  const { isAuthenticated } = useSession()
  const location = useLocation()

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />
  }

  return <Outlet />
}

export function ConfigEnabledRoute({
  children,
  isEnabled,
}: {
  children: ReactNode
  isEnabled?: (config: StarbaseConfig) => boolean
}) {
  const { config } = useAppConfig()

  if (isEnabled && !isEnabled(config)) {
    return <Navigate to="/app/explorer" replace />
  }

  return children
}

export function RouteFallback() {
  return (
    <Stack align="center" justify="center" py="xl" mih={240}>
      <Loader color="teal" />
    </Stack>
  )
}
