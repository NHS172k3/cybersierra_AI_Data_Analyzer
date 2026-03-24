import { useCallback, useEffect, useState } from 'react'
import { deleteFile as apiDeleteFile, listFiles, uploadFiles as apiUploadFiles, UploadedFile } from '../api'

interface UseFilesReturn {
  files: UploadedFile[]
  isUploading: boolean
  uploadError: string | null
  uploadFiles: (rawFiles: File[]) => Promise<UploadedFile[]>
  deleteFile: (fileId: string) => Promise<void>
  refreshFiles: () => Promise<void>
}

export function useFiles(): UseFilesReturn {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const refreshFiles = useCallback(async () => {
    try {
      const data = await listFiles()
      setFiles(data.files)
    } catch {
      // Silently fail on list refresh — the registry may be empty after a restart
    }
  }, [])

  useEffect(() => {
    void refreshFiles()
  }, [refreshFiles])

  const uploadFiles = useCallback(async (rawFiles: File[]): Promise<UploadedFile[]> => {
    setIsUploading(true)
    setUploadError(null)
    try {
      const data = await apiUploadFiles(rawFiles)
      setFiles((prev) => {
        const existingIds = new Set(prev.map((f) => f.file_id))
        const newFiles = data.files.filter((f) => !existingIds.has(f.file_id))
        return [...prev, ...newFiles]
      })
      return data.files
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.')
      return []
    } finally {
      setIsUploading(false)
    }
  }, [])

  const deleteFile = useCallback(async (fileId: string) => {
    try {
      await apiDeleteFile(fileId)
      setFiles((prev) => prev.filter((f) => f.file_id !== fileId))
    } catch {
      // Silently fail — file may already be gone
    }
  }, [])

  return { files, isUploading, uploadError, uploadFiles, deleteFile, refreshFiles }
}
