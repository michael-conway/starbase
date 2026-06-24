import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  ActionIcon,
  Alert,
  AppShell,
  Badge,
  Burger,
  Button,
  Code,
  Container,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import {
  IconInfoCircle,
  IconLogout,
  IconSettings,
  IconTool,
  IconUserCircle,
} from '@tabler/icons-react'
import { primarySections } from './app-sections'
import { defaultPath } from './features/explorer'
import { userFromOIDCToken } from './features/identity'
import { getFavorites, getHealth, getSavedMetadataQueries, getServiceInfo } from './lib/irods-rest'
import { useAppConfig } from './providers/use-app-config'
import { useSession } from './providers/use-session'

function zoneFromSearch(search: string) {
  const params = new URLSearchParams(search)
  const path = params.get('irods_path')?.trim() || defaultPath

  return path.split('/').filter(Boolean).at(0) || 'tempZone'
}

function formatServiceValue(value: unknown) {
  if (value === null || value === undefined) {
    return '—'
  }

  if (typeof value === 'string') {
    return value.trim() ? value : '—'
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${value}`
  }

  try {
    return JSON.stringify(value)
  } catch {
    return '—'
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

function App() {
  const appConfig = useAppConfig()
  const {
    basicUsername,
    clearSession,
    connection,
    currentUserMembership,
    isAuthenticated,
    oidcToken,
  } = useSession()
  const location = useLocation()
  const [menuOpened, setMenuOpened] = useState(false)
  const [serviceInfoOpened, setServiceInfoOpened] = useState(false)
  const healthQuery = useQuery({
    queryKey: ['health', connection.baseUrl],
    queryFn: () => getHealth(connection.baseUrl),
    retry: 1,
    staleTime: 30_000,
  })
  const serviceInfoQuery = useQuery({
    queryKey: ['service-info', connection],
    queryFn: () => getServiceInfo(connection.auth, connection.baseUrl),
    enabled: serviceInfoOpened,
    staleTime: 60_000,
  })
  useQuery({
    queryKey: ['favorites', connection],
    queryFn: () => getFavorites(connection.auth, connection.baseUrl),
    enabled: isAuthenticated,
    staleTime: 60_000,
  })
  useQuery({
    queryKey: ['saved-metadata-queries', connection],
    queryFn: () => getSavedMetadataQueries(connection.auth, connection.baseUrl),
    enabled: isAuthenticated,
    staleTime: 60_000,
  })
  const currentUser =
    currentUserMembership?.current_user.user.name ||
    (connection.auth.mode === 'basic'
      ? basicUsername || 'Unknown user'
      : userFromOIDCToken(oidcToken) || 'OIDC user')
  const currentUserType = currentUserMembership?.current_user.user.type
  const currentGroups = currentUserMembership?.current_user.groups ?? []
  const currentZone =
    currentUserMembership?.zone ||
    currentUserMembership?.current_user.user.zone ||
    zoneFromSearch(location.search)
  const authModeLabel = connection.auth.mode === 'basic' ? 'Basic auth' : 'OIDC'
  const appTitle = appConfig.config.title?.trim() || 'Starbase'
  const appSubtitle = appConfig.config.subtitle?.trim() || 'iRODS Explorer'
  const servicePayload = asObject(serviceInfoQuery.data)
  const serverInfo = asObject(servicePayload.server_info)
  const normalizedServerInfo = Object.keys(serverInfo).length > 0 ? serverInfo : servicePayload
  const knownServerInfoKeys = new Set([
    'release_version',
    'api_version',
    'reconnect_port',
    'reconnect_addr',
    'cookie',
    'irods_host',
    'irods_port',
    'irods_zone',
    'irods_negotiation',
    'irods_default_resource',
    'resource_affinity',
  ])
  const additionalFields = Object.entries(normalizedServerInfo).filter(
    ([key]) => !knownServerInfoKeys.has(key),
  )
  const topLevelFields = Object.entries(servicePayload).filter(([key]) => key !== 'server_info')

  return (
    <AppShell
      header={{ height: 76 }}
      navbar={{ width: 280, breakpoint: 'md', collapsed: { mobile: !menuOpened, desktop: !menuOpened } }}
      padding="lg"
    >
      <Modal
        opened={serviceInfoOpened}
        onClose={() => setServiceInfoOpened(false)}
        title="Service info"
        centered
        size="lg"
      >
        <Stack gap="md">
          {serviceInfoQuery.isLoading ? (
            <Group justify="center" py="md">
              <Loader size="sm" />
            </Group>
          ) : null}

          {serviceInfoQuery.isError ? (
            <Alert color="red" variant="light" title="Unable to load service info">
              {serviceInfoQuery.error.message}
            </Alert>
          ) : null}

          {serviceInfoQuery.isSuccess ? (
            Object.keys(normalizedServerInfo).length > 0 || topLevelFields.length > 0 ? (
              <Stack gap="md">
                <Table verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th colSpan={2}>Version</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td>
                        <Code>release_version</Code>
                      </Table.Td>
                      <Table.Td>{formatServiceValue(normalizedServerInfo.release_version)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code>api_version</Code>
                      </Table.Td>
                      <Table.Td>{formatServiceValue(normalizedServerInfo.api_version)}</Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>

                <Table verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th colSpan={2}>Connection</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td>
                        <Code>irods_host</Code>
                      </Table.Td>
                      <Table.Td>{formatServiceValue(normalizedServerInfo.irods_host)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code>irods_port</Code>
                      </Table.Td>
                      <Table.Td>{formatServiceValue(normalizedServerInfo.irods_port)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code>irods_zone</Code>
                      </Table.Td>
                      <Table.Td>{formatServiceValue(normalizedServerInfo.irods_zone)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code>irods_negotiation</Code>
                      </Table.Td>
                      <Table.Td>{formatServiceValue(normalizedServerInfo.irods_negotiation)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code>reconnect_addr</Code>
                      </Table.Td>
                      <Table.Td>{formatServiceValue(normalizedServerInfo.reconnect_addr)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code>reconnect_port</Code>
                      </Table.Td>
                      <Table.Td>{formatServiceValue(normalizedServerInfo.reconnect_port)}</Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>

                <Table verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th colSpan={2}>Resource settings</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td>
                        <Code>irods_default_resource</Code>
                      </Table.Td>
                      <Table.Td>{formatServiceValue(normalizedServerInfo.irods_default_resource)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>
                        <Code>resource_affinity</Code>
                      </Table.Td>
                      <Table.Td>{formatServiceValue(normalizedServerInfo.resource_affinity)}</Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>

                {additionalFields.length > 0 || topLevelFields.length > 0 ? (
                  <Table verticalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th colSpan={2}>Additional fields</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {topLevelFields.map(([key, value]) => (
                        <Table.Tr key={`top-${key}`}>
                          <Table.Td>
                            <Code>{key}</Code>
                          </Table.Td>
                          <Table.Td>{formatServiceValue(value)}</Table.Td>
                        </Table.Tr>
                      ))}
                      {additionalFields.map(([key, value]) => (
                        <Table.Tr key={`server-${key}`}>
                          <Table.Td>
                            <Code>{key}</Code>
                          </Table.Td>
                          <Table.Td>{formatServiceValue(value)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : null}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                Service endpoint returned no fields.
              </Text>
            )
          ) : null}

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setServiceInfoOpened(false)}>
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>

      <AppShell.Header className="shell-header">
        <Container size="xl" h="100%">
          <Group justify="space-between" h="100%">
            <div>
              <Group gap="sm" align="center">
                <Burger
                  opened={menuOpened}
                  onClick={() => setMenuOpened((current) => !current)}
                  size="sm"
                  aria-label={menuOpened ? 'Hide main menu' : 'Show main menu'}
                />
                <Title order={2}>{appTitle}</Title>
              </Group>
              <Text size="sm" c="dimmed">
                {appSubtitle}
              </Text>
            </div>

            <Stack gap={6} align="flex-end">
              <Group gap="sm" align="center">
                <Text size="sm" c="dimmed">
                  Status
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

                <Menu position="bottom-end" width={320} shadow="md">
                  <Menu.Target>
                    <ActionIcon
                      variant="default"
                      size="lg"
                      aria-label="Open tools menu"
                    >
                      <IconTool size={22} />
                    </ActionIcon>
                  </Menu.Target>

                  <Menu.Dropdown>
                    <Menu.Label>Tools</Menu.Label>
                    <Menu.Item
                      component={NavLink}
                      to="/app/settings"
                      leftSection={<IconSettings size={16} />}
                    >
                      Settings
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                      component="a"
                      href="https://irods.org/download/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Get icommands
                    </Menu.Item>
                    <Menu.Item
                      component="a"
                      href="https://github.com/cyverse/gocommands/releases"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Get go-commands
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>

                <Menu position="bottom-end" width={240} shadow="md">
                  <Menu.Target>
                    <ActionIcon
                      variant="default"
                      size="lg"
                      aria-label="Open user menu"
                    >
                      <IconUserCircle size={22} />
                    </ActionIcon>
                  </Menu.Target>

                  <Menu.Dropdown>
                    <Menu.Label>iRODS session</Menu.Label>
                    <Stack gap={4} px="sm" py={6}>
                      <Text size="xs" c="dimmed">
                        Zone
                      </Text>
                      <Text size="sm" fw={600}>
                        {currentZone}
                      </Text>
                      <Text size="xs" c="dimmed" mt={4}>
                        User
                      </Text>
                      <Text size="sm" fw={600}>
                        {currentUser}
                      </Text>
                      {currentUserType ? (
                        <Badge variant="light" color="gray" w="fit-content">
                          {currentUserType}
                        </Badge>
                      ) : null}
                      <Text size="xs" c="dimmed" mt={4}>
                        Groups
                      </Text>
                      {currentGroups.length > 0 ? (
                        <Stack gap={4} style={{ maxHeight: 160, overflowY: 'auto' }}>
                          {currentGroups.map((group) => (
                            <Group
                              key={`${group.zone}:${group.name}`}
                              gap="xs"
                              justify="space-between"
                              wrap="nowrap"
                            >
                              <Text size="sm" truncate>
                                {group.name}
                              </Text>
                              <Badge variant="light" color="gray" size="xs">
                                {group.zone}
                              </Badge>
                            </Group>
                          ))}
                        </Stack>
                      ) : (
                        <Text size="sm" c="dimmed">
                          No groups returned
                        </Text>
                      )}
                      <Text size="xs" c="dimmed" mt={4}>
                        Connection
                      </Text>
                      <Badge variant="light" color="blue" w="fit-content">
                        {authModeLabel}
                      </Badge>
                    </Stack>
                    <Menu.Divider />
                    <Menu.Item
                      leftSection={<IconInfoCircle size={16} />}
                      onClick={() => setServiceInfoOpened(true)}
                    >
                      Service info
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                      color="red"
                      leftSection={<IconLogout size={16} />}
                      onClick={clearSession}
                    >
                      Sign out
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
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
              {appSubtitle}
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
