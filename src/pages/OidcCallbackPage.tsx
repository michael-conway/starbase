import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Alert, Container, Loader, Stack, Text, Title } from '@mantine/core'
import {
  resolveOidcPkceRedirectUri,
  resolveOidcPkceUrl,
  type StarbaseConfig,
} from '../config/starbase-config'
import { clearOidcPkceSignInTransaction, completeOidcPkceSignIn } from '../features/oidc-pkce'
import { useAppConfig } from '../providers/use-app-config'
import { useSession } from '../providers/use-session'

function validatePkceConfig(config: StarbaseConfig) {
  const authorizationEndpoint = resolveOidcPkceUrl(config.oidcAuthorizationEndpoint)
  const tokenEndpoint = resolveOidcPkceUrl(config.oidcTokenEndpoint)
  const clientId = config.oidcClientId.trim()
  const redirectUri = resolveOidcPkceRedirectUri(config.oidcRedirectPath)

  if (!authorizationEndpoint || !tokenEndpoint || !clientId) {
    return null
  }

  return {
    authorizationEndpoint,
    tokenEndpoint,
    clientId,
    redirectUri,
  }
}

export function OidcCallbackPage() {
  const { config } = useAppConfig()
  const location = useLocation()
  const { isAuthenticated, signInOidc } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [isCompleting, setIsCompleting] = useState(true)

  useEffect(() => {
    let cancelled = false

    const complete = async () => {
      setIsCompleting(true)
      setError(null)

      const params = new URLSearchParams(location.search)
      const oauthError = params.get('error')?.trim()
      const oauthErrorDescription = params.get('error_description')?.trim()
      const code = params.get('code')?.trim()
      const state = params.get('state')?.trim()

      if (oauthError) {
        if (!cancelled) {
          setError(
            oauthErrorDescription ? `${oauthError}: ${oauthErrorDescription}` : oauthError,
          )
          setIsCompleting(false)
        }
        return
      }

      if (!code || !state) {
        if (!cancelled) {
          setError('Callback is missing code or state.')
          setIsCompleting(false)
        }
        return
      }

      const pkceConfig = validatePkceConfig(config)
      if (!pkceConfig) {
        if (!cancelled) {
          setError('OIDC PKCE is not configured in starbase.yaml.')
          setIsCompleting(false)
        }
        return
      }

      try {
        const result = await completeOidcPkceSignIn({
          tokenEndpoint: pkceConfig.tokenEndpoint,
          clientId: pkceConfig.clientId,
          redirectUri: pkceConfig.redirectUri,
          code,
          state,
        })

        if (!cancelled) {
          signInOidc({
            token: result.accessToken,
            baseUrl: result.baseUrl,
          })
          setIsCompleting(false)
        }
      } catch (completionError) {
        clearOidcPkceSignInTransaction()
        if (!cancelled) {
          setError(
            completionError instanceof Error
              ? completionError.message
              : 'Unable to complete OIDC sign-in.',
          )
          setIsCompleting(false)
        }
      }
    }

    void complete()

    return () => {
      cancelled = true
    }
  }, [config, location.search, signInOidc])

  if (isAuthenticated) {
    return <Navigate to="/app/explorer" replace />
  }

  return (
    <Container size="sm" py={64}>
      <Stack gap="md" align="stretch">
        <Title order={2}>OIDC sign-in</Title>
        {isCompleting ? (
          <Stack gap="xs">
            <Loader size="sm" />
            <Text c="dimmed">Completing sign-in...</Text>
          </Stack>
        ) : null}
        {error ? (
          <Alert color="red" variant="light" title="Sign-in failed">
            {error}
          </Alert>
        ) : null}
        {!isCompleting && error ? (
          <Text c="dimmed" size="sm">
            Return to /login and start sign-in again.
          </Text>
        ) : null}
      </Stack>
    </Container>
  )
}
