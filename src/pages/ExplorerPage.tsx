import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  TextInput,
  Anchor,
  ActionIcon,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  IconAlertCircle,
  IconDatabase,
  IconDots,
  IconFile,
  IconFolder,
  IconHome2,
  IconRefresh,
  IconUpload,
} from '@tabler/icons-react'
import { displayName, formatDateTime, homePathForUser } from '../features/explorer'
import { ApiError, getPath, getPathChildren } from '../lib/irods-rest'
import { useSession } from '../providers/session'

function quickLocations(path: string, username?: string) {
  const segments = path.split('/').filter(Boolean)
  const zoneRoot = segments[0] ? `/${segments[0]}` : '/tempZone'
  const homePath = homePathForUser(username, path)

  return [
    {
      label: 'Home',
      path: homePath,
      icon: IconHome2,
    },
    {
      label: 'Zone',
      path: zoneRoot,
      icon: IconDatabase,
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
  const { basicUsername, connection } = useSession()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const userHomePath = homePathForUser(basicUsername)
  const initialPath = searchParams.get('irods_path')?.trim() || userHomePath
  const [draftPath, setDraftPath] = useState(initialPath)
  const [selectedPath, setSelectedPath] = useState(initialPath)
  const [selectedChildren, setSelectedChildren] = useState<string[]>([])

  useEffect(() => {
    setDraftPath(initialPath)
    setSelectedPath(initialPath)
    setSelectedChildren([])
  }, [initialPath])

  const openCollection = (nextPath: string) => {
    const normalized = nextPath.trim() || userHomePath
    setDraftPath(normalized)
    setSelectedPath(normalized)
    setSearchParams(normalized === userHomePath ? {} : { irods_path: normalized })
  }

  const openPath = async (nextPath: string) => {
    const normalized = nextPath.trim() || userHomePath

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

  const openDetails = (nextPath: string) => {
    const normalized = nextPath.trim() || userHomePath
    navigate(`/app/explorer/details?irods_path=${encodeURIComponent(normalized)}`)
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
  const locationOptions = quickLocations(selectedPath, basicUsername)
  const listingError = childrenQuery.isError ? listingErrorDetails(childrenQuery.error) : null
  const allChildrenSelected = children.length > 0 && selectedChildren.length === children.length
  const someChildrenSelected =
    selectedChildren.length > 0 && selectedChildren.length < children.length

  const toggleChildSelection = (childPath: string) => {
    setSelectedChildren((current) =>
      current.includes(childPath)
        ? current.filter((path) => path !== childPath)
        : [...current, childPath],
    )
  }

  const toggleAllChildren = () => {
    setSelectedChildren(allChildrenSelected ? [] : children.map((child) => child.path))
  }

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
              placeholder={userHomePath}
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
                  <Table.Th w={52}>
                    <Checkbox
                      aria-label="Select all items"
                      checked={allChildrenSelected}
                      indeterminate={someChildrenSelected}
                      onChange={toggleAllChildren}
                      disabled={!children.length}
                    />
                  </Table.Th>
                  <Table.Th w={56}></Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Kind</Table.Th>
                  <Table.Th>Size</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Updated</Table.Th>
                  <Table.Th w={64}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {listingError ? (
                  <Table.Tr>
                    <Table.Td colSpan={8}>
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
                    className={`explorer-clickable-row${
                      selectedChildren.includes(child.path) ? ' explorer-row-selected' : ''
                    }`}
                    onClick={() => void openPath(child.path)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        void openPath(child.path)
                      }
                    }}
                    tabIndex={0}
                  >
                    <Table.Td>
                      <Checkbox
                        aria-label={`Select ${displayName(child.path)}`}
                        checked={selectedChildren.includes(child.path)}
                        onChange={() => toggleChildSelection(child.path)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </Table.Td>
                    <Table.Td>
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
                    </Table.Td>
                    <Table.Td>
                      <Anchor
                        fw={600}
                        underline="never"
                        onClick={(event) => {
                          event.stopPropagation()
                          void openPath(child.path)
                        }}
                      >
                        {child.path_segments.at(-1)?.display_name ?? displayName(child.path)}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>{child.kind === 'data_object' ? 'file' : 'folder'}</Table.Td>
                    <Table.Td>{child.kind === 'data_object' ? (child.display_size ?? '—') : '—'}</Table.Td>
                    <Table.Td>{formatDateTime(child.created_at)}</Table.Td>
                    <Table.Td>{formatDateTime(child.updated_at)}</Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={`Open details for ${displayName(child.path)}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          openDetails(child.path)
                        }}
                      >
                        <IconDots size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {!children.length && !childrenQuery.isLoading && !listingError ? (
                  <Table.Tr>
                    <Table.Td colSpan={8}>
                      <Text size="sm" c="dimmed">
                        Empty collection.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : null}
                {childrenQuery.isLoading ? (
                  <Table.Tr>
                    <Table.Td colSpan={8}>
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
