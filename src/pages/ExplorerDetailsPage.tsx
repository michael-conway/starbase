import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ActionIcon,
  Anchor,
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Code,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
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
  IconPlus,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { displayName, formatBytes, formatDateTime } from '../features/explorer'
import {
  addAVU,
  actionLinkUrl,
  ApiError,
  computePathChecksum,
  createPathTicket,
  deleteAVU,
  deletePath,
  deleteTicket,
  downloadPath,
  getPath,
  getPathAVUs,
  getTickets,
  renamePath,
  type ActionLink,
  type PathEntry,
  type TicketEntry,
  updateTicket,
} from '../lib/irods-rest'
import { useSession } from '../providers/session'

interface DeleteDialogState {
  path: string
  label: string
  kind: PathEntry['kind']
}

interface RenameDialogState {
  path: string
  label: string
  kind: PathEntry['kind']
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

export function ExplorerDetailsPage() {
  const { connection } = useSession()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const irodsPath = searchParams.get('irods_path')?.trim() ?? ''
  const [isAddingAVU, setIsAddingAVU] = useState(false)
  const [avuForm, setAVUForm] = useState({
    attrib: '',
    value: '',
    unit: '',
  })
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
  const [renameName, setRenameName] = useState('')

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
  const ticketsQuery = useQuery({
    queryKey: ['tickets', connection],
    queryFn: () => getTickets(connection.auth, connection.baseUrl),
    enabled: Boolean(irodsPath),
  })
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

      await deletePath(deleteDialog.path, connection.auth, connection.baseUrl, {
        force: deleteForce,
      })

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
        navigate(
          `/app/explorer?irods_path=${encodeURIComponent(detailsQuery.data.parent.irods_path)}`,
        )
        return
      }

      navigate('/app/explorer')
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

      return renamePath(
        renameDialog.path,
        {
          new_name: newName,
        },
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
      navigate(`/app/explorer/details?irods_path=${encodeURIComponent(renamed.path)}`, {
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

  const breadcrumbs = useMemo(() => detailsQuery.data?.path_segments ?? [], [detailsQuery.data])
  const ticketsForPath = useMemo(
    () =>
      (ticketsQuery.data?.tickets ?? []).filter(
        (ticket) => ticket.irods_path?.trim() === irodsPath,
      ),
    [ticketsQuery.data, irodsPath],
  )
  const isCollection = detailsQuery.data?.kind === 'collection'
  const isDataObject = detailsQuery.data?.kind === 'data_object'
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
    })
    setRenameName(label)
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
              <div className="details-header-layout">
                <Paper withBorder radius="lg" p="lg" className="details-header-card">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <Group gap="sm" align="flex-start" className="details-header-main">
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
                        <Group
                          justify="space-between"
                          align="flex-start"
                          className="details-header-copy"
                        >
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
                            onClick={() => void copyText(detailsQuery.data.path, 'Path')}
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
                  </Stack>
                </Paper>

                <Card shadow="sm" radius="xl" padding="lg" className="details-actions-card">
                  <Stack gap="sm">
                    <Title order={4}>Actions</Title>
                    {isDataObject ? (
                      <DetailsDownloadButton path={detailsQuery.data.path} />
                    ) : null}
                    {isDataObject ? (
                      <Button variant="default" leftSection={<IconUpload size={14} />}>
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
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={beginPathDelete}
                    >
                      Delete {detailsQuery.data.kind === 'collection' ? 'folder' : 'file'}
                    </Button>
                    {isCollection ? (
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
                    {isDataObject ? <Tabs.Tab value="storage">Storage</Tabs.Tab> : null}
                    <Tabs.Tab value="avus">AVUs</Tabs.Tab>
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

                  {isDataObject ? (
                    <Tabs.Panel value="storage" pt="md">
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
                                      onChange={(event) =>
                                        setTicketForm((current) => ({
                                          ...current,
                                          maximumUses: event.currentTarget.value,
                                        }))
                                      }
                                    />
                                  </Table.Td>
                                  <Table.Td>
                                    <TextInput
                                      placeholder="720"
                                      value={ticketForm.lifetimeMinutes}
                                      onChange={(event) =>
                                        setTicketForm((current) => ({
                                          ...current,
                                          lifetimeMinutes: event.currentTarget.value,
                                        }))
                                      }
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
                                          onChange={(event) =>
                                            setTicketEditForm((current) => ({
                                              ...current,
                                              maximumUses: event.currentTarget.value,
                                            }))
                                          }
                                        />
                                      ) : (
                                        formatTicketLimit(ticket.uses_limit)
                                      )}
                                    </Table.Td>
                                    <Table.Td>
                                      {editingTicketName === ticket.name ? (
                                        <TextInput
                                          value={ticketEditForm.lifetimeMinutes}
                                          onChange={(event) =>
                                            setTicketEditForm((current) => ({
                                              ...current,
                                              lifetimeMinutes: event.currentTarget.value,
                                            }))
                                          }
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
