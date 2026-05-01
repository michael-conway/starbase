import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
  Code,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQuery } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconBinaryTree2,
  IconCopy,
  IconDatabase,
  IconDownload,
  IconEdit,
  IconFile,
  IconFolder,
  IconFingerprint,
  IconKey,
  IconLock,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconEye,
  IconTerminal2,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { FilePreviewGlyph } from '../features/file-preview-icon'
import { filePreviewSpec } from '../features/file-preview'
import { displayName, formatDateTime } from '../features/explorer'
import {
  addPathACL,
  addFavorite,
  addAVU,
  actionLinkUrl,
  addPathReplica,
  ApiError,
  computePathChecksum,
  createPathTicket,
  deletePathACLInheritance,
  deletePathACL,
  deleteAVU,
  deletePath,
  deletePathByAction,
  deleteTicket,
  downloadPath,
  getPath,
  getPathChildren,
  getPathACL,
  getPathAVUs,
  getFavorites,
  getResources,
  searchGroups,
  searchUsers,
  getTickets,
  type PathACLEntry,
  type PathACLResponse,
  renamePath,
  relocatePath,
  relocatePathByAction,
  removeFavorite,
  renamePathByAction,
  setPathACLInheritance,
  movePathReplica,
  trimPathReplica,
  type ActionLink,
  type FavoriteEntry,
  type PathEntry,
  type TicketEntry,
  updatePathACL,
  updateTicket,
} from '../lib/irods-rest'
import { useSession } from '../providers/use-session'
import { useUploadManager } from '../providers/upload-context'

interface DeleteDialogState {
  path: string
  label: string
  kind: PathEntry['kind']
  action?: ActionLink
}

interface RenameDialogState {
  path: string
  label: string
  kind: PathEntry['kind']
  action?: ActionLink
}

type RelocateOperation = 'move' | 'copy'

interface RelocateDialogState {
  operation: RelocateOperation
  browsePath: string
  destinationPathDraft: string
}

interface ACLFormState {
  name: string
  zone: string
  type: 'user' | 'group'
  read: boolean
  write: boolean
  own: boolean
}

interface ACLPermissionState {
  read: boolean
  write: boolean
  own: boolean
}

type ACLPermissionKey = keyof ACLPermissionState

interface ACLPrincipalOption {
  value: string
  label: string
  principal: string
  zone?: string
}

function avuCreateAction(entry?: Pick<PathEntry, 'links'>): ActionLink | undefined {
  const action = entry?.links?.create_avu ?? entry?.links?.avus
  if (!action) {
    return undefined
  }

  if (action.method?.toUpperCase() === 'GET') {
    return {
      ...action,
      method: 'POST',
    }
  }

  return action
}

function avuRows(
  avus?: {
    id: string
    attrib: string
    value: string
    unit?: string
    created_at?: string
    updated_at?: string
    links?: {
      delete?: { href: string; method?: string }
    }
  }[],
  options?: {
    onDelete: (avu: {
      id: string
      attrib: string
      value: string
      unit?: string
      links?: {
        delete?: { href: string; method?: string }
      }
    }) => void
  },
) {
  if (!avus || avus.length === 0) {
    return (
      <Table.Tr>
        <Table.Td colSpan={4}>
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
        <Code>{avu.attrib}</Code>
      </Table.Td>
      <Table.Td>{avu.value}</Table.Td>
      <Table.Td>{avu.unit ?? '—'}</Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          {avu.links?.delete ? (
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label={`Delete AVU ${avu.attrib}`}
              onClick={() => options?.onDelete(avu)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          ) : null}
          {!avu.links?.delete ? (
            <Text size="sm" c="dimmed">
              Unavailable
            </Text>
          ) : null}
        </Group>
      </Table.Td>
    </Table.Tr>
  ))
}

function checksumValueOnly(checksum?: { checksum?: string; type?: string }) {
  const raw = checksum?.checksum?.trim()
  if (!raw) {
    return 'N/A'
  }

  const [prefix, remainder] = raw.split(':', 2)
  if (remainder && checksum?.type && prefix.toLowerCase() === checksum.type.toLowerCase()) {
    return remainder
  }

  return remainder ?? raw
}

function filenameFromPath(path: string) {
  const segments = path.split('/').filter(Boolean)
  return segments.at(-1) ?? 'download'
}

function shellQuote(value: string) {
  if (!value) {
    return "''"
  }

  return `'${value.replace(/'/g, `'\\''`)}'`
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

function destinationPathForSource(sourcePath: string, destinationCollectionPath: string) {
  const sourceName = displayName(sourcePath)
  const destinationCollection = normalizeCollectionPath(destinationCollectionPath)
  if (!sourceName || !destinationCollection) {
    return ''
  }

  return destinationCollection === '/' ? `/${sourceName}` : `${destinationCollection}/${sourceName}`
}

function relocateActionForEntry(entry: PathEntry, operation: RelocateOperation): ActionLink | undefined {
  if (operation === 'move') {
    return entry.links?.move ?? entry.links?.relocate ?? entry.links?.update
  }

  return entry.links?.copy ?? entry.links?.relocate ?? entry.links?.update
}

function ticketCreateAction(entry?: Pick<PathEntry, 'links'>): ActionLink | undefined {
  const action = entry?.links?.create_ticket
  if (!action) {
    return undefined
  }

  if (action.method?.toUpperCase() === 'GET') {
    return {
      ...action,
      method: 'POST',
    }
  }

  return action
}

function formatTicketLimit(value?: number) {
  if (value === undefined || value === null) {
    return '—'
  }

  return value === 0 ? 'Unlimited' : `${value}`
}

function aclAddAction(entry?: Pick<PathACLResponse, 'links'>): ActionLink | undefined {
  return entry?.links?.add_permission ?? entry?.links?.add_user
}

function normalizeACLPermissionState(state: ACLPermissionState): ACLPermissionState {
  if (state.own) {
    return {
      read: true,
      write: true,
      own: true,
    }
  }

  if (state.write) {
    return {
      read: true,
      write: true,
      own: false,
    }
  }

  return {
    read: state.read,
    write: false,
    own: false,
  }
}

function nextACLPermissionState(
  current: ACLPermissionState,
  permission: ACLPermissionKey,
  checked: boolean,
): ACLPermissionState {
  const next = {
    ...current,
    [permission]: checked,
  }

  if (permission === 'read' && !checked) {
    next.write = false
    next.own = false
  }

  if (permission === 'write' && !checked) {
    next.own = false
  }

  return normalizeACLPermissionState(next)
}

function aclPermissionState(accessLevel?: string): ACLPermissionState {
  const normalized = accessLevel?.trim().toLowerCase() ?? ''
  if (normalized === 'own') {
    return {
      read: true,
      write: true,
      own: true,
    }
  }

  if (normalized === 'modify_object' || normalized === 'write' || normalized === 'write_object') {
    return {
      read: true,
      write: true,
      own: false,
    }
  }

  if (normalized === 'read_object' || normalized === 'read') {
    return {
      read: true,
      write: false,
      own: false,
    }
  }

  return {
    read: false,
    write: false,
    own: false,
  }
}

function aclAccessLevelFromState(state: ACLPermissionState) {
  if (state.own) {
    return 'own'
  }

  if (state.write) {
    return 'modify_object'
  }

  if (state.read) {
    return 'read_object'
  }

  return ''
}

function aclAccessLevelLabel(accessLevel?: string) {
  const normalized = accessLevel?.trim()
  if (!normalized) {
    return 'None'
  }

  switch (normalized.toLowerCase()) {
    case 'own':
      return 'Owner'
    case 'modify_object':
    case 'write':
    case 'write_object':
      return 'Write'
    case 'read_object':
    case 'read':
      return 'Read'
    default:
      return normalized
  }
}

function aclPrincipalLabel(entry: PathACLEntry) {
  return entry.zone ? `${entry.name}#${entry.zone}` : entry.name
}

function collectionInheritanceAction(
  acl?: Pick<PathACLResponse, 'inheritance_enabled' | 'links'>,
) {
  const links = acl?.links
  if (!links) {
    return undefined
  }

  if (acl?.inheritance_enabled === true) {
    return links.delete_inheritance ?? links.set_inheritance
  }

  return links.set_inheritance ?? links.delete_inheritance
}

export function ExplorerDetailsPage() {
  const { connection } = useSession()
  const { openFilePicker } = useUploadManager()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const irodsPath = searchParams.get('irods_path')?.trim() ?? ''
  const explorerQuery = searchParams.get('explorer_query')?.trim() ?? ''
  const explorerReturnQueryString = useMemo(() => {
    if (!explorerQuery) {
      return ''
    }

    const params = new URLSearchParams(explorerQuery)
    params.delete('explorer_query')
    return params.toString()
  }, [explorerQuery])
  const [isAddingAVU, setIsAddingAVU] = useState(false)
  const [avuForm, setAVUForm] = useState({
    attrib: '',
    value: '',
    unit: '',
  })
  const [isAddingACL, setIsAddingACL] = useState(false)
  const [aclForm, setACLForm] = useState<ACLFormState>({
    name: '',
    zone: '',
    type: 'user',
    read: true,
    write: false,
    own: false,
  })
  const [aclPrincipalSelection, setACLPrincipalSelection] = useState<string | null>(null)
  const [aclPrincipalSearchValue, setACLPrincipalSearchValue] = useState('')
  const [aclEdits, setACLEdits] = useState<Record<string, ACLPermissionState>>({})
  const [applyACLRecursively, setApplyACLRecursively] = useState(false)
  const [isAddingTicket, setIsAddingTicket] = useState(false)
  const [ticketForm, setTicketForm] = useState({
    maximumUses: '50',
    lifetimeMinutes: '720',
  })
  const [editingTicketName, setEditingTicketName] = useState<string | null>(null)
  const [ticketEditForm, setTicketEditForm] = useState({
    maximumUses: '',
    lifetimeMinutes: '',
  })
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)
  const [deleteForce, setDeleteForce] = useState(false)
  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null)
  const [relocateDialog, setRelocateDialog] = useState<RelocateDialogState | null>(null)
  const [renameName, setRenameName] = useState('')
  const [commandHintsOpened, setCommandHintsOpened] = useState(false)
  const [storageCommandDetailsOpened, setStorageCommandDetailsOpened] = useState(false)
  const [storageCommandSourceResource, setStorageCommandSourceResource] = useState('')
  const [storageCommandDestinationResource, setStorageCommandDestinationResource] = useState('')
  const [replicaAddResource, setReplicaAddResource] = useState('')
  const [replicaAddUpdate, setReplicaAddUpdate] = useState(true)
  const [replicaMoveSourceResource, setReplicaMoveSourceResource] = useState<string | null>(null)
  const [replicaMoveDestinationResource, setReplicaMoveDestinationResource] = useState('')
  const [replicaMoveUpdate, setReplicaMoveUpdate] = useState(true)
  const [replicaMoveMinCopies, setReplicaMoveMinCopies] = useState('1')
  const [replicaMoveMinAgeMinutes, setReplicaMoveMinAgeMinutes] = useState('0')

  const detailsUrlForPath = (path: string) => {
    const params = new URLSearchParams({
      irods_path: path,
    })
    if (explorerQuery) {
      params.set('explorer_query', explorerQuery)
    }
    return `/app/explorer/details?${params.toString()}`
  }

  const navigateToExplorer = (irodsPathOverride?: string) => {
    if (explorerReturnQueryString) {
      const params = new URLSearchParams(explorerReturnQueryString)
      if (irodsPathOverride?.trim()) {
        params.set('irods_path', irodsPathOverride.trim())
      }
      const nextQuery = params.toString()
      navigate(nextQuery ? `/app/explorer?${nextQuery}` : '/app/explorer')
      return
    }

    if (irodsPathOverride?.trim()) {
      navigate(`/app/explorer?irods_path=${encodeURIComponent(irodsPathOverride.trim())}`)
      return
    }

    navigate('/app/explorer')
  }

  const detailsQuery = useQuery({
    queryKey: ['path-detail', irodsPath, connection],
    queryFn: () => getPath(irodsPath, connection.auth, connection.baseUrl, { verbose: 2 }),
    enabled: Boolean(irodsPath),
  })
  const headerPreviewSpec = useMemo(() => {
    if (!detailsQuery.data || detailsQuery.data.kind !== 'data_object') {
      return undefined
    }

    return filePreviewSpec(detailsQuery.data.path, detailsQuery.data.mime_type)
  }, [detailsQuery.data])
  const headerImagePreviewQuery = useQuery({
    queryKey: ['path-preview-thumbnail', irodsPath, connection],
    queryFn: () => downloadPath(irodsPath, connection.auth, connection.baseUrl),
    enabled: Boolean(headerPreviewSpec?.kind === 'image' && detailsQuery.data?.kind === 'data_object'),
    staleTime: 60_000,
  })
  const avuQuery = useQuery({
    queryKey: ['path-avus', irodsPath, connection],
    queryFn: () => getPathAVUs(irodsPath, connection.auth, connection.baseUrl),
    enabled: Boolean(irodsPath),
  })
  const aclQuery = useQuery({
    queryKey: ['path-acls', irodsPath, connection],
    queryFn: () => getPathACL(irodsPath, connection.auth, connection.baseUrl),
    enabled: Boolean(irodsPath),
  })
  const resourcesQuery = useQuery({
    queryKey: ['resources-top', connection.baseUrl, connection.auth.mode],
    queryFn: () => getResources(connection.auth, connection.baseUrl, { scope: 'top' }),
    enabled: Boolean(irodsPath),
    staleTime: 60_000,
  })
  const favoritesQuery = useQuery({
    queryKey: ['favorites', connection],
    queryFn: () => getFavorites(connection.auth, connection.baseUrl),
    staleTime: 60_000,
  })
  const relocateBrowsePath = relocateDialog?.browsePath ?? ''
  const relocateBrowserEntryQuery = useQuery({
    queryKey: ['path-entry-relocate-details-dialog', relocateBrowsePath, connection],
    queryFn: () => getPath(relocateBrowsePath, connection.auth, connection.baseUrl),
    enabled: Boolean(relocateDialog && relocateBrowsePath),
  })
  const relocateBrowserChildrenQuery = useQuery({
    queryKey: ['path-children-relocate-details-dialog', relocateBrowsePath, connection],
    queryFn: () => getPathChildren(relocateBrowsePath, connection.auth, connection.baseUrl),
    enabled:
      relocateBrowserEntryQuery.data?.kind === 'collection' &&
      relocateBrowserEntryQuery.data.path === relocateBrowsePath,
  })
  const aclPrincipalSearchTerm = aclPrincipalSearchValue.trim()
  const aclPrincipalQuery = useQuery({
    queryKey: [
      'acl-principal-search',
      connection.baseUrl,
      connection.auth.mode,
      aclForm.type,
      aclPrincipalSearchTerm,
      aclForm.zone.trim(),
    ],
    queryFn: async (): Promise<ACLPrincipalOption[]> => {
      const zone = aclForm.zone.trim() || detailsQuery.data?.zone || undefined

      if (aclForm.type === 'group') {
        const payload = await searchGroups(
          aclPrincipalSearchTerm,
          connection.auth,
          connection.baseUrl,
          { zone },
        )

        return payload.groups.map((group) => ({
          value: group.zone ? `${group.name}#${group.zone}` : group.name,
          label: group.zone ? `${group.name}#${group.zone}` : group.name,
          principal: group.name,
          zone: group.zone,
        }))
      }

      const payload = await searchUsers(
        aclPrincipalSearchTerm,
        connection.auth,
        connection.baseUrl,
        { zone },
      )
      return payload.users.map((user) => ({
        value: user.zone ? `${user.name}#${user.zone}` : user.name,
        label: user.zone ? `${user.name}#${user.zone}` : user.name,
        principal: user.name,
        zone: user.zone,
      }))
    },
    enabled: isAddingACL && aclPrincipalSearchTerm.length >= 3,
    staleTime: 30_000,
  })
  const aclPrincipalOptionsByValue = useMemo(
    () => new Map((aclPrincipalQuery.data ?? []).map((option) => [option.value, option])),
    [aclPrincipalQuery.data],
  )
  const ticketsQuery = useQuery({
    queryKey: ['tickets', connection],
    queryFn: () => getTickets(connection.auth, connection.baseUrl),
    enabled: Boolean(irodsPath),
  })
  const headerImagePreviewUrl = useMemo(() => {
    if (headerPreviewSpec?.kind !== 'image' || !headerImagePreviewQuery.data?.blob) {
      return null
    }

    return URL.createObjectURL(headerImagePreviewQuery.data.blob)
  }, [headerImagePreviewQuery.data, headerPreviewSpec?.kind])

  useEffect(() => {
    if (!headerImagePreviewUrl) {
      return undefined
    }

    return () => URL.revokeObjectURL(headerImagePreviewUrl)
  }, [headerImagePreviewUrl])
  const checksumMutation = useMutation({
    mutationFn: () => computePathChecksum(irodsPath, connection.auth, connection.baseUrl),
    onSuccess: async (payload) => {
      notifications.show({
        title: 'Checksum updated',
        message: payload.checksum ?? 'Checksum computed',
        color: 'teal',
      })
      await detailsQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Checksum failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const deleteAVUMutation = useMutation({
    mutationFn: (input: { href: { href: string; method?: string } }) =>
      deleteAVU(input.href, connection.auth, connection.baseUrl),
    onSuccess: async () => {
      notifications.show({
        title: 'AVU deleted',
        message: 'Metadata entry removed.',
        color: 'teal',
      })
      await avuQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'AVU delete failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const addAVUMutation = useMutation({
    mutationFn: (input: {
      href: { href: string; method?: string }
      attrib: string
      value: string
      unit?: string
    }) =>
      addAVU(
        input.href,
        {
          attrib: input.attrib,
          value: input.value,
          unit: input.unit,
        },
        connection.auth,
        connection.baseUrl,
      ),
    onSuccess: async () => {
      notifications.show({
        title: 'AVU added',
        message: 'Metadata entry created.',
        color: 'teal',
      })
      await avuQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'AVU add failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const addACLMutation = useMutation({
    mutationFn: (input: {
      href: ActionLink
      name: string
      zone?: string
      type: 'user' | 'group'
      access_level: string
      recursive?: boolean
    }) =>
      addPathACL(
        input.href,
        {
          name: input.name,
          zone: input.zone,
          type: input.type,
          access_level: input.access_level,
          recursive: input.recursive,
        },
        connection.auth,
        connection.baseUrl,
      ),
    onSuccess: async () => {
      notifications.show({
        title: 'Permission added',
        message: 'ACL entry created.',
        color: 'teal',
      })
      await aclQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Permission add failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const updateACLMutation = useMutation({
    mutationFn: (input: {
      href: ActionLink
      access_level: string
      recursive?: boolean
    }) =>
      updatePathACL(
        input.href,
        {
          access_level: input.access_level,
          recursive: input.recursive,
        },
        connection.auth,
        connection.baseUrl,
      ),
    onSuccess: async () => {
      notifications.show({
        title: 'Permission updated',
        message: 'ACL entry saved.',
        color: 'teal',
      })
      await aclQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Permission update failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const deleteACLMutation = useMutation({
    mutationFn: (input: { href: ActionLink }) =>
      deletePathACL(input.href, connection.auth, connection.baseUrl),
    onSuccess: async () => {
      notifications.show({
        title: 'Permission deleted',
        message: 'ACL entry removed.',
        color: 'teal',
      })
      await aclQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Permission delete failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const inheritanceMutation = useMutation({
    mutationFn: (input: {
      enabled: boolean
      setAction?: ActionLink
      deleteAction?: ActionLink
      recursive?: boolean
    }) => {
      if (input.enabled) {
        const action = input.setAction ?? input.deleteAction
        if (!action) {
          throw new Error('No inheritance enable action available')
        }

        return setPathACLInheritance(
          action,
          {
            enabled: true,
            recursive: input.recursive,
          },
          connection.auth,
          connection.baseUrl,
        )
      }

      if (input.deleteAction) {
        return deletePathACLInheritance(
          input.deleteAction,
          {
            recursive: input.recursive,
          },
          connection.auth,
          connection.baseUrl,
        )
      }

      if (input.setAction) {
        return setPathACLInheritance(
          input.setAction,
          {
            enabled: false,
            recursive: input.recursive,
          },
          connection.auth,
          connection.baseUrl,
        )
      }

      throw new Error('No inheritance disable action available')
    },
    onSuccess: async () => {
      notifications.show({
        title: 'Inheritance updated',
        message: 'Collection inheritance setting changed.',
        color: 'teal',
      })
      await aclQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Inheritance update failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const addReplicaMutation = useMutation({
    mutationFn: (input: { resource: string; update: boolean }) =>
      addPathReplica(
        irodsPath,
        {
          resource: input.resource,
          update: input.update,
        },
        connection.auth,
        connection.baseUrl,
      ),
    onSuccess: async () => {
      notifications.show({
        title: 'Replica added',
        message: 'Data object replica created.',
        color: 'teal',
      })
      setReplicaAddResource('')
      await detailsQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Replica add failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const moveReplicaMutation = useMutation({
    mutationFn: (input: {
      source_resource: string
      destination_resource: string
      update: boolean
      min_copies: number
      min_age_minutes: number
    }) =>
      movePathReplica(
        irodsPath,
        {
          source_resource: input.source_resource,
          destination_resource: input.destination_resource,
          update: input.update,
          min_copies: input.min_copies,
          min_age_minutes: input.min_age_minutes,
        },
        connection.auth,
        connection.baseUrl,
      ),
    onSuccess: async () => {
      notifications.show({
        title: 'Replica moved',
        message: 'Replica phymove completed.',
        color: 'teal',
      })
      setReplicaMoveDestinationResource('')
      await detailsQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Replica move failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const trimReplicaMutation = useMutation({
    mutationFn: (input: { resource: string }) =>
      trimPathReplica(
        irodsPath,
        {
          resource: input.resource,
        },
        connection.auth,
        connection.baseUrl,
      ),
    onSuccess: async () => {
      notifications.show({
        title: 'Replica trimmed',
        message: 'Replica removed from the selected resource.',
        color: 'teal',
      })
      await detailsQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Replica trim failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const createTicketMutation = useMutation({
    mutationFn: (input: {
      href: ActionLink
      maximum_uses?: number
      lifetime_minutes?: number
    }) => createPathTicket(input.href, input, connection.auth, connection.baseUrl),
    onSuccess: async () => {
      notifications.show({
        title: 'Ticket created',
        message: 'Anonymous access ticket created.',
        color: 'teal',
      })
      await ticketsQuery.refetch()
    },
    onError: async (error: Error) => {
      const normalizedMessage = error.message.toLowerCase()
      const shouldSuggestRefresh =
        normalizedMessage.includes('ticket') &&
        normalizedMessage.includes('not found')

      notifications.show({
        title: shouldSuggestRefresh ? 'Ticket may already exist' : 'Ticket create failed',
        message: shouldSuggestRefresh
          ? 'The server did not return the created ticket cleanly. Refresh the ticket list and check whether the new ticket already appears.'
          : error.message,
        color: shouldSuggestRefresh ? 'yellow' : 'red',
      })

      if (shouldSuggestRefresh) {
        await ticketsQuery.refetch()
      }
    },
  })
  const updateTicketMutation = useMutation({
    mutationFn: (input: {
      href: ActionLink
      maximum_uses?: number
      lifetime_minutes?: number
    }) => updateTicket(input.href, input, connection.auth, connection.baseUrl),
    onSuccess: async () => {
      notifications.show({
        title: 'Ticket updated',
        message: 'Ticket restrictions updated.',
        color: 'teal',
      })
      setEditingTicketName(null)
      await ticketsQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Ticket update failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const deleteTicketMutation = useMutation({
    mutationFn: (input: { href: ActionLink }) =>
      deleteTicket(input.href, connection.auth, connection.baseUrl),
    onSuccess: async () => {
      notifications.show({
        title: 'Ticket deleted',
        message: 'Ticket removed.',
        color: 'teal',
      })
      await ticketsQuery.refetch()
    },
    onError: async (error: Error) => {
      const normalizedMessage = error.message.toLowerCase()
      const shouldSuggestRefresh =
        normalizedMessage.includes('ticket') &&
        normalizedMessage.includes('not found')

      notifications.show({
        title: shouldSuggestRefresh ? 'Ticket may already be gone' : 'Ticket delete failed',
        message: shouldSuggestRefresh
          ? 'The server reported that the ticket was not found. Refreshing the ticket list to confirm the current state.'
          : error.message,
        color: shouldSuggestRefresh ? 'yellow' : 'red',
      })

      if (shouldSuggestRefresh) {
        await ticketsQuery.refetch()
      }
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
      setDeleteDialog(null)
      setDeleteForce(false)

      if (detailsQuery.data?.parent?.irods_path) {
        navigateToExplorer(detailsQuery.data.parent.irods_path)
        return
      }

      navigateToExplorer()
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
      if (!renameDialog) {
        throw new ApiError(400, 'No rename target was selected.')
      }

      const newName = renameName.trim()
      if (!newName) {
        throw new ApiError(400, 'Enter a new name.')
      }

      const payload = {
        new_name: newName,
      }

      if (renameDialog.action) {
        return renamePathByAction(renameDialog.action, payload, connection.auth, connection.baseUrl)
      }

      return renamePath(
        renameDialog.path,
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
      setRenameDialog(null)
      setRenameName('')
      navigate(detailsUrlForPath(renamed.path), {
        replace: true,
      })
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
      sourcePath: string
      destinationCollectionPath: string
    }) => {
      const destinationCollectionPath = normalizeCollectionPath(input.destinationCollectionPath)
      if (!destinationCollectionPath) {
        throw new ApiError(400, 'Destination path must be an absolute collection path.')
      }

      const destinationPath = destinationPathForSource(input.sourcePath, destinationCollectionPath)
      if (!destinationPath) {
        throw new ApiError(400, 'Unable to derive destination path.')
      }

      let result: PathEntry
      const sourceEntry = detailsQuery.data
      const action = sourceEntry ? relocateActionForEntry(sourceEntry, input.operation) : undefined
      if (action) {
        result = await relocatePathByAction(
          action,
          {
            operation: input.operation,
            destination_path: destinationPath,
          },
          connection.auth,
          connection.baseUrl,
        )
      } else {
        result = await relocatePath(
          input.sourcePath,
          {
            operation: input.operation,
            destination_path: destinationPath,
          },
          connection.auth,
          connection.baseUrl,
        )
      }

      return {
        result,
        destinationCollectionPath,
      }
    },
    onSuccess: (payload, variables) => {
      notifications.show({
        title: variables.operation === 'copy' ? 'Copy complete' : 'Move complete',
        message: payload.result.path,
        color: 'teal',
      })
      setRelocateDialog(null)
      navigate(`/app/explorer?irods_path=${encodeURIComponent(payload.destinationCollectionPath)}`)
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Relocate failed',
        message: error.message,
        color: 'red',
      })
    },
  })
  const addFavoriteMutation = useMutation({
    mutationFn: async (input: { path: string; defaultName: string }) => {
      const action = favoritesQuery.data?.links?.create
      if (!action) {
        throw new ApiError(405, 'Favorite add action is unavailable.')
      }

      return addFavorite(
        action,
        {
          name: input.defaultName,
          absolute_path: input.path,
        },
        connection.auth,
        connection.baseUrl,
      )
    },
    onSuccess: async (_, variables) => {
      notifications.show({
        title: 'Favorite added',
        message: variables.path,
        color: 'teal',
      })
      await favoritesQuery.refetch()
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Favorite add failed',
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
        message: favorite.absolute_path,
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

  const breadcrumbs = useMemo(() => detailsQuery.data?.path_segments ?? [], [detailsQuery.data])
  const ticketsForPath = useMemo(
    () =>
      (ticketsQuery.data?.tickets ?? []).filter(
        (ticket) => ticket.irods_path?.trim() === irodsPath,
      ),
    [ticketsQuery.data, irodsPath],
  )
  const aclEntries = useMemo(
    () => [...(aclQuery.data?.users ?? []), ...(aclQuery.data?.groups ?? [])],
    [aclQuery.data],
  )
  const favorites = useMemo(
    () => favoritesQuery.data?.favorites ?? [],
    [favoritesQuery.data?.favorites],
  )
  const currentFavorite = useMemo(
    () => favorites.find((favorite) => favorite.absolute_path === detailsQuery.data?.path),
    [favorites, detailsQuery.data?.path],
  )
  const replicaResourceOptions = useMemo(() => {
    const resources = new Set<string>()
    for (const replica of detailsQuery.data?.replicas ?? []) {
      const resourceName = replica.resource_name?.trim()
      if (resourceName) {
        resources.add(resourceName)
      }
    }

    return Array.from(resources).map((resourceName) => ({
      value: resourceName,
      label: resourceName,
    }))
  }, [detailsQuery.data?.replicas])
  const topResourceOptions = useMemo(
    () =>
      (resourcesQuery.data?.resources ?? []).map((resource) => ({
        value: resource.name,
        label: resource.name,
      })),
    [resourcesQuery.data],
  )
  const commandCues = useMemo(
    () =>
      (detailsQuery.data?.cmd_cues ?? []).filter(
        (cue) => {
          const operation = cue.operation?.trim().toLowerCase()
          const isPutOrGet = operation === 'put' || operation === 'get'
          return isPutOrGet && (Boolean(cue.gocmd?.trim()) || Boolean(cue.icommand?.trim()))
        },
      ),
    [detailsQuery.data?.cmd_cues],
  )
  const hasCommandHints = commandCues.length > 0
  const isCollection = detailsQuery.data?.kind === 'collection'
  const isDataObject = detailsQuery.data?.kind === 'data_object'
  const selectedReplicaMoveSourceResource = useMemo(() => {
    const current = replicaMoveSourceResource?.trim() ?? ''
    if (current && replicaResourceOptions.some((entry) => entry.value === current)) {
      return current
    }
    return replicaResourceOptions[0]?.value ?? null
  }, [replicaMoveSourceResource, replicaResourceOptions])
  const selectedReplicaAddResource = useMemo(() => {
    const current = replicaAddResource.trim()
    if (current && topResourceOptions.some((entry) => entry.value === current)) {
      return current
    }
    return topResourceOptions[0]?.value ?? ''
  }, [replicaAddResource, topResourceOptions])
  const selectedReplicaMoveDestinationResource = useMemo(() => {
    const current = replicaMoveDestinationResource.trim()
    if (current && topResourceOptions.some((entry) => entry.value === current)) {
      return current
    }
    return topResourceOptions[0]?.value ?? ''
  }, [replicaMoveDestinationResource, topResourceOptions])
  const selectedStorageCommandSourceResource = useMemo(() => {
    const current = storageCommandSourceResource.trim()
    if (current && topResourceOptions.some((entry) => entry.value === current)) {
      return current
    }
    return topResourceOptions[0]?.value ?? ''
  }, [storageCommandSourceResource, topResourceOptions])
  const selectedStorageCommandDestinationResource = useMemo(() => {
    const current = storageCommandDestinationResource.trim()
    if (current && topResourceOptions.some((entry) => entry.value === current)) {
      return current
    }
    return topResourceOptions[0]?.value ?? ''
  }, [storageCommandDestinationResource, topResourceOptions])
  const backPath = useMemo(() => {
    if (!detailsQuery.data) {
      return ''
    }

    return detailsQuery.data.kind === 'collection'
      ? detailsQuery.data.path
      : (detailsQuery.data.parent?.irods_path ?? '')
  }, [detailsQuery.data])
  const deleteReturnPath = useMemo(
    () => detailsQuery.data?.parent?.irods_path ?? '',
    [detailsQuery.data],
  )
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

  const storageCommandSourcePlaceholder = selectedStorageCommandSourceResource.trim()
    ? shellQuote(selectedStorageCommandSourceResource.trim())
    : '<srcResource>'
  const storageCommandDestinationPlaceholder = selectedStorageCommandDestinationResource.trim()
    ? shellQuote(selectedStorageCommandDestinationResource.trim())
    : '<destResource>'
  const storageCommandPathPlaceholder = irodsPath.trim()
    ? shellQuote(irodsPath.trim())
    : (isCollection ? '<collection>' : '<dataObj>')
  const phyMoveCommand = isCollection
    ? `iphymv -r -S ${storageCommandSourcePlaceholder} -R ${storageCommandDestinationPlaceholder} ${storageCommandPathPlaceholder}`
    : `iphymv -S ${storageCommandSourcePlaceholder} -R ${storageCommandDestinationPlaceholder} ${storageCommandPathPlaceholder}`
  const replicateCommand = isCollection
    ? `irepl -r -S ${storageCommandSourcePlaceholder} -R ${storageCommandDestinationPlaceholder} ${storageCommandPathPlaceholder}`
    : `irepl -S ${storageCommandSourcePlaceholder} -R ${storageCommandDestinationPlaceholder} ${storageCommandPathPlaceholder}`

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      notifications.show({
        title: 'Copied',
        message: `${label} was copied.`,
        color: 'teal',
      })
    } catch {
      notifications.show({
        title: 'Copy failed',
        message: `Unable to copy ${label.toLowerCase()}.`,
        color: 'red',
      })
    }
  }

  const openResourceDetails = (resourceName: string) => {
    const trimmedName = resourceName.trim()
    if (!trimmedName) {
      return
    }

    navigate(`/app/resources/details?name=${encodeURIComponent(trimmedName)}`)
  }

  const beginAVUDelete = (avu: {
    attrib: string
    value: string
    links?: {
      delete?: { href: string; method?: string }
    }
  }) => {
    if (!avu.links?.delete) {
      return
    }

    const confirmed = window.confirm(`Delete AVU "${avu.attrib}" with value "${avu.value}"?`)
    if (!confirmed) {
      return
    }

    deleteAVUMutation.mutate({
      href: avu.links.delete,
    })
  }

  const beginAVUAdd = () => {
    const avuAction = avuCreateAction(detailsQuery.data)
    if (!avuAction) {
      return
    }
    setIsAddingAVU(true)
    setAVUForm({
      attrib: '',
      value: '',
      unit: '',
    })
  }

  const cancelAVUEditor = () => {
    setIsAddingAVU(false)
    setAVUForm({
      attrib: '',
      value: '',
      unit: '',
    })
  }

  const submitAVUEditor = () => {
    if (!avuForm.attrib.trim() || !avuForm.value.trim()) {
      notifications.show({
        title: 'AVU is incomplete',
        message: 'Attribute and value are required.',
        color: 'red',
      })
      return
    }

    const avuAction = avuCreateAction(detailsQuery.data)
    if (!avuAction) {
      return
    }

    addAVUMutation.mutate(
      {
        href: avuAction,
        attrib: avuForm.attrib.trim(),
        value: avuForm.value.trim(),
        unit: avuForm.unit.trim(),
      },
      {
        onSuccess: async () => {
          cancelAVUEditor()
          await avuQuery.refetch()
        },
      },
    )
  }

  const beginACLAdd = () => {
    if (!aclAddAction(aclQuery.data)) {
      return
    }

    setIsAddingACL(true)
    setACLPrincipalSelection(null)
    setACLPrincipalSearchValue('')
    setACLForm({
      name: '',
      zone: detailsQuery.data?.zone ?? '',
      type: 'user',
      read: true,
      write: false,
      own: false,
    })
  }

  const cancelACLAdd = () => {
    setIsAddingACL(false)
    setACLPrincipalSelection(null)
    setACLPrincipalSearchValue('')
    setACLForm({
      name: '',
      zone: '',
      type: 'user',
      read: true,
      write: false,
      own: false,
    })
  }

  const aclDraftForEntry = (entry: PathACLEntry) =>
    aclEdits[entry.id] ?? aclPermissionState(entry.access_level)

  const updateACLDraft = (entry: PathACLEntry, next: ACLPermissionState) => {
    setACLEdits((current) => ({
      ...current,
      [entry.id]: next,
    }))
  }

  const submitACLAdd = () => {
    const action = aclAddAction(aclQuery.data)
    if (!action) {
      return
    }

    if (!aclForm.name.trim()) {
      notifications.show({
        title: 'Permission is incomplete',
        message: 'Principal name is required.',
        color: 'red',
      })
      return
    }

    const accessLevel = aclAccessLevelFromState(
      {
        read: aclForm.read,
        write: aclForm.write,
        own: aclForm.own,
      },
    )

    if (!accessLevel) {
      notifications.show({
        title: 'Permission is incomplete',
        message: 'Select read or write access before adding a permission.',
        color: 'red',
      })
      return
    }

    addACLMutation.mutate(
      {
        href: action,
        name: aclForm.name.trim(),
        zone: aclForm.zone.trim() || undefined,
        type: aclForm.type,
        access_level: accessLevel,
        recursive: isCollection && applyACLRecursively ? true : undefined,
      },
      {
        onSuccess: async () => {
          cancelACLAdd()
          await aclQuery.refetch()
        },
      },
    )
  }

  const submitACLUpdate = (entry: PathACLEntry) => {
    if (!entry.links?.update) {
      return
    }

    const draft = aclDraftForEntry(entry)
    const accessLevel = aclAccessLevelFromState(draft)
    if (!accessLevel) {
      notifications.show({
        title: 'Permission is incomplete',
        message: 'Select read or write access before updating a permission.',
        color: 'red',
      })
      return
    }

    updateACLMutation.mutate(
      {
        href: entry.links.update,
        access_level: accessLevel,
        recursive: isCollection && applyACLRecursively ? true : undefined,
      },
      {
        onSuccess: async () => {
          setACLEdits((current) => {
            const next = { ...current }
            delete next[entry.id]
            return next
          })
          await aclQuery.refetch()
        },
      },
    )
  }

  const beginACLDelete = (entry: PathACLEntry) => {
    if (!entry.links?.remove) {
      return
    }

    const confirmed = window.confirm(`Delete permission for "${entry.name}"?`)
    if (!confirmed) {
      return
    }

    deleteACLMutation.mutate({
      href: entry.links.remove,
    })
  }

  const toggleCollectionInheritance = (enabled: boolean) => {
    const setAction = aclQuery.data?.links?.set_inheritance
    const deleteAction = aclQuery.data?.links?.delete_inheritance

    const canEnable = Boolean(setAction ?? deleteAction)
    const canDisable = Boolean(deleteAction ?? setAction)

    if ((enabled && !canEnable) || (!enabled && !canDisable)) {
      notifications.show({
        title: 'Inheritance unavailable',
        message: 'The current API response does not expose inheritance controls yet.',
        color: 'yellow',
      })
      return
    }

    inheritanceMutation.mutate({
      enabled,
      setAction,
      deleteAction,
      recursive: applyACLRecursively,
    })
  }

  const beginTicketAdd = () => {
    if (!ticketCreateAction(detailsQuery.data)) {
      return
    }

    setIsAddingTicket(true)
    setTicketForm({
      maximumUses: '50',
      lifetimeMinutes: '720',
    })
  }

  const cancelTicketAdd = () => {
    setIsAddingTicket(false)
    setTicketForm({
      maximumUses: '50',
      lifetimeMinutes: '720',
    })
  }

  const submitTicketAdd = () => {
    const action = ticketCreateAction(detailsQuery.data)
    if (!action) {
      return
    }

    const maximumUses = Number.parseInt(ticketForm.maximumUses.trim() || '0', 10)
    const lifetimeMinutes = Number.parseInt(ticketForm.lifetimeMinutes.trim() || '0', 10)

    if (Number.isNaN(maximumUses) || maximumUses < 0 || Number.isNaN(lifetimeMinutes) || lifetimeMinutes < 0) {
      notifications.show({
        title: 'Ticket is invalid',
        message: 'Maximum uses and lifetime minutes must be zero or greater integers.',
        color: 'red',
      })
      return
    }

    createTicketMutation.mutate(
      {
        href: action,
        maximum_uses: maximumUses,
        lifetime_minutes: lifetimeMinutes,
      },
      {
        onSuccess: async () => {
          cancelTicketAdd()
          await ticketsQuery.refetch()
        },
      },
    )
  }

  const beginTicketEdit = (ticket: TicketEntry) => {
    setEditingTicketName(ticket.name)
    setTicketEditForm({
      maximumUses: `${ticket.uses_limit ?? 0}`,
      lifetimeMinutes: ticket.expiration_time ? '720' : '0',
    })
  }

  const cancelTicketEdit = () => {
    setEditingTicketName(null)
    setTicketEditForm({
      maximumUses: '',
      lifetimeMinutes: '',
    })
  }

  const submitTicketEdit = (ticket: TicketEntry) => {
    if (!ticket.links?.update) {
      return
    }

    const maximumUses = Number.parseInt(ticketEditForm.maximumUses.trim() || '0', 10)
    const lifetimeMinutes = Number.parseInt(ticketEditForm.lifetimeMinutes.trim() || '0', 10)

    if (Number.isNaN(maximumUses) || maximumUses < 0 || Number.isNaN(lifetimeMinutes) || lifetimeMinutes < 0) {
      notifications.show({
        title: 'Ticket update is invalid',
        message: 'Maximum uses and lifetime minutes must be zero or greater integers.',
        color: 'red',
      })
      return
    }

    updateTicketMutation.mutate({
      href: ticket.links.update,
      maximum_uses: maximumUses,
      lifetime_minutes: lifetimeMinutes,
    })
  }

  const beginTicketDelete = (ticket: TicketEntry) => {
    if (!ticket.links?.delete) {
      return
    }

    const confirmed = window.confirm(`Delete ticket "${ticket.name}"?`)
    if (!confirmed) {
      return
    }

    deleteTicketMutation.mutate({
      href: ticket.links.delete,
    })
  }

  const beginPathDelete = () => {
    if (!detailsQuery.data) {
      return
    }

    const requiresForce =
      detailsQuery.data.kind === 'collection' &&
      Boolean(detailsQuery.data.hasChildren || (detailsQuery.data.childCount ?? 0) > 0)

    setDeleteDialog({
      path: detailsQuery.data.path,
      label: displayName(detailsQuery.data.path),
      kind: detailsQuery.data.kind,
      action: detailsQuery.data.links?.delete,
    })
    setDeleteForce(requiresForce)
  }

  const beginPathRename = () => {
    if (!detailsQuery.data) {
      return
    }

    const label = displayName(detailsQuery.data.path)
    setRenameDialog({
      path: detailsQuery.data.path,
      label,
      kind: detailsQuery.data.kind,
      action: detailsQuery.data.links?.update,
    })
    setRenameName(label)
  }

  const openRelocateDialog = (operation: RelocateOperation) => {
    if (!detailsQuery.data) {
      return
    }

    const defaultDestination =
      detailsQuery.data.kind === 'collection'
        ? detailsQuery.data.parent?.irods_path ?? '/'
        : detailsQuery.data.parent?.irods_path ?? '/'

    const normalizedDestination = normalizeCollectionPath(defaultDestination) || '/'

    setRelocateDialog({
      operation,
      browsePath: normalizedDestination,
      destinationPathDraft: normalizedDestination,
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
    if (!relocateDialog || !detailsQuery.data) {
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

    relocatePathMutation.mutate({
      operation: relocateDialog.operation,
      sourcePath: detailsQuery.data.path,
      destinationCollectionPath,
    })
  }

  const toggleFavorite = () => {
    const path = detailsQuery.data?.path
    if (!path) {
      return
    }

    if (currentFavorite) {
      removeFavoriteMutation.mutate(currentFavorite)
      return
    }

    addFavoriteMutation.mutate({
      path,
      defaultName: displayName(path),
    })
  }

  const submitReplicaAdd = () => {
    const resource = selectedReplicaAddResource.trim()
    if (!resource) {
      notifications.show({
        title: 'Replica add is incomplete',
        message: 'Target resource is required.',
        color: 'red',
      })
      return
    }

    addReplicaMutation.mutate({
      resource,
      update: replicaAddUpdate,
    })
  }

  const submitReplicaMove = () => {
    const sourceResource = selectedReplicaMoveSourceResource?.trim() ?? ''
    const destinationResource = selectedReplicaMoveDestinationResource.trim()
    const minCopies = Number.parseInt(replicaMoveMinCopies.trim() || '0', 10)
    const minAgeMinutes = Number.parseInt(replicaMoveMinAgeMinutes.trim() || '0', 10)

    if (!sourceResource || !destinationResource) {
      notifications.show({
        title: 'Replica move is incomplete',
        message: 'Source and destination resources are required.',
        color: 'red',
      })
      return
    }
    if (sourceResource === destinationResource) {
      notifications.show({
        title: 'Replica move is invalid',
        message: 'Destination resource must differ from source resource.',
        color: 'red',
      })
      return
    }
    if (Number.isNaN(minCopies) || minCopies < 0 || Number.isNaN(minAgeMinutes) || minAgeMinutes < 0) {
      notifications.show({
        title: 'Replica move is invalid',
        message: 'min_copies and min_age_minutes must be zero or greater integers.',
        color: 'red',
      })
      return
    }

    moveReplicaMutation.mutate({
      source_resource: sourceResource,
      destination_resource: destinationResource,
      update: replicaMoveUpdate,
      min_copies: minCopies,
      min_age_minutes: minAgeMinutes,
    })
  }

  const submitReplicaTrim = (resourceName: string) => {
    const resource = resourceName.trim()
    if (!resource) {
      notifications.show({
        title: 'Replica trim is incomplete',
        message: 'Resource is required.',
        color: 'red',
      })
      return
    }

    const confirmed = window.confirm(`Delete replica on resource "${resource}"?`)
    if (!confirmed) {
      return
    }

    trimReplicaMutation.mutate({
      resource,
    })
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
      <Modal
        opened={renameDialog !== null}
        onClose={() => {
          if (!renamePathMutation.isPending) {
            setRenameDialog(null)
            setRenameName('')
          }
        }}
        title={renameDialog?.kind === 'collection' ? 'Rename folder' : 'Rename file'}
        centered
      >
        <Stack gap="md">
          <TextInput
            label="New name"
            value={renameName}
            onChange={(event) => setRenameName(event.currentTarget.value)}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                renamePathMutation.mutate()
              }
            }}
          />

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setRenameDialog(null)
                setRenameName('')
              }}
              disabled={renamePathMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => renamePathMutation.mutate()}
              loading={renamePathMutation.isPending}
            >
              Rename
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
        title={relocateDialog?.operation === 'copy' ? 'Copy item' : 'Move item'}
        centered
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Source path
          </Text>
          <Text size="sm" className="explorer-hover-path">
            {detailsQuery.data?.path ?? ''}
          </Text>

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
                key={`relocate-details-${crumb.irods_path}`}
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
                  <Table.Tr key={`relocate-details-child-${child.path}`}>
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
              disabled={!relocateDestinationPath || !detailsQuery.data}
            >
              {relocateDialog?.operation === 'copy' ? 'Copy' : 'Move'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={commandHintsOpened}
        onClose={() => setCommandHintsOpened(false)}
        title="Command hints"
        centered
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Documentation-only command examples for this {detailsQuery.data?.kind === 'collection' ? 'collection' : 'file'}.
          </Text>

          {commandCues.length > 0 ? (
            <Stack gap="md">
              {commandCues.map((cue, index) => (
                <Paper
                  key={`${cue.operation ?? 'operation'}-${index}`}
                  withBorder
                  radius="md"
                  p="sm"
                >
                  <Stack gap="sm">
                    {cue.operation?.trim() ? (
                      <Group gap="xs">
                        <Badge variant="light" color="blue">
                          {cue.operation}
                        </Badge>
                      </Group>
                    ) : null}

                    {cue.icommand?.trim() ? (
                      <Stack gap="xs">
                        <Group justify="space-between" align="center">
                          <Text size="sm" fw={600}>
                            iCommand
                          </Text>
                          <Button
                            size="xs"
                            variant="subtle"
                            leftSection={<IconCopy size={14} />}
                            onClick={() => void copyText(cue.icommand!, `iCommand (${cue.operation ?? index + 1})`)}
                          >
                            Copy command
                          </Button>
                        </Group>
                        <Code block className="details-code-cell">
                          {cue.icommand}
                        </Code>
                      </Stack>
                    ) : null}

                    {cue.gocmd?.trim() ? (
                      <Stack gap="xs">
                        <Group justify="space-between" align="center">
                          <Text size="sm" fw={600}>
                            goCmd
                          </Text>
                          <Button
                            size="xs"
                            variant="subtle"
                            leftSection={<IconCopy size={14} />}
                            onClick={() => void copyText(cue.gocmd!, `goCmd (${cue.operation ?? index + 1})`)}
                          >
                            Copy command
                          </Button>
                        </Group>
                        <Code block className="details-code-cell">
                          {cue.gocmd}
                        </Code>
                      </Stack>
                    ) : null}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              No command hints are available for this path.
            </Text>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCommandHintsOpened(false)}>
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={storageCommandDetailsOpened}
        onClose={() => setStorageCommandDetailsOpened(false)}
        title="Storage command details"
        centered
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Build iCommand examples for {isCollection ? 'collection' : 'data object'} replica operations.
          </Text>

          <Group align="flex-end" grow>
            <Select
              label="Source resource"
              placeholder="Select source resource"
              data={topResourceOptions}
              value={selectedStorageCommandSourceResource || null}
              onChange={(value) => setStorageCommandSourceResource(value ?? '')}
              searchable
              allowDeselect={false}
              disabled={resourcesQuery.isLoading}
            />
            <Select
              label="Destination resource"
              placeholder="Select destination resource"
              data={topResourceOptions}
              value={selectedStorageCommandDestinationResource || null}
              onChange={(value) => setStorageCommandDestinationResource(value ?? '')}
              searchable
              allowDeselect={false}
              disabled={resourcesQuery.isLoading}
            />
          </Group>

          <Paper withBorder radius="md" p="sm">
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Badge variant="light" color="blue">
                  Phymove
                </Badge>
                <Button
                  size="xs"
                  variant="subtle"
                  leftSection={<IconCopy size={14} />}
                  onClick={() => void copyText(phyMoveCommand, 'Phymove command')}
                >
                  Copy command
                </Button>
              </Group>
              <Code block className="details-code-cell">
                {phyMoveCommand}
              </Code>
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="sm">
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Badge variant="light" color="teal">
                  Replicate
                </Badge>
                <Button
                  size="xs"
                  variant="subtle"
                  leftSection={<IconCopy size={14} />}
                  onClick={() => void copyText(replicateCommand, 'Replicate command')}
                >
                  Copy command
                </Button>
              </Group>
              <Code block className="details-code-cell">
                {replicateCommand}
              </Code>
            </Stack>
          </Paper>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setStorageCommandDetailsOpened(false)}>
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Card shadow="sm" radius="xl" padding="lg">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Group gap="sm" align="center">
              {detailsQuery.data ? (
                <ThemeIcon
                  variant="light"
                  color={detailsQuery.data.kind === 'collection' ? 'blue' : 'teal'}
                  size="lg"
                >
                  {detailsQuery.data.kind === 'collection' ? (
                    <IconFolder size={18} />
                  ) : (
                    <IconFile size={18} />
                  )}
                </ThemeIcon>
              ) : null}
              <Title order={2}>
                {detailsQuery.data ? displayName(detailsQuery.data.path) : 'Details'}
              </Title>
            </Group>

            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => {
                if (backPath) {
                  navigateToExplorer(backPath)
                  return
                }

                navigateToExplorer()
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
                onClick={() => navigateToExplorer(crumb.irods_path)}
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
              <div className="details-header-layout">
                <Paper withBorder radius="lg" p="lg" className="details-header-card">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <Group gap="sm" align="flex-start" className="details-header-main">
                        <Group
                          justify="space-between"
                          align="flex-start"
                          className="details-header-copy"
                        >
                          <Group gap="xs">
                            <Badge variant="light" color="blue">
                              {detailsQuery.data.kind}
                            </Badge>
                            <Badge variant="dot" color="gray">
                              {detailsQuery.data.zone}
                            </Badge>
                            <ActionIcon
                              variant={currentFavorite ? 'filled' : 'light'}
                              color={currentFavorite ? 'yellow' : 'gray'}
                              aria-label={currentFavorite ? 'Remove favorite' : 'Add favorite'}
                              onClick={toggleFavorite}
                              loading={addFavoriteMutation.isPending || removeFavoriteMutation.isPending}
                              disabled={!favoritesQuery.data?.links?.create && !currentFavorite?.links?.delete && !favoritesQuery.data?.links?.delete}
                            >
                              {currentFavorite ? <IconStarFilled size={16} /> : <IconStar size={16} />}
                            </ActionIcon>
                            <Button
                              size="xs"
                              variant="default"
                              leftSection={<IconTerminal2 size={14} />}
                              onClick={() => setCommandHintsOpened(true)}
                              disabled={!hasCommandHints}
                            >
                              Command hints
                            </Button>
                          </Group>
                        </Group>
                      </Group>
                    </Group>

                    <div className="details-header-summary-with-preview">
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
                              onClick={() => void copyText(detailsQuery.data.path, 'Path')}
                            >
                              <IconCopy size={16} />
                            </ActionIcon>
                          }
                        />
                        <SummaryStat
                          label="Size"
                          value={detailsQuery.data.display_size ?? '—'}
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
                            label="MIME type"
                            value={detailsQuery.data.mime_type ?? 'N/A'}
                          />
                        ) : null}
                        {detailsQuery.data.kind === 'data_object' ? null : (
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

                      {detailsQuery.data.kind === 'data_object' && headerPreviewSpec ? (
                        <button
                          type="button"
                          className="details-preview-tile"
                          disabled={!headerPreviewSpec.canOpenPreview}
                          onClick={() => {
                            const params = new URLSearchParams({
                              irods_path: detailsQuery.data.path,
                            })
                            if (explorerQuery) {
                              params.set('explorer_query', explorerQuery)
                            }
                            navigate(`/app/explorer/preview?${params.toString()}`)
                          }}
                        >
                          <div className="details-preview-media">
                            {headerPreviewSpec.kind === 'image' ? (
                              headerImagePreviewUrl ? (
                                <img
                                  src={headerImagePreviewUrl}
                                  alt={`Preview for ${displayName(detailsQuery.data.path)}`}
                                />
                              ) : headerImagePreviewQuery.isLoading ? (
                                <Loader size={24} />
                              ) : (
                                <ThemeIcon size={48} radius="xl" color="blue" variant="light">
                                  <FilePreviewGlyph icon={headerPreviewSpec.icon} size={24} />
                                </ThemeIcon>
                              )
                            ) : (
                              <ThemeIcon size={48} radius="xl" color="blue" variant="light">
                                <FilePreviewGlyph icon={headerPreviewSpec.icon} size={24} />
                              </ThemeIcon>
                            )}
                          </div>
                          <Stack gap={4} align="center">
                            <Text fw={600} size="sm">
                              {headerPreviewSpec.label}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {headerPreviewSpec.canOpenPreview ? 'Open preview' : 'Preview unavailable'}
                            </Text>
                            {headerPreviewSpec.canOpenPreview ? (
                              <Group gap={4} align="center">
                                <IconEye size={14} />
                                <Text size="xs">Preview</Text>
                              </Group>
                            ) : null}
                          </Stack>
                        </button>
                      ) : null}
                    </div>
                  </Stack>
                </Paper>

                <Card shadow="sm" radius="xl" padding="lg" className="details-actions-card">
                  <Stack gap="sm">
                    <Title order={4}>Actions</Title>
                    {isDataObject ? (
                      <DetailsDownloadButton path={detailsQuery.data.path} />
                    ) : null}
                    {isDataObject ? (
                      <Button
                        variant="default"
                        leftSection={<IconUpload size={14} />}
                        onClick={() =>
                          openFilePicker({
                            targetPath: detailsQuery.data.parent?.irods_path ?? '/',
                            targetLabel: detailsQuery.data.parent?.irods_path ?? '/',
                            targetFileName: displayName(detailsQuery.data.path),
                            overwriteDefault: true,
                            allowMultiple: false,
                          })
                        }
                      >
                        Replace object
                      </Button>
                    ) : null}
                    <Button
                      variant="light"
                      leftSection={<IconEdit size={14} />}
                      onClick={beginPathRename}
                    >
                      Rename {detailsQuery.data.kind === 'collection' ? 'folder' : 'file'}
                    </Button>
                    <Button
                      variant="light"
                      onClick={() => openRelocateDialog('move')}
                    >
                      Move {detailsQuery.data.kind === 'collection' ? 'folder' : 'file'}
                    </Button>
                    <Button
                      variant="light"
                      leftSection={<IconCopy size={14} />}
                      onClick={() => openRelocateDialog('copy')}
                    >
                      Copy {detailsQuery.data.kind === 'collection' ? 'folder' : 'file'}
                    </Button>
                    <Button
                      variant="light"
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={beginPathDelete}
                    >
                      Delete {detailsQuery.data.kind === 'collection' ? 'folder' : 'file'}
                    </Button>
                    {isCollection ? (
                      <Button
                        variant="light"
                        onClick={() => navigateToExplorer(detailsQuery.data.path)}
                      >
                        Open collection
                      </Button>
                    ) : null}
                    {detailsQuery.data.parent ? (
                      <Button
                        variant="light"
                        onClick={() => navigateToExplorer(detailsQuery.data.parent!.irods_path)}
                      >
                        Open parent collection
                      </Button>
                    ) : null}
                    {!detailsQuery.data.parent && deleteReturnPath === '' ? (
                      <Text size="sm" c="dimmed">
                        Delete will return to the explorer root.
                      </Text>
                    ) : null}
                  </Stack>
                </Card>
              </div>

              <Card shadow="sm" radius="xl" padding="lg">
                <Tabs defaultValue="overview" keepMounted={false}>
                  <Tabs.List grow>
                    <Tabs.Tab value="overview">Overview</Tabs.Tab>
                    {isDataObject || isCollection ? <Tabs.Tab value="storage">Storage</Tabs.Tab> : null}
                    <Tabs.Tab value="avus">AVUs</Tabs.Tab>
                    <Tabs.Tab value="permissions">Permissions</Tabs.Tab>
                    <Tabs.Tab value="tickets">Tickets</Tabs.Tab>
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
                              onClick={() => void copyText(detailsQuery.data.path, 'Path')}
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
                        {isDataObject ? (
                          <>
                            <InfoRow
                              label="MIME type"
                              value={detailsQuery.data.mime_type ?? 'N/A'}
                            />
                            <InfoRow
                              label="Checksum type"
                              value={detailsQuery.data.checksum?.type ?? 'N/A'}
                            />
                            <InfoRow
                              label="Checksum value"
                              value={checksumValueOnly(detailsQuery.data.checksum)}
                              code
                              action={
                                <Button
                                  size="xs"
                                  variant="light"
                                  leftSection={<IconFingerprint size={14} />}
                                  loading={checksumMutation.isPending}
                                  onClick={() => checksumMutation.mutate()}
                                >
                                  Compute
                                </Button>
                              }
                            />
                            <InfoRow
                              label="Primary resource"
                              value={detailsQuery.data.resource ?? 'N/A'}
                              action={
                                detailsQuery.data.resource ? (
                                  <Button
                                    size="xs"
                                    variant="light"
                                    onClick={() => openResourceDetails(detailsQuery.data.resource!)}
                                  >
                                    Details
                                  </Button>
                                ) : undefined
                              }
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

                  {isDataObject || isCollection ? (
                    <Tabs.Panel value="storage" pt="md">
                      {isDataObject ? (
                      <Card shadow="sm" radius="xl" padding="lg">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Group gap="xs">
                              <ThemeIcon variant="light" color="gray" size="md">
                                <IconBinaryTree2 size={14} />
                              </ThemeIcon>
                              <Title order={4}>Storage Detail</Title>
                            </Group>
                            <Button
                              size="xs"
                              variant="default"
                              leftSection={<IconTerminal2 size={14} />}
                              onClick={() => setStorageCommandDetailsOpened(true)}
                            >
                              Command details
                            </Button>
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

                          <Divider label="Replica operations" labelPosition="left" />

                          {resourcesQuery.isError ? (
                            <Alert color="yellow" variant="light" title="Resource list unavailable">
                              {resourcesQuery.error.message}
                            </Alert>
                          ) : null}

                          <Paper withBorder radius="md" p="sm">
                            <Stack gap="xs">
                              <Text size="sm" fw={600}>
                                Add replica
                              </Text>
                              <Group align="flex-end" gap="xs">
                                <Select
                                  label="Resource"
                                  placeholder="Select resource"
                                  data={topResourceOptions}
                                  value={selectedReplicaAddResource || null}
                                  onChange={(value) => setReplicaAddResource(value ?? '')}
                                  searchable
                                  allowDeselect={false}
                                  disabled={addReplicaMutation.isPending || resourcesQuery.isLoading}
                                />
                                <Checkbox
                                  label="Update"
                                  checked={replicaAddUpdate}
                                  onChange={(event) => setReplicaAddUpdate(event.currentTarget.checked)}
                                  disabled={addReplicaMutation.isPending}
                                />
                                <Button
                                  size="xs"
                                  onClick={submitReplicaAdd}
                                  loading={addReplicaMutation.isPending}
                                >
                                  Add
                                </Button>
                              </Group>
                            </Stack>
                          </Paper>

                          <Paper withBorder radius="md" p="sm">
                            <Stack gap="xs">
                              <Text size="sm" fw={600}>
                                Phymove replica
                              </Text>
                              <Group align="flex-end" gap="xs">
                                <Select
                                  label="Source resource"
                                  data={replicaResourceOptions}
                                  value={selectedReplicaMoveSourceResource}
                                  onChange={(value) => setReplicaMoveSourceResource(value)}
                                  allowDeselect={false}
                                  disabled={moveReplicaMutation.isPending || replicaResourceOptions.length === 0}
                                />
                                <Select
                                  label="Destination resource"
                                  placeholder="Select resource"
                                  data={topResourceOptions}
                                  value={selectedReplicaMoveDestinationResource || null}
                                  onChange={(value) => setReplicaMoveDestinationResource(value ?? '')}
                                  searchable
                                  allowDeselect={false}
                                  disabled={moveReplicaMutation.isPending || resourcesQuery.isLoading}
                                />
                                <TextInput
                                  label="min_copies"
                                  value={replicaMoveMinCopies}
                                  onChange={(event) => setReplicaMoveMinCopies(event.currentTarget.value)}
                                  w={120}
                                  disabled={moveReplicaMutation.isPending}
                                />
                                <TextInput
                                  label="min_age_minutes"
                                  value={replicaMoveMinAgeMinutes}
                                  onChange={(event) => setReplicaMoveMinAgeMinutes(event.currentTarget.value)}
                                  w={140}
                                  disabled={moveReplicaMutation.isPending}
                                />
                                <Checkbox
                                  label="Update"
                                  checked={replicaMoveUpdate}
                                  onChange={(event) => setReplicaMoveUpdate(event.currentTarget.checked)}
                                  disabled={moveReplicaMutation.isPending}
                                />
                                <Button
                                  size="xs"
                                  onClick={submitReplicaMove}
                                  loading={moveReplicaMutation.isPending}
                                >
                                  Move
                                </Button>
                              </Group>
                            </Stack>
                          </Paper>

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
                                        <Group gap="xs" wrap="nowrap" align="center">
                                          {replica.resource_name ? (
                                            <Anchor
                                              size="sm"
                                              fw={600}
                                              underline="never"
                                              onClick={() =>
                                                openResourceDetails(replica.resource_name!)
                                              }
                                            >
                                              {replica.resource_name}
                                            </Anchor>
                                          ) : (
                                            <Text size="sm" fw={600}>
                                              N/A
                                            </Text>
                                          )}
                                          {replica.resource_name ? (
                                            <ActionIcon
                                              variant="subtle"
                                              color="red"
                                              aria-label={`Delete replica on ${replica.resource_name}`}
                                              onClick={() => submitReplicaTrim(replica.resource_name!)}
                                              disabled={trimReplicaMutation.isPending}
                                            >
                                              <IconTrash size={16} />
                                            </ActionIcon>
                                          ) : null}
                                        </Group>
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
                                              void copyText(replica.physical_path!, 'Physical path')
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
                          <Stack gap="sm">
                            <Group justify="space-between" align="center">
                              <Group gap="xs">
                                <ThemeIcon variant="light" color="gray" size="md">
                                  <IconBinaryTree2 size={14} />
                                </ThemeIcon>
                                <Title order={4}>Storage Detail</Title>
                              </Group>
                              <Button
                                size="xs"
                                variant="default"
                                leftSection={<IconTerminal2 size={14} />}
                                onClick={() => setStorageCommandDetailsOpened(true)}
                              >
                                Command details
                              </Button>
                            </Group>
                          </Stack>
                        </Card>
                      )}
                    </Tabs.Panel>
                  ) : null}

                  <Tabs.Panel value="avus" pt="md">
                    <Card shadow="sm" radius="xl" padding="lg">
                        <Stack gap="sm">
                          <Group gap="xs" justify="space-between">
                            <Group gap="xs">
                              <ThemeIcon variant="light" color="orange" size="md">
                                <IconDatabase size={14} />
                              </ThemeIcon>
                              <Title order={4}>AVU Metadata</Title>
                            </Group>
                            {avuCreateAction(detailsQuery.data) ? (
                              <Button
                                size="xs"
                                variant="light"
                                leftSection={<IconPlus size={14} />}
                                loading={addAVUMutation.isPending}
                                onClick={beginAVUAdd}
                                disabled={isAddingAVU}
                              >
                                Add AVU
                              </Button>
                            ) : null}
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
                                  <Table.Th>Attribute</Table.Th>
                                  <Table.Th>Value</Table.Th>
                                  <Table.Th>Unit</Table.Th>
                                  <Table.Th>Actions</Table.Th>
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                {avuQuery.isLoading ? (
                                  <Table.Tr>
                                    <Table.Td colSpan={4}>
                                      <Text size="sm" c="dimmed">
                                        Loading AVUs...
                                      </Text>
                                    </Table.Td>
                                  </Table.Tr>
                                ) : isAddingAVU ? (
                                  <Table.Tr className="explorer-row-selected">
                                    <Table.Td>
                                      <TextInput
                                        placeholder="Attribute"
                                        value={avuForm.attrib}
                                        onChange={(event) => {
                                          const value = event.currentTarget.value
                                          setAVUForm((current) => ({
                                            ...current,
                                            attrib: value,
                                          }))
                                        }}
                                      />
                                    </Table.Td>
                                    <Table.Td>
                                      <TextInput
                                        placeholder="Value"
                                        value={avuForm.value}
                                        onChange={(event) => {
                                          const value = event.currentTarget.value
                                          setAVUForm((current) => ({
                                            ...current,
                                            value,
                                          }))
                                        }}
                                      />
                                    </Table.Td>
                                    <Table.Td>
                                      <TextInput
                                        placeholder="Unit"
                                        value={avuForm.unit}
                                        onChange={(event) => {
                                          const value = event.currentTarget.value
                                          setAVUForm((current) => ({
                                            ...current,
                                            unit: value,
                                          }))
                                        }}
                                      />
                                    </Table.Td>
                                    <Table.Td>
                                      <Group gap="xs" wrap="nowrap">
                                        <Button
                                          size="xs"
                                          onClick={submitAVUEditor}
                                          loading={addAVUMutation.isPending}
                                        >
                                          Update
                                        </Button>
                                        <Button size="xs" variant="default" onClick={cancelAVUEditor}>
                                          Cancel
                                        </Button>
                                      </Group>
                                    </Table.Td>
                                  </Table.Tr>
                                ) : (
                                  avuRows(avuQuery.data?.avus, {
                                    onDelete: beginAVUDelete,
                                  })
                                )}
                              </Table.Tbody>
                            </Table>
                        )}
                      </Stack>
                    </Card>
                  </Tabs.Panel>

                  <Tabs.Panel value="permissions" pt="md">
                    <Card shadow="sm" radius="xl" padding="lg">
                      <Stack gap="sm">
                        <Group gap="xs" justify="space-between">
                          <Group gap="xs">
                            <ThemeIcon variant="light" color="red" size="md">
                              <IconLock size={14} />
                            </ThemeIcon>
                            <Title order={4}>Permissions</Title>
                          </Group>
                          {aclAddAction(aclQuery.data) ? (
                            <Button
                              size="xs"
                              variant="light"
                              leftSection={<IconPlus size={14} />}
                              loading={addACLMutation.isPending}
                              onClick={beginACLAdd}
                              disabled={isAddingACL}
                            >
                              Add permission
                            </Button>
                          ) : null}
                        </Group>

                        {isCollection ? (
                          <Paper withBorder radius="md" p="sm">
                            <Stack gap="xs">
                              <Group gap="md" justify="space-between" align="center">
                                <Checkbox
                                  label="Inherit permissions to child paths"
                                  checked={aclQuery.data?.inheritance_enabled === true}
                                  disabled={
                                    aclQuery.isLoading ||
                                    inheritanceMutation.isPending ||
                                    !collectionInheritanceAction(aclQuery.data)
                                  }
                                  onChange={(event) =>
                                    toggleCollectionInheritance(event.currentTarget.checked)
                                  }
                                />
                                <Checkbox
                                  label="Apply permission changes recursively"
                                  checked={applyACLRecursively}
                                  onChange={(event) =>
                                    setApplyACLRecursively(event.currentTarget.checked)
                                  }
                                />
                              </Group>
                              {!collectionInheritanceAction(aclQuery.data) ? (
                                <Text size="xs" c="dimmed">
                                  Inheritance controls are unavailable from the current ACL response.
                                </Text>
                              ) : null}
                            </Stack>
                          </Paper>
                        ) : null}

                        {aclQuery.isError ? (
                          <Alert
                            color="red"
                            variant="light"
                            icon={<IconAlertCircle size={18} />}
                            title="Unable to load permissions"
                          >
                            {aclQuery.error.message}
                          </Alert>
                        ) : (
                          <Table highlightOnHover verticalSpacing="sm">
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>Principal</Table.Th>
                                <Table.Th>Type</Table.Th>
                                <Table.Th>Zone</Table.Th>
                                <Table.Th>Current</Table.Th>
                                <Table.Th>Permissions</Table.Th>
                                <Table.Th>Actions</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {aclQuery.isLoading ? (
                                <Table.Tr>
                                  <Table.Td colSpan={6}>
                                    <Text size="sm" c="dimmed">
                                      Loading permissions...
                                    </Text>
                                  </Table.Td>
                                </Table.Tr>
                              ) : isAddingACL ? (
                                <Table.Tr className="explorer-row-selected">
                                  <Table.Td>
                                    <Select
                                      searchable
                                      value={aclPrincipalSelection}
                                      searchValue={aclPrincipalSearchValue}
                                      placeholder={`Search ${aclForm.type} (3+ chars)`}
                                      data={aclPrincipalQuery.data ?? []}
                                      nothingFoundMessage={
                                        aclPrincipalSearchTerm.length < 3
                                          ? 'Type at least 3 characters'
                                          : aclPrincipalQuery.isLoading
                                            ? 'Searching...'
                                            : 'No matches found'
                                      }
                                      onSearchChange={(value) => {
                                        setACLPrincipalSearchValue(value)
                                        const selected = aclPrincipalSelection
                                          ? aclPrincipalOptionsByValue.get(aclPrincipalSelection)
                                          : null
                                        if (!selected || selected.label !== value) {
                                          setACLPrincipalSelection(null)
                                          setACLForm((current) => ({
                                            ...current,
                                            name: '',
                                          }))
                                        }
                                      }}
                                      onChange={(value) => {
                                        setACLPrincipalSelection(value)
                                        if (!value) {
                                          setACLPrincipalSearchValue('')
                                          setACLForm((current) => ({
                                            ...current,
                                            name: '',
                                          }))
                                          return
                                        }

                                        const selected = aclPrincipalOptionsByValue.get(value)
                                        if (!selected) {
                                          setACLForm((current) => ({
                                            ...current,
                                            name: '',
                                          }))
                                          return
                                        }

                                        setACLForm((current) => ({
                                          ...current,
                                          name: selected.principal,
                                          zone: selected.zone ?? current.zone,
                                        }))
                                        setACLPrincipalSearchValue(selected.label)
                                      }}
                                      rightSection={
                                        aclPrincipalQuery.isFetching ? <Loader size={14} /> : undefined
                                      }
                                      disabled={addACLMutation.isPending}
                                    />
                                  </Table.Td>
                                  <Table.Td>
                                    <Select
                                      data={[
                                        { value: 'user', label: 'User' },
                                        { value: 'group', label: 'Group' },
                                      ]}
                                      value={aclForm.type}
                                      allowDeselect={false}
                                      onChange={(value) => {
                                        if (value === 'user' || value === 'group') {
                                          setACLPrincipalSelection(null)
                                          setACLPrincipalSearchValue('')
                                          setACLForm((current) => ({
                                            ...current,
                                            type: value,
                                            name: '',
                                          }))
                                        }
                                      }}
                                    />
                                  </Table.Td>
                                  <Table.Td>
                                    <TextInput
                                      placeholder={detailsQuery.data.zone}
                                      value={aclForm.zone}
                                      onChange={(event) => {
                                        const value = event.currentTarget.value
                                        setACLForm((current) => ({
                                          ...current,
                                          zone: value,
                                        }))
                                      }}
                                    />
                                  </Table.Td>
                                  <Table.Td>
                                    <Text size="sm" c="dimmed">
                                      New
                                    </Text>
                                  </Table.Td>
                                  <Table.Td>
                                    <ACLPermissionCheckboxes
                                      value={{
                                        read: aclForm.read,
                                        write: aclForm.write,
                                        own: aclForm.own,
                                      }}
                                      principalLabel={aclForm.name || 'new principal'}
                                      disabled={addACLMutation.isPending}
                                      onChange={(permission, checked) =>
                                        setACLForm((current) => ({
                                          ...current,
                                          ...nextACLPermissionState(
                                            {
                                              read: current.read,
                                              write: current.write,
                                              own: current.own,
                                            },
                                            permission,
                                            checked,
                                          ),
                                        }))
                                      }
                                    />
                                  </Table.Td>
                                  <Table.Td>
                                    <Group gap="xs" wrap="nowrap">
                                      <Button
                                        size="xs"
                                        onClick={submitACLAdd}
                                        loading={addACLMutation.isPending}
                                      >
                                        Add
                                      </Button>
                                      <Button size="xs" variant="default" onClick={cancelACLAdd}>
                                        Cancel
                                      </Button>
                                    </Group>
                                  </Table.Td>
                                </Table.Tr>
                              ) : aclEntries.length === 0 ? (
                                <Table.Tr>
                                  <Table.Td colSpan={6}>
                                    <Text size="sm" c="dimmed">
                                      No permissions returned for this path.
                                    </Text>
                                  </Table.Td>
                                </Table.Tr>
                              ) : (
                                aclEntries.map((entry) => {
                                  const draft = aclDraftForEntry(entry)
                                  const principalLabel = aclPrincipalLabel(entry)

                                  return (
                                    <Table.Tr key={entry.id}>
                                      <Table.Td>
                                        <Stack gap={2}>
                                          <Text size="sm" fw={600}>
                                            {entry.name}
                                          </Text>
                                          <Text size="xs" c="dimmed">
                                            {entry.id}
                                          </Text>
                                        </Stack>
                                      </Table.Td>
                                      <Table.Td>
                                        <Badge variant="light" color={entry.type === 'group' ? 'grape' : 'blue'}>
                                          {entry.type}
                                        </Badge>
                                      </Table.Td>
                                      <Table.Td>{entry.zone ?? '—'}</Table.Td>
                                      <Table.Td>
                                        <Stack gap={2}>
                                          <Text size="sm">{aclAccessLevelLabel(entry.access_level)}</Text>
                                          <Text size="xs" c="dimmed">
                                            {entry.access_level}
                                          </Text>
                                        </Stack>
                                      </Table.Td>
                                      <Table.Td>
                                        <ACLPermissionCheckboxes
                                          value={draft}
                                          principalLabel={principalLabel}
                                          disabled={!entry.links?.update || updateACLMutation.isPending}
                                          onChange={(permission, checked) =>
                                            updateACLDraft(
                                              entry,
                                              nextACLPermissionState(draft, permission, checked),
                                            )
                                          }
                                        />
                                      </Table.Td>
                                      <Table.Td>
                                        <Group gap="xs" wrap="nowrap">
                                          {entry.links?.update ? (
                                            <Button
                                              size="xs"
                                              variant="light"
                                              onClick={() => submitACLUpdate(entry)}
                                              loading={updateACLMutation.isPending}
                                            >
                                              Update
                                            </Button>
                                          ) : null}
                                          {entry.links?.remove ? (
                                            <ActionIcon
                                              variant="subtle"
                                              color="red"
                                              aria-label={`Delete permission for ${principalLabel}`}
                                              onClick={() => beginACLDelete(entry)}
                                            >
                                              <IconTrash size={16} />
                                            </ActionIcon>
                                          ) : null}
                                          {!entry.links?.update && !entry.links?.remove ? (
                                            <Text size="sm" c="dimmed">
                                              Unavailable
                                            </Text>
                                          ) : null}
                                        </Group>
                                      </Table.Td>
                                    </Table.Tr>
                                  )
                                })
                              )}
                            </Table.Tbody>
                          </Table>
                        )}
                      </Stack>
                    </Card>
                  </Tabs.Panel>

                  <Tabs.Panel value="tickets" pt="md">
                    <Card shadow="sm" radius="xl" padding="lg">
                      <Stack gap="sm">
                        <Group gap="xs" justify="space-between">
                          <Group gap="xs">
                            <ThemeIcon variant="light" color="violet" size="md">
                              <IconKey size={14} />
                            </ThemeIcon>
                            <Title order={4}>Tickets</Title>
                          </Group>
                          {ticketCreateAction(detailsQuery.data) ? (
                            <Button
                              size="xs"
                              variant="light"
                              leftSection={<IconPlus size={14} />}
                              loading={createTicketMutation.isPending}
                              onClick={beginTicketAdd}
                              disabled={isAddingTicket}
                            >
                              Add ticket
                            </Button>
                          ) : null}
                        </Group>

                        {ticketsQuery.isError ? (
                          <Alert
                            color="red"
                            variant="light"
                            icon={<IconAlertCircle size={18} />}
                            title="Unable to load tickets"
                          >
                            {ticketsQuery.error.message}
                          </Alert>
                        ) : (
                          <Table highlightOnHover verticalSpacing="sm">
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>Name</Table.Th>
                                <Table.Th>Bearer token</Table.Th>
                                <Table.Th>Uses</Table.Th>
                                <Table.Th>Expires</Table.Th>
                                <Table.Th>Actions</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {ticketsQuery.isLoading ? (
                                <Table.Tr>
                                  <Table.Td colSpan={5}>
                                    <Text size="sm" c="dimmed">
                                      Loading tickets...
                                    </Text>
                                  </Table.Td>
                                </Table.Tr>
                              ) : isAddingTicket ? (
                                <Table.Tr className="explorer-row-selected">
                                  <Table.Td>
                                    <Text size="sm" c="dimmed">
                                      New ticket
                                    </Text>
                                  </Table.Td>
                                  <Table.Td>
                                    <Text size="sm" c="dimmed">
                                      Generated by server
                                    </Text>
                                  </Table.Td>
                                  <Table.Td>
                                    <TextInput
                                      placeholder="50"
                                      value={ticketForm.maximumUses}
                                      onChange={(event) => {
                                        const value = event.currentTarget.value
                                        setTicketForm((current) => ({
                                          ...current,
                                          maximumUses: value,
                                        }))
                                      }}
                                    />
                                  </Table.Td>
                                  <Table.Td>
                                    <TextInput
                                      placeholder="720"
                                      value={ticketForm.lifetimeMinutes}
                                      onChange={(event) => {
                                        const value = event.currentTarget.value
                                        setTicketForm((current) => ({
                                          ...current,
                                          lifetimeMinutes: value,
                                        }))
                                      }}
                                    />
                                  </Table.Td>
                                  <Table.Td>
                                    <Group gap="xs" wrap="nowrap">
                                      <Button
                                        size="xs"
                                        onClick={submitTicketAdd}
                                        loading={createTicketMutation.isPending}
                                      >
                                        Create
                                      </Button>
                                      <Button size="xs" variant="default" onClick={cancelTicketAdd}>
                                        Cancel
                                      </Button>
                                    </Group>
                                  </Table.Td>
                                </Table.Tr>
                              ) : ticketsForPath.length === 0 ? (
                                <Table.Tr>
                                  <Table.Td colSpan={5}>
                                    <Text size="sm" c="dimmed">
                                      No tickets returned for this path.
                                    </Text>
                                  </Table.Td>
                                </Table.Tr>
                              ) : (
                                ticketsForPath.map((ticket) => (
                                  <Table.Tr key={ticket.name}>
                                    <Table.Td>
                                      <Code>{ticket.name}</Code>
                                    </Table.Td>
                                    <Table.Td>
                                      <Group gap="xs" wrap="nowrap" align="flex-start">
                                        <Text size="sm" className="details-code-cell">
                                          {ticket.bearer_token ?? '—'}
                                        </Text>
                                        {ticket.bearer_token ? (
                                          <ActionIcon
                                            variant="subtle"
                                            color="gray"
                                            aria-label="Copy bearer token"
                                            onClick={() => void copyText(ticket.bearer_token!, 'Bearer token')}
                                          >
                                            <IconCopy size={16} />
                                          </ActionIcon>
                                        ) : null}
                                      </Group>
                                    </Table.Td>
                                    <Table.Td>
                                      {editingTicketName === ticket.name ? (
                                        <TextInput
                                          value={ticketEditForm.maximumUses}
                                          onChange={(event) => {
                                            const value = event.currentTarget.value
                                            setTicketEditForm((current) => ({
                                              ...current,
                                              maximumUses: value,
                                            }))
                                          }}
                                        />
                                      ) : (
                                        formatTicketLimit(ticket.uses_limit)
                                      )}
                                    </Table.Td>
                                    <Table.Td>
                                      {editingTicketName === ticket.name ? (
                                        <TextInput
                                          value={ticketEditForm.lifetimeMinutes}
                                          onChange={(event) => {
                                            const value = event.currentTarget.value
                                            setTicketEditForm((current) => ({
                                              ...current,
                                              lifetimeMinutes: value,
                                            }))
                                          }}
                                        />
                                      ) : (
                                        formatDateTime(ticket.expiration_time)
                                      )}
                                    </Table.Td>
                                    <Table.Td>
                                      <Group gap="xs" wrap="nowrap">
                                        {editingTicketName === ticket.name ? (
                                          <>
                                            <Button
                                              size="xs"
                                              onClick={() => submitTicketEdit(ticket)}
                                              loading={updateTicketMutation.isPending}
                                            >
                                              Update
                                            </Button>
                                            <Button size="xs" variant="default" onClick={cancelTicketEdit}>
                                              Cancel
                                            </Button>
                                          </>
                                        ) : (
                                          <>
                                            {ticket.links?.update ? (
                                              <Button
                                                size="xs"
                                                variant="light"
                                                onClick={() => beginTicketEdit(ticket)}
                                              >
                                                Update
                                              </Button>
                                            ) : null}
                                            {!isCollection && ticket.links?.download ? (() => {
                                              const downloadLink = ticket.links.download
                                              return (
                                                <ActionIcon
                                                  variant="subtle"
                                                  color="gray"
                                                  aria-label={`Copy ticket link for ${ticket.name}`}
                                                  onClick={() =>
                                                    void copyText(
                                                      actionLinkUrl(
                                                        downloadLink,
                                                        connection.baseUrl,
                                                      ),
                                                      'Ticket link',
                                                    )
                                                  }
                                                >
                                                  <IconCopy size={16} />
                                                </ActionIcon>
                                              )
                                            })() : null}
                                            {ticket.links?.delete ? (
                                              <ActionIcon
                                                variant="subtle"
                                                color="red"
                                                aria-label={`Delete ticket ${ticket.name}`}
                                                onClick={() => beginTicketDelete(ticket)}
                                              >
                                                <IconTrash size={16} />
                                              </ActionIcon>
                                            ) : null}
                                          </>
                                        )}
                                      </Group>
                                    </Table.Td>
                                  </Table.Tr>
                                ))
                              )}
                            </Table.Tbody>
                          </Table>
                        )}
                      </Stack>
                    </Card>
                  </Tabs.Panel>
                </Tabs>
              </Card>
            </Stack>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  )
}

function DetailsDownloadButton({ path }: { path: string }) {
  const { connection } = useSession()
  const downloadMutation = useMutation({
    mutationFn: () => downloadPath(path, connection.auth, connection.baseUrl),
    onSuccess: ({ blob, filename }) => {
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

  return (
    <Button
      variant="light"
      leftSection={<IconDownload size={14} />}
      loading={downloadMutation.isPending}
      onClick={() => downloadMutation.mutate()}
    >
      Download object
    </Button>
  )
}

function ACLPermissionCheckboxes({
  value,
  disabled,
  principalLabel,
  onChange,
}: {
  value: ACLPermissionState
  disabled?: boolean
  principalLabel: string
  onChange: (permission: ACLPermissionKey, checked: boolean) => void
}) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Checkbox
        size="xs"
        label="Read"
        aria-label={`Read permission for ${principalLabel}`}
        checked={value.read}
        disabled={disabled}
        onChange={(event) => onChange('read', event.currentTarget.checked)}
      />
      <Checkbox
        size="xs"
        label="Write"
        aria-label={`Write permission for ${principalLabel}`}
        checked={value.write}
        disabled={disabled}
        onChange={(event) => onChange('write', event.currentTarget.checked)}
      />
      <Checkbox
        size="xs"
        label="Own"
        aria-label={`Owner permission for ${principalLabel}`}
        checked={value.own}
        disabled={disabled}
        onChange={(event) => onChange('own', event.currentTarget.checked)}
      />
    </Group>
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
