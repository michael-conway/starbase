import {
  IconBinaryTree2,
  IconBraces,
  IconCode,
  IconFile,
  IconFileText,
  IconPhoto,
  IconTable,
} from '@tabler/icons-react'
import type { PreviewIconKey } from './file-preview'

export function FilePreviewGlyph({ icon, size = 28 }: { icon: PreviewIconKey; size?: number }) {
  switch (icon) {
    case 'image':
      return <IconPhoto size={size} />
    case 'table':
      return <IconTable size={size} />
    case 'json':
      return <IconBraces size={size} />
    case 'yaml':
      return <IconCode size={size} />
    case 'text':
      return <IconFileText size={size} />
    case 'log':
      return <IconFileText size={size} />
    case 'binary':
      return <IconBinaryTree2 size={size} />
    default:
      return <IconFile size={size} />
  }
}
