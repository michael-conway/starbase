import { useMemo, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ActionIcon,
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
  Tabs,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconBinaryTree2,
  IconCopy,
  IconDatabase,
  IconDownload,
  IconFile,
  IconFolder,
  IconUpload,
} from '@tabler/icons-react'
import { displayName, formatBytes, formatDateTime } from '../features/explorer'
import { downloadPathUrl, getPath, getPathAVUs } from '../lib/irods-rest'
import { useSession } from '../providers/session'

function avuRows(
  avus?: {
    id: string
    attrib: string
    value: string
    unit?: string
    created_at?: string
    updated_at?: string
  }[],
) {
  if (!avus || avus.length === 0) {
    return (
      <Table.Tr>
        <Table.Td colSpan={6}>
          <Text c="dimmed" size="sm">
            No AVUs returned.
          </Text>
        </Table.Td>
      </Table.Tr>
    )
  }

  return avus.map((avu) => (
    <Table.Tr key={`${avu.id}-${avu.attrib}`}>
      <Table.Td>
        <Text size="sm" className="details-code-cell">
          {avu.id}
        </Text>
      </Table.Td>
      <Table.Td>
        <Code>{avu.attrib}</Code>
      </Table.Td>
      <Table.Td>{avu.value}</Table.Td>
      <Table.Td>{avu.unit ?? '—'}</Table.Td>
      <Table.Td>{formatDateTime(avu.created_at)}</Table.Td>
      <Table.Td>{formatDateTime(avu.updated_at)}</Table.Td>
    </Table.Tr>
  ))
}

export function ExplorerDetailsPage() {
  const { connection } = useSession()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const irodsPath = searchParams.get('irods_path')?.trim() ?? ''

  const detailsQuery = useQuery({
    queryKey: ['path-detail', irodsPath, connection],
    queryFn: () => getPath(irodsPath, connection.auth, connection.baseUrl, { verbose: 2 }),
    enabled: Boolean(irodsPath),
  })
  const avuQuery = useQuery({
    queryKey: ['path-avus', irodsPath, connection],
    queryFn: () => getPathAVUs(irodsPath, connection.auth, connection.baseUrl),
    enabled: Boolean(irodsPath),
  })

  const breadcrumbs = useMemo(() => detailsQuery.data?.path_segments ?? [], [detailsQuery.data])
  const backPath = useMemo(() => {
    if (!detailsQuery.data) {
      return ''
    }

    return detailsQuery.data.kind === 'collection'
      ? detailsQuery.data.path
      : (detailsQuery.data.parent?.irods_path ?? '')
  }, [detailsQuery.data])

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // Ignore clipboard failures for now.
    }
  }

  if (!irodsPath) {
    return (
      <Alert variant="light" color="red" title="Missing path">
        No path selected.
      </Alert>
    )
  }

  return (
    <Stack gap="lg">
      <Card shadow="sm" radius="xl" padding="lg">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <div>
              <Title order={2}>
                {detailsQuery.data?.kind === 'collection' ? 'Folder details' : 'File details'}
              </Title>
            </div>

            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => {
                if (backPath) {
                  navigate(`/app/explorer?irods_path=${encodeURIComponent(backPath)}`)
                  return
                }

                navigate('/app/explorer')
              }}
            >
              Back to explorer
            </Button>
          </Group>

          <Breadcrumbs>
            {breadcrumbs.map((crumb) => (
              <Button
                key={crumb.irods_path}
                variant="subtle"
                size="xs"
                onClick={() =>
                  navigate(`/app/explorer?irods_path=${encodeURIComponent(crumb.irods_path)}`)
                }
              >
                {crumb.display_name}
              </Button>
            ))}
          </Breadcrumbs>

          {detailsQuery.isLoading ? (
            <Group justify="center" py="xl">
              <Loader />
            </Group>
          ) : null}

          {detailsQuery.isError ? (
            <Alert
              color="red"
              variant="light"
              icon={<IconAlertCircle size={18} />}
              title="Unable to load details"
            >
              {detailsQuery.error.message}
            </Alert>
          ) : null}

          {detailsQuery.data ? (
            <Stack gap="md">
              <Paper withBorder radius="lg" p="lg">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <ThemeIcon
                      variant="light"
                      color={detailsQuery.data.kind === 'collection' ? 'blue' : 'teal'}
                      size="xl"
                    >
                      {detailsQuery.data.kind === 'collection' ? (
                        <IconFolder size={20} />
                      ) : (
                        <IconFile size={20} />
                      )}
                    </ThemeIcon>
                    <Group justify="space-between" align="flex-start" className="details-header-main">
                      <div>
                        <Title order={3}>{displayName(detailsQuery.data.path)}</Title>
                        <Text c="dimmed">
                          {detailsQuery.data.parent?.irods_path ?? 'Path root'}
                        </Text>
                      </div>

                      <Group gap="xs">
                        <Badge variant="light" color="blue">
                          {detailsQuery.data.kind}
                        </Badge>
                        <Badge variant="dot" color="gray">
                          {detailsQuery.data.zone}
                        </Badge>
                      </Group>
                    </Group>
                  </Group>

                  <div className="details-header-summary">
                    <SummaryStat
                      label="Path"
                      value={detailsQuery.data.path}
                      code
                      action={
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label="Copy path"
                          onClick={() => void copyText(detailsQuery.data.path)}
                        >
                          <IconCopy size={16} />
                        </ActionIcon>
                      }
                    />
                    <SummaryStat
                      label="Size"
                      value={detailsQuery.data.display_size ?? formatBytes(detailsQuery.data.size)}
                    />
                    <SummaryStat
                      label="Updated"
                      value={formatDateTime(detailsQuery.data.updated_at)}
                    />
                    <SummaryStat
                      label="Resource"
                      value={detailsQuery.data.resource ?? 'N/A'}
                    />
                    {detailsQuery.data.kind === 'data_object' ? (
                      <SummaryStat
                        label="Checksum"
                        value={detailsQuery.data.checksum ?? 'N/A'}
                        code
                      />
                    ) : (
                      <SummaryStat
                        label="Children"
                        value={
                          detailsQuery.data.childCount === undefined
                            ? 'N/A'
                            : `${detailsQuery.data.childCount}`
                        }
                      />
                    )}
                  </div>
                </Stack>
              </Paper>

              <div className="details-layout">
                <Card shadow="sm" radius="xl" padding="lg">
                  <Tabs defaultValue="overview" keepMounted={false}>
                    <Tabs.List>
                      <Tabs.Tab value="overview">Overview</Tabs.Tab>
                      <Tabs.Tab value="storage">Storage</Tabs.Tab>
                      <Tabs.Tab value="avus">AVUs</Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="overview" pt="md">
                      <Card shadow="sm" radius="xl" padding="lg">
                        <Stack gap="sm">
                          <Title order={4}>Overview</Title>
                          <InfoRow
                            label="Path"
                            value={detailsQuery.data.path}
                            code
                            action={
                              <ActionIcon
                                variant="subtle"
                                color="gray"
                                aria-label="Copy path"
                                onClick={() => void copyText(detailsQuery.data.path)}
                              >
                                <IconCopy size={16} />
                              </ActionIcon>
                            }
                          />
                          <InfoRow label="Zone" value={detailsQuery.data.zone} />
                          <InfoRow
                            label="Created"
                            value={formatDateTime(detailsQuery.data.created_at)}
                          />
                          <InfoRow
                            label="Updated"
                            value={formatDateTime(detailsQuery.data.updated_at)}
                          />
                          {detailsQuery.data.kind === 'data_object' ? (
                            <>
                              <InfoRow
                                label="Checksum"
                                value={detailsQuery.data.checksum ?? 'N/A'}
                                code
                              />
                              <InfoRow
                                label="Primary resource"
                                value={detailsQuery.data.resource ?? 'N/A'}
                              />
                            </>
                          ) : (
                            <InfoRow
                              label="Children"
                              value={
                                detailsQuery.data.childCount === undefined
                                  ? 'N/A'
                                  : `${detailsQuery.data.childCount}`
                              }
                            />
                          )}
                        </Stack>
                      </Card>
                    </Tabs.Panel>

                    <Tabs.Panel value="storage" pt="md">
                      {detailsQuery.data.kind === 'data_object' ? (
                        <Card shadow="sm" radius="xl" padding="lg">
                          <Stack gap="sm">
                            <Group gap="xs">
                              <ThemeIcon variant="light" color="gray" size="md">
                                <IconBinaryTree2 size={14} />
                              </ThemeIcon>
                              <Title order={4}>Storage Detail</Title>
                            </Group>
                            <InfoRow
                              label="Replica count"
                              value={`${detailsQuery.data.replicas?.length ?? 0}`}
                            />
                            <InfoRow
                              label="Data type"
                              value={detailsQuery.data.replicas?.[0]?.data_type ?? 'N/A'}
                            />
                            <InfoRow
                              label="Last replica update"
                              value={formatDateTime(detailsQuery.data.replicas?.[0]?.updated_at)}
                            />
                            <InfoRow
                              label="Replica owner"
                              value={detailsQuery.data.replicas?.[0]?.owner ?? 'N/A'}
                            />

                            <Divider label="Replicas" labelPosition="left" />

                            {detailsQuery.data.replicas?.length ? (
                              <Table highlightOnHover verticalSpacing="sm">
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th>#</Table.Th>
                                    <Table.Th>Resource</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Checksum</Table.Th>
                                    <Table.Th>Physical path</Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {detailsQuery.data.replicas.map((replica) => (
                                    <Table.Tr key={`${replica.number}-${replica.resource_name}`}>
                                      <Table.Td>{replica.number}</Table.Td>
                                      <Table.Td>
                                        <Stack gap={2}>
                                          <Text size="sm" fw={600}>
                                            {replica.resource_name ?? 'N/A'}
                                          </Text>
                                          <Text size="xs" c="dimmed">
                                            {replica.resource_hierarchy ?? 'No hierarchy'}
                                          </Text>
                                        </Stack>
                                      </Table.Td>
                                      <Table.Td>
                                        <Stack gap={2}>
                                          <Text size="sm">
                                            {replica.status_description ?? replica.status ?? 'Unknown'}
                                          </Text>
                                          <Text size="xs" c="dimmed">
                                            {replica.status_symbol
                                              ? `Symbol ${replica.status_symbol}`
                                              : 'No symbol'}
                                          </Text>
                                        </Stack>
                                      </Table.Td>
                                      <Table.Td>
                                        <Text size="sm" className="details-code-cell">
                                          {replica.checksum ?? '—'}
                                        </Text>
                                      </Table.Td>
                                      <Table.Td>
                                        <Group gap="xs" wrap="nowrap" align="flex-start">
                                          <Text size="sm" className="details-code-cell">
                                            {replica.physical_path ?? '—'}
                                          </Text>
                                          {replica.physical_path ? (
                                            <ActionIcon
                                              variant="subtle"
                                              color="gray"
                                              aria-label="Copy physical path"
                                              onClick={() =>
                                                void copyText(replica.physical_path!)
                                              }
                                            >
                                              <IconCopy size={16} />
                                            </ActionIcon>
                                          ) : null}
                                        </Group>
                                      </Table.Td>
                                    </Table.Tr>
                                  ))}
                                </Table.Tbody>
                              </Table>
                            ) : (
                              <Text size="sm" c="dimmed">
                                No replica detail returned.
                              </Text>
                            )}
                          </Stack>
                        </Card>
                      ) : (
                        <Card shadow="sm" radius="xl" padding="lg">
                          <Text size="sm" c="dimmed">
                            Storage detail will expand here for collections later.
                          </Text>
                        </Card>
                      )}
                    </Tabs.Panel>

                    <Tabs.Panel value="avus" pt="md">
                      <Card shadow="sm" radius="xl" padding="lg">
                        <Stack gap="sm">
                          <Group gap="xs">
                            <ThemeIcon variant="light" color="orange" size="md">
                              <IconDatabase size={14} />
                            </ThemeIcon>
                            <Title order={4}>AVU Metadata</Title>
                          </Group>

                          {avuQuery.isError ? (
                            <Alert
                              color="red"
                              variant="light"
                              icon={<IconAlertCircle size={18} />}
                              title="Unable to load AVUs"
                            >
                              {avuQuery.error.message}
                            </Alert>
                          ) : (
                            <Table highlightOnHover verticalSpacing="sm">
                              <Table.Thead>
                                <Table.Tr>
                                  <Table.Th>ID</Table.Th>
                                  <Table.Th>Attribute</Table.Th>
                                  <Table.Th>Value</Table.Th>
                                  <Table.Th>Unit</Table.Th>
                                  <Table.Th>Created</Table.Th>
                                  <Table.Th>Updated</Table.Th>
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                {avuQuery.isLoading ? (
                                  <Table.Tr>
                                    <Table.Td colSpan={6}>
                                      <Text size="sm" c="dimmed">
                                        Loading AVUs...
                                      </Text>
                                    </Table.Td>
                                  </Table.Tr>
                                ) : (
                                  avuRows(avuQuery.data?.avus)
                                )}
                              </Table.Tbody>
                            </Table>
                          )}
                        </Stack>
                      </Card>
                    </Tabs.Panel>
                  </Tabs>
                </Card>

                <Card shadow="sm" radius="xl" padding="lg">
                  <Stack gap="sm">
                    <Title order={4}>Actions</Title>
                    <DetailsDownloadButton path={detailsQuery.data.path} />
                    <Button variant="default" leftSection={<IconUpload size={14} />}>
                      Replace object
                    </Button>
                    {detailsQuery.data.kind === 'collection' ? (
                      <Button
                        variant="light"
                        onClick={() =>
                          navigate(
                            `/app/explorer?irods_path=${encodeURIComponent(detailsQuery.data.path)}`,
                          )
                        }
                      >
                        Open collection
                      </Button>
                    ) : null}
                    {detailsQuery.data.parent ? (
                      <Button
                        variant="light"
                        onClick={() =>
                          navigate(
                            `/app/explorer?irods_path=${encodeURIComponent(detailsQuery.data.parent!.irods_path)}`,
                          )
                        }
                      >
                        Open parent collection
                      </Button>
                    ) : null}
                  </Stack>
                </Card>
              </div>
            </Stack>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  )
}

function DetailsDownloadButton({ path }: { path: string }) {
  const { connection } = useSession()
  const isBasic = connection.auth.mode === 'basic'

  if (isBasic) {
    return (
      <Button size="xs" variant="light" leftSection={<IconDownload size={14} />} disabled>
        Download unavailable
      </Button>
    )
  }

  return (
    <Button
      component="a"
      href={downloadPathUrl(path, connection.baseUrl)}
      variant="light"
      leftSection={<IconDownload size={14} />}
    >
      Download object
    </Button>
  )
}

function SummaryStat({
  label,
  value,
  code = false,
  action,
}: {
  label: string
  value: string
  code?: boolean
  action?: ReactNode
}) {
  return (
    <div className="details-summary-stat">
      <Text size="xs" tt="uppercase" fw={700} c="dimmed">
        {label}
      </Text>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        {code ? (
          <Code className="details-inline-code">{value}</Code>
        ) : (
          <Text size="sm" fw={600}>
            {value}
          </Text>
        )}
        {action}
      </Group>
    </div>
  )
}

function InfoRow({
  label,
  value,
  code = false,
  action,
}: {
  label: string
  value: string
  code?: boolean
  action?: ReactNode
}) {
  return (
    <Group justify="space-between" align="flex-start">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        {code ? (
          <Code className="details-inline-code">{value}</Code>
        ) : (
          <Text size="sm" fw={600} maw={320} ta="right">
            {value}
          </Text>
        )}
        {action}
      </Group>
    </Group>
  )
}
