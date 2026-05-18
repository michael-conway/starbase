import { Card, Code, Grid, List, Stack, Text, Title } from '@mantine/core'
import { useAppConfig } from '../providers/use-app-config'

export function SetupPage() {
  const appConfig = useAppConfig()
  const restApiBaseUrl = appConfig.config.restApiBaseUrl || 'same-origin API paths'

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
                <List.Item>
                  OIDC sign-in uses <Code>/web/login</Code>.
                </List.Item>
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
                  OIDC login path: <Code>/web/login</Code>
                </List.Item>
              </List>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
