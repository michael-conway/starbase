import { lazy, Suspense, type ComponentType } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import App from './App'
import { primarySections } from './app-sections'
import { ExplorerDetailsPage } from './pages/ExplorerDetailsPage'
import { ExplorerPreviewPage } from './pages/ExplorerPreviewPage'
import { LoginPage } from './pages/LoginPage'
import { OidcCallbackPage } from './pages/OidcCallbackPage'
import { ResourceDetailsPage } from './pages/ResourceDetailsPage'
import { SettingsPage } from './pages/SettingsPage'
import { SetupPage } from './pages/SetupPage'
import { HomeRedirect, RequireSession, RouteFallback } from './router-components'

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
    path: '/auth/*',
    element: <OidcCallbackPage />,
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
            path: 'explorer/details',
            element: <ExplorerDetailsPage />,
          },
          {
            path: 'explorer/preview',
            element: <ExplorerPreviewPage />,
          },
          {
            path: 'resources/details',
            element: <ResourceDetailsPage />,
          },
          {
            path: 'search/queries',
            element: lazyElement(() => import('./pages/SearchPage'), 'SearchPage'),
          },
          {
            path: 'search/queries/new',
            element: lazyElement(() => import('./pages/SearchPage'), 'SearchPage'),
          },
          {
            path: 'search/queries/:queryId/edit',
            element: lazyElement(() => import('./pages/SearchPage'), 'SearchPage'),
          },
          {
            path: 'search/results/:queryId',
            element: lazyElement(() => import('./pages/SearchPage'), 'SearchPage'),
          },
          {
            path: 'settings',
            element: <SettingsPage />,
          },
          {
            path: 'setup',
            element: <SetupPage />,
          },
        ],
      },
    ],
  },
])
