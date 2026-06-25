import { ActionIcon, Button, Code, Group, Table, Text, TextInput } from '@mantine/core'
import { IconEdit, IconTrash } from '@tabler/icons-react'
import type { AVUEntry } from '../lib/irods-rest'

export interface AVUFormState {
  attrib: string
  value: string
  unit: string
}

export type AVURow = AVUEntry

interface AVUMetadataTableProps {
  avus?: AVURow[]
  canModify?: boolean
  editingAVUId?: string
  emptyMessage?: string
  form: AVUFormState
  isAdding: boolean
  isCreating: boolean
  isLoading: boolean
  isSaving: boolean
  loadingMessage?: string
  onCancel: () => void
  onChange: (form: AVUFormState) => void
  onDelete: (avu: AVURow) => void
  onEdit: (avu: AVURow) => void
  onSubmitAdd: () => void
  onSubmitEdit: () => void
}

function addAVURow({
  form,
  isCreating,
  onCancel,
  onChange,
  onSubmitAdd,
}: Pick<AVUMetadataTableProps, 'form' | 'isCreating' | 'onCancel' | 'onChange' | 'onSubmitAdd'>) {
  return (
    <Table.Tr className="explorer-row-selected">
      <Table.Td>
        <TextInput
          placeholder="Attribute"
          value={form.attrib}
          onChange={(event) =>
            onChange({
              ...form,
              attrib: event.currentTarget.value,
            })
          }
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          placeholder="Value"
          value={form.value}
          onChange={(event) =>
            onChange({
              ...form,
              value: event.currentTarget.value,
            })
          }
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          placeholder="Unit"
          value={form.unit}
          onChange={(event) =>
            onChange({
              ...form,
              unit: event.currentTarget.value,
            })
          }
        />
      </Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <Button size="xs" onClick={onSubmitAdd} loading={isCreating}>
            Add
          </Button>
          <Button size="xs" variant="default" onClick={onCancel}>
            Cancel
          </Button>
        </Group>
      </Table.Td>
    </Table.Tr>
  )
}

function avuRows(
  avus: AVURow[] | undefined,
  {
    editingAVUId,
    canModify = true,
    emptyMessage,
    form,
    isSaving,
    onCancel,
    onChange,
    onDelete,
    onEdit,
    onSubmitEdit,
  }: Pick<
    AVUMetadataTableProps,
    | 'editingAVUId'
    | 'canModify'
    | 'emptyMessage'
    | 'form'
    | 'isSaving'
    | 'onCancel'
    | 'onChange'
    | 'onDelete'
    | 'onEdit'
    | 'onSubmitEdit'
  >,
) {
  if (!avus || avus.length === 0) {
    return (
      <Table.Tr>
        <Table.Td colSpan={4}>
          <Text c="dimmed" size="sm">
            {emptyMessage ?? 'No AVUs returned.'}
          </Text>
        </Table.Td>
      </Table.Tr>
    )
  }

  return avus.map((avu) => (
    <Table.Tr key={`${avu.id}-${avu.attrib}`}>
      {editingAVUId === avu.id ? (
        <>
          <Table.Td>
            <TextInput
              placeholder="Attribute"
              value={form.attrib}
              onChange={(event) =>
                onChange({
                  ...form,
                  attrib: event.currentTarget.value,
                })
              }
            />
          </Table.Td>
          <Table.Td>
            <TextInput
              placeholder="Value"
              value={form.value}
              onChange={(event) =>
                onChange({
                  ...form,
                  value: event.currentTarget.value,
                })
              }
            />
          </Table.Td>
          <Table.Td>
            <TextInput
              placeholder="Unit"
              value={form.unit}
              onChange={(event) =>
                onChange({
                  ...form,
                  unit: event.currentTarget.value,
                })
              }
            />
          </Table.Td>
        </>
      ) : (
        <>
          <Table.Td>
            <Code>{avu.attrib}</Code>
          </Table.Td>
          <Table.Td>{avu.value}</Table.Td>
          <Table.Td>{avu.unit ?? '-'}</Table.Td>
        </>
      )}
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          {editingAVUId === avu.id ? (
            <>
              <Button size="xs" onClick={onSubmitEdit} loading={isSaving}>
                Update
              </Button>
              <Button size="xs" variant="default" onClick={onCancel}>
                Cancel
              </Button>
            </>
          ) : null}
          {editingAVUId !== avu.id && canModify && avu.links?.update ? (
            <ActionIcon
              variant="subtle"
              aria-label={`Edit AVU ${avu.attrib}`}
              onClick={() => onEdit(avu)}
            >
              <IconEdit size={16} />
            </ActionIcon>
          ) : null}
          {editingAVUId !== avu.id && canModify && avu.links?.delete ? (
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label={`Delete AVU ${avu.attrib}`}
              onClick={() => onDelete(avu)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          ) : null}
          {editingAVUId !== avu.id &&
          (!canModify || (!avu.links?.update && !avu.links?.delete)) ? (
            <Text size="sm" c="dimmed">
              Unavailable
            </Text>
          ) : null}
        </Group>
      </Table.Td>
    </Table.Tr>
  ))
}

export function AVUMetadataTable({
  avus,
  canModify = true,
  editingAVUId,
  emptyMessage,
  form,
  isAdding,
  isCreating,
  isLoading,
  isSaving,
  loadingMessage,
  onCancel,
  onChange,
  onDelete,
  onEdit,
  onSubmitAdd,
  onSubmitEdit,
}: AVUMetadataTableProps) {
  return (
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
        {isLoading ? (
          <Table.Tr>
            <Table.Td colSpan={4}>
              <Text size="sm" c="dimmed">
                {loadingMessage ?? 'Loading AVUs...'}
              </Text>
            </Table.Td>
          </Table.Tr>
        ) : isAdding ? (
          addAVURow({
            form,
            isCreating,
            onCancel,
            onChange,
            onSubmitAdd,
          })
        ) : (
          avuRows(avus, {
            canModify,
            editingAVUId,
            emptyMessage,
            form,
            isSaving,
            onCancel,
            onChange,
            onDelete,
            onEdit,
            onSubmitEdit,
          })
        )}
      </Table.Tbody>
    </Table>
  )
}
