import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  Anchor,
  AppShell,
  Badge,
  Button,
  Container,
  Divider,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import {
  IconBinoculars,
} from '@tabler/icons-react'
import { primarySections } from './app-sections'
import { getHealth } from './lib/irods-rest'
import { useSession } from './providers/session'

function App() {
  const { clearSession, connection } = useSession()
  const healthQuery = useQuery({
    queryKey: ['health', connection.baseUrl],
    queryFn: () => getHealth(connection.baseUrl),
    retry: 1,
    staleTime: 30_000,
  })

  return (
    <AppShell
      header={{ height: 76 }}
      navbar={{ width: 280, breakpoint: 'md' }}
      padding="lg"
    >
      <AppShell.Header className="shell-header">
        <Container size="xl" h="100%">
          <Group justify="space-between" h="100%">
            <div>
              <Group gap="sm" align="center">
                <Title order={2}>starbase</Title>
                <Badge variant="light" color="cyan">
                  starter template
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                iRODS browser starter over `irods-go-rest`.
              </Text>
            </div>

            <Stack gap={6} align="flex-end">
              <Group gap="sm">
                <Button component={Link} to="/app/setup" variant="subtle">
                  Setup
                </Button>
                <Button variant="default" onClick={clearSession}>
                  Sign out
                </Button>
              </Group>
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  API
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

      <AppShell.Navbar p="md" className="shell-nav">
        <Stack gap="md" h="100%">
          <div>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">
              Workspace
            </Text>
            <Text size="sm" mt={4}>
              Start with browsing, uploads, downloads, and collection work.
            </Text>
          </div>

          <Stack gap={6}>
            {primarySections.map((section) => (
              <Button
                key={section.slug}
                component={NavLink}
                to={`/app/${section.slug}`}
                justify="flex-start"
                variant="subtle"
                leftSection={<section.icon size={18} />}
                className="nav-button"
              >
                {section.label}
              </Button>
            ))}
          </Stack>

          <Divider />

          <Stack gap="xs">
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">
              Connection
            </Text>
            <Badge variant="light" color="blue">
              {connection.auth.mode === 'basic' ? 'Basic auth' : 'OIDC bearer'}
            </Badge>
            <Text size="sm" c="dimmed">
              {connection.baseUrl || 'Using Vite proxy to localhost:8080'}
            </Text>
          </Stack>

          <div style={{ flex: 1 }} />

          <Button
            component={Link}
            to="/app/setup"
            justify="flex-start"
            variant="default"
            leftSection={<IconBinoculars size={18} />}
          >
            Setup and stack notes
          </Button>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="xl" py="xl">
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}

export default App
