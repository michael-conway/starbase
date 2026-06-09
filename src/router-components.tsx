import { Loader, Stack } from '@mantine/core'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
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

export function RouteFallback() {
  return (
    <Stack align="center" justify="center" py="xl" mih={240}>
      <Loader color="teal" />
    </Stack>
  )
}
