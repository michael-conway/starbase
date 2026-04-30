export type PreviewKind =
  | 'image'
  | 'text'
  | 'json'
  | 'yaml'
  | 'csv'
  | 'tsv'
  | 'log'
  | 'excel'
  | 'binary'
  | 'document'

export type PreviewIconKey = 'image' | 'table' | 'json' | 'yaml' | 'text' | 'log' | 'binary' | 'document'

export interface FilePreviewSpec {
  kind: PreviewKind
  icon: PreviewIconKey
  label: string
  canOpenPreview: boolean
  canEdit: boolean
  delimiter?: ',' | '\t'
}

function extensionFromPath(path: string) {
  const filename = path.split('/').filter(Boolean).at(-1) ?? ''
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex === -1) {
    return ''
  }

  return filename.slice(dotIndex + 1).toLowerCase()
}

function normalizedMimeType(mimeType?: string) {
  return mimeType?.trim().toLowerCase() ?? ''
}

function isLikelyBinaryMime(mimeType: string) {
  if (!mimeType) {
    return false
  }

  return (
    mimeType.includes('octet-stream') ||
    mimeType.startsWith('application/x-') ||
    mimeType.includes('zip') ||
    mimeType.includes('compressed')
  )
}

export function parentPath(path: string) {
  const segments = path.split('/').filter(Boolean)
  if (segments.length <= 1) {
    return '/'
  }

  return `/${segments.slice(0, -1).join('/')}`
}

export function filePreviewSpec(path: string, mimeType?: string): FilePreviewSpec {
  const ext = extensionFromPath(path)
  const mime = normalizedMimeType(mimeType)

  if (
    mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'tif', 'tiff'].includes(ext)
  ) {
    return {
      kind: 'image',
      icon: 'image',
      label: 'Image preview',
      canOpenPreview: true,
      canEdit: false,
    }
  }

  if (mime === 'application/json' || ext === 'json') {
    return {
      kind: 'json',
      icon: 'json',
      label: 'JSON editor',
      canOpenPreview: true,
      canEdit: true,
    }
  }

  if (
    mime === 'application/x-yaml' ||
    mime === 'application/yaml' ||
    mime === 'text/yaml' ||
    ['yaml', 'yml'].includes(ext)
  ) {
    return {
      kind: 'yaml',
      icon: 'yaml',
      label: 'YAML editor',
      canOpenPreview: true,
      canEdit: true,
    }
  }

  if (mime === 'text/csv' || ext === 'csv') {
    return {
      kind: 'csv',
      icon: 'table',
      label: 'CSV editor',
      canOpenPreview: true,
      canEdit: true,
      delimiter: ',',
    }
  }

  if (mime === 'text/tab-separated-values' || ext === 'tsv') {
    return {
      kind: 'tsv',
      icon: 'table',
      label: 'TSV editor',
      canOpenPreview: true,
      canEdit: true,
      delimiter: '\t',
    }
  }

  if (
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    ['xls', 'xlsx'].includes(ext)
  ) {
    return {
      kind: 'excel',
      icon: 'table',
      label: 'Excel workbook',
      canOpenPreview: false,
      canEdit: false,
    }
  }

  if (ext === 'log') {
    return {
      kind: 'log',
      icon: 'log',
      label: 'Log viewer',
      canOpenPreview: true,
      canEdit: false,
    }
  }

  if (
    mime.startsWith('text/') ||
    ['txt', 'md', 'cfg', 'ini', 'conf', 'xml', 'html', 'css', 'js', 'ts'].includes(ext)
  ) {
    return {
      kind: 'text',
      icon: 'text',
      label: 'Text editor',
      canOpenPreview: true,
      canEdit: true,
    }
  }

  if (isLikelyBinaryMime(mime) || ['bin', 'dat', 'exe', 'so', 'dylib'].includes(ext)) {
    return {
      kind: 'binary',
      icon: 'binary',
      label: 'Binary file',
      canOpenPreview: false,
      canEdit: false,
    }
  }

  return {
    kind: 'document',
    icon: 'document',
    label: 'Document',
    canOpenPreview: false,
    canEdit: false,
  }
}

function parseDelimitedLine(line: string, delimiter: ',' | '\t') {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      const nextChar = line[i + 1]
      if (inQuotes && nextChar === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }

    current += char
  }

  cells.push(current)
  return cells
}

export function parseDelimitedContent(text: string, delimiter: ',' | '\t') {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  if (lines.length === 1 && lines[0] === '') {
    return [['']]
  }

  return lines.map((line) => parseDelimitedLine(line, delimiter))
}

function escapeDelimitedCell(value: string, delimiter: ',' | '\t') {
  const needsQuotes = value.includes(delimiter) || value.includes('"') || value.includes('\n')
  if (!needsQuotes) {
    return value
  }

  return `"${value.replaceAll('"', '""')}"`
}

export function serializeDelimitedContent(rows: string[][], delimiter: ',' | '\t') {
  return rows
    .map((row) => row.map((cell) => escapeDelimitedCell(cell, delimiter)).join(delimiter))
    .join('\n')
}
