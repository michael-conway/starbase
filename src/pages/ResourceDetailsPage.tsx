import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Code,
  Group,
  Loader,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCopy,
  IconServer2,
} from '@tabler/icons-react'
import { formatDateTime } from '../features/explorer'
import { getResources } from '../lib/irods-rest'
import { useSession } from '../providers/session'

export function ResourceDetailsPage() {
  const { connection } = useSession()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const resourceName = searchParams.get('name')?.trim() ?? ''
  const resourcesQuery = useQuery({
    queryKey: ['resources', connection, 'all'],
    queryFn: () => getResources(connection.auth, connection.baseUrl, { scope: 'all' }),
    enabled: Boolean(resourceName),
  })

  const resource = useMemo(
    () =>
      (resourcesQuery.data?.resources ?? []).find(
        (entry) => entry.name.trim().toLowerCase() === resourceName.toLowerCase(),
      ),
    [resourcesQuery.data, resourceName],
  )

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      return
    }
  }

  if (!resourceName) {
    return (
      <Alert variant="light" color="red" title="Missing resource">
        No resource name was provided.
      </Alert>
    )
  }

  return (
    <Stack gap="lg">
      <Card shadow="sm" radius="xl" padding="lg">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <div>
              <Title order={2}>Resource details</Title>
            </div>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate('/app/resources')}
            >
              Back to resources
            </Button>
          </Group>

          <Breadcrumbs>
            <Button variant="subtle" size="xs" onClick={() => navigate('/app/resources')}>
              Resources
            </Button>
            <Button variant="subtle" size="xs" disabled>
              {resourceName}
            </Button>
          </Breadcrumbs>

          {resourcesQuery.isLoading ? (
            <Group justify="center" py="xl">
              <Loader />
            </Group>
          ) : null}

          {resourcesQuery.isError ? (
            <Alert
              color="red"
              variant="light"
              icon={<IconAlertCircle size={18} />}
              title="Unable to load resources"
            >
              {resourcesQuery.error.message}
            </Alert>
          ) : null}

          {!resourcesQuery.isLoading && !resourcesQuery.isError && !resource ? (
            <Alert
              color="yellow"
              variant="light"
              icon={<IconAlertCircle size={18} />}
              title="Resource not found"
            >
              No resource named <Code>{resourceName}</Code> was returned by the zone
              resource listing.
            </Alert>
          ) : null}

          {resource ? (
            <div className="details-header-layout">
              <Card shadow="sm" radius="xl" padding="lg" className="details-header-card">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <Group gap="sm" align="flex-start">
                      <ThemeIcon variant="light" color="blue" size="xl">
                        <IconServer2 size={20} />
                      </ThemeIcon>
                      <div>
                        <Title order={3}>{resource.name}</Title>
                        <Text c="dimmed">{resource.location ?? 'No location reported'}</Text>
                      </div>
                    </Group>
                    <Group gap="xs">
                      <Badge variant="light" color="blue">
                        {resource.type ?? 'resource'}
                      </Badge>
                      <Badge variant="dot" color="gray">
                        {resource.zone ?? 'unknown zone'}
                      </Badge>
                    </Group>
                  </Group>

                  <div className="details-header-summary">
                    <ResourceStat label="ID" value={`${resource.id}`} code />
                    <ResourceStat label="Class" value={resource.class ?? '—'} />
                    <ResourceStat label="Path" value={resource.path ?? '—'} code />
                    <ResourceStat label="Updated" value={formatDateTime(resource.updated_at)} />
                  </div>
                </Stack>
              </Card>

              <Card shadow="sm" radius="xl" padding="lg" className="details-actions-card">
                <Stack gap="sm">
                  <Title order={4}>Details</Title>
                  <ResourceInfoRow label="Name" value={resource.name} />
                  <ResourceInfoRow label="Zone" value={resource.zone ?? '—'} />
                  <ResourceInfoRow label="Type" value={resource.type ?? '—'} />
                  <ResourceInfoRow label="Class" value={resource.class ?? '—'} />
                  <ResourceInfoRow label="Location" value={resource.location ?? '—'} />
                  <ResourceInfoRow label="Vault path" value={resource.path ?? '—'} code />
                  <ResourceInfoRow label="Context" value={resource.context ?? '—'} code />
                  <ResourceInfoRow
                    label="Created"
                    value={formatDateTime(resource.created_at)}
                  />
                  <ResourceInfoRow
                    label="Updated"
                    value={formatDateTime(resource.updated_at)}
                  />
                  <Button
                    variant="light"
                    leftSection={<IconCopy size={14} />}
                    onClick={() => void copyText(resource.name)}
                  >
                    Copy resource name
                  </Button>
                </Stack>
              </Card>
            </div>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  )
}

function ResourceStat({
  label,
  value,
  code = false,
}: {
  label: string
  value: string
  code?: boolean
}) {
  return (
    <div className="details-summary-stat">
      <Text size="xs" tt="uppercase" fw={700} c="dimmed">
        {label}
      </Text>
      {code ? (
        <Code className="details-inline-code">{value}</Code>
      ) : (
        <Text size="sm" fw={600}>
          {value}
        </Text>
      )}
    </div>
  )
}

function ResourceInfoRow({
  label,
  value,
  code = false,
}: {
  label: string
  value: string
  code?: boolean
}) {
  return (
    <Group justify="space-between" align="flex-start">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      {code ? (
        <Code className="details-inline-code">{value}</Code>
      ) : (
        <Text size="sm" fw={600} maw={320} ta="right">
          {value}
        </Text>
      )}
    </Group>
  )
}
