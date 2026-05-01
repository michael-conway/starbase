import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Code,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy, IconRestore } from '@tabler/icons-react'
import { FilePreviewGlyph } from '../features/file-preview-icon'
import {
  filePreviewSpec,
  parseDelimitedContent,
  parentPath,
  serializeDelimitedContent,
  type FilePreviewSpec,
} from '../features/file-preview'
import { displayName } from '../features/explorer'
import { downloadPath, getPath, uploadPathContents } from '../lib/irods-rest'
import { useSession } from '../providers/use-session'

function cloneRows(rows: string[][]) {
  return rows.map((row) => [...row])
}

function rowsEqual(left: string[][], right: string[][]) {
  if (left.length !== right.length) {
    return false
  }

  for (let rowIndex = 0; rowIndex < left.length; rowIndex += 1) {
    const leftRow = left[rowIndex]
    const rightRow = right[rowIndex]
    if (!leftRow || !rightRow || leftRow.length !== rightRow.length) {
      return false
    }

    for (let columnIndex = 0; columnIndex < leftRow.length; columnIndex += 1) {
      if (leftRow[columnIndex] !== rightRow[columnIndex]) {
        return false
      }
    }
  }

  return true
}

function previewTitle(spec: FilePreviewSpec) {
  switch (spec.kind) {
    case 'image':
      return 'Image preview'
    case 'json':
      return 'JSON editor'
    case 'yaml':
      return 'YAML editor'
    case 'text':
      return 'Text editor'
    case 'csv':
      return 'CSV editor'
    case 'tsv':
      return 'TSV editor'
    case 'log':
      return 'Log viewer'
    case 'excel':
      return 'Excel workbook'
    case 'binary':
      return 'Binary file'
    default:
      return 'File preview'
  }
}

export function ExplorerPreviewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { connection } = useSession()
  const irodsPath = searchParams.get('irods_path')?.trim() ?? ''
  const [textValue, setTextValue] = useState('')
  const [originalTextValue, setOriginalTextValue] = useState('')
  const [tableRows, setTableRows] = useState<string[][]>([['']])
  const [originalTableRows, setOriginalTableRows] = useState<string[][]>([['']])
  const [decodedContentReady, setDecodedContentReady] = useState(false)
  const [decodedContentError, setDecodedContentError] = useState<string | null>(null)

  const detailsQuery = useQuery({
    queryKey: ['path-detail', irodsPath, connection, 'preview'],
    queryFn: () => getPath(irodsPath, connection.auth, connection.baseUrl, { verbose: 2 }),
    enabled: Boolean(irodsPath),
  })

  const previewSpec = useMemo(() => {
    if (!detailsQuery.data || detailsQuery.data.kind !== 'data_object') {
      return undefined
    }

    return filePreviewSpec(detailsQuery.data.path, detailsQuery.data.mime_type)
  }, [detailsQuery.data])

  const contentQuery = useQuery({
    queryKey: ['path-preview-content', irodsPath, connection, previewSpec?.kind],
    queryFn: () => downloadPath(irodsPath, connection.auth, connection.baseUrl),
    enabled: Boolean(irodsPath && detailsQuery.data?.kind === 'data_object' && previewSpec?.canOpenPreview),
  })
  const imagePreviewUrl = useMemo(() => {
    if (previewSpec?.kind !== 'image' || !contentQuery.data?.blob) {
      return null
    }

    return URL.createObjectURL(contentQuery.data.blob)
  }, [contentQuery.data, previewSpec?.kind])

  const saveMutation = useMutation({
    mutationFn: async (payload: { content: string }) => {
      const pathEntry = detailsQuery.data
      if (!pathEntry || pathEntry.kind !== 'data_object') {
        throw new Error('Only data objects can be saved.')
      }

      const fileName = displayName(pathEntry.path)
      const fileContent = new File([payload.content], fileName, {
        type: pathEntry.mime_type || 'text/plain',
      })

      return uploadPathContents(
        {
          parent_path: pathEntry.parent?.irods_path ?? parentPath(pathEntry.path),
          file_name: fileName,
          content: fileContent,
          overwrite: true,
        },
        connection.auth,
        connection.baseUrl,
      )
    },
    onSuccess: async () => {
      notifications.show({
        title: 'File saved',
        message: 'The preview changes were written to iRODS.',
        color: 'teal',
      })
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Save failed',
        message: error.message,
        color: 'red',
      })
    },
  })

  useEffect(() => {
    if (!imagePreviewUrl) {
      return undefined
    }

    return () => URL.revokeObjectURL(imagePreviewUrl)
  }, [imagePreviewUrl])

  useEffect(() => {
    const spec = previewSpec
    if (!spec || !contentQuery.data?.blob) {
      return
    }

    if (!['text', 'json', 'yaml', 'csv', 'tsv', 'log'].includes(spec.kind)) {
      queueMicrotask(() => {
        setDecodedContentReady(true)
        setDecodedContentError(null)
      })
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      setDecodedContentReady(false)
      setDecodedContentError(null)
    })

    void contentQuery.data.blob
      .text()
      .then((decoded) => {
        if (cancelled) {
          return
        }

        if (spec.kind === 'csv' || spec.kind === 'tsv') {
          const parsedRows = parseDelimitedContent(decoded, spec.delimiter ?? ',')
          setTableRows(cloneRows(parsedRows))
          setOriginalTableRows(cloneRows(parsedRows))
        } else {
          setTextValue(decoded)
          setOriginalTextValue(decoded)
        }

        setDecodedContentReady(true)
      })
      .catch((error: Error) => {
        if (cancelled) {
          return
        }
        setDecodedContentError(error.message)
        setDecodedContentReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [contentQuery.data, previewSpec])

  const isTableEditor = previewSpec?.kind === 'csv' || previewSpec?.kind === 'tsv'
  const isTextEditor = previewSpec?.kind === 'text' || previewSpec?.kind === 'json' || previewSpec?.kind === 'yaml'
  const isLogViewer = previewSpec?.kind === 'log'
  const editorDirty = useMemo(() => {
    if (!previewSpec?.canEdit) {
      return false
    }

    if (isTableEditor) {
      return !rowsEqual(tableRows, originalTableRows)
    }

    if (isTextEditor) {
      return textValue !== originalTextValue
    }

    return false
  }, [
    isTableEditor,
    isTextEditor,
    originalTableRows,
    originalTextValue,
    previewSpec?.canEdit,
    tableRows,
    textValue,
  ])

  const saveChanges = () => {
    if (!previewSpec?.canEdit) {
      return
    }

    if (isTableEditor) {
      const serialized = serializeDelimitedContent(tableRows, previewSpec.delimiter ?? ',')
      saveMutation.mutate(
        { content: serialized },
        {
          onSuccess: async () => {
            setOriginalTableRows(cloneRows(tableRows))
            await Promise.all([contentQuery.refetch(), detailsQuery.refetch()])
          },
        },
      )
      return
    }

    saveMutation.mutate(
      { content: textValue },
      {
        onSuccess: async () => {
          setOriginalTextValue(textValue)
          await Promise.all([contentQuery.refetch(), detailsQuery.refetch()])
        },
      },
    )
  }

  const revertChanges = () => {
    if (!previewSpec?.canEdit) {
      return
    }

    if (isTableEditor) {
      setTableRows(cloneRows(originalTableRows))
      return
    }

    setTextValue(originalTextValue)
  }

  return (
    <Card shadow="sm" radius="xl" padding="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>File preview</Title>
            <Text c="dimmed" size="sm">
              {irodsPath || 'No iRODS path selected'}
            </Text>
          </div>
          <Group gap="xs">
            <Button
              variant="default"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => navigate(`/app/explorer/details?irods_path=${encodeURIComponent(irodsPath)}`)}
            >
              Back to details
            </Button>
            <Button
              variant="subtle"
              onClick={() => navigate(`/app/explorer?irods_path=${encodeURIComponent(parentPath(irodsPath))}`)}
            >
              Back to explorer
            </Button>
          </Group>
        </Group>

        {!irodsPath ? (
          <Alert color="yellow" variant="light" icon={<IconAlertCircle size={18} />} title="No path selected">
            Open file details from Explorer and select Preview.
          </Alert>
        ) : null}

        {detailsQuery.isLoading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : null}

        {detailsQuery.isError ? (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title="Unable to load file">
            {detailsQuery.error.message}
          </Alert>
        ) : null}

        {detailsQuery.data?.kind === 'collection' ? (
          <Alert color="yellow" variant="light" icon={<IconAlertCircle size={18} />} title="Preview unavailable">
            Collection paths are not previewable.
          </Alert>
        ) : null}

        {detailsQuery.data && detailsQuery.data.kind === 'data_object' && previewSpec ? (
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Group gap="sm">
                  <ThemeIcon size="lg" variant="light" color="blue">
                    <FilePreviewGlyph icon={previewSpec.icon} size={18} />
                  </ThemeIcon>
                  <div>
                    <Title order={4}>{previewTitle(previewSpec)}</Title>
                    <Text size="sm" c="dimmed">
                      {previewSpec.label}
                    </Text>
                  </div>
                </Group>
              </Group>

              {!previewSpec.canOpenPreview ? (
                <Alert
                  color="yellow"
                  variant="light"
                  icon={<IconAlertCircle size={18} />}
                  title="Preview unavailable for this type"
                >
                  This file format cannot be rendered in-browser yet.
                </Alert>
              ) : null}

              {previewSpec.canOpenPreview && contentQuery.isLoading ? (
                <Group justify="center" py="xl">
                  <Loader />
                </Group>
              ) : null}

              {previewSpec.canOpenPreview && contentQuery.isError ? (
                <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title="Unable to load file">
                  {contentQuery.error.message}
                </Alert>
              ) : null}

              {previewSpec.canOpenPreview && decodedContentError ? (
                <Alert
                  color="red"
                  variant="light"
                  icon={<IconAlertCircle size={18} />}
                  title="Unable to parse preview data"
                >
                  {decodedContentError}
                </Alert>
              ) : null}

              {previewSpec.canOpenPreview && contentQuery.isSuccess ? (
                <>
                  {previewSpec.kind === 'image' ? (
                    <div className="preview-image-canvas">
                      {imagePreviewUrl ? (
                        <img src={imagePreviewUrl} alt={displayName(detailsQuery.data.path)} />
                      ) : (
                        <Loader />
                      )}
                    </div>
                  ) : null}

                  {decodedContentReady && isTextEditor ? (
                    <Textarea
                      autosize
                      minRows={18}
                      maxRows={36}
                      value={textValue}
                      onChange={(event) => setTextValue(event.currentTarget.value)}
                      className="preview-text-editor"
                    />
                  ) : null}

                  {decodedContentReady && isLogViewer ? (
                    <ScrollArea h={560}>
                      <pre className="preview-log-viewer">{textValue}</pre>
                    </ScrollArea>
                  ) : null}

                  {decodedContentReady && isTableEditor ? (
                    <ScrollArea h={560}>
                      <Table verticalSpacing={4} highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            {Array.from({
                              length: Math.max(...tableRows.map((row) => row.length), 1),
                            }).map((_, columnIndex) => (
                              <Table.Th key={`header-${columnIndex}`}>Column {columnIndex + 1}</Table.Th>
                            ))}
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {tableRows.map((row, rowIndex) => (
                            <Table.Tr key={`row-${rowIndex}`}>
                              {Array.from({
                                length: Math.max(...tableRows.map((eachRow) => eachRow.length), 1),
                              }).map((_, columnIndex) => (
                                <Table.Td key={`cell-${rowIndex}-${columnIndex}`}>
                                  <TextInput
                                    size="xs"
                                    value={row[columnIndex] ?? ''}
                                    onChange={(event) => {
                                      const value = event.currentTarget.value
                                      setTableRows((current) => {
                                        const next = cloneRows(current)
                                        while (next.length <= rowIndex) {
                                          next.push([])
                                        }
                                        while (next[rowIndex].length <= columnIndex) {
                                          next[rowIndex].push('')
                                        }
                                        next[rowIndex][columnIndex] = value
                                        return next
                                      })
                                    }}
                                  />
                                </Table.Td>
                              ))}
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </ScrollArea>
                  ) : null}

                  {previewSpec.canEdit ? (
                    <Group justify="flex-end">
                      <Button
                        variant="default"
                        leftSection={<IconRestore size={14} />}
                        onClick={revertChanges}
                        disabled={!editorDirty || saveMutation.isPending}
                      >
                        Revert
                      </Button>
                      <Button
                        leftSection={<IconDeviceFloppy size={14} />}
                        onClick={saveChanges}
                        loading={saveMutation.isPending}
                        disabled={!editorDirty}
                      >
                        Save
                      </Button>
                    </Group>
                  ) : null}
                </>
              ) : null}

              {detailsQuery.data.mime_type ? (
                <Text size="xs" c="dimmed">
                  MIME: <Code>{detailsQuery.data.mime_type}</Code>
                </Text>
              ) : null}
            </Stack>
          </Paper>
        ) : null}
      </Stack>
    </Card>
  )
}
