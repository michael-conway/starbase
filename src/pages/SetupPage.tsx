import {
  Alert,
  Anchor,
  Card,
  Code,
  Grid,
  List,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'

export function SetupPage() {
  return (
    <Stack gap="lg">
      <div>
        <Title order={1}>Setup notes</Title>
        <Text c="dimmed" maw={760}>
          This starter keeps frontend concerns explicit: login experience,
          section-level navigation, and explorer workflows live here, while
          `irods-go-rest` remains the auth and iRODS integration boundary.
        </Text>
      </div>

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card radius="xl" shadow="sm" padding="lg">
            <Stack gap="sm">
              <Title order={3}>Local development</Title>
              <List spacing="xs">
                <List.Item>
                  Start `irods-go-rest` on <Code>http://localhost:8080</Code>.
                </List.Item>
                <List.Item>
                  Run this UI with <Code>npm run dev</Code>.
                </List.Item>
                <List.Item>
                  Leave the API base URL blank to use the Vite dev proxy.
                </List.Item>
                <List.Item>
                  Open <Code>/swagger</Code> or <Code>/openapi.yaml</Code> to
                  verify the current backend contract.
                </List.Item>
              </List>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card radius="xl" shadow="sm" padding="lg">
            <Stack gap="sm">
              <Title order={3}>Auth modes</Title>
              <List spacing="xs">
                <List.Item>
                  Basic auth is supported directly by `irods-go-rest`.
                </List.Item>
                <List.Item>
                  OIDC uses the backend browser flow under <Code>/web/login</Code>.
                </List.Item>
                <List.Item>
                  The starter treats auth selection as a first-class entry point.
                </List.Item>
                <List.Item>
                  Future backend session APIs can replace the current manual
                  token handoff without changing the overall shell.
                </List.Item>
              </List>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card radius="xl" shadow="sm" padding="lg">
            <Stack gap="sm">
              <Title order={3}>Major sections</Title>
              <List spacing="xs">
                <List.Item>
                  Explorer is the primary file and collection workspace.
                </List.Item>
                <List.Item>
                  Search is a separate top-level surface, not an explorer overlay.
                </List.Item>
                <List.Item>
                  Rules and administration keep their own route spaces.
                </List.Item>
                <List.Item>
                  Additional major tools can be added beside these sections with
                  no shell rewrite.
                </List.Item>
              </List>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card radius="xl" shadow="sm" padding="lg">
            <Stack gap="sm">
              <Title order={3}>Integration stack</Title>
              <List spacing="xs">
                <List.Item>
                  Use{' '}
                  <Code>../irods-go-rest/deployments/docker-test-framework/5-0</Code>{' '}
                  as the local integration environment.
                </List.Item>
                <List.Item>
                  That stack includes PostgreSQL, iRODS provider, and Keycloak.
                </List.Item>
                <List.Item>
                  Keycloak is exposed by the compose stack and is intended for the
                  OIDC browser flow.
                </List.Item>
              </List>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Alert
        variant="light"
        color="blue"
        icon={<IconInfoCircle size={18} />}
        title="Backend expectations"
      >
        The current `irods-go-rest` contract is path-first: <Code>GET /api/v1/path</Code>,{' '}
        <Code>GET /api/v1/path/children</Code>, and{' '}
        <Code>GET /api/v1/path/contents</Code>. See the sibling repo docs in{' '}
        <Anchor
          href="https://github.com/michael-conway/irods-go-rest"
          target="_blank"
        >
          project docs
        </Anchor>{' '}
        when updating auth or deployment assumptions.
      </Alert>
    </Stack>
  )
}
