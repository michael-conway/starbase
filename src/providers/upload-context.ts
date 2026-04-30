import { createContext, useContext } from 'react'

export interface UploadTargetOptions {
  targetPath: string
  targetLabel?: string
  targetFileName?: string
  overwriteDefault?: boolean
  allowMultiple?: boolean
}

export interface UploadManagerContextValue {
  requestFilesUpload: (files: File[], options: UploadTargetOptions) => void
  openFilePicker: (options: UploadTargetOptions) => void
}

export const UploadManagerContext = createContext<UploadManagerContextValue | null>(null)

export function useUploadManager() {
  const context = useContext(UploadManagerContext)

  if (!context) {
    throw new Error('useUploadManager must be used within an UploadProvider')
  }

  return context
}
