import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  type CSSVariablesResolver,
  MantineProvider,
  createTheme,
} from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'
import { router } from './router'
import { SessionProvider } from './providers/session'
import { UploadProvider } from './providers/upload-provider'

const theme = createTheme({
  primaryColor: 'teal',
  primaryShade: 6,
  fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
  headings: {
    fontFamily: '"Source Serif 4", "Iowan Old Style", "Palatino Linotype", serif',
  },
  defaultRadius: 'md',
})

const resolver: CSSVariablesResolver = () => ({
  variables: {
    '--app-bg': '#f3f6f8',
    '--app-bg-accent': 'rgba(15, 118, 110, 0.08)',
    '--app-shell': 'rgba(255, 255, 255, 0.92)',
    '--app-panel': '#ffffff',
    '--app-panel-strong': '#f7fafb',
    '--app-border': 'rgba(15, 23, 42, 0.12)',
    '--app-text': '#132238',
    '--app-text-muted': '#516173',
    '--app-accent': '#0f766e',
    '--app-accent-soft': 'rgba(15, 118, 110, 0.12)',
    '--app-nav-active': 'rgba(15, 118, 110, 0.1)',
  },
  light: {},
  dark: {},
})

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} cssVariablesResolver={resolver} defaultColorScheme="light">
        <Notifications position="top-right" />
        <SessionProvider>
          <UploadProvider>
            <RouterProvider router={router} />
          </UploadProvider>
        </SessionProvider>
      </MantineProvider>
    </QueryClientProvider>
  </StrictMode>,
)
