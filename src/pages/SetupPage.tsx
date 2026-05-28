import { Card, Code, Grid, List, Stack, Text, Title } from '@mantine/core'
import {
  hasDirectOidcPkceConfig,
  resolveOidcEndpointUrl,
  resolveOidcPkceRedirectUri,
  resolveOidcPkceUrl,
} from '../config/starbase-config'
import { useAppConfig } from '../providers/use-app-config'

export function SetupPage() {
  const appConfig = useAppConfig()
  const restApiBaseUrl = appConfig.config.restApiBaseUrl || 'same-origin API paths'
  const oidcEndpoint = appConfig.config.oidcEndpoint
  const oidcLoginUrl = resolveOidcEndpointUrl(appConfig.config.restApiBaseUrl, oidcEndpoint)
  const directPkceEnabled = hasDirectOidcPkceConfig(appConfig.config)
  const oidcAuthorizationEndpoint = resolveOidcPkceUrl(appConfig.config.oidcAuthorizationEndpoint)
  const oidcTokenEndpoint = resolveOidcPkceUrl(appConfig.config.oidcTokenEndpoint)
  const oidcRedirectUri = resolveOidcPkceRedirectUri(appConfig.config.oidcRedirectPath)

  return (
    <Stack gap="lg">
      <div>
        <Title order={1}>Setup</Title>
        <Text c="dimmed" maw={760}>
          Local connection and sign-in settings.
        </Text>
      </div>

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card radius="xl" shadow="sm" padding="lg">
            <Stack gap="sm">
              <Title order={3}>Server</Title>
              <List spacing="xs">
                <List.Item>
                  Start the API server on <Code>{restApiBaseUrl}</Code>.
                </List.Item>
                <List.Item>
                  Run the app with <Code>npm run dev</Code>.
                </List.Item>
                <List.Item>
                  Leave the API base URL blank to use the local proxy.
                </List.Item>
              </List>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card radius="xl" shadow="sm" padding="lg">
            <Stack gap="sm">
              <Title order={3}>Sign in</Title>
              <List spacing="xs">
                <List.Item>Basic auth is available in the app.</List.Item>
                {directPkceEnabled ? (
                  <>
                    <List.Item>
                      OIDC authorization endpoint: <Code>{oidcAuthorizationEndpoint}</Code>
                    </List.Item>
                    <List.Item>
                      OIDC token endpoint: <Code>{oidcTokenEndpoint}</Code>
                    </List.Item>
                    <List.Item>
                      OIDC callback URL: <Code>{oidcRedirectUri}</Code>
                    </List.Item>
                  </>
                ) : (
                  <List.Item>
                    OIDC sign-in uses <Code>{oidcLoginUrl}</Code>.
                  </List.Item>
                )}
              </List>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card radius="xl" shadow="sm" padding="lg">
            <Stack gap="sm">
              <Title order={3}>Explorer</Title>
              <List spacing="xs">
                <List.Item>Browse collections and objects.</List.Item>
                <List.Item>Open object details on a separate page.</List.Item>
              </List>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card radius="xl" shadow="sm" padding="lg">
            <Stack gap="sm">
              <Title order={3}>Environment</Title>
              <List spacing="xs">
                <List.Item>
                  Default API URL: <Code>{restApiBaseUrl}</Code>
                </List.Item>
                <List.Item>
                  OIDC endpoint: <Code>{oidcEndpoint}</Code>
                </List.Item>
                {directPkceEnabled ? (
                  <List.Item>
                    OIDC client ID: <Code>{appConfig.config.oidcClientId || '—'}</Code>
                  </List.Item>
                ) : null}
              </List>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
