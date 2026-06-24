import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Alert, Container, Loader, Stack, Text, Title } from '@mantine/core'
import {
  resolveOidcPkceRedirectUri,
  resolveOidcPkceUrl,
  type StarbaseConfig,
} from '../config/starbase-config'
import { clearOidcPkceSignInTransaction, completeOidcPkceSignIn } from '../features/oidc-pkce'
import { getCurrentUserMembership } from '../lib/irods-rest'
import { useAppConfig } from '../providers/use-app-config'
import { useSession } from '../providers/use-session'

interface OidcExchangeResult {
  accessToken: string
  baseUrl: string
  returnTo: string
}

function safeReturnTo(value: string) {
  const trimmed = value.trim()

  if ((trimmed !== '/app' && !trimmed.startsWith('/app/')) || trimmed.startsWith('//')) {
    return '/app/explorer'
  }

  return trimmed
}

const inFlightOidcExchanges = new Map<string, Promise<OidcExchangeResult>>()

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
  const [returnTo, setReturnTo] = useState('/app/explorer')

  useEffect(() => {
    let cancelled = false

    const complete = async () => {
      setIsCompleting(true)
      setError(null)

      const params = new URLSearchParams(location.search)
      const oauthError = params.get('error')?.trim()
      const code = params.get('code')?.trim()
      const state = params.get('state')?.trim()
      const exchangeKey = code && state ? `${state}:${code}` : ''

      if (oauthError) {
        if (!cancelled) {
          setError('OIDC sign-in was not completed. Start sign-in again.')
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
        let exchange = inFlightOidcExchanges.get(exchangeKey)
        if (!exchange) {
          exchange = completeOidcPkceSignIn({
            tokenEndpoint: pkceConfig.tokenEndpoint,
            clientId: pkceConfig.clientId,
            redirectUri: pkceConfig.redirectUri,
            code,
            state,
          }).finally(() => {
            inFlightOidcExchanges.delete(exchangeKey)
          })
          inFlightOidcExchanges.set(exchangeKey, exchange)
        }

        const result = await exchange
        const currentUserMembership = await getCurrentUserMembership(
          {
            mode: 'oidc',
            token: result.accessToken,
            suppressAuthenticationException: true,
          },
          result.baseUrl,
        )

        if (!cancelled) {
          setReturnTo(safeReturnTo(result.returnTo))
          signInOidc({
            token: result.accessToken,
            baseUrl: result.baseUrl,
            currentUserMembership,
          })
          setIsCompleting(false)
        }
      } catch {
        clearOidcPkceSignInTransaction()
        if (!cancelled) {
          setError('Unable to complete OIDC sign-in. Start sign-in again.')
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
    return <Navigate to={returnTo} replace />
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
