import {
  useMemo,
  useState,
} from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Group,
  PasswordInput,
  Select,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconKey,
  IconLock,
} from '@tabler/icons-react'
import { ApiError, getCurrentUserMembership, type AuthMode } from '../lib/irods-rest'
import {
  hasDirectOidcPkceConfig,
  resolveOidcPkceRedirectUri,
  resolveOidcPkceUrl,
} from '../config/starbase-config'
import { startOidcPkceSignIn } from '../features/oidc-pkce'
import { useAppConfig } from '../providers/use-app-config'
import { useSession } from '../providers/use-session'

function safeReturnTo(value: string | null) {
  const fallback = '/app/explorer'
  const trimmed = value?.trim()

  if (!trimmed || (trimmed !== '/app' && !trimmed.startsWith('/app/'))) {
    return fallback
  }

  if (trimmed.startsWith('//')) {
    return fallback
  }

  return trimmed
}

function basicSignInErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return 'Unable to validate sign-in. Check the service connection and try again.'
  }

  if (error.status === 401 || error.status === 403) {
    return error.status === 403
      ? 'The account is authenticated but is not allowed to access Starbase user information.'
      : 'The username or password is not valid.'
  }

  if (error.status === 0) {
    return 'Unable to reach the iRODS REST service. Check the service URL and try again.'
  }

  return 'Unable to validate sign-in. Check your credentials and try again.'
}

export function LoginPage() {
  const appConfig = useAppConfig()
  const [searchParams] = useSearchParams()
  const {
    isAuthenticated,
    preferences,
    signInBasic,
    setPreferredAuthMode,
  } = useSession()
  const [mode, setMode] = useState<AuthMode>(preferences.authMode)
  const baseUrl = preferences.baseUrl
  const [basicAuthType, setBasicAuthType] = useState(preferences.basicAuthType)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [basicError, setBasicError] = useState<string | null>(null)
  const [basicLoading, setBasicLoading] = useState(false)
  const [oidcError, setOidcError] = useState<string | null>(null)
  const returnTo = safeReturnTo(searchParams.get('returnTo'))
  const directPkceEnabled = hasDirectOidcPkceConfig(appConfig.config)
  const oidcAuthorizationUrl = resolveOidcPkceUrl(appConfig.config.oidcAuthorizationEndpoint)
  const oidcRedirectUri = resolveOidcPkceRedirectUri(appConfig.config.oidcRedirectPath)
  const oidcTokenEndpoint = resolveOidcPkceUrl(appConfig.config.oidcTokenEndpoint)
  const oidcClientId = appConfig.config.oidcClientId.trim()
  const oidcScope = appConfig.config.oidcScope
  const basicAuthOptions = useMemo(
    () =>
      appConfig.config.authModes.map((option) => ({
        value: option.mode,
        label: option.authName,
      })),
    [appConfig.config.authModes],
  )
  const effectiveBasicAuthType =
    basicAuthOptions.some((option) => option.value === basicAuthType) && basicAuthType
      ? basicAuthType
      : (basicAuthOptions[0]?.value ?? 'native')

  if (isAuthenticated) {
    return <Navigate to={returnTo} replace />
  }

  const beginBasicSignIn = async () => {
    const normalizedUsername = username.trim()
    setBasicError(null)

    if (!normalizedUsername || !password) {
      const message = 'Enter a username and password.'
      setBasicError(message)
      notifications.show({
        color: 'red',
        title: 'Sign-in failed',
        message,
      })
      return
    }

    setBasicLoading(true)

    try {
      const currentUserMembership = await getCurrentUserMembership(
        {
          mode: 'basic',
          username: normalizedUsername,
          password,
          basicAuthType: effectiveBasicAuthType,
          suppressAuthenticationException: true,
        },
        baseUrl,
      )
      signInBasic({
        username: normalizedUsername,
        password,
        baseUrl,
        basicAuthType: effectiveBasicAuthType,
        currentUserMembership,
      })
    } catch (error) {
      const message = basicSignInErrorMessage(error)

      setBasicError(message)
      notifications.show({
        color: 'red',
        title: 'Sign-in failed',
        message,
      })
    } finally {
      setBasicLoading(false)
    }
  }

  const beginOidcSignIn = async () => {
    setOidcError(null)

    if (!directPkceEnabled || !oidcAuthorizationUrl || !oidcTokenEndpoint || !oidcClientId) {
      setOidcError(
        'OIDC sign-in requires OIDCAuthorizationEndpoint, OIDCTokenEndpoint, and OIDCClientID in starbase.yaml.',
      )
      return
    }

    try {
      const authorizationUrl = await startOidcPkceSignIn({
        authorizationEndpoint: oidcAuthorizationUrl,
        clientId: oidcClientId,
        scope: oidcScope,
        redirectUri: oidcRedirectUri,
        baseUrl,
        returnTo,
      })
      window.location.assign(authorizationUrl)
    } catch {
      setOidcError('Unable to start OIDC sign-in. Check the sign-in settings and try again.')
    }
  }

  return (
    <Container size="xl" py={48}>
      <Stack gap="xl">
        <PaperHero />

        <Grid gap="lg">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Card radius="xl" padding="xl" shadow="sm">
              <Stack gap="lg">
                <div>
                  <Badge variant="filled" color="dark">
                    Sign in
                  </Badge>
                  <Title order={1} mt="sm">
                    starbase
                  </Title>
                  <Text c="dimmed" mt="sm">
                    iRODS Explorer
                  </Text>
                </div>

                <SegmentedControl
                  fullWidth
                  value={mode}
                  onChange={(value) => {
                    const next = value as AuthMode
                    setMode(next)
                    setPreferredAuthMode(next)
                  }}
                  data={[
                    { label: 'Basic auth', value: 'basic' },
                    { label: 'OIDC', value: 'oidc' },
                  ]}
                />

                {mode === 'basic' ? (
                  <Stack gap="md">
                    {basicError ? (
                      <Alert color="red" variant="light" title="Sign-in failed">
                        {basicError}
                      </Alert>
                    ) : null}
                    <Select
                      label="Auth type"
                      value={effectiveBasicAuthType}
                      onChange={(value) => {
                        if (value) {
                          setBasicAuthType(value)
                        }
                      }}
                      data={basicAuthOptions}
                      allowDeselect={false}
                    />
                    <TextInput
                      label="Username"
                      placeholder="rods"
                      value={username}
                      onChange={(event) => setUsername(event.currentTarget.value)}
                    />
                    <PasswordInput
                      label="Password"
                      placeholder="Enter the iRODS or service password"
                      value={password}
                      onChange={(event) => setPassword(event.currentTarget.value)}
                    />
                    <Button
                      leftSection={<IconLock size={16} />}
                      loading={basicLoading}
                      onClick={() => {
                        void beginBasicSignIn()
                      }}
                    >
                      Enter workspace
                    </Button>
                  </Stack>
                ) : (
                  <Stack gap="md">
                    {oidcError ? (
                      <Alert color="red" variant="light" title="OIDC sign-in failed">
                        {oidcError}
                      </Alert>
                    ) : null}
                    <Group>
                      <Button
                        leftSection={<IconKey size={16} />}
                        onClick={() => {
                          void beginOidcSignIn()
                        }}
                      >
                        Login
                      </Button>
                    </Group>
                  </Stack>
                )}
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  )
}

function PaperHero() {
  return (
    <Card radius="xl" padding="xl" className="hero-panel" shadow="sm">
      <Group justify="space-between" align="flex-start" gap="xl">
        <div>
          <Badge variant="light" color="cyan">
            starbase
          </Badge>
          <Title order={2} mt="sm">
            iRODS Explorer
          </Title>
          <Text c="dimmed" mt="sm" maw={760}>
            Sign in to browse collections and objects.
          </Text>
        </div>
      </Group>
    </Card>
  )
}
