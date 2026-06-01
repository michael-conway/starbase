import {
  useMemo,
  useState,
} from 'react'
import { Navigate } from 'react-router-dom'
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
import {
  IconKey,
  IconLock,
} from '@tabler/icons-react'
import type { AuthMode } from '../lib/irods-rest'
import {
  hasDirectOidcPkceConfig,
  resolveOidcEndpointUrl,
  resolveOidcPkceRedirectUri,
  resolveOidcPkceUrl,
} from '../config/starbase-config'
import { startOidcPkceSignIn } from '../features/oidc-pkce'
import { useAppConfig } from '../providers/use-app-config'
import { useSession } from '../providers/use-session'

export function LoginPage() {
  const appConfig = useAppConfig()
  const {
    isAuthenticated,
    preferences,
    signInBasic,
    signInOidc,
    setPreferredAuthMode,
  } = useSession()
  const [mode, setMode] = useState<AuthMode>(preferences.authMode)
  const baseUrl = preferences.baseUrl
  const [basicAuthType, setBasicAuthType] = useState(preferences.basicAuthType)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [oidcError, setOidcError] = useState<string | null>(null)
  const oidcEndpointUrl = resolveOidcEndpointUrl(baseUrl, appConfig.config.oidcEndpoint)
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
    return <Navigate to="/app/explorer" replace />
  }

  const beginOidcSignIn = async () => {
    setOidcError(null)

    if (
      directPkceEnabled &&
      oidcAuthorizationUrl &&
      oidcTokenEndpoint &&
      oidcClientId &&
      oidcRedirectUri
    ) {
      try {
        const authorizationUrl = await startOidcPkceSignIn({
          authorizationEndpoint: oidcAuthorizationUrl,
          clientId: oidcClientId,
          scope: oidcScope,
          redirectUri: oidcRedirectUri,
          baseUrl,
        })
        window.location.assign(authorizationUrl)
      } catch (error) {
        setOidcError(error instanceof Error ? error.message : 'Unable to start OIDC sign-in.')
      }
      return
    }

    window.open(oidcEndpointUrl, '_blank', 'noopener,noreferrer')
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
                      onClick={() =>
                        signInBasic({
                          username,
                          password,
                          baseUrl,
                          basicAuthType: effectiveBasicAuthType,
                        })
                      }
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
                        Open sign-in
                      </Button>
                    </Group>

                    <PasswordInput
                      label="Access token"
                      placeholder="Paste access token"
                      value={token}
                      onChange={(event) => setToken(event.currentTarget.value)}
                    />

                    <Button
                      variant="filled"
                      onClick={() =>
                        signInOidc({
                          token,
                          baseUrl,
                        })
                      }
                    >
                      Enter workspace
                    </Button>
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
