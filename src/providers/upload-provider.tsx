import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  Progress,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import {
  IconCircleCheck,
  IconChevronUp,
  IconLoader2,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import { ApiError, uploadPathContents } from '../lib/irods-rest'
import { useSession } from './use-session'
import {
  UploadManagerContext,
  type UploadManagerContextValue,
  type UploadTargetOptions,
} from './upload-context'

type UploadStatus =
  | 'queued'
  | 'uploading'
  | 'awaiting_overwrite'
  | 'success'
  | 'error'
  | 'cancelled'

interface UploadItem {
  id: string
  file: File
  targetPath: string
  targetFileName: string
  checksumRequired: boolean
  overwrite: boolean
  status: UploadStatus
  loaded: number
  total: number
  error?: string
}

interface PendingUploadSelection {
  files: File[]
  targetPath: string
  targetLabel: string
  targetFileName?: string
  overwriteDefault: boolean
}

interface OverwritePromptState {
  uploadId: string
  fileName: string
  targetPath: string
}

const maxParallelUploads = 3

export function UploadProvider({ children }: { children: ReactNode }) {
  const { connection } = useSession()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pickerTargetRef = useRef<UploadTargetOptions | null>(null)
  const controllersRef = useRef(new Map<string, AbortController>())
  const [pendingSelection, setPendingSelection] = useState<PendingUploadSelection | null>(null)
  const [checksumRequired, setChecksumRequired] = useState(false)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [overwritePrompt, setOverwritePrompt] = useState<OverwritePromptState | null>(null)
  const [uploadDrawerOpened, setUploadDrawerOpened] = useState(false)

  const countUploading = () =>
    uploads.filter((upload) => upload.status === 'uploading').length

  const kickUploads = useCallback((snapshot?: UploadItem[]) => {
    const currentUploads = snapshot ?? uploads
    const activeCount = currentUploads.filter((upload) => upload.status === 'uploading').length
    const availableSlots = Math.max(0, maxParallelUploads - activeCount)
    if (availableSlots === 0) {
      return
    }

    const queuedUploads = currentUploads
      .filter((upload) => upload.status === 'queued' && !controllersRef.current.has(upload.id))
      .slice(0, availableSlots)

    queuedUploads.forEach((upload) => {
      const controller = new AbortController()
      controllersRef.current.set(upload.id, controller)

      setUploads((current) =>
        current.map((item) =>
          item.id === upload.id ? { ...item, status: 'uploading' } : item,
        ),
      )

      void uploadPathContents(
        {
          parent_path: upload.targetPath,
          file_name: upload.targetFileName,
          content: upload.file,
          checksum: upload.checksumRequired,
          overwrite: upload.overwrite,
        },
        connection.auth,
        connection.baseUrl,
        {
          signal: controller.signal,
          onProgress: ({ loaded, total }) => {
            setUploads((current) =>
              current.map((item) =>
                item.id === upload.id
                  ? {
                      ...item,
                      loaded,
                      total,
                    }
                  : item,
              ),
            )
          },
        },
      )
        .then((response) => {
          notifications.show({
            title: response.action === 'replaced' ? 'Upload replaced file' : 'Upload complete',
            message: response.path,
            color: 'teal',
          })

          setUploads((current) =>
            current.map((item) =>
              item.id === upload.id
                ? {
                    ...item,
                    status: 'success',
                    loaded: upload.file.size,
                    total: upload.file.size,
                  }
                : item,
            ),
          )

          void queryClient.invalidateQueries({ queryKey: ['path-entry'] })
          void queryClient.invalidateQueries({ queryKey: ['path-children'] })
          void queryClient.invalidateQueries({ queryKey: ['path-detail'] })
        })
        .catch((error: Error) => {
          const isCancelled = error.message === 'Upload was cancelled.'
          const requiresOverwriteDecision =
            error instanceof ApiError && error.status === 409

          setUploads((current) =>
            current.map((item) =>
              item.id === upload.id
                ? {
                    ...item,
                    status: isCancelled
                      ? 'cancelled'
                      : requiresOverwriteDecision
                        ? 'awaiting_overwrite'
                        : 'error',
                    error: requiresOverwriteDecision ? undefined : error.message,
                  }
                : item,
            ),
          )

          if (requiresOverwriteDecision) {
            setOverwritePrompt({
              uploadId: upload.id,
              fileName: upload.file.name,
              targetPath: upload.targetPath,
            })
            return
          }

          if (!isCancelled) {
            notifications.show({
              title: 'Upload failed',
              message: `${upload.file.name}: ${error.message}`,
              color: 'red',
            })
          }
        })
        .finally(() => {
          controllersRef.current.delete(upload.id)
          setUploads((current) => [...current])
        })
    })
  }, [connection.auth, connection.baseUrl, queryClient, uploads])

  const requestFilesUpload = (files: File[], options: UploadTargetOptions) => {
    if (files.length === 0) {
      return
    }

    setPendingSelection({
      files,
      targetPath: options.targetPath,
      targetLabel: options.targetLabel ?? options.targetPath,
      targetFileName: options.targetFileName,
      overwriteDefault: options.overwriteDefault ?? false,
    })
    setChecksumRequired(false)
  }

  const openFilePicker = (options: UploadTargetOptions) => {
    pickerTargetRef.current = options
    fileInputRef.current?.click()
  }

  const confirmUploadSelection = () => {
    if (!pendingSelection) {
      return
    }

    const nextUploads = pendingSelection.files.map<UploadItem>((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      file,
      targetPath: pendingSelection.targetPath,
      targetFileName: pendingSelection.targetFileName ?? file.name,
      checksumRequired,
      overwrite: pendingSelection.overwriteDefault,
      status: 'queued',
      loaded: 0,
      total: file.size,
    }))

    setUploads((current) => [...current, ...nextUploads])

    setPendingSelection(null)
    setChecksumRequired(false)
  }

  const cancelUploadSelection = () => {
    setPendingSelection(null)
    setChecksumRequired(false)
  }

  const cancelUpload = (uploadId: string) => {
    const controller = controllersRef.current.get(uploadId)
    if (controller) {
      controller.abort()
      return
    }

    setUploads((current) =>
      current.map((item) =>
        item.id === uploadId ? { ...item, status: 'cancelled' } : item,
      ),
    )
  }

  const dismissUpload = (uploadId: string) => {
    controllersRef.current.delete(uploadId)
    setUploads((current) => {
      const next = current.filter((item) => item.id !== uploadId)
      if (next.length === 0) {
        setUploadDrawerOpened(false)
      }
      return next
    })
  }

  const cancelOverwritePrompt = () => {
    if (!overwritePrompt) {
      return
    }

    setUploads((current) =>
      current.map((item) =>
        item.id === overwritePrompt.uploadId
          ? {
              ...item,
              status: 'cancelled',
              error: 'Upload cancelled because overwrite was not approved.',
            }
          : item,
      ),
    )
    setOverwritePrompt(null)
  }

  const confirmOverwritePrompt = () => {
    if (!overwritePrompt) {
      return
    }

    setUploads((current) =>
      current.map((item) =>
        item.id === overwritePrompt.uploadId
          ? {
              ...item,
              overwrite: true,
              status: 'queued' as const,
              error: undefined,
              loaded: 0,
            }
          : item,
      ),
    )
    setOverwritePrompt(null)
  }

  useEffect(() => {
    if (!uploads.some((upload) => upload.status === 'queued')) {
      return
    }

    queueMicrotask(() => kickUploads())
  }, [kickUploads, uploads])

  const contextValue = useMemo<UploadManagerContextValue>(
    () => ({
      requestFilesUpload,
      openFilePicker,
    }),
    [],
  )

  return (
    <UploadManagerContext.Provider value={contextValue}>
      {children}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          const target = pickerTargetRef.current
          event.currentTarget.value = ''

          if (!target || files.length === 0) {
            return
          }

          requestFilesUpload(
            target.allowMultiple === false ? [files[0]] : files,
            target,
          )
        }}
      />

      <Modal
        opened={pendingSelection !== null}
        onClose={cancelUploadSelection}
        title="Upload files"
        centered
      >
        <Stack gap="md">
          <Text>
            Upload <strong>{pendingSelection?.files.length ?? 0}</strong> file
            {(pendingSelection?.files.length ?? 0) === 1 ? '' : 's'} to{' '}
            <strong>{pendingSelection?.targetLabel ?? pendingSelection?.targetPath}</strong>?
          </Text>
          {pendingSelection?.targetFileName ? (
            <Text size="sm" c="dimmed">
              Target object name: <strong>{pendingSelection.targetFileName}</strong>
            </Text>
          ) : null}
          {pendingSelection?.overwriteDefault ? (
            <Text size="sm" c="dimmed">
              This upload will default to overwrite the existing target object.
            </Text>
          ) : null}

          <Switch
            label="Request checksum calculation during upload"
            checked={checksumRequired}
            onChange={(event) => setChecksumRequired(event.currentTarget.checked)}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={cancelUploadSelection}>
              Cancel
            </Button>
            <Button leftSection={<IconUpload size={14} />} onClick={confirmUploadSelection}>
              Start upload
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={overwritePrompt !== null}
        onClose={cancelOverwritePrompt}
        title="File already exists"
        centered
      >
        <Stack gap="md">
          <Text>
            <strong>{overwritePrompt?.fileName}</strong> already exists in{' '}
            <strong>{overwritePrompt?.targetPath}</strong>.
          </Text>
          <Text size="sm" c="dimmed">
            Choose overwrite to replace the existing object, or cancel to skip this
            upload.
          </Text>

          <Group justify="flex-end">
            <Button variant="default" onClick={cancelOverwritePrompt}>
              Cancel upload
            </Button>
            <Button color="red" onClick={confirmOverwritePrompt}>
              Overwrite existing file
            </Button>
          </Group>
        </Stack>
      </Modal>

      {uploads.length > 0 ? (
        <>
          <Card
            shadow="sm"
            radius="xl"
            padding="sm"
            className="upload-footer"
            withBorder
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap">
                <Title order={6}>Uploads</Title>
                <Badge variant="light" color="blue">
                  {countUploading()} active
                </Badge>
                <Badge variant="dot" color="gray">
                  {uploads.length} total
                </Badge>
              </Group>
              <Button
                size="xs"
                variant="subtle"
                rightSection={<IconChevronUp size={14} />}
                onClick={() => setUploadDrawerOpened(true)}
              >
                Open
              </Button>
            </Group>
          </Card>

          <Drawer
            opened={uploadDrawerOpened}
            onClose={() => setUploadDrawerOpened(false)}
            title="Uploads"
            position="bottom"
            size="md"
            className="upload-drawer"
          >
            <Stack gap="sm" className="upload-drawer-body">
              {uploads.map((upload) => {
                const progress = upload.total > 0 ? Math.round((upload.loaded / upload.total) * 100) : 0
                return (
                  <Stack key={upload.id} gap={6} className="upload-dock-item">
                    <Group justify="space-between" align="flex-start" gap="sm">
                      <div>
                        <Text size="sm" fw={600}>
                          {upload.file.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {upload.targetPath}
                        </Text>
                      </div>
                      <Group gap={4}>
                        {upload.status === 'success' ? (
                          <ActionIcon variant="subtle" color="teal" aria-label="Upload complete">
                            <IconCircleCheck size={16} />
                          </ActionIcon>
                        ) : upload.status === 'uploading' ? (
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label="Uploading"
                            disabled
                          >
                            <IconLoader2 size={16} className="upload-spinner" />
                          </ActionIcon>
                        ) : null}
                        {upload.status === 'queued' || upload.status === 'uploading' ? (
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label={`Cancel upload for ${upload.file.name}`}
                            onClick={() => cancelUpload(upload.id)}
                          >
                            <IconX size={16} />
                          </ActionIcon>
                        ) : (
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label={`Dismiss upload for ${upload.file.name}`}
                            onClick={() => dismissUpload(upload.id)}
                          >
                            <IconX size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Group>

                    <Progress
                      value={
                        upload.status === 'success'
                          ? 100
                          : upload.status === 'cancelled'
                            ? 0
                            : progress
                      }
                      color={
                        upload.status === 'error'
                          ? 'red'
                          : upload.status === 'success'
                            ? 'teal'
                            : upload.status === 'awaiting_overwrite'
                              ? 'yellow'
                              : 'blue'
                      }
                    />

                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        {upload.status}
                      </Text>
                      {upload.error ? (
                        <Text size="xs" c="red">
                          {upload.error}
                        </Text>
                      ) : (
                        <Text size="xs" c="dimmed">
                          {upload.total > 0 ? `${progress}%` : 'Pending'}
                        </Text>
                      )}
                    </Group>
                  </Stack>
                )
              })}
            </Stack>
          </Drawer>
        </>
      ) : null}
    </UploadManagerContext.Provider>
  )
}
