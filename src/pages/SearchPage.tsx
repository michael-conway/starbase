import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Code,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconEdit,
  IconFile,
  IconFolder,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react'
import { displayName, formatDateTime, homePathForUser } from '../features/explorer'
import {
  ApiError,
  deleteSavedMetadataQuery,
  downloadPath,
  getPath,
  getPathChildren,
  getSavedMetadataQueries,
  getSavedMetadataQuery,
  queryPathEntries,
  saveMetadataQuery,
  type AVUEntry,
  type EntryKind,
  type EntryQueryCondition,
  type EntryQueryDefinition,
  type EntryQueryScopeMode,
  type PathEntry,
  type SavedMetadataQuery,
} from '../lib/irods-rest'
import { useSession } from '../providers/use-session'

type SearchRouteMode = 'list' | 'new' | 'edit' | 'results'
type SupportedScopeMode = Extract<EntryQueryScopeMode, 'self' | 'children' | 'descendants'>

interface SearchDraft {
  name: string
  description: string
  scopeRoot: string
  scopeMode: SupportedScopeMode | ''
  unsupportedScopeMode?: string
  kinds: EntryKind[]
  conditionsText: string
}

interface ConditionsValidation {
  conditions: EntryQueryCondition[]
  error: string
}

interface DeleteTarget {
  id: string
  name: string
}

interface LoadedResultPage {
  paths: PathEntry[]
  matchedAVUs: Record<string, AVUEntry[]>
  nextPageToken: string
}

const defaultQueryName = 'New Query'
const defaultPageSize = 100
const defaultKinds: EntryKind[] = ['data_object', 'collection']
const supportedScopeModes: SupportedScopeMode[] = ['self', 'children', 'descendants']
const allowedConditionFields = ['avu.attrib', 'avu.value', 'avu.unit'] as const
const allowedConditionOperators = ['=', 'like'] as const
const defaultConditions: EntryQueryCondition[] = [
  {
    field: 'avu.attrib',
    op: '=',
    value: '',
  },
  {
    field: 'avu.value',
    op: 'like',
    value: '%',
  },
]

const scopeModeOptions = [
  { value: 'self', label: 'Current collection' },
  { value: 'children', label: 'Direct children' },
  { value: 'descendants', label: 'Descendants' },
] as const

const pageSizeOptions = [
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: '200', label: '200' },
  { value: '500', label: '500' },
] as const

function routeModeFromPath(pathname: string): SearchRouteMode {
  if (pathname.includes('/search/results/')) {
    return 'results'
  }

  if (pathname.endsWith('/search/queries/new')) {
    return 'new'
  }

  if (pathname.includes('/search/queries/') && pathname.endsWith('/edit')) {
    return 'edit'
  }

  return 'list'
}

function normalizeCollectionPath(path: string) {
  const trimmed = path.trim()
  if (!trimmed || !trimmed.startsWith('/')) {
    return ''
  }

  return trimmed === '/' ? '/' : trimmed.replace(/\/+$/, '')
}

function normalizeSavedQueryName(name?: string) {
  const normalized = name?.trim()
  return normalized || defaultQueryName
}

function formatConditions(conditions: EntryQueryCondition[]) {
  return JSON.stringify(conditions, null, 2)
}

function isSupportedScopeMode(value: string | undefined): value is SupportedScopeMode {
  return supportedScopeModes.includes(value as SupportedScopeMode)
}

function defaultDraft(scopeRoot: string): SearchDraft {
  return {
    name: defaultQueryName,
    description: '',
    scopeRoot: normalizeCollectionPath(scopeRoot),
    scopeMode: 'descendants',
    kinds: [...defaultKinds],
    conditionsText: formatConditions(defaultConditions),
  }
}

function draftFromSavedQuery(saved: SavedMetadataQuery, fallbackScopeRoot: string): SearchDraft {
  const scopeMode = saved.query.scope?.mode
  const supportedMode = isSupportedScopeMode(scopeMode) ? scopeMode : ''
  const kinds = (saved.query.kinds ?? []).filter((kind): kind is EntryKind =>
    kind === 'data_object' || kind === 'collection',
  )
  const conditions = Array.isArray(saved.query.conditions)
    ? saved.query.conditions
    : defaultConditions

  return {
    name: normalizeSavedQueryName(saved.name),
    description: saved.description ?? '',
    scopeRoot: normalizeCollectionPath(saved.query.scope?.root ?? fallbackScopeRoot),
    scopeMode: supportedMode,
    unsupportedScopeMode: supportedMode ? undefined : scopeMode,
    kinds: kinds.length > 0 ? kinds : [...defaultKinds],
    conditionsText: formatConditions(conditions),
  }
}

function validateConditionsText(value: string): ConditionsValidation {
  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch (error) {
    return {
      conditions: [],
      error: error instanceof Error ? error.message : 'Conditions must be valid JSON.',
    }
  }

  if (!Array.isArray(parsed)) {
    return {
      conditions: [],
      error: 'Conditions JSON must be an array.',
    }
  }

  const conditions: EntryQueryCondition[] = []
  for (const [index, item] of parsed.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return {
        conditions: [],
        error: `Condition ${index + 1} must be an object.`,
      }
    }

    const record = item as Record<string, unknown>
    const keys = Object.keys(record)
    const unexpectedKey = keys.find((key) => !['field', 'op', 'value'].includes(key))
    if (unexpectedKey) {
      return {
        conditions: [],
        error: `Condition ${index + 1} contains unsupported key "${unexpectedKey}".`,
      }
    }

    if (typeof record.field !== 'string') {
      return {
        conditions: [],
        error: `Condition ${index + 1} field must be a string.`,
      }
    }

    if (!allowedConditionFields.includes(record.field as (typeof allowedConditionFields)[number])) {
      return {
        conditions: [],
        error: `Condition ${index + 1} field must be an AVU field.`,
      }
    }

    if (typeof record.op !== 'string') {
      return {
        conditions: [],
        error: `Condition ${index + 1} op must be a string.`,
      }
    }

    if (!allowedConditionOperators.includes(record.op as (typeof allowedConditionOperators)[number])) {
      return {
        conditions: [],
        error: `Condition ${index + 1} op must be "=" or "like".`,
      }
    }

    if (typeof record.value !== 'string') {
      return {
        conditions: [],
        error: `Condition ${index + 1} value must be a string.`,
      }
    }

    conditions.push({
      field: record.field,
      op: record.op,
      value: record.value,
    })
  }

  return {
    conditions,
    error: '',
  }
}

function queryDefinitionFromDraft(
  draft: SearchDraft,
  conditions: EntryQueryCondition[],
): EntryQueryDefinition {
  const scopeRoot = normalizeCollectionPath(draft.scopeRoot)
  if (!scopeRoot) {
    throw new ApiError(400, 'Choose a collection scope.', 'invalid_request', {
      scope: 'Choose a collection scope.',
    })
  }

  if (!draft.scopeMode) {
    throw new ApiError(400, 'Choose a supported scope mode.', 'invalid_request', {
      scope: 'Choose a supported scope mode.',
    })
  }

  if (draft.kinds.length === 0) {
    throw new ApiError(400, 'Choose at least one result kind.', 'invalid_request', {
      kinds: 'Choose at least one result kind.',
    })
  }

  return {
    type: 'entry_query',
    kinds: draft.kinds,
    scope: {
      root: scopeRoot,
      mode: draft.scopeMode,
    },
    conditions,
  }
}

function filenameFromPath(path: string) {
  return displayName(path) || 'download'
}

function queryKindLabel(kinds?: EntryKind[]) {
  const normalized = kinds ?? []
  if (normalized.includes('collection') && normalized.includes('data_object')) {
    return 'Data objects and collections'
  }

  if (normalized.includes('collection')) {
    return 'Collections'
  }

  return 'Data objects'
}

function useSavedSearchQueries() {
  const { connection, isAuthenticated } = useSession()

  return useQuery({
    queryKey: ['saved-metadata-queries', connection],
    queryFn: () => getSavedMetadataQueries(connection.auth, connection.baseUrl),
    enabled: isAuthenticated,
    staleTime: 60_000,
  })
}

function ErrorToaster({ error, title }: { error: Error | null; title: string }) {
  useEffect(() => {
    if (!error) {
      return
    }

    notifications.show({
      title,
      message: error.message,
      color: 'red',
    })
  }, [error, title])

  return null
}

export function SearchPage() {
  const { basicUsername, connection } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const userHomePath = homePathForUser(basicUsername)
  const routeMode = routeModeFromPath(location.pathname)
  const activeQueryId = params.queryId
  const savedSearchesQuery = useSavedSearchQueries()

  const deleteMutation = useMutation({
    mutationFn: async (target: DeleteTarget) => {
      await deleteSavedMetadataQuery(target.id, connection.auth, connection.baseUrl)
      return target
    },
    onSuccess: async (target) => {
      notifications.show({
        title: 'Saved search deleted',
        message: target.name,
        color: 'teal',
      })
      setDeleteTarget(null)
      await queryClient.invalidateQueries({ queryKey: ['saved-metadata-queries'] })
      if (activeQueryId === target.id) {
        navigate('/app/search/queries')
      }
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Delete failed',
        message: error.message,
        color: 'red',
      })
    },
  })

  const runSavedSearch = (queryId: string) => {
    navigate(`/app/search/results/${encodeURIComponent(queryId)}`)
  }

  const editSavedSearch = (queryId: string) => {
    navigate(`/app/search/queries/${encodeURIComponent(queryId)}/edit`)
  }

  const mainContent = (() => {
    if (routeMode === 'results' && activeQueryId) {
      return <SearchResultsPage key={activeQueryId} queryId={activeQueryId} onEdit={editSavedSearch} />
    }

    if (routeMode === 'new') {
      return (
        <SearchEditorPage
          initialScopeRoot={searchParams.get('scope_root') ?? userHomePath}
          onSaved={() => savedSearchesQuery.refetch()}
        />
      )
    }

    if (routeMode === 'edit' && activeQueryId) {
      return (
        <SearchEditorPage
          queryId={activeQueryId}
          initialScopeRoot={userHomePath}
          onSaved={() => savedSearchesQuery.refetch()}
        />
      )
    }

    return (
      <SavedSearchListPage
        query={savedSearchesQuery}
        onAdd={() => navigate('/app/search/queries/new')}
        onRun={runSavedSearch}
        onEdit={editSavedSearch}
        onDelete={setDeleteTarget}
      />
    )
  })()

  return (
    <>
      <Modal
        opened={deleteTarget !== null}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setDeleteTarget(null)
          }
        }}
        title="Delete saved query?"
        centered
      >
        <Stack gap="md">
          <Text>
            This removes <strong>{deleteTarget?.name}</strong> from your saved metadata queries.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget)
                }
              }}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      {mainContent}
    </>
  )
}

function SavedSearchListPage({
  query,
  onAdd,
  onRun,
  onEdit,
  onDelete,
}: {
  query: ReturnType<typeof useSavedSearchQueries>
  onAdd: () => void
  onRun: (queryId: string) => void
  onEdit: (queryId: string) => void
  onDelete: (target: DeleteTarget) => void
}) {
  const searches = query.data?.metadata_queries ?? []

  return (
    <Card shadow="sm" radius="xl" padding="lg" className="search-main">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Badge variant="light" color="cyan">
              Search
            </Badge>
            <Title order={1} mt="sm">
              Saved searches
            </Title>
          </div>
          <Button leftSection={<IconPlus size={16} />} onClick={onAdd}>
            Add search
          </Button>
        </Group>

        {query.isError ? (
          <Alert color="red" variant="light" title="Unable to load saved searches">
            <Stack gap="xs">
              <Text size="sm">{query.error.message}</Text>
              <Button size="xs" variant="light" onClick={() => query.refetch()}>
                Retry
              </Button>
            </Stack>
          </Alert>
        ) : null}

        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th>Updated</Table.Th>
              <Table.Th w={180}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {query.isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text size="sm" c="dimmed">
                    Loading saved searches...
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : null}

            {searches.map((search) => (
              <Table.Tr key={search.id}>
                <Table.Td>
                  <Text fw={600}>{normalizeSavedQueryName(search.name)}</Text>
                </Table.Td>
                <Table.Td>{search.description?.trim() || '—'}</Table.Td>
                <Table.Td>{formatDateTime(search.updated_at)}</Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      color="teal"
                      aria-label={`Run ${normalizeSavedQueryName(search.name)}`}
                      onClick={() => onRun(search.id)}
                    >
                      <IconPlayerPlay size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={`Edit ${normalizeSavedQueryName(search.name)}`}
                      onClick={() => onEdit(search.id)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Delete ${normalizeSavedQueryName(search.name)}`}
                      onClick={() =>
                        onDelete({
                          id: search.id,
                          name: normalizeSavedQueryName(search.name),
                        })
                      }
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}

            {!searches.length && !query.isLoading && !query.isError ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text size="sm" c="dimmed">
                    No saved searches.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  )
}

function SearchEditorPage({
  queryId,
  initialScopeRoot,
  onSaved,
}: {
  queryId?: string
  initialScopeRoot: string
  onSaved: () => void
}) {
  const { basicUsername, connection } = useSession()
  const userHomePath = homePathForUser(basicUsername)
  const savedQuery = useQuery({
    queryKey: ['saved-metadata-query', queryId, connection],
    queryFn: async () => {
      if (!queryId) {
        throw new ApiError(400, 'query_id is required.')
      }
      return getSavedMetadataQuery(queryId, connection.auth, connection.baseUrl)
    },
    enabled: Boolean(queryId),
  })

  if (queryId && savedQuery.isLoading) {
    return (
      <Card shadow="sm" radius="xl" padding="lg" className="search-main">
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      </Card>
    )
  }

  if (queryId && savedQuery.isError) {
    return (
      <Card shadow="sm" radius="xl" padding="lg" className="search-main">
        <ErrorToaster error={savedQuery.error} title="Saved search load failed" />
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <div>
              <Badge variant="light" color="cyan">
                Search definition
              </Badge>
              <Title order={1} mt="sm">
                Edit saved search
              </Title>
            </div>
          </Group>
          <Alert color="red" variant="light" title="Unable to load saved search">
            {savedQuery.error.message}
          </Alert>
        </Stack>
      </Card>
    )
  }

  const initialDraft = queryId && savedQuery.data?.metadata_query
    ? draftFromSavedQuery(savedQuery.data.metadata_query, initialScopeRoot)
    : defaultDraft(initialScopeRoot)
  const editorKey = queryId
    ? `${queryId}-${savedQuery.data?.metadata_query.updated_at ?? 'loaded'}`
    : `new-${initialScopeRoot}`

  return (
    <SearchEditorForm
      key={editorKey}
      queryId={queryId}
      initialDraft={initialDraft}
      initialScopeRoot={initialScopeRoot}
      userHomePath={userHomePath}
      onSaved={onSaved}
    />
  )
}

function SearchEditorForm({
  queryId,
  initialDraft,
  initialScopeRoot,
  userHomePath,
  onSaved,
}: {
  queryId?: string
  initialDraft: SearchDraft
  initialScopeRoot: string
  userHomePath: string
  onSaved: () => void
}) {
  const { connection } = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<SearchDraft>(initialDraft)
  const [dirty, setDirty] = useState(!queryId)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const validation = useMemo(
    () => validateConditionsText(draft.conditionsText),
    [draft.conditionsText],
  )
  const canSubmit =
    !validation.error &&
    Boolean(normalizeCollectionPath(draft.scopeRoot)) &&
    Boolean(draft.scopeMode) &&
    draft.kinds.length > 0

  const updateDraft = (update: Partial<SearchDraft>, clearFields: string[]) => {
    setDraft((current) => ({
      ...current,
      ...update,
    }))
    setFieldErrors((current) => {
      const next = { ...current }
      clearFields.forEach((field) => {
        delete next[field]
      })
      return next
    })
    setDirty(true)
  }

  const persistMutation = useMutation({
    mutationFn: async (input: { createCopy: boolean; runAfter: boolean }) => {
      if (validation.error) {
        throw new ApiError(400, validation.error, 'invalid_request', {
          conditions: validation.error,
        })
      }

      const query = queryDefinitionFromDraft(draft, validation.conditions)
      const response = await saveMetadataQuery(
        {
          name: draft.name,
          description: draft.description,
          query,
        },
        connection.auth,
        connection.baseUrl,
        input.createCopy ? undefined : { queryId },
      )

      return {
        saved: response.metadata_query,
        input,
      }
    },
    onSuccess: async ({ saved, input }) => {
      setDraft(draftFromSavedQuery(saved, initialScopeRoot))
      setFieldErrors({})
      setDirty(false)
      await queryClient.invalidateQueries({ queryKey: ['saved-metadata-queries'] })
      onSaved()

      if (input.runAfter) {
        notifications.show({
          title: 'Search saved',
          message: normalizeSavedQueryName(saved.name),
          color: 'teal',
        })
        navigate(`/app/search/results/${encodeURIComponent(saved.id)}`)
        return
      }

      notifications.show({
        title: input.createCopy ? 'Saved query copy created' : 'Saved query saved',
        message: normalizeSavedQueryName(saved.name),
        color: 'teal',
      })

      if (!queryId || input.createCopy) {
        navigate(`/app/search/queries/${encodeURIComponent(saved.id)}/edit`)
      }
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.fields) {
        setFieldErrors(error.fields)
      }
      notifications.show({
        title: 'Save failed',
        message: error.message,
        color: 'red',
      })
    },
  })

  const revertMutation = useMutation({
    mutationFn: async () => {
      if (!queryId) {
        throw new ApiError(400, 'Revert is available after the search has been saved.')
      }
      return getSavedMetadataQuery(queryId, connection.auth, connection.baseUrl)
    },
    onSuccess: (response) => {
      setDraft(draftFromSavedQuery(response.metadata_query, initialScopeRoot))
      setFieldErrors({})
      setDirty(false)
      notifications.show({
        title: 'Saved query reverted',
        message: normalizeSavedQueryName(response.metadata_query.name),
        color: 'teal',
      })
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Revert failed',
        message: error.message,
        color: 'red',
      })
    },
  })

  const toggleKind = (kind: EntryKind) => {
    const nextKinds = draft.kinds.includes(kind)
      ? draft.kinds.filter((item) => item !== kind)
      : [...draft.kinds, kind]
    updateDraft({ kinds: nextKinds }, ['kinds'])
  }

  const formatEditorJSON = () => {
    if (!validation.error) {
      setDraft((current) => ({
        ...current,
        conditionsText: formatConditions(validation.conditions),
      }))
    }
  }

  const conditionsError = validation.error || fieldErrors.conditions || fieldErrors.query
  const scopeError = fieldErrors.scope
  const kindsError = fieldErrors.kinds

  return (
    <Card shadow="sm" radius="xl" padding="lg" className="search-main">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Badge variant="light" color="cyan">
              Search definition
            </Badge>
            <Title order={1} mt="sm">
              {queryId ? 'Edit saved search' : 'New saved search'}
            </Title>
          </div>
          <Button variant="default" onClick={() => navigate('/app/search/queries')}>
            Saved searches
          </Button>
        </Group>

        {draft.unsupportedScopeMode ? (
          <Alert color="yellow" variant="light" title="Unsupported scope mode">
            This saved search uses a scope mode that is not editable in this version of Starbase.
            Choose a supported scope mode before saving.
          </Alert>
        ) : null}

        <Group grow align="flex-start">
          <TextInput
            label="Name"
            value={draft.name}
            error={fieldErrors.name}
            onChange={(event) =>
              updateDraft({ name: event.currentTarget.value }, ['name'])
            }
          />
          <TextInput
            label="Description"
            value={draft.description}
            error={fieldErrors.description}
            onChange={(event) =>
              updateDraft({ description: event.currentTarget.value }, ['description'])
            }
          />
        </Group>

        <ScopePicker
          selectedPath={draft.scopeRoot}
          userHomePath={userHomePath}
          error={scopeError}
          onChange={(scopeRoot) => updateDraft({ scopeRoot }, ['scope'])}
        />

        <Group align="flex-end" wrap="wrap">
          <Select
            label="Scope"
            data={scopeModeOptions as unknown as { value: string; label: string }[]}
            value={draft.scopeMode}
            onChange={(value) =>
              updateDraft(
                {
                  scopeMode: isSupportedScopeMode(value ?? '') ? value as SupportedScopeMode : '',
                  unsupportedScopeMode: undefined,
                },
                ['scope'],
              )
            }
            allowDeselect={false}
            error={!draft.scopeMode ? scopeError || 'Choose a supported scope mode.' : scopeError}
            w={240}
          />
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Kinds
            </Text>
            <Group gap="xs">
              <Button
                variant={draft.kinds.includes('data_object') ? 'light' : 'default'}
                onClick={() => toggleKind('data_object')}
              >
                Data objects
              </Button>
              <Button
                variant={draft.kinds.includes('collection') ? 'light' : 'default'}
                onClick={() => toggleKind('collection')}
              >
                Collections
              </Button>
            </Group>
            {kindsError || draft.kinds.length === 0 ? (
              <Text size="xs" c="red">
                {kindsError || 'Choose at least one kind.'}
              </Text>
            ) : null}
          </Stack>
        </Group>

        <Textarea
          label="Conditions JSON"
          value={draft.conditionsText}
          onChange={(event) =>
            updateDraft({ conditionsText: event.currentTarget.value }, ['conditions', 'query'])
          }
          onBlur={formatEditorJSON}
          minRows={9}
          autosize
          className="search-json-editor"
          error={conditionsError}
        />

        <Group justify="space-between" align="center" wrap="wrap">
          <Text size="sm" c="dimmed">
            {dirty ? 'Unsaved changes' : 'Saved'}
          </Text>
          <Group gap="xs">
            <Button
              variant="default"
              onClick={() => revertMutation.mutate()}
              loading={revertMutation.isPending}
              disabled={!queryId || persistMutation.isPending}
            >
              Revert
            </Button>
            {queryId ? (
              <Button
                variant="light"
                onClick={() => persistMutation.mutate({ createCopy: true, runAfter: false })}
                loading={persistMutation.isPending}
                disabled={!canSubmit}
              >
                Save as
              </Button>
            ) : null}
            <Button
              variant="light"
              onClick={() => persistMutation.mutate({ createCopy: false, runAfter: false })}
              loading={persistMutation.isPending}
              disabled={!canSubmit}
            >
              {queryId ? 'Save' : 'Create'}
            </Button>
            <Button
              onClick={() => persistMutation.mutate({ createCopy: false, runAfter: true })}
              loading={persistMutation.isPending}
              disabled={!canSubmit}
            >
              Save and run
            </Button>
          </Group>
        </Group>
      </Stack>
    </Card>
  )
}

function ScopePicker({
  selectedPath,
  userHomePath,
  error,
  onChange,
}: {
  selectedPath: string
  userHomePath: string
  error?: string
  onChange: (path: string) => void
}) {
  const { connection } = useSession()
  const [browsePath, setBrowsePath] = useState(normalizeCollectionPath(selectedPath) || userHomePath)
  const normalizedBrowsePath = normalizeCollectionPath(browsePath)
  const entryQuery = useQuery({
    queryKey: ['search-scope-entry', normalizedBrowsePath, connection],
    queryFn: () => getPath(normalizedBrowsePath, connection.auth, connection.baseUrl),
    enabled: Boolean(normalizedBrowsePath),
  })
  const childrenQuery = useQuery({
    queryKey: ['search-scope-children', normalizedBrowsePath, connection],
    queryFn: () => getPathChildren(normalizedBrowsePath, connection.auth, connection.baseUrl),
    enabled:
      Boolean(normalizedBrowsePath) &&
      entryQuery.data?.kind === 'collection' &&
      entryQuery.data.path === normalizedBrowsePath,
  })
  const children = (childrenQuery.data?.children ?? []).filter((child) => child.kind === 'collection')
  const breadcrumbs = childrenQuery.data?.path_segments ?? entryQuery.data?.path_segments ?? []
  const currentEntry = entryQuery.data

  return (
    <Card withBorder radius="sm" padding="sm">
      <Stack gap="sm">
        <Group align="flex-end" wrap="wrap">
          <TextInput
            label="Collection scope"
            value={selectedPath}
            readOnly
            error={error}
            className="search-scope-input"
          />
          <Button
            variant="light"
            onClick={() => setBrowsePath(normalizeCollectionPath(selectedPath) || userHomePath)}
          >
            Browse selected
          </Button>
          <Button variant="default" onClick={() => setBrowsePath(userHomePath)}>
            Home
          </Button>
        </Group>

        <Breadcrumbs>
          {breadcrumbs.map((crumb) => (
            <Button
              key={crumb.irods_path}
              variant="subtle"
              size="xs"
              onClick={() => setBrowsePath(crumb.irods_path)}
            >
              {crumb.display_name}
            </Button>
          ))}
        </Breadcrumbs>

        {entryQuery.isLoading || childrenQuery.isLoading ? (
          <Text size="sm" c="dimmed">
            Loading collection picker...
          </Text>
        ) : null}

        {entryQuery.isError ? (
          <Alert color="red" variant="light" title="Unable to open scope path">
            {entryQuery.error.message}
          </Alert>
        ) : null}

        {currentEntry?.kind === 'collection' ? (
          <Group gap="xs">
            <Button size="xs" onClick={() => onChange(currentEntry.path)}>
              Use this collection
            </Button>
            <Text size="sm" c="dimmed" className="explorer-hover-path">
              {currentEntry.path}
            </Text>
          </Group>
        ) : null}

        {children.length > 0 ? (
          <Table highlightOnHover verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Collection</Table.Th>
                <Table.Th w={150}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {children.map((child) => (
                <Table.Tr key={child.path}>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {displayName(child.path)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Button size="xs" variant="subtle" onClick={() => setBrowsePath(child.path)}>
                        Open
                      </Button>
                      <Button size="xs" variant="light" onClick={() => onChange(child.path)}>
                        Select
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : null}
      </Stack>
    </Card>
  )
}

function SearchResultsPage({
  queryId,
  onEdit,
}: {
  queryId: string
  onEdit: (queryId: string) => void
}) {
  const { connection } = useSession()
  const navigate = useNavigate()
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [openInNewPage, setOpenInNewPage] = useState(false)
  const [loadedPages, setLoadedPages] = useState<LoadedResultPage[]>([])
  const [expandedRows, setExpandedRows] = useState<string[]>([])
  const savedQuery = useQuery({
    queryKey: ['saved-metadata-query', queryId, connection],
    queryFn: () => getSavedMetadataQuery(queryId, connection.auth, connection.baseUrl),
  })
  const firstPageQuery = useQuery({
    queryKey: [
      'path-query-results',
      queryId,
      savedQuery.data?.metadata_query.updated_at,
      pageSize,
      connection,
    ],
    queryFn: () => {
      const query = savedQuery.data?.metadata_query.query
      if (!query) {
        throw new ApiError(400, 'Saved query has not loaded.')
      }
      return queryPathEntries(
        {
          ...query,
          limit: pageSize,
          include_matched_avus: true,
        },
        connection.auth,
        connection.baseUrl,
      )
    },
    enabled: Boolean(savedQuery.data?.metadata_query.query),
  })
  const rows = useMemo(
    () => [
      ...(firstPageQuery.data?.paths ?? []),
      ...loadedPages.flatMap((page) => page.paths),
    ],
    [firstPageQuery.data?.paths, loadedPages],
  )
  const matchedAVUs = useMemo(
    () =>
      loadedPages.reduce<Record<string, AVUEntry[]>>(
        (current, page) => ({
          ...current,
          ...page.matchedAVUs,
        }),
        firstPageQuery.data?.matched_avus ?? {},
      ),
    [firstPageQuery.data?.matched_avus, loadedPages],
  )
  const nextPageToken =
    loadedPages.at(-1)?.nextPageToken ?? firstPageQuery.data?.page.next_page_token ?? ''

  const loadMoreMutation = useMutation({
    mutationFn: () => {
      const query = savedQuery.data?.metadata_query.query
      if (!query || !nextPageToken) {
        throw new ApiError(400, 'No additional page is available.')
      }
      return queryPathEntries(
        {
          ...query,
          limit: pageSize,
          page_token: nextPageToken,
          include_matched_avus: true,
        },
        connection.auth,
        connection.baseUrl,
      )
    },
    onSuccess: (response) => {
      setLoadedPages((current) => [
        ...current,
        {
          paths: response.paths,
          matchedAVUs: response.matched_avus ?? {},
          nextPageToken: response.page.next_page_token ?? '',
        },
      ])
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Load more failed',
        message: error.message,
        color: 'red',
      })
    },
  })

  const downloadMutation = useMutation({
    mutationFn: (path: string) => downloadPath(path, connection.auth, connection.baseUrl),
    onSuccess: ({ blob, filename }, path) => {
      const objectUrl = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = filename || filenameFromPath(path)
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.URL.revokeObjectURL(objectUrl)
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Download failed',
        message: error.message,
        color: 'red',
      })
    },
  })

  const saved = savedQuery.data?.metadata_query
  const resultScope = firstPageQuery.data?.query.scope ?? saved?.query.scope
  const resultKinds = firstPageQuery.data?.query.kinds ?? saved?.query.kinds

  const openEntry = (entry: PathEntry) => {
    const target = new URLSearchParams({
      irods_path: entry.path,
    })
    const route =
      entry.kind === 'collection'
        ? `/app/explorer?${target.toString()}`
        : `/app/explorer/details?${target.toString()}`

    if (openInNewPage) {
      const opened = window.open(route, '_blank')
      if (opened) {
        opened.opener = null
      }
      return
    }

    navigate(route)
  }

  const rerun = () => {
    setLoadedPages([])
    setExpandedRows([])
    void firstPageQuery.refetch()
  }

  const toggleExpanded = (path: string) => {
    setExpandedRows((current) =>
      current.includes(path)
        ? current.filter((item) => item !== path)
        : [...current, path],
    )
  }

  return (
    <Card shadow="sm" radius="xl" padding="lg" className="search-main">
      <ErrorToaster
        error={savedQuery.isError ? savedQuery.error : null}
        title="Saved search load failed"
      />
      <ErrorToaster
        error={firstPageQuery.isError ? firstPageQuery.error : null}
        title="Search failed"
      />
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Badge variant="light" color="cyan">
              Search results
            </Badge>
            <Title order={1} mt="sm">
              {normalizeSavedQueryName(saved?.name)}
            </Title>
            {saved?.description ? (
              <Text c="dimmed" mt={4}>
                {saved.description}
              </Text>
            ) : null}
          </div>
          <Group gap="xs">
            <Button variant="default" onClick={() => navigate('/app/search/queries')}>
              Saved searches
            </Button>
            <Button variant="light" onClick={() => onEdit(queryId)}>
              Edit search
            </Button>
          </Group>
        </Group>

        <Card withBorder radius="sm" padding="sm">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="xs" wrap="wrap">
              <Badge variant="light" color="blue">
                {resultScope?.mode ?? 'scope'}
              </Badge>
              <Text size="sm" className="explorer-hover-path">
                {resultScope?.root ?? 'No scope'}
              </Text>
              <Badge variant="light" color="teal">
                {queryKindLabel(resultKinds)}
              </Badge>
              <Badge variant="light" color="gray">
                {rows.length} loaded
              </Badge>
            </Group>
            <Group gap="xs" wrap="wrap">
              <Select
                label="Page size"
                data={pageSizeOptions as unknown as { value: string; label: string }[]}
                value={`${pageSize}`}
                onChange={(value) => {
                  const parsed = Number.parseInt(value ?? `${defaultPageSize}`, 10)
                  setLoadedPages([])
                  setExpandedRows([])
                  setPageSize(parsed)
                }}
                allowDeselect={false}
                w={120}
              />
              <Switch
                label="Open in new page"
                checked={openInNewPage}
                onChange={(event) => setOpenInNewPage(event.currentTarget.checked)}
              />
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={rerun}
                loading={firstPageQuery.isFetching}
              >
                Rerun
              </Button>
            </Group>
          </Group>
        </Card>

        {savedQuery.isLoading || firstPageQuery.isLoading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : null}

        {savedQuery.isError ? (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title="Unable to load saved search">
            {savedQuery.error.message}
          </Alert>
        ) : null}

        {firstPageQuery.isError ? (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title="Search failed">
            {firstPageQuery.error.message}
          </Alert>
        ) : null}

        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={44}></Table.Th>
              <Table.Th w={56}></Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Kind</Table.Th>
              <Table.Th>Size</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th>Updated</Table.Th>
              <Table.Th w={82}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((entry) => {
              const expanded = expandedRows.includes(entry.path)
              const avus = matchedAVUs[entry.path] ?? []
              return (
                <Fragment key={entry.path}>
                  <Table.Tr
                    className={`explorer-clickable-row${
                      entry.kind === 'collection' ? ' explorer-collection-row' : ''
                    }`}
                    onClick={() => openEntry(entry)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openEntry(entry)
                      }
                    }}
                    tabIndex={0}
                  >
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={`Show matched AVUs for ${displayName(entry.path)}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleExpanded(entry.path)
                        }}
                      >
                        {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                      </ActionIcon>
                    </Table.Td>
                    <Table.Td>
                      <ThemeIcon
                        size="md"
                        variant="light"
                        color={entry.kind === 'collection' ? 'blue' : 'teal'}
                      >
                        {entry.kind === 'collection' ? (
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
                          openEntry(entry)
                        }}
                      >
                        {displayName(entry.path)}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>{entry.kind === 'data_object' ? 'file' : 'folder'}</Table.Td>
                    <Table.Td>{entry.kind === 'data_object' ? (entry.display_size ?? '—') : '—'}</Table.Td>
                    <Table.Td>{formatDateTime(entry.created_at)}</Table.Td>
                    <Table.Td>{formatDateTime(entry.updated_at)}</Table.Td>
                    <Table.Td>
                      {entry.kind === 'data_object' ? (
                        <ActionIcon
                          variant="subtle"
                          color="teal"
                          aria-label={`Download ${displayName(entry.path)}`}
                          loading={downloadMutation.isPending}
                          onClick={(event) => {
                            event.stopPropagation()
                            downloadMutation.mutate(entry.path)
                          }}
                        >
                          <IconDownload size={16} />
                        </ActionIcon>
                      ) : null}
                    </Table.Td>
                  </Table.Tr>
                  {expanded ? (
                    <Table.Tr>
                      <Table.Td colSpan={8}>
                        <MatchedAVUTable absolutePath={entry.path} avus={avus} />
                      </Table.Td>
                    </Table.Tr>
                  ) : null}
                </Fragment>
              )
            })}

            {!rows.length && !firstPageQuery.isLoading && !firstPageQuery.isError ? (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text size="sm" c="dimmed">
                    No matching entries.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>

        <Group justify="center">
          <Button
            variant="light"
            onClick={() => loadMoreMutation.mutate()}
            loading={loadMoreMutation.isPending}
            disabled={!nextPageToken}
          >
            Load more
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}

function MatchedAVUTable({ absolutePath, avus }: { absolutePath: string; avus: AVUEntry[] }) {
  return (
    <Stack gap="xs">
      <Stack gap={4}>
        <Text size="xs" fw={600} c="dimmed">
          Absolute path
        </Text>
        <Code className="details-inline-code">{absolutePath}</Code>
      </Stack>

      <Table verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>ID</Table.Th>
            <Table.Th>Attribute</Table.Th>
            <Table.Th>Value</Table.Th>
            <Table.Th>Unit</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {avus.map((avu, index) => (
            <Table.Tr key={avu.id || `${avu.attrib}-${avu.value}-${avu.unit ?? ''}-${index}`}>
              <Table.Td>{avu.id ? <Code>{avu.id}</Code> : '—'}</Table.Td>
              <Table.Td>
                <Code>{avu.attrib}</Code>
              </Table.Td>
              <Table.Td>{avu.value}</Table.Td>
              <Table.Td>{avu.unit || '—'}</Table.Td>
            </Table.Tr>
          ))}
          {!avus.length ? (
            <Table.Tr>
              <Table.Td colSpan={4}>
                <Text size="sm" c="dimmed">
                  No matched AVUs returned.
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : null}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}
