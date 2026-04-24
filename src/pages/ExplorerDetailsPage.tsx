import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconDownload,
  IconFile,
  IconFolder,
  IconUpload,
} from '@tabler/icons-react'
import { displayName, formatBytes } from '../features/explorer'
import { downloadPathUrl, getPath } from '../lib/irods-rest'
import { useSession } from '../providers/session'

function metadataRows(metadata?: Record<string, string>) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return (
      <Table.Tr>
        <Table.Td colSpan={2}>
          <Text c="dimmed" size="sm">
            No metadata returned.
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

export function ExplorerDetailsPage() {
  const { connection } = useSession()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const irodsPath = searchParams.get('irods_path')?.trim() ?? ''

  const detailsQuery = useQuery({
    queryKey: ['path-detail', irodsPath, connection],
    queryFn: () => getPath(irodsPath, connection.auth, connection.baseUrl),
    enabled: Boolean(irodsPath),
  })

  const breadcrumbs = useMemo(() => detailsQuery.data?.path_segments ?? [], [detailsQuery.data])

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
              <Title order={2}>Details</Title>
            </div>

            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate(-1)}
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
                <Group justify="space-between" align="flex-start">
                  <Group gap="sm" align="flex-start">
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
                    <div>
                      <Title order={3}>{displayName(detailsQuery.data.path)}</Title>
                      <Text c="dimmed">{detailsQuery.data.path}</Text>
                    </div>
                  </Group>

                  <Group gap="xs">
                    <Badge variant="light" color="blue">
                      {detailsQuery.data.kind}
                    </Badge>
                    <Badge variant="dot" color="gray">
                      {detailsQuery.data.zone}
                    </Badge>
                  </Group>
                </Group>
              </Paper>

              <div className="details-layout">
                <Card shadow="sm" radius="xl" padding="lg">
                  <Stack gap="sm">
                    <Title order={4}>Summary</Title>
                    <InfoRow label="Identifier" value={detailsQuery.data.id} />
                    <InfoRow label="Zone" value={detailsQuery.data.zone} />
                    <InfoRow label="Size" value={formatBytes(detailsQuery.data.size)} />
                    <InfoRow label="Checksum" value={detailsQuery.data.checksum ?? 'N/A'} />
                    {detailsQuery.data.kind === 'collection' ? (
                      <InfoRow
                        label="Children"
                        value={
                          detailsQuery.data.childCount === undefined
                            ? 'N/A'
                            : `${detailsQuery.data.childCount}`
                        }
                      />
                    ) : null}
                  </Stack>
                </Card>

                <Card shadow="sm" radius="xl" padding="lg">
                  <Stack gap="sm">
                    <Title order={4}>Actions</Title>
                    <DetailsDownloadButton path={detailsQuery.data.path} />
                    <Button variant="default" leftSection={<IconUpload size={14} />}>
                      Replace object
                    </Button>
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

              <Divider label="Metadata" labelPosition="left" />

              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Attribute</Table.Th>
                    <Table.Th>Value</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{metadataRows(detailsQuery.data.metadata)}</Table.Tbody>
              </Table>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600} maw={240} ta="right">
        {value}
      </Text>
    </Group>
  )
}
