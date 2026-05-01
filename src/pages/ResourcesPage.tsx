import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Badge,
  Card,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import {
  IconAlertCircle,
  IconServer2,
} from '@tabler/icons-react'
import { formatDateTime } from '../features/explorer'
import { getResources } from '../lib/irods-rest'
import { useSession } from '../providers/use-session'

export function ResourcesPage() {
  const { connection } = useSession()
  const navigate = useNavigate()
  const resourcesQuery = useQuery({
    queryKey: ['resources', connection, 'all'],
    queryFn: () => getResources(connection.auth, connection.baseUrl, { scope: 'all' }),
  })

  return (
    <Stack gap="lg">
      <Card shadow="sm" radius="xl" padding="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Zone resources</Title>
            <Text c="dimmed">
              Browse the resource servers visible in the current iRODS zone.
            </Text>
          </div>
          {resourcesQuery.data ? (
            <Badge variant="light" color="blue">
              {resourcesQuery.data.count} resources
            </Badge>
          ) : null}
        </Group>
      </Card>

      <Card shadow="sm" radius="xl" padding="lg">
        <Stack gap="md">
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

          {resourcesQuery.data ? (
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Zone</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Class</Table.Th>
                  <Table.Th>Location</Table.Th>
                  <Table.Th>Updated</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {resourcesQuery.data.resources.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text size="sm" c="dimmed">
                        No resources returned.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  resourcesQuery.data.resources.map((resource) => (
                    <Table.Tr
                      key={`${resource.id}-${resource.name}`}
                      className="explorer-clickable-row"
                      onClick={() =>
                        navigate(
                          `/app/resources/details?name=${encodeURIComponent(resource.name)}`,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          navigate(
                            `/app/resources/details?name=${encodeURIComponent(resource.name)}`,
                          )
                        }
                      }}
                      tabIndex={0}
                    >
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <ThemeIcon variant="light" color="blue" size="md">
                            <IconServer2 size={16} />
                          </ThemeIcon>
                          <div>
                            <Text fw={600}>{resource.name}</Text>
                            <Text size="xs" c="dimmed">
                              ID {resource.id}
                            </Text>
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>{resource.zone ?? '—'}</Table.Td>
                      <Table.Td>{resource.type ?? '—'}</Table.Td>
                      <Table.Td>{resource.class ?? '—'}</Table.Td>
                      <Table.Td>{resource.location ?? '—'}</Table.Td>
                      <Table.Td>{formatDateTime(resource.updated_at)}</Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  )
}
