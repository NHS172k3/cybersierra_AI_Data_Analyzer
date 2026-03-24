import { DragEvent, useRef, useState } from 'react'
import { UploadedFile } from '../api'

const ALLOWED_EXTENSIONS = ['.csv', '.xls', '.xlsx']

interface FileUploadProps {
  onUploadComplete: (files: UploadedFile[]) => void
  uploadFiles: (files: File[]) => Promise<UploadedFile[]>
  isUploading: boolean
  uploadError: string | null
}

function validateExtension(file: File): boolean {
  const name = file.name.toLowerCase()
  return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

export function FileUpload({
  onUploadComplete,
  uploadFiles,
  isUploading,
  uploadError,
}: FileUploadProps) {
  const [stagedFiles, setStagedFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function stageFiles(files: File[]) {
    const valid = files.filter(validateExtension)
    const invalid = files.filter((f) => !validateExtension(f))
    if (invalid.length > 0) {
      setValidationError(
        `Skipped ${invalid.length} unsupported file(s): ${invalid.map((f) => f.name).join(', ')}. Only .csv, .xls, .xlsx are accepted.`,
      )
    } else {
      setValidationError(null)
    }
    setStagedFiles((prev) => [...prev, ...valid])
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    stageFiles(Array.from(e.dataTransfer.files))
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      stageFiles(Array.from(e.target.files))
    }
  }

  async function handleUpload() {
    if (stagedFiles.length === 0) return
    const result = await uploadFiles(stagedFiles)
    if (result.length > 0) {
      setStagedFiles([])
      setSuccessMessage(`Uploaded ${result.length} file(s) successfully!`)
      setTimeout(() => setSuccessMessage(null), 3000)
      onUploadComplete(result)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
      >
        <p className="text-sm text-gray-500">
          {isUploading ? (
            <span className="text-blue-600 font-medium">Uploading…</span>
          ) : (
            <>
              <span className="font-medium text-blue-600">Click to browse</span> or drag & drop
              <br />
              <span className="text-xs">.csv, .xls, .xlsx · max 50 MB each</span>
            </>
          )}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xls,.xlsx"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {/* Staged files list */}
      {stagedFiles.length > 0 && (
        <ul className="text-sm text-gray-700 space-y-1">
          {stagedFiles.map((f, i) => (
            <li key={i} className="flex justify-between items-center bg-gray-100 rounded px-3 py-1">
              <span className="truncate max-w-[160px]" title={f.name}>
                {f.name}
              </span>
              <span className="text-gray-400 text-xs ml-2">
                {(f.size / 1024).toFixed(0)} KB
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Success / Errors */}
      {successMessage && <p className="text-xs text-green-600 font-medium">{successMessage}</p>}
      {(validationError || uploadError) && (
        <p className="text-xs text-red-600">{validationError || uploadError}</p>
      )}

      {/* Upload button */}
      {stagedFiles.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isUploading ? 'Uploading…' : `Upload ${stagedFiles.length} file(s)`}
        </button>
      )}
    </div>
  )
}
