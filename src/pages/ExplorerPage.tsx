import { useState } from 'react'
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Code,
  Divider,
  Group,
  Loader,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  IconAlertCircle,
  IconArrowUpRight,
  IconDatabase,
  IconDownload,
  IconFile,
  IconFolder,
  IconHome2,
  IconRefresh,
  IconRoute,
  IconUpload,
} from '@tabler/icons-react'
import { downloadPathUrl, getPath, getPathChildren } from '../lib/irods-rest'
import { useSession } from '../providers/session'

const defaultPath = '/tempZone/home'

function metadataRows(metadata?: Record<string, string>) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return (
      <Table.Tr>
        <Table.Td colSpan={2}>
          <Text c="dimmed" size="sm">
            No AVU metadata returned.
          </Text>
        </Table.Td>
      </Table.Tr>
    )
  }

  return Object.entries(metadata).map(([key, value]) => (
    <Table.Tr key={key}>
      <Table.Td>
        <Code>{key}</Code>
      </Table.Td>
      <Table.Td>{value}</Table.Td>
    </Table.Tr>
  ))
}

function pathSegments(path: string) {
  const segments = path.split('/').filter(Boolean)
  const crumbs = [{ label: '/', value: '/' }]

  let current = ''
  for (const segment of segments) {
    current += `/${segment}`
    crumbs.push({ label: segment, value: current })
  }

  return crumbs
}

function displayName(path: string) {
  if (path === '/') {
    return '/'
  }

  return path.split('/').filter(Boolean).at(-1) ?? path
}

function formatBytes(size?: number) {
  if (size === undefined) {
    return 'N/A'
  }

  return new Intl.NumberFormat('en-US', {
    notation: size > 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(size)
}

function quickLocations(path: string) {
  const segments = path.split('/').filter(Boolean)
  const zoneRoot = segments[0] ? `/${segments[0]}` : '/tempZone'
  const homePath = segments.length >= 2 ? `/${segments[0]}/${segments[1]}` : defaultPath

  return [
    {
      label: 'Home',
      description: 'Primary browser workspace',
      path: defaultPath,
      icon: IconHome2,
    },
    {
      label: 'Zone',
      description: 'Top-level zone view',
      path: zoneRoot,
      icon: IconDatabase,
    },
    {
      label: 'Current branch',
      description: 'Resume this branch quickly',
      path: homePath,
      icon: IconRoute,
    },
  ]
}

export function ExplorerPage() {
  const { connection } = useSession()
  const [draftPath, setDraftPath] = useState(defaultPath)
  const [selectedPath, setSelectedPath] = useState(defaultPath)
  const [highlightedChildPath, setHighlightedChildPath] = useState<string | null>(null)

  const openPath = (nextPath: string) => {
    const normalized = nextPath.trim() || defaultPath
    setDraftPath(normalized)
    setSelectedPath(normalized)
    setHighlightedChildPath(null)
  }

  const entryQuery = useQuery({
    queryKey: ['path-entry', selectedPath, connection],
    queryFn: () => getPath(selectedPath, connection.auth, connection.baseUrl),
  })

  const childrenQuery = useQuery({
    queryKey: ['path-children', selectedPath, connection],
    queryFn: () => getPathChildren(selectedPath, connection.auth, connection.baseUrl),
    enabled: entryQuery.data?.kind === 'collection',
  })

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const entry = await getPath(selectedPath, connection.auth, connection.baseUrl)
      if (entry.kind === 'collection') {
        await getPathChildren(selectedPath, connection.auth, connection.baseUrl)
      }
      return entry
    },
    onSuccess: (entry) => {
      notifications.show({
        title: 'View refreshed',
        message: entry.path,
        color: 'teal',
      })
      void entryQuery.refetch()
      void childrenQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Refresh failed',
        message: error.message,
        color: 'red',
      })
    },
  })

  const entry = entryQuery.data
  const children = childrenQuery.data?.children ?? []
  const breadcrumbs = pathSegments(selectedPath)
  const locationOptions = quickLocations(selectedPath)
  const highlightedChild =
    children.find((child) => child.path === highlightedChildPath) ?? null
  const detailEntry = entry?.kind === 'collection' ? highlightedChild ?? entry : entry

  return (
    <Stack gap="lg">
      <Paper className="hero-panel" radius="xl" p="xl">
        <Group justify="space-between" align="flex-start" gap="xl">
          <Stack gap="sm" maw={760}>
            <Badge variant="filled" color="dark">
              Explorer
            </Badge>
            <Title order={1}>A focused browser workspace for iRODS collections and objects.</Title>
            <Text size="lg" c="dimmed">
              The current UI is deliberately shaped like a file browser: navigation
              on the left, the collection surface in the center, and selected item
              details on the right.
            </Text>
          </Stack>

          <Group gap="sm" align="stretch" className="explorer-hero-stats">
            <MiniStat title="Current mode" value="Browse" note="Collections, objects, transfers" />
            <MiniStat title="Contract" value="/api/v1/path" note="Path-first navigation" />
          </Group>
        </Group>
      </Paper>

      <div className="explorer-layout">
        <Card shadow="sm" radius="xl" padding="lg" className="explorer-sidebar">
          <Stack gap="lg">
            <div>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                Locations
              </Text>
              <Text size="sm" mt={4} c="dimmed">
                Keep navigation concise and predictable.
              </Text>
            </div>

            <Stack gap="xs">
              {locationOptions.map((location) => (
                <Button
                  key={`${location.label}-${location.path}`}
                  justify="flex-start"
                  variant={selectedPath === location.path ? 'light' : 'subtle'}
                  leftSection={<location.icon size={16} />}
                  onClick={() => openPath(location.path)}
                >
                  <span>{location.label}</span>
                </Button>
              ))}
            </Stack>

            <Divider />

            <Stack gap="xs">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                Session
              </Text>
              <Badge variant="light" color="blue">
                {connection.auth.mode === 'basic' ? 'Basic auth' : 'OIDC bearer'}
              </Badge>
              <Text size="sm" c="dimmed">
                {connection.baseUrl || 'Using Vite proxy to localhost:8080'}
              </Text>
            </Stack>
          </Stack>
        </Card>

        <Card shadow="sm" radius="xl" padding="lg" className="explorer-main">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <div>
                <Title order={3}>Files</Title>
                <Text size="sm" c="dimmed">
                  Browse a collection, select an item, and keep detail work off to the side.
                </Text>
              </div>

              <Group gap="sm">
                <Button leftSection={<IconUpload size={16} />} variant="default">
                  Upload
                </Button>
                <Button
                  leftSection={<IconRefresh size={16} />}
                  variant="light"
                  onClick={() => refreshMutation.mutate()}
                  loading={refreshMutation.isPending}
                >
                  Refresh
                </Button>
              </Group>
            </Group>

            <div className="explorer-toolbar">
              <TextInput
                label="Open iRODS path"
                placeholder={defaultPath}
                value={draftPath}
                onChange={(event) => setDraftPath(event.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Button onClick={() => openPath(draftPath)}>Open</Button>
            </div>

            <Breadcrumbs>
              {breadcrumbs.map((crumb) => (
                <Button
                  key={crumb.value}
                  variant="subtle"
                  size="xs"
                  onClick={() => openPath(crumb.value)}
                >
                  {crumb.label}
                </Button>
              ))}
            </Breadcrumbs>

            {entryQuery.isLoading ? (
              <Group justify="center" py="xl">
                <Loader />
              </Group>
            ) : null}

            {entryQuery.isError ? (
              <Alert
                color="red"
                variant="light"
                icon={<IconAlertCircle size={18} />}
                title="Unable to load path"
              >
                {entryQuery.error.message}
              </Alert>
            ) : null}

            {entry ? (
              <Stack gap="md">
                <Paper withBorder radius="lg" p="md">
                  <Group justify="space-between" align="flex-start">
                    <Group gap="sm" align="flex-start">
                      <ThemeIcon
                        variant="light"
                        color={entry.kind === 'collection' ? 'blue' : 'teal'}
                        size="lg"
                      >
                        {entry.kind === 'collection' ? (
                          <IconFolder size={18} />
                        ) : (
                          <IconFile size={18} />
                        )}
                      </ThemeIcon>
                      <div>
                        <Text fw={700}>{entry.path}</Text>
                        <Text size="sm" c="dimmed">
                          {entry.kind === 'collection'
                            ? 'Collection listing'
                            : 'Object detail surface'}
                        </Text>
                      </div>
                    </Group>

                    <Group gap="xs">
                      <Badge variant="light" color="blue">
                        {entry.kind}
                      </Badge>
                      <Badge variant="dot" color="gray">
                        {entry.zone}
                      </Badge>
                    </Group>
                  </Group>
                </Paper>

                {entry.kind === 'collection' ? (
                  <Table highlightOnHover verticalSpacing="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Name</Table.Th>
                        <Table.Th>Kind</Table.Th>
                        <Table.Th>Children</Table.Th>
                        <Table.Th>Zone</Table.Th>
                        <Table.Th>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {children.map((child) => {
                        const isSelected = child.path === highlightedChildPath

                        return (
                          <Table.Tr
                            key={child.path}
                            className={isSelected ? 'explorer-row-selected' : undefined}
                            onClick={() => setHighlightedChildPath(child.path)}
                          >
                            <Table.Td>
                              <Group gap="sm" wrap="nowrap">
                                <ThemeIcon
                                  size="md"
                                  variant="light"
                                  color={child.kind === 'collection' ? 'blue' : 'teal'}
                                >
                                  {child.kind === 'collection' ? (
                                    <IconFolder size={14} />
                                  ) : (
                                    <IconFile size={14} />
                                  )}
                                </ThemeIcon>
                                <div>
                                  <Text fw={600}>{displayName(child.path)}</Text>
                                  <Text size="xs" c="dimmed">
                                    {child.path}
                                  </Text>
                                </div>
                              </Group>
                            </Table.Td>
                            <Table.Td>{child.kind}</Table.Td>
                            <Table.Td>{child.childCount ?? '—'}</Table.Td>
                            <Table.Td>{child.zone}</Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                <Button
                                  size="xs"
                                  variant="subtle"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    openPath(child.path)
                                  }}
                                >
                                  Open
                                </Button>
                                {child.kind === 'data_object' ? (
                                  <DownloadButton path={child.path} />
                                ) : null}
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        )
                      })}
                      {!children.length && !childrenQuery.isLoading ? (
                        <Table.Tr>
                          <Table.Td colSpan={5}>
                            <Text size="sm" c="dimmed">
                              Empty collection or child listing not yet available.
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ) : null}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Paper withBorder radius="lg" p="md">
                    <Group gap="sm">
                      <DownloadButton path={entry.path} />
                      <Button variant="default">Replace object</Button>
                    </Group>
                  </Paper>
                )}
              </Stack>
            ) : null}
          </Stack>
        </Card>

        <Card shadow="sm" radius="xl" padding="lg" className="explorer-details">
          <Stack gap="md">
            <div>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                Details
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                Selection details stay separate from the listing so the browser remains readable.
              </Text>
            </div>

            {detailEntry ? (
              <>
                <Paper withBorder radius="lg" p="md">
                  <Group gap="sm" align="flex-start">
                    <ThemeIcon
                      variant="light"
                      color={detailEntry.kind === 'collection' ? 'blue' : 'teal'}
                      size="lg"
                    >
                      {detailEntry.kind === 'collection' ? (
                        <IconFolder size={18} />
                      ) : (
                        <IconFile size={18} />
                      )}
                    </ThemeIcon>
                    <div>
                      <Text fw={700}>{displayName(detailEntry.path)}</Text>
                      <Text size="sm" c="dimmed">
                        {detailEntry.path}
                      </Text>
                    </div>
                  </Group>
                </Paper>

                <Stack gap="xs">
                  <InfoRow label="Kind" value={detailEntry.kind} />
                  <InfoRow label="Zone" value={detailEntry.zone} />
                  <InfoRow label="Identifier" value={detailEntry.id} />
                  <InfoRow
                    label="Children"
                    value={`${detailEntry.childCount ?? (detailEntry.kind === 'collection' ? children.length : 0)}`}
                  />
                  <InfoRow label="Size" value={formatBytes(detailEntry.size)} />
                  <InfoRow label="Checksum" value={detailEntry.checksum ?? 'N/A'} />
                </Stack>

                <Divider label="Metadata" labelPosition="left" />

                <Table verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Attribute</Table.Th>
                      <Table.Th>Value</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>{metadataRows(detailEntry.metadata)}</Table.Tbody>
                </Table>

                <Divider label="Actions" labelPosition="left" />

                <Stack gap="xs">
                  {detailEntry.kind === 'data_object' ? (
                    <DownloadButton path={detailEntry.path} />
                  ) : (
                    <Button
                      variant="light"
                      leftSection={<IconArrowUpRight size={14} />}
                      onClick={() => openPath(detailEntry.path)}
                    >
                      Open collection
                    </Button>
                  )}
                  <Button variant="default" leftSection={<IconUpload size={14} />}>
                    {detailEntry.kind === 'data_object' ? 'Replace object' : 'Upload into collection'}
                  </Button>
                </Stack>
              </>
            ) : (
              <Alert variant="light" color="blue" title="Nothing selected">
                Open a path or choose an item in the current collection to inspect it here.
              </Alert>
            )}
          </Stack>
        </Card>
      </div>
    </Stack>
  )
}

function DownloadButton({ path }: { path: string }) {
  const { connection } = useSession()
  const isBasic = connection.auth.mode === 'basic'

  if (isBasic) {
    return (
      <Button size="xs" variant="light" leftSection={<IconDownload size={14} />} disabled>
        Download requires browser/header flow
      </Button>
    )
  }

  return (
    <Button
      component="a"
      href={downloadPathUrl(path, connection.baseUrl)}
      size="xs"
      variant="light"
      leftSection={<IconDownload size={14} />}
    >
      Download
    </Button>
  )
}

function MiniStat({
  title,
  value,
  note,
}: {
  title: string
  value: string
  note: string
}) {
  return (
    <Paper withBorder radius="lg" p="md">
      <Text size="sm" c="dimmed">
        {title}
      </Text>
      <Text fw={700}>{value}</Text>
      <Text size="sm" c="dimmed">
        {note}
      </Text>
    </Paper>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600} maw={180} ta="right">
        {value}
      </Text>
    </Group>
  )
}
