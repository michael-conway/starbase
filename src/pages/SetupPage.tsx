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
        <Text c="dimmed" maw={720}>
          This frontend is intentionally thin. It assumes `irods-go-rest` owns
          authentication, OpenAPI, and the iRODS integration boundary.
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
                  inspect the backend contract.
                </List.Item>
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
                  <Code>VITE_PROXY_TARGET</Code> controls the dev proxy target.
                </List.Item>
                <List.Item>
                  <Code>VITE_API_BASE_URL</Code> can pin the API origin for
                  built deployments.
                </List.Item>
                <List.Item>
                  Protected API routes still require a bearer token.
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
        The current `irods-go-rest` contract exposes `GET /healthz`,
        `GET /api/v1/objects/{'{object_id}'}`, and
        `GET /api/v1/collections/{'{collection_id}'}`. Browser login is handled
        separately under <Code>/web/login</Code>. See the backend README in{' '}
        <Anchor
          href="https://github.com/michael-conway/irods-go-rest"
          target="_blank"
        >
          project docs
        </Anchor>{' '}
        if you want to align deployment env vars.
      </Alert>
    </Stack>
  )
}
