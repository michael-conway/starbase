import { startTransition, useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Divider,
  Grid,
  Group,
  Paper,
  PasswordInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import {
  IconAlertCircle,
  IconBinaryTree2,
  IconCircleCheck,
  IconCopy,
  IconDatabase,
  IconFileInfo,
  IconKey,
  IconRoute2,
  IconShieldLock,
  IconSparkles,
} from '@tabler/icons-react'
import {
  ApiError,
  type CollectionRecord,
  getCollection,
  getObject,
  type ObjectRecord,
} from '../lib/irods-rest'

type ResourceKind = 'object' | 'collection'

type ResourceResult =
  | { kind: 'object'; data: ObjectRecord }
  | { kind: 'collection'; data: CollectionRecord }

const baseUrlStorageKey = 'irods-rest-console.base-url'
const tokenStorageKey = 'irods-rest-console.token'

function readStorage(key: string, fallback = '') {
  return window.localStorage.getItem(key) ?? fallback
}

function formatBytes(size: number) {
  return new Intl.NumberFormat('en-US', {
    notation: size > 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(size)
}

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

export function ExplorerPage() {
  const [resourceKind, setResourceKind] = useState<ResourceKind>('object')
  const [identifier, setIdentifier] = useState('demo-object')
  const [token, setToken] = useState(() => readStorage(tokenStorageKey))
  const [baseUrl, setBaseUrl] = useState(() => readStorage(baseUrlStorageKey))

  useEffect(() => {
    window.localStorage.setItem(tokenStorageKey, token)
  }, [token])

  useEffect(() => {
    window.localStorage.setItem(baseUrlStorageKey, baseUrl)
  }, [baseUrl])

  const placeholder = useMemo(
    () => (resourceKind === 'object' ? 'demo-object' : 'demo-collection'),
    [resourceKind],
  )

  const lookupMutation = useMutation<ResourceResult, ApiError, void>({
    mutationFn: async () => {
      const trimmedToken = token.trim()
      const trimmedIdentifier = identifier.trim()
      const trimmedBaseUrl = baseUrl.trim()

      if (!trimmedToken) {
        throw new ApiError(401, 'A bearer token is required for API calls.')
      }

      if (!trimmedIdentifier) {
        throw new ApiError(400, 'Enter an object or collection identifier.')
      }

      if (resourceKind === 'object') {
        const data = await getObject(trimmedIdentifier, trimmedToken, trimmedBaseUrl)
        return { kind: 'object', data }
      }

      const data = await getCollection(
        trimmedIdentifier,
        trimmedToken,
        trimmedBaseUrl,
      )
      return { kind: 'collection', data }
    },
    onSuccess: (result) => {
      notifications.show({
        title: `${result.kind} loaded`,
        message: result.data.path,
        color: 'teal',
      })
    },
    onError: (error) => {
      notifications.show({
        title: `Lookup failed (${error.status})`,
        message: error.message,
        color: 'red',
      })
    },
  })

  const result = lookupMutation.data

  return (
    <Stack gap="xl">
      <Paper className="hero-panel" radius="xl" p="xl">
        <Group justify="space-between" align="flex-start" gap="xl">
          <Stack gap="sm">
            <Badge variant="filled" color="dark">
              iRODS data access
            </Badge>
            <Title order={1} maw={620}>
              Search iRODS object and collection records through the
              `irods-go-rest` API.
            </Title>
            <Text size="lg" c="dimmed" maw={760}>
              This starter favors a clean operator console: direct bearer-token
              auth, contract-aligned fetches, and a structure that can grow into
              a fuller browser without rewrites.
            </Text>
          </Stack>

          <SimpleGrid cols={1} spacing="sm" miw={240}>
            <StatCard
              icon={IconDatabase}
              label="Backend"
              value="irods-go-rest"
              note="/api/v1/* over bearer auth"
            />
            <StatCard
              icon={IconSparkles}
              label="UI stack"
              value="Mantine"
              note="Polished primitives with minimal ceremony"
            />
          </SimpleGrid>
        </Group>
      </Paper>

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="lg">
            <Card shadow="sm" radius="xl" padding="lg">
              <Stack gap="md">
                <Group gap="sm">
                  <ThemeIcon variant="light" color="cyan" size="lg">
                    <IconRoute2 size={18} />
                  </ThemeIcon>
                  <div>
                    <Title order={3}>Connection</Title>
                    <Text size="sm" c="dimmed">
                      Leave the base URL empty during local Vite development to
                      use the built-in proxy to `http://localhost:8080`.
                    </Text>
                  </div>
                </Group>

                <TextInput
                  label="API base URL"
                  placeholder="Use dev proxy when blank"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.currentTarget.value)}
                />

                <PasswordInput
                  label="Bearer token"
                  placeholder="Paste a Keycloak access token"
                  value={token}
                  onChange={(event) => setToken(event.currentTarget.value)}
                  leftSection={<IconShieldLock size={16} />}
                />

                <Alert
                  variant="light"
                  color="blue"
                  icon={<IconKey size={16} />}
                  title="Token source"
                >
                  The current API expects <Code>Authorization: Bearer</Code>.
                  Use the backend&apos;s browser login flow at{' '}
                  <Anchor href="/web/login" target="_blank">
                    /web/login
                  </Anchor>{' '}
                  or pull a token from Keycloak directly.
                </Alert>
              </Stack>
            </Card>

            <Card shadow="sm" radius="xl" padding="lg">
              <Stack gap="md">
                <Group gap="sm">
                  <ThemeIcon variant="light" color="teal" size="lg">
                    <IconFileInfo size={18} />
                  </ThemeIcon>
                  <div>
                    <Title order={3}>Lookup</Title>
                    <Text size="sm" c="dimmed">
                      Switch between object and collection metadata lookups.
                    </Text>
                  </div>
                </Group>

                <SegmentedControl
                  fullWidth
                  value={resourceKind}
                  onChange={(value) => {
                    startTransition(() => {
                      const next = value as ResourceKind
                      setResourceKind(next)
                      setIdentifier(next === 'object' ? 'demo-object' : 'demo-collection')
                    })
                  }}
                  data={[
                    { label: 'Object', value: 'object' },
                    { label: 'Collection', value: 'collection' },
                  ]}
                />

                <TextInput
                  label={`${resourceKind} identifier`}
                  placeholder={placeholder}
                  value={identifier}
                  onChange={(event) => setIdentifier(event.currentTarget.value)}
                />

                <Group gap="sm">
                  <Button
                    onClick={() => lookupMutation.mutate()}
                    loading={lookupMutation.isPending}
                  >
                    Run lookup
                  </Button>
                  <Button
                    variant="default"
                    onClick={() =>
                      setIdentifier(
                        resourceKind === 'object' ? 'demo-object' : 'demo-collection',
                      )
                    }
                  >
                    Use sample
                  </Button>
                </Group>
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card shadow="sm" radius="xl" padding="lg" mih={520}>
            <Stack gap="lg">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Title order={3}>Result</Title>
                  <Text size="sm" c="dimmed">
                    Contract-aligned rendering for the current OpenAPI schema.
                  </Text>
                </div>
                {result ? (
                  <Badge variant="light" color="teal">
                    {result.kind}
                  </Badge>
                ) : null}
              </Group>

              {lookupMutation.isIdle ? (
                <EmptyState />
              ) : null}

              {lookupMutation.isError ? (
                <Alert
                  color="red"
                  variant="light"
                  icon={<IconAlertCircle size={18} />}
                  title="Request error"
                >
                  {lookupMutation.error.message}
                </Alert>
              ) : null}

              {result ? (
                <Stack gap="lg">
                  <Paper withBorder radius="lg" p="md">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Group gap="xs">
                          <Title order={4}>{result.data.id}</Title>
                          <CopyButton value={result.data.path}>
                            {({ copied, copy }) => (
                              <ActionIcon
                                variant="subtle"
                                color={copied ? 'teal' : 'gray'}
                                onClick={copy}
                              >
                                {copied ? (
                                  <IconCircleCheck size={16} />
                                ) : (
                                  <IconCopy size={16} />
                                )}
                              </ActionIcon>
                            )}
                          </CopyButton>
                        </Group>
                        <Text c="dimmed">{result.data.path}</Text>
                      </div>
                      <Badge variant="dot" color="blue">
                        zone {result.data.zone}
                      </Badge>
                    </Group>
                  </Paper>

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <InfoCard
                      label="Path"
                      value={result.data.path}
                      icon={IconRoute2}
                    />
                    <InfoCard
                      label="Zone"
                      value={result.data.zone}
                      icon={IconBinaryTree2}
                    />
                    {result.kind === 'object' ? (
                      <>
                        <InfoCard
                          label="Checksum"
                          value={result.data.checksum}
                          icon={IconShieldLock}
                        />
                        <InfoCard
                          label="Size"
                          value={`${result.data.size} bytes (${formatBytes(result.data.size)})`}
                          icon={IconDatabase}
                        />
                      </>
                    ) : (
                      <InfoCard
                        label="Children"
                        value={`${result.data.childCount ?? 0}`}
                        icon={IconDatabase}
                      />
                    )}
                  </SimpleGrid>

                  <Divider label="Metadata" labelPosition="left" />

                  <Table highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Attribute</Table.Th>
                        <Table.Th>Value</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>{metadataRows(result.data.metadata)}</Table.Tbody>
                  </Table>
                </Stack>
              ) : null}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}

function EmptyState() {
  return (
    <Stack align="center" justify="center" mih={360} gap="sm">
      <ThemeIcon size={64} radius="xl" variant="light" color="cyan">
        <IconFileInfo size={32} />
      </ThemeIcon>
      <Title order={4}>No lookup yet</Title>
      <Text c="dimmed" ta="center" maw={420}>
        Enter a token, choose a resource type, and query a record from the
        running `irods-go-rest` service.
      </Text>
    </Stack>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof IconDatabase
  label: string
  value: string
  note: string
}) {
  return (
    <Paper withBorder radius="lg" p="md">
      <Group wrap="nowrap" align="flex-start">
        <ThemeIcon size="lg" variant="light" color="dark">
          <Icon size={18} />
        </ThemeIcon>
        <div>
          <Text size="xs" tt="uppercase" c="dimmed">
            {label}
          </Text>
          <Text fw={700}>{value}</Text>
          <Text size="sm" c="dimmed">
            {note}
          </Text>
        </div>
      </Group>
    </Paper>
  )
}

function InfoCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof IconDatabase
}) {
  return (
    <Paper withBorder radius="lg" p="md">
      <Group gap="sm" align="flex-start">
        <ThemeIcon variant="light" color="cyan">
          <Icon size={16} />
        </ThemeIcon>
        <div>
          <Text size="xs" tt="uppercase" c="dimmed">
            {label}
          </Text>
          <Text fw={600}>{value}</Text>
        </div>
      </Group>
    </Paper>
  )
}
