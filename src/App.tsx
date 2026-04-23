import { Link, Outlet } from 'react-router-dom'
import {
  Anchor,
  AppShell,
  Badge,
  Button,
  Container,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { getHealth } from './lib/irods-rest'

function App() {
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: () => getHealth(),
    retry: 1,
    staleTime: 30_000,
  })

  return (
    <AppShell header={{ height: 84 }} padding="lg">
      <AppShell.Header className="shell-header">
        <Container size="xl" h="100%">
          <Group justify="space-between" h="100%">
            <div>
              <Group gap="sm" align="center">
                <Title order={2}>starbase</Title>
                <Badge variant="light" color="cyan">
                  React + Mantine
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                Operator-friendly UI for browsing objects and collections in
                `starbase`.
              </Text>
            </div>

            <Stack gap={6} align="flex-end">
              <Group gap="sm">
                <Button component={Link} to="/" variant="subtle">
                  Explorer
                </Button>
                <Button component={Link} to="/setup" variant="subtle">
                  Setup
                </Button>
              </Group>
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  API status
                </Text>
                <Badge
                  color={
                    healthQuery.isSuccess
                      ? 'teal'
                      : healthQuery.isError
                        ? 'red'
                        : 'yellow'
                  }
                  variant="light"
                >
                  {healthQuery.isSuccess
                    ? healthQuery.data.status
                    : healthQuery.isError
                      ? 'offline'
                      : 'checking'}
                </Badge>
                <Anchor href="/swagger" target="_blank" size="sm">
                  Swagger
                </Anchor>
              </Group>
            </Stack>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="xl" py="xl">
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}

export default App
