import { lazy, Suspense, type ComponentType } from 'react'
import { Loader, Stack } from '@mantine/core'
import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom'
import App from './App'
import { primarySections } from './app-sections'
import { LoginPage } from './pages/LoginPage'
import { SetupPage } from './pages/SetupPage'
import { useSession } from './providers/session'

function HomeRedirect() {
  const { isAuthenticated } = useSession()
  return <Navigate to={isAuthenticated ? '/app/explorer' : '/login'} replace />
}

function RequireSession() {
  const { isAuthenticated } = useSession()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

function RouteFallback() {
  return (
    <Stack align="center" justify="center" py="xl" mih={240}>
      <Loader color="teal" />
    </Stack>
  )
}

function lazyElement(
  loadModule: () => Promise<Record<string, unknown>>,
  exportName: string,
) {
  const LazyComponent = lazy(async () => {
    const module = await loadModule()
    return {
      default: module[exportName] as ComponentType,
    }
  })

  return (
    <Suspense fallback={<RouteFallback />}>
      <LazyComponent />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomeRedirect />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/setup',
    element: <SetupPage />,
  },
  {
    path: '/app',
    element: <RequireSession />,
    children: [
      {
        element: <App />,
        children: [
          {
            index: true,
            element: <Navigate to="/app/explorer" replace />,
          },
          ...primarySections.map((section) => ({
            path: section.slug,
            element: lazyElement(section.importPage, section.exportName),
          })),
          {
            path: 'setup',
            element: <SetupPage />,
          },
        ],
      },
    ],
  },
])
