import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ActionIcon,
  Anchor,
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  HoverCard,
  Loader,
  Modal,
  Radio,
  Select,
  Stack,
  Switch,
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
  IconCheck,
  IconCopy,
  IconDots,
  IconDatabase,
  IconEdit,
  IconFile,
  IconFolder,
  IconHome2,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconUpload,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { displayName, formatDateTime, homePathForUser } from '../features/explorer'
import {
  ApiError,
  createPathChild,
  createPathChildFromAction,
  deletePath,
  deletePathByAction,
  getFavorites,
  getPath,
  getPathChildren,
  relocatePath,
  relocatePathByAction,
  renamePath,
  renamePathByAction,
  removeFavorite,
  type ActionLink,
  type FavoriteEntry,
  type PathEntry,
} from '../lib/irods-rest'
import { useSession } from '../providers/use-session'
import { useUploadManager } from '../providers/upload-context'

type CreateKind = 'collection' | 'data_object'

interface DeleteDialogState {
  path: string
  label: string
  kind: PathEntry['kind']
  action?: ActionLink
}

interface RenameState {
  path: string
  draftName: string
  kind: PathEntry['kind']
  action?: ActionLink
}

type RelocateOperation = 'move' | 'copy'

interface RelocateDialogState {
  operation: RelocateOperation
  browsePath: string
  destinationPathDraft: string
}

type SearchScope = 'children' | 'subtree' | 'absolute'
type SearchSort = 'path' | 'name' | 'kind' | 'size' | 'created_at' | 'updated_at'
type SearchOrder = 'asc' | 'desc'

const searchScopeOptions = [
  { value: 'children', label: 'This folder only' },
  { value: 'subtree', label: 'This folder + descendants' },
  { value: 'absolute', label: 'Full path (advanced)' },
] as const

const searchSortOptions = [
  { value: 'name', label: 'Name' },
  { value: 'path', label: 'Path' },
  { value: 'kind', label: 'Kind' },
  { value: 'size', label: 'Size' },
  { value: 'created_at', label: 'Created' },
  { value: 'updated_at', label: 'Updated' },
] as const

const searchOrderOptions = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
] as const

const searchLimitOptions = [
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: '200', label: '200' },
  { value: '500', label: '500' },
] as const

function parseSearchScope(value: string | null): SearchScope {
  if (value === 'subtree' || value === 'absolute' || value === 'children') {
    return value
  }
  return 'subtree'
}

function parseSearchSort(value: string | null): SearchSort {
  if (
    value === 'path' ||
    value === 'name' ||
    value === 'kind' ||
    value === 'size' ||
    value === 'created_at' ||
    value === 'updated_at'
  ) {
    return value
  }
  return 'name'
}

function parseSearchOrder(value: string | null): SearchOrder {
  if (value === 'desc' || value === 'asc') {
    return value
  }
  return 'asc'
}

function parseSearchLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (Number.isNaN(parsed)) {
    return 200
  }
  return Math.max(1, Math.min(1000, parsed))
}

function parseSearchOffset(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (Number.isNaN(parsed)) {
    return 0
  }
  return Math.max(0, parsed)
}

function normalizeCollectionPath(path: string) {
  const trimmed = path.trim()
  if (!trimmed) {
    return ''
  }

  if (!trimmed.startsWith('/')) {
    return ''
  }

  if (trimmed === '/') {
    return '/'
  }

  return trimmed.replace(/\/+$/, '')
}

function destinationPathForChild(destinationCollectionPath: string, childPath: string) {
  const baseName = displayName(childPath)
  const normalizedDestination = normalizeCollectionPath(destinationCollectionPath)
  if (!normalizedDestination || !baseName) {
    return ''
  }

  return normalizedDestination === '/'
    ? `/${baseName}`
    : `${normalizedDestination}/${baseName}`
}

function relocateActionForEntry(entry: PathEntry, operation: RelocateOperation): ActionLink | undefined {
  if (operation === 'move') {
    return entry.links?.move ?? entry.links?.relocate ?? entry.links?.update
  }

  return entry.links?.copy ?? entry.links?.relocate ?? entry.links?.update
}

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
  const searchPattern = searchParams.get('pattern')?.trim() ?? ''
  const searchScope = parseSearchScope(searchParams.get('scope'))
  const searchCaseSensitive = searchParams.get('case_sensitive')?.toLowerCase() !== 'false'
  const searchSort = parseSearchSort(searchParams.get('sort'))
  const searchOrder = parseSearchOrder(searchParams.get('order'))
  const searchLimit = parseSearchLimit(searchParams.get('limit'))
  const searchOffset = parseSearchOffset(searchParams.get('offset'))
  const advancedSearchOpen = searchParams.get('advanced')?.toLowerCase() === 'true'
  const searchActive = searchPattern.length > 0
  const [draftPathState, setDraftPathState] = useState({
    sourcePath: initialPath,
    value: initialPath,
  })
  const [searchPatternDraftState, setSearchPatternDraftState] = useState({
    sourcePath: initialPath,
    sourcePattern: searchPattern,
    value: searchPattern,
  })
  const [selectedChildrenState, setSelectedChildrenState] = useState<{
    path: string
    selected: string[]
  }>({
    path: initialPath,
    selected: [],
  })
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createKind, setCreateKind] = useState<CreateKind>('collection')
  const [createName, setCreateName] = useState('new folder')
  const [createIntermediateCollections, setCreateIntermediateCollections] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)
  const [deleteForce, setDeleteForce] = useState(false)
  const [renameState, setRenameState] = useState<RenameState | null>(null)
  const [relocateDialog, setRelocateDialog] = useState<RelocateDialogState | null>(null)
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null)
  const { requestFilesUpload, openFilePicker } = useUploadManager()
  const selectedPath = initialPath
  const explorerQueryString = searchParams.toString()
  const draftPath =
    draftPathState.sourcePath === initialPath ? draftPathState.value : initialPath
  const searchPatternDraft =
    searchPatternDraftState.sourcePath === initialPath &&
    searchPatternDraftState.sourcePattern === searchPattern
      ? searchPatternDraftState.value
      : searchPattern
  const selectedChildren =
    selectedChildrenState.path === initialPath ? selectedChildrenState.selected : []

  const setDraftPath = (value: string) => {
    setDraftPathState({
      sourcePath: initialPath,
      value,
    })
  }

  const setSearchPatternDraft = (value: string) => {
    setSearchPatternDraftState({
      sourcePath: initialPath,
      sourcePattern: searchPattern,
      value,
    })
  }

  const updateExplorerSearchParams = (
    updater: (params: URLSearchParams) => void,
  ) => {
    const next = new URLSearchParams(searchParams)
    updater(next)
    setSearchParams(next)
  }

  const setSelectedChildren = (
    selected: string[] | ((current: string[]) => string[]),
  ) => {
    const nextSelected =
      typeof selected === 'function' ? selected(selectedChildren) : selected

    setSelectedChildrenState({
      path: initialPath,
      selected: nextSelected,
    })
  }

  const setCreateDefaults = (kind: CreateKind) => {
    setCreateKind(kind)
    setCreateName(kind === 'collection' ? 'new folder' : 'new file')
    setCreateIntermediateCollections(false)
  }

  const openCollection = (nextPath: string) => {
    const normalized = nextPath.trim() || userHomePath
    setDraftPath(normalized)
    updateExplorerSearchParams((params) => {
      if (normalized === userHomePath) {
        params.delete('irods_path')
      } else {
        params.set('irods_path', normalized)
      }
      params.set('offset', '0')
    })
    setSelectedChildrenState({
      path: normalized,
      selected: [],
    })
  }

  const openPath = async (nextPath: string) => {
    const normalized = nextPath.trim() || userHomePath

    try {
      const entry = await getPath(normalized, connection.auth, connection.baseUrl)

      if (entry.kind === 'collection') {
        openCollection(normalized)
        return
      }

      const detailsParams = new URLSearchParams({
        irods_path: normalized,
      })
      if (explorerQueryString) {
        detailsParams.set('explorer_query', explorerQueryString)
      }

      navigate(`/app/explorer/details?${detailsParams.toString()}`)
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
    const detailsParams = new URLSearchParams({
      irods_path: normalized,
    })
    if (explorerQueryString) {
      detailsParams.set('explorer_query', explorerQueryString)
    }

    navigate(`/app/explorer/details?${detailsParams.toString()}`)
  }

  const entryQuery = useQuery({
    queryKey: ['path-entry', selectedPath, connection],
    queryFn: () => getPath(selectedPath, connection.auth, connection.baseUrl),
  })
  const favoritesQuery = useQuery({
    queryKey: ['favorites', connection],
    queryFn: () => getFavorites(connection.auth, connection.baseUrl),
  })

  const childrenQueryOptions = searchActive
    ? {
        name_pattern: searchPattern,
        search_scope: searchScope,
        case_sensitive: searchCaseSensitive,
        sort: searchSort,
        order: searchOrder,
        limit: searchLimit,
        offset: searchOffset,
      }
    : undefined

  const childrenQuery = useQuery({
    queryKey: [
      'path-children',
      selectedPath,
      connection,
      searchActive,
      searchActive ? searchPattern : '',
      searchActive ? searchScope : 'children',
      searchActive ? searchCaseSensitive : true,
      searchActive ? searchSort : 'name',
      searchActive ? searchOrder : 'asc',
      searchActive ? searchLimit : 0,
      searchActive ? searchOffset : 0,
    ],
    queryFn: () =>
      getPathChildren(
        selectedPath,
        connection.auth,
        connection.baseUrl,
        childrenQueryOptions,
      ),
    enabled:
      entryQuery.data?.kind === 'collection' && entryQuery.data.path === selectedPath,
  })

  const relocateBrowsePath = relocateDialog?.browsePath ?? ''
  const relocateBrowserEntryQuery = useQuery({
    queryKey: ['path-entry-relocate-dialog', relocateBrowsePath, connection],
    queryFn: () => getPath(relocateBrowsePath, connection.auth, connection.baseUrl),
    enabled: Boolean(relocateDialog && relocateBrowsePath),
  })
  const relocateBrowserChildrenQuery = useQuery({
    queryKey: ['path-children-relocate-dialog', relocateBrowsePath, connection],
    queryFn: () => getPathChildren(relocateBrowsePath, connection.auth, connection.baseUrl),
    enabled:
      relocateBrowserEntryQuery.data?.kind === 'collection' &&
      relocateBrowserEntryQuery.data.path === relocateBrowsePath,
  })

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const entry = await getPath(selectedPath, connection.auth, connection.baseUrl)
      if (entry.kind === 'collection') {
        await getPathChildren(
          selectedPath,
          connection.auth,
          connection.baseUrl,
          childrenQueryOptions,
        )
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

  const createChildMutation = useMutation({
    mutationFn: async () => {
      if (!entry || entry.kind !== 'collection') {
        throw new ApiError(400, 'Open a collection before creating a child path.')
      }

      const childName = createName.trim()
      if (!childName) {
        throw new ApiError(400, 'Enter a name for the new item.')
      }

      const payload = {
        child_name: childName,
        kind: createKind,
        mkdirs: createKind === 'collection' ? createIntermediateCollections : undefined,
      } as const

      const action =
        createKind === 'collection'
          ? (childrenResponse?.links?.create_child_collection ?? entry.links?.create_child_collection)
          : (childrenResponse?.links?.create_child_data_object ?? entry.links?.create_child_data_object)

      if (action) {
        return createPathChildFromAction(action, payload, connection.auth, connection.baseUrl)
      }

      return createPathChild(
        entry.path,
        payload,
        connection.auth,
        connection.baseUrl,
      )
    },
    onSuccess: (created) => {
      notifications.show({
        title: created.kind === 'collection' ? 'Folder created' : 'File created',
        message: created.path,
        color: 'teal',
      })
      setCreateModalOpen(false)
      void entryQuery.refetch()
      void childrenQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Create failed',
        message: error.message,
        color: 'red',
      })
    },
  })

  const deletePathMutation = useMutation({
    mutationFn: async () => {
      if (!deleteDialog) {
        throw new ApiError(400, 'No delete target was selected.')
      }

      if (deleteDialog.action) {
        await deletePathByAction(deleteDialog.action, connection.auth, connection.baseUrl, {
          force: deleteForce,
        })
      } else {
        await deletePath(deleteDialog.path, connection.auth, connection.baseUrl, {
          force: deleteForce,
        })
      }

      return deleteDialog
    },
    onSuccess: (deleted) => {
      notifications.show({
        title: deleted.kind === 'collection' ? 'Folder deleted' : 'File deleted',
        message: deleted.path,
        color: 'teal',
      })
      setSelectedChildren((current) => current.filter((path) => path !== deleted.path))
      setDeleteDialog(null)
      setDeleteForce(false)
      void entryQuery.refetch()
      void childrenQuery.refetch()
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.status === 409) {
        setDeleteForce(true)
        notifications.show({
          title: 'Folder is not empty',
          message: 'Enable force delete to remove this collection recursively.',
          color: 'yellow',
        })
        return
      }

      notifications.show({
        title: 'Delete failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const renamePathMutation = useMutation({
    mutationFn: async () => {
      if (!renameState) {
        throw new ApiError(400, 'No rename target was selected.')
      }

      const newName = renameState.draftName.trim()
      if (!newName) {
        throw new ApiError(400, 'Enter a new name.')
      }

      const payload = {
        new_name: newName,
      }
      if (renameState.action) {
        return renamePathByAction(renameState.action, payload, connection.auth, connection.baseUrl)
      }

      return renamePath(
        renameState.path,
        payload,
        connection.auth,
        connection.baseUrl,
      )
    },
    onSuccess: (renamed) => {
      notifications.show({
        title: renamed.kind === 'collection' ? 'Folder renamed' : 'File renamed',
        message: renamed.path,
        color: 'teal',
      })
      setSelectedChildren((current) =>
        current.map((path) => (path === renameState?.path ? renamed.path : path)),
      )
      setRenameState(null)
      void entryQuery.refetch()
      void childrenQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Rename failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const relocatePathMutation = useMutation({
    mutationFn: async (input: {
      operation: RelocateOperation
      destinationCollectionPath: string
      sourceEntries: Array<Pick<PathEntry, 'path' | 'links'>>
    }) => {
      const destinationCollectionPath = normalizeCollectionPath(input.destinationCollectionPath)
      if (!destinationCollectionPath) {
        throw new ApiError(400, 'Destination path must be an absolute collection path.')
      }

      const failures: Array<{ source: string; reason: string }> = []
      let successCount = 0

      for (const sourceEntry of input.sourceEntries) {
        const sourcePath = sourceEntry.path
        const destinationPath = destinationPathForChild(destinationCollectionPath, sourcePath)
        if (!destinationPath) {
          failures.push({
            source: sourcePath,
            reason: 'Unable to derive destination path.',
          })
          continue
        }

        try {
          const action = relocateActionForEntry(sourceEntry as PathEntry, input.operation)
          if (action) {
            await relocatePathByAction(
              action,
              {
                operation: input.operation,
                destination_path: destinationPath,
              },
              connection.auth,
              connection.baseUrl,
            )
          } else {
            await relocatePath(
              sourcePath,
              {
                operation: input.operation,
                destination_path: destinationPath,
              },
              connection.auth,
              connection.baseUrl,
            )
          }
          successCount += 1
        } catch (error) {
          failures.push({
            source: sourcePath,
            reason: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      return {
        successCount,
        failureCount: failures.length,
        failures,
      }
    },
    onSuccess: (result, variables) => {
      const operationLabel = variables.operation === 'move' ? 'Move' : 'Copy'
      if (result.failureCount === 0) {
        notifications.show({
          title: `${operationLabel} complete`,
          message: `${result.successCount} item${result.successCount === 1 ? '' : 's'} processed.`,
          color: 'teal',
        })
        setRelocateDialog(null)
        setSelectedChildren([])
      } else {
        notifications.show({
          title: `${operationLabel} completed with errors`,
          message: `${result.successCount} succeeded, ${result.failureCount} failed.`,
          color: 'yellow',
        })
      }
      void entryQuery.refetch()
      void childrenQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Relocate failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const removeFavoriteMutation = useMutation({
    mutationFn: async (favorite: FavoriteEntry) => {
      const action = favorite.links?.delete ?? favoritesQuery.data?.links?.delete
      if (!action) {
        throw new ApiError(405, 'Favorite remove action is unavailable.')
      }

      await removeFavorite(
        action,
        {
          absolute_path: favorite.absolute_path,
        },
        connection.auth,
        connection.baseUrl,
      )

      return favorite
    },
    onSuccess: async (favorite) => {
      notifications.show({
        title: 'Favorite removed',
        message: favorite.name,
        color: 'teal',
      })
      await favoritesQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Favorite remove failed',
        message: error.message,
        color: 'red',
      })
    },
  })

  const entry = entryQuery.data
  const childrenResponse =
    childrenQuery.data?.irods_path === selectedPath ? childrenQuery.data : undefined
  const children = childrenResponse?.children ?? []
  const selectedChildEntries = children.filter((child) => selectedChildren.includes(child.path))
  const breadcrumbs = childrenResponse?.path_segments ?? entry?.path_segments ?? []
  const locationOptions = quickLocations(selectedPath, basicUsername)
  const favorites = favoritesQuery.data?.favorites ?? []
  const listingError = childrenQuery.isError ? listingErrorDetails(childrenQuery.error) : null
  const allChildrenSelected = children.length > 0 && selectedChildren.length === children.length
  const someChildrenSelected =
    selectedChildren.length > 0 && selectedChildren.length < children.length
  const matchedCount = childrenResponse?.search?.matched_count
  const shownCount = children.length
  const searchSummary = searchActive
    ? `${shownCount} shown${matchedCount !== undefined ? ` of ${matchedCount}` : ''}`
    : `${shownCount} item${shownCount === 1 ? '' : 's'}`
  const hasPreviousPage = searchActive && searchOffset > 0
  const hasNextPage =
    searchActive && (matchedCount !== undefined
      ? searchOffset + searchLimit < matchedCount
      : shownCount >= searchLimit)
  const relocateBrowserChildren =
    relocateBrowserChildrenQuery.data?.irods_path === relocateBrowsePath
      ? (relocateBrowserChildrenQuery.data.children ?? []).filter((child) => child.kind === 'collection')
      : []
  const relocateBrowserBreadcrumbs =
    relocateBrowserChildrenQuery.data?.path_segments ??
    relocateBrowserEntryQuery.data?.path_segments ??
    []
  const relocateDestinationPath = normalizeCollectionPath(
    relocateDialog?.destinationPathDraft ?? '',
  )

  const applySearch = () => {
    const normalizedPattern = searchPatternDraft.trim()
    const effectiveScope = advancedSearchOpen ? searchScope : 'subtree'
    const effectiveCaseSensitive = advancedSearchOpen ? searchCaseSensitive : true
    updateExplorerSearchParams((params) => {
      if (normalizedPattern) {
        params.set('pattern', normalizedPattern)
        params.delete('recursive')
        params.set('scope', effectiveScope)
        params.set('case_sensitive', `${effectiveCaseSensitive}`)
        if (advancedSearchOpen) {
          params.set('sort', searchSort)
          params.set('order', searchOrder)
          params.set('limit', `${searchLimit}`)
        } else {
          params.delete('sort')
          params.delete('order')
          params.delete('limit')
        }
      } else {
        params.delete('pattern')
        params.delete('scope')
        params.delete('case_sensitive')
        params.delete('sort')
        params.delete('order')
        params.delete('limit')
      }
      params.set('offset', '0')
    })
  }

  const toggleAdvancedSearch = () => {
    updateExplorerSearchParams((params) => {
      if (advancedSearchOpen) {
        params.delete('advanced')
      } else {
        params.set('advanced', 'true')
      }
    })
  }

  const clearSearch = () => {
    setSearchPatternDraft('')
    updateExplorerSearchParams((params) => {
      params.delete('pattern')
      params.delete('advanced')
      params.delete('scope')
      params.delete('recursive')
      params.delete('case_sensitive')
      params.delete('sort')
      params.delete('order')
      params.delete('limit')
      params.delete('offset')
    })
  }

  const movePage = (direction: 'prev' | 'next') => {
    const nextOffset = direction === 'next'
      ? searchOffset + searchLimit
      : Math.max(0, searchOffset - searchLimit)
    updateExplorerSearchParams((params) => {
      params.set('offset', `${nextOffset}`)
    })
  }

  const openRelocateDialog = (operation: RelocateOperation) => {
    if (!selectedChildEntries.length) {
      notifications.show({
        title: 'No items selected',
        message: 'Select one or more rows to move or copy.',
        color: 'yellow',
      })
      return
    }

    setRelocateDialog({
      operation,
      browsePath: selectedPath,
      destinationPathDraft: selectedPath,
    })
  }

  const browseRelocatePath = (nextPath: string) => {
    const normalized = normalizeCollectionPath(nextPath)
    if (!normalized) {
      notifications.show({
        title: 'Invalid path',
        message: 'Destination path must be absolute.',
        color: 'red',
      })
      return
    }

    setRelocateDialog((current) =>
      current
        ? {
            ...current,
            browsePath: normalized,
            destinationPathDraft: normalized,
          }
        : current,
    )
  }

  const submitRelocate = () => {
    if (!relocateDialog) {
      return
    }

    const destinationCollectionPath = normalizeCollectionPath(relocateDialog.destinationPathDraft)
    if (!destinationCollectionPath) {
      notifications.show({
        title: 'Destination is invalid',
        message: 'Enter an absolute destination collection path.',
        color: 'red',
      })
      return
    }

    if (!selectedChildEntries.length) {
      notifications.show({
        title: 'No items selected',
        message: 'Select one or more rows to move or copy.',
        color: 'yellow',
      })
      return
    }

    relocatePathMutation.mutate({
      operation: relocateDialog.operation,
      destinationCollectionPath,
      sourceEntries: selectedChildEntries.map((item) => ({
        path: item.path,
        links: item.links,
      })),
    })
  }

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

  const openCreateModal = (kind: CreateKind) => {
    setCreateDefaults(kind)
    setCreateModalOpen(true)
  }

  const openDeleteDialog = (child: PathEntry) => {
    const childLabel = child.path_segments.at(-1)?.display_name ?? displayName(child.path)
    const requiresForce = child.kind === 'collection' && Boolean(child.hasChildren || (child.childCount ?? 0) > 0)

    setDeleteDialog({
      path: child.path,
      label: childLabel,
      kind: child.kind,
      action: child.links?.delete,
    })
    setDeleteForce(requiresForce)
  }

  const canHandleDragFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer.types).includes('Files')

  const startUploadToPath = (files: File[], targetPath: string, targetLabel?: string) => {
    if (files.length === 0) {
      return
    }

    requestFilesUpload(files, {
      targetPath,
      targetLabel,
    })
  }

  const beginRename = (child: PathEntry) => {
    setRenameState({
      path: child.path,
      draftName: child.path_segments.at(-1)?.display_name ?? displayName(child.path),
      kind: child.kind,
      action: child.links?.update,
    })
  }

  const cancelRename = () => {
    if (!renamePathMutation.isPending) {
      setRenameState(null)
    }
  }

  const updateRenameDraft = (draftName: string) => {
    setRenameState((current) => (current ? { ...current, draftName } : current))
  }

  return (
    <div className="explorer-layout">
      <Modal
        opened={createModalOpen}
        onClose={() => {
          if (!createChildMutation.isPending) {
            setCreateModalOpen(false)
          }
        }}
        title={createKind === 'collection' ? 'New folder' : 'New file'}
        centered
      >
        <Stack gap="md">
          <Radio.Group
            label="Create"
            value={createKind}
            onChange={(value) => setCreateDefaults(value as CreateKind)}
          >
            <Group mt="xs">
              <Radio value="collection" label="Folder" />
              <Radio value="data_object" label="File" />
            </Group>
          </Radio.Group>

          <TextInput
            label="Name"
            value={createName}
            onChange={(event) => setCreateName(event.currentTarget.value)}
            placeholder={createKind === 'collection' ? 'new folder' : 'new file'}
            autoFocus
          />

          {createKind === 'collection' ? (
            <Switch
              label="Create intermediate folders"
              checked={createIntermediateCollections}
              onChange={(event) =>
                setCreateIntermediateCollections(event.currentTarget.checked)
              }
            />
          ) : null}

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setCreateModalOpen(false)}
              disabled={createChildMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createChildMutation.mutate()}
              loading={createChildMutation.isPending}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={deleteDialog !== null}
        onClose={() => {
          if (!deletePathMutation.isPending) {
            setDeleteDialog(null)
            setDeleteForce(false)
          }
        }}
        title={deleteDialog?.kind === 'collection' ? 'Delete folder' : 'Delete file'}
        centered
      >
        <Stack gap="md">
          <Text>
            Delete <strong>{deleteDialog?.label}</strong>?
          </Text>

          {deleteDialog?.kind === 'collection' ? (
            <>
              <Text size="sm" c="dimmed">
                Non-empty collections require force delete, which removes the folder
                recursively.
              </Text>
              <Switch
                label="Force recursive delete"
                checked={deleteForce}
                onChange={(event) => setDeleteForce(event.currentTarget.checked)}
              />
            </>
          ) : null}

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setDeleteDialog(null)
                setDeleteForce(false)
              }}
              disabled={deletePathMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => deletePathMutation.mutate()}
              loading={deletePathMutation.isPending}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={relocateDialog !== null}
        onClose={() => {
          if (!relocatePathMutation.isPending) {
            setRelocateDialog(null)
          }
        }}
        title={relocateDialog?.operation === 'copy' ? 'Copy selected items' : 'Move selected items'}
        centered
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm">
            {selectedChildEntries.length} selected item{selectedChildEntries.length === 1 ? '' : 's'}
          </Text>

          <Stack gap={4}>
            {selectedChildEntries.map((item) => (
              <Text key={item.path} size="xs" c="dimmed" className="explorer-hover-path">
                {item.path}
              </Text>
            ))}
          </Stack>

          <TextInput
            label="Destination collection path"
            value={relocateDialog?.destinationPathDraft ?? ''}
            onChange={(event) =>
              setRelocateDialog((current) =>
                current
                  ? {
                      ...current,
                      destinationPathDraft: event.currentTarget.value,
                    }
                  : current,
              )
            }
            placeholder="/tempZone/home/user/target"
          />

          <Group gap="xs">
            <Button
              variant="light"
              onClick={() => browseRelocatePath(relocateDialog?.destinationPathDraft ?? '')}
              disabled={relocatePathMutation.isPending}
            >
              Browse destination
            </Button>
            <Text size="sm" c="dimmed" className="explorer-hover-path">
              {relocateDestinationPath || 'No destination selected'}
            </Text>
          </Group>

          <Breadcrumbs>
            {relocateBrowserBreadcrumbs.map((crumb) => (
              <Button
                key={`relocate-${crumb.irods_path}`}
                variant="subtle"
                size="xs"
                onClick={() => browseRelocatePath(crumb.irods_path)}
              >
                {crumb.display_name}
              </Button>
            ))}
          </Breadcrumbs>

          {relocateBrowserEntryQuery.isLoading || relocateBrowserChildrenQuery.isLoading ? (
            <Group justify="center" py="sm">
              <Loader size="sm" />
            </Group>
          ) : null}

          {relocateBrowserEntryQuery.isError ? (
            <Alert color="red" variant="light" title="Unable to open destination path">
              {relocateBrowserEntryQuery.error.message}
            </Alert>
          ) : null}

          {relocateBrowserEntryQuery.data && relocateBrowserEntryQuery.data.kind !== 'collection' ? (
            <Alert color="yellow" variant="light" title="Destination is not a collection">
              Choose a collection path for move/copy destination.
            </Alert>
          ) : null}

          {relocateBrowserChildren.length ? (
            <Table highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Folder</Table.Th>
                  <Table.Th w={120}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {relocateBrowserChildren.map((child) => (
                  <Table.Tr key={`relocate-child-${child.path}`}>
                    <Table.Td>
                      <Text size="sm">
                        {child.path_segments.at(-1)?.display_name ?? displayName(child.path)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => browseRelocatePath(child.path)}
                      >
                        Open
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : null}

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setRelocateDialog(null)}
              disabled={relocatePathMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={submitRelocate}
              loading={relocatePathMutation.isPending}
              disabled={!relocateDestinationPath || selectedChildEntries.length === 0}
            >
              {relocateDialog?.operation === 'copy' ? 'Copy selected' : 'Move selected'}
            </Button>
          </Group>
        </Stack>
      </Modal>

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

          <Divider />

          <div>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">
              Favorites
            </Text>
          </div>

          {favoritesQuery.isLoading ? (
            <Text size="sm" c="dimmed">
              Loading favorites...
            </Text>
          ) : null}

          {favoritesQuery.isError ? (
            <Alert color="red" variant="light" title="Unable to load favorites">
              {favoritesQuery.error.message}
            </Alert>
          ) : null}

          <Stack gap="xs">
            {favorites.map((favorite) => (
              <Group key={`${favorite.absolute_path}-${favorite.name}`} gap={6} wrap="nowrap">
                <Button
                  justify="flex-start"
                  variant={selectedPath === favorite.absolute_path ? 'light' : 'subtle'}
                  onClick={() => openPath(favorite.absolute_path)}
                  className="explorer-favorite-button"
                >
                  {favorite.name}
                </Button>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label={`Remove favorite ${favorite.name}`}
                  onClick={() => removeFavoriteMutation.mutate(favorite)}
                  loading={removeFavoriteMutation.isPending}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            ))}

            {!favorites.length && !favoritesQuery.isLoading && !favoritesQuery.isError ? (
              <Text size="sm" c="dimmed">
                No favorites.
              </Text>
            ) : null}
          </Stack>
        </Stack>
      </Card>

      <Card
        shadow="sm"
        radius="xl"
        padding="lg"
        className={`explorer-main explorer-main-wide${
          dropTargetPath === selectedPath ? ' explorer-drop-target-active' : ''
        }`}
        onDragOver={(event) => {
          if (entry?.kind !== 'collection' || !canHandleDragFiles(event)) {
            return
          }

          event.preventDefault()
          setDropTargetPath(selectedPath)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDropTargetPath((current) => (current === selectedPath ? null : current))
          }
        }}
        onDrop={(event) => {
          if (entry?.kind !== 'collection') {
            return
          }

          event.preventDefault()
          setDropTargetPath(null)
          startUploadToPath(
            Array.from(event.dataTransfer.files),
            selectedPath,
            displayName(selectedPath),
          )
        }}
      >
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

          <div className="explorer-controls-panel">
            {selectedChildEntries.length > 0 ? (
              <Group justify="space-between" align="center" wrap="wrap">
                <Group gap="xs">
                  <Badge variant="light" color="blue">
                    {selectedChildEntries.length} selected
                  </Badge>
                </Group>
                <Group gap="xs">
                  <Button
                    variant="default"
                    onClick={() => openRelocateDialog('move')}
                  >
                    Move selected
                  </Button>
                  <Button
                    variant="light"
                    leftSection={<IconCopy size={14} />}
                    onClick={() => openRelocateDialog('copy')}
                  >
                    Copy selected
                  </Button>
                </Group>
              </Group>
            ) : null}

            <div className="explorer-search-panel">
              <Stack gap="sm">
              <Group align="flex-end" wrap="wrap">
                <TextInput
                  label="Name pattern"
                  placeholder="*.txt, report-??.csv, [ab]*"
                  value={searchPatternDraft}
                  onChange={(event) => setSearchPatternDraft(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      applySearch()
                    }
                  }}
                  className="explorer-search-pattern"
                />
                <Button leftSection={<IconSearch size={16} />} onClick={applySearch}>
                  Search
                </Button>
                <Button variant="default" onClick={clearSearch}>
                  Clear
                </Button>
                <Button
                  variant="subtle"
                  onClick={toggleAdvancedSearch}
                >
                  {advancedSearchOpen ? 'Hide advanced' : 'Advanced search'}
                </Button>
              </Group>

              {advancedSearchOpen ? (
                <Card withBorder radius="sm" padding="sm">
                  <Stack gap="sm">
                    <Group align="flex-end" wrap="wrap">
                      <Select
                        label="Scope"
                        data={searchScopeOptions as unknown as { value: string; label: string }[]}
                        value={searchScope}
                        onChange={(value) => {
                          const nextScope = parseSearchScope(value)
                          updateExplorerSearchParams((params) => {
                            params.set('scope', nextScope)
                            params.set('offset', '0')
                          })
                        }}
                        allowDeselect={false}
                        w={260}
                      />
                      <Switch
                        label="Case sensitive"
                        checked={searchCaseSensitive}
                        onChange={(event) => {
                          updateExplorerSearchParams((params) => {
                            params.set('case_sensitive', `${event.currentTarget.checked}`)
                            params.set('offset', '0')
                          })
                        }}
                      />
                      <Select
                        label="Sort"
                        data={searchSortOptions as unknown as { value: string; label: string }[]}
                        value={searchSort}
                        onChange={(value) => {
                          const nextSort = parseSearchSort(value)
                          updateExplorerSearchParams((params) => {
                            params.set('sort', nextSort)
                            params.set('offset', '0')
                          })
                        }}
                        allowDeselect={false}
                        w={180}
                      />
                      <Select
                        label="Order"
                        data={searchOrderOptions as unknown as { value: string; label: string }[]}
                        value={searchOrder}
                        onChange={(value) => {
                          const nextOrder = parseSearchOrder(value)
                          updateExplorerSearchParams((params) => {
                            params.set('order', nextOrder)
                            params.set('offset', '0')
                          })
                        }}
                        allowDeselect={false}
                        w={150}
                      />
                      <Select
                        label="Page size"
                        data={searchLimitOptions as unknown as { value: string; label: string }[]}
                        value={`${searchLimit}`}
                        onChange={(value) => {
                          const nextLimit = parseSearchLimit(value)
                          updateExplorerSearchParams((params) => {
                            params.set('limit', `${nextLimit}`)
                            params.set('offset', '0')
                          })
                        }}
                        allowDeselect={false}
                        w={140}
                      />
                    </Group>

                    <Group justify="space-between" align="center" wrap="wrap">
                      <Text size="sm" c="dimmed">
                        {searchSummary}
                      </Text>
                      <Group gap="xs" align="end">
                        <Button
                          variant="default"
                          size="xs"
                          onClick={() => movePage('prev')}
                          disabled={!hasPreviousPage}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="default"
                          size="xs"
                          onClick={() => movePage('next')}
                          disabled={!hasNextPage}
                        >
                          Next
                        </Button>
                      </Group>
                    </Group>
                  </Stack>
                </Card>
              ) : null}

              {searchActive ? (
                <Alert color="blue" variant="light" title="Wildcard search active">
                  Pattern <strong>{searchPattern}</strong> in <strong>{selectedPath}</strong>
                  {childrenResponse?.search?.search_scope
                    ? ` (${childrenResponse.search.search_scope})`
                    : ''}
                </Alert>
              ) : null}
              </Stack>
            </div>

            <div className="explorer-menubar">
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              onClick={() => openCreateModal('collection')}
              disabled={entry?.kind !== 'collection'}
            >
              New folder
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              onClick={() => openCreateModal('data_object')}
              disabled={entry?.kind !== 'collection'}
            >
              New file
            </Button>
            <Button
              leftSection={<IconUpload size={16} />}
              variant="default"
              onClick={() =>
                openFilePicker({
                  targetPath: selectedPath,
                  targetLabel: displayName(selectedPath),
                })
              }
              disabled={entry?.kind !== 'collection'}
            >
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
            <Button
              leftSection={<IconDots size={16} />}
              variant="light"
              onClick={() => openDetails(selectedPath)}
              disabled={entry?.kind !== 'collection'}
            >
              Collection details
            </Button>
            <TextInput
              placeholder={userHomePath}
              value={draftPath}
              onChange={(event) => setDraftPath(event.currentTarget.value)}
              className="explorer-path-input"
            />
            <Button onClick={() => void openPath(draftPath)}>Open path</Button>
          </div>
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
                  (() => {
                    const isRenaming = renameState?.path === child.path
                    const isCollectionDropTarget =
                      child.kind === 'collection' && dropTargetPath === child.path
                    return (
                  <Table.Tr
                    key={child.path}
                    className={`explorer-clickable-row${
                      selectedChildren.includes(child.path) ? ' explorer-row-selected' : ''
                    }${isCollectionDropTarget ? ' explorer-row-drop-target' : ''}${
                      child.kind === 'collection' ? ' explorer-collection-row' : ''
                    }`}
                    onClick={() => {
                      if (!isRenaming) {
                        void openPath(child.path)
                      }
                    }}
                    onKeyDown={(event) => {
                      if (!isRenaming && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault()
                        void openPath(child.path)
                      }
                    }}
                    tabIndex={0}
                    onDragOver={(event) => {
                      if (child.kind !== 'collection' || !canHandleDragFiles(event)) {
                        return
                      }

                      event.preventDefault()
                      event.stopPropagation()
                      setDropTargetPath(child.path)
                    }}
                    onDragLeave={(event) => {
                      if (child.kind !== 'collection') {
                        return
                      }

                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setDropTargetPath((current) => (current === child.path ? null : current))
                      }
                    }}
                    onDrop={(event) => {
                      if (child.kind !== 'collection') {
                        return
                      }

                      event.preventDefault()
                      event.stopPropagation()
                      setDropTargetPath(null)
                      startUploadToPath(
                        Array.from(event.dataTransfer.files),
                        child.path,
                        child.path_segments.at(-1)?.display_name ?? displayName(child.path),
                      )
                    }}
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
                      {isRenaming ? (
                        <TextInput
                          value={renameState.draftName}
                          onChange={(event) => updateRenameDraft(event.currentTarget.value)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            event.stopPropagation()
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              renamePathMutation.mutate()
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault()
                              cancelRename()
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <HoverCard
                          position="bottom-start"
                          shadow="md"
                          withArrow
                          openDelay={120}
                          closeDelay={80}
                          width={560}
                        >
                          <HoverCard.Target>
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
                          </HoverCard.Target>
                          <HoverCard.Dropdown>
                            <Stack gap={4}>
                              <Text size="xs" c="dimmed">
                                Parent collection
                              </Text>
                              <Text size="sm" className="explorer-hover-path">
                                {selectedPath}
                              </Text>
                              <Text size="xs" c="dimmed" mt={4}>
                                Current {child.kind === 'collection' ? 'collection' : 'file'}
                              </Text>
                              <Text size="sm" className="explorer-hover-path">
                                {child.path_segments.at(-1)?.display_name ?? displayName(child.path)}
                              </Text>
                            </Stack>
                          </HoverCard.Dropdown>
                        </HoverCard>
                      )}
                    </Table.Td>
                    <Table.Td>{child.kind === 'data_object' ? 'file' : 'folder'}</Table.Td>
                    <Table.Td>{child.kind === 'data_object' ? (child.display_size ?? '—') : '—'}</Table.Td>
                    <Table.Td>{formatDateTime(child.created_at)}</Table.Td>
                    <Table.Td>{formatDateTime(child.updated_at)}</Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        {isRenaming ? (
                          <>
                            <ActionIcon
                              variant="subtle"
                              color="teal"
                              aria-label={`Save rename for ${displayName(child.path)}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                renamePathMutation.mutate()
                              }}
                              loading={renamePathMutation.isPending}
                            >
                              <IconCheck size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              aria-label={`Cancel rename for ${displayName(child.path)}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                cancelRename()
                              }}
                            >
                              <IconX size={16} />
                            </ActionIcon>
                          </>
                        ) : (
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label={`Rename ${displayName(child.path)}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              beginRename(child)
                            }}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        )}
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={`Delete ${displayName(child.path)}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            openDeleteDialog(child)
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
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
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                    )
                  })()
                ))}
                {!children.length && !childrenQuery.isLoading && !listingError ? (
                  <Table.Tr>
                    <Table.Td colSpan={8}>
                      <Text size="sm" c="dimmed">
                        {searchActive ? 'No matching items.' : 'Empty collection.'}
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
