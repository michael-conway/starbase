import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Group,
  Loader,
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
  IconDatabase,
  IconFile,
  IconFolder,
  IconHome2,
  IconRefresh,
  IconRoute,
  IconUpload,
} from '@tabler/icons-react'
import { defaultPath, displayName } from '../features/explorer'
import { ApiError, getPath, getPathChildren } from '../lib/irods-rest'
import { useSession } from '../providers/session'

function quickLocations(path: string) {
  const segments = path.split('/').filter(Boolean)
  const zoneRoot = segments[0] ? `/${segments[0]}` : '/tempZone'
  const homePath = segments.length >= 2 ? `/${segments[0]}/${segments[1]}` : defaultPath

  return [
    {
      label: 'Home',
      path: defaultPath,
      icon: IconHome2,
    },
    {
      label: 'Zone',
      path: zoneRoot,
      icon: IconDatabase,
    },
    {
      label: 'Current branch',
      path: homePath,
      icon: IconRoute,
    },
  ]
}

function listingErrorDetails(error: Error) {
  if (error instanceof ApiError && error.status === 403) {
    return {
      title: 'Unable to list collection',
      message: 'You do not have permission to list this collection.',
    }
  }

  return {
    title: 'Unable to load collection',
    message: error.message,
  }
}

export function ExplorerPage() {
  const { connection } = useSession()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialPath = searchParams.get('irods_path')?.trim() || defaultPath
  const [draftPath, setDraftPath] = useState(initialPath)
  const [selectedPath, setSelectedPath] = useState(initialPath)

  useEffect(() => {
    setDraftPath(initialPath)
    setSelectedPath(initialPath)
  }, [initialPath])

  const openCollection = (nextPath: string) => {
    const normalized = nextPath.trim() || defaultPath
    setDraftPath(normalized)
    setSelectedPath(normalized)
    setSearchParams(normalized === defaultPath ? {} : { irods_path: normalized })
  }

  const openPath = async (nextPath: string) => {
    const normalized = nextPath.trim() || defaultPath

    try {
      const entry = await getPath(normalized, connection.auth, connection.baseUrl)

      if (entry.kind === 'collection') {
        openCollection(normalized)
        return
      }

      navigate(`/app/explorer/details?irods_path=${encodeURIComponent(normalized)}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open path'
      notifications.show({
        title: 'Open failed',
        message,
        color: 'red',
      })
    }
  }

  const entryQuery = useQuery({
    queryKey: ['path-entry', selectedPath, connection],
    queryFn: () => getPath(selectedPath, connection.auth, connection.baseUrl),
  })

  const childrenQuery = useQuery({
    queryKey: ['path-children', selectedPath, connection],
    queryFn: () => getPathChildren(selectedPath, connection.auth, connection.baseUrl),
    enabled:
      entryQuery.data?.kind === 'collection' && entryQuery.data.path === selectedPath,
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
  const childrenResponse =
    childrenQuery.data?.irods_path === selectedPath ? childrenQuery.data : undefined
  const children = childrenResponse?.children ?? []
  const breadcrumbs = childrenResponse?.path_segments ?? entry?.path_segments ?? []
  const locationOptions = quickLocations(selectedPath)
  const listingError = childrenQuery.isError ? listingErrorDetails(childrenQuery.error) : null

  return (
    <div className="explorer-layout">
      <Card shadow="sm" radius="xl" padding="lg" className="explorer-sidebar">
        <Stack gap="lg">
          <div>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">
              Locations
            </Text>
          </div>

          <Stack gap="xs">
            {locationOptions.map((location) => (
              <Button
                key={`${location.label}-${location.path}`}
                justify="flex-start"
                variant={selectedPath === location.path ? 'light' : 'subtle'}
                leftSection={<location.icon size={16} />}
                onClick={() => openCollection(location.path)}
              >
                {location.label}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Card>

      <Card shadow="sm" radius="xl" padding="lg" className="explorer-main explorer-main-wide">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <div>
              <Title order={2}>iRODS Explorer</Title>
            </div>
            {entry ? (
              <Group gap="xs">
                <Badge variant="light" color="blue">
                  {entry.kind}
                </Badge>
                <Badge variant="dot" color="gray">
                  {entry.zone}
                </Badge>
              </Group>
            ) : null}
          </Group>

          <Breadcrumbs>
            {breadcrumbs.map((crumb) => (
              <Button
                key={crumb.irods_path}
                variant="subtle"
                size="xs"
                onClick={() => openCollection(crumb.irods_path)}
              >
                {crumb.display_name}
              </Button>
            ))}
          </Breadcrumbs>

          <div className="explorer-menubar">
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
            <TextInput
              placeholder={defaultPath}
              value={draftPath}
              onChange={(event) => setDraftPath(event.currentTarget.value)}
              className="explorer-path-input"
            />
            <Button onClick={() => void openPath(draftPath)}>Open path</Button>
          </div>

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

          {entry && entry.kind === 'collection' ? (
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Kind</Table.Th>
                  <Table.Th>Items</Table.Th>
                  <Table.Th>Zone</Table.Th>
                  <Table.Th>Open</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {listingError ? (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Alert
                        color="red"
                        variant="light"
                        icon={<IconAlertCircle size={18} />}
                        title={listingError.title}
                      >
                        {listingError.message}
                      </Alert>
                    </Table.Td>
                  </Table.Tr>
                ) : null}
                {children.map((child) => (
                  <Table.Tr
                    key={child.path}
                    className="explorer-clickable-row"
                    onClick={() =>
                      child.kind === 'collection'
                        ? openCollection(child.path)
                        : navigate(
                            `/app/explorer/details?irods_path=${encodeURIComponent(child.path)}`,
                          )
                    }
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
                          <Text fw={600}>
                            {child.path_segments.at(-1)?.display_name ?? displayName(child.path)}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {child.path}
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>{child.kind}</Table.Td>
                    <Table.Td>{child.kind === 'collection' ? (child.childCount ?? '—') : '—'}</Table.Td>
                    <Table.Td>{child.zone}</Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (child.kind === 'collection') {
                            openCollection(child.path)
                            return
                          }

                          navigate(
                            `/app/explorer/details?irods_path=${encodeURIComponent(child.path)}`,
                          )
                        }}
                      >
                        {child.kind === 'collection' ? 'Open folder' : 'Open details'}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {!children.length && !childrenQuery.isLoading && !listingError ? (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Text size="sm" c="dimmed">
                        Empty collection.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : null}
                {childrenQuery.isLoading ? (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Text size="sm" c="dimmed">
                        Loading collection contents...
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : null}
              </Table.Tbody>
            </Table>
          ) : null}
        </Stack>
      </Card>
    </div>
  )
}
