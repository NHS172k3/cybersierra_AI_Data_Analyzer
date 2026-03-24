import { useEffect, useState } from 'react'
import { ChartPayload, QueryResponse, UploadedFile } from './api'
import { ChartDisplay } from './components/ChartDisplay'
import { DataPreview } from './components/DataPreview'
import { FeedbackButtons } from './components/FeedbackButtons'
import { FileUpload } from './components/FileUpload'
import { PromptHistory } from './components/PromptHistory'
import { QueryPanel } from './components/QueryPanel'
import { useFiles } from './hooks/useFiles'
import { HistoryEntry, usePromptHistory } from './hooks/usePromptHistory'

export default function App() {
  const { files, isUploading, uploadError, uploadFiles, deleteFile } = useFiles()
  const { history, addEntry, updateFeedback, clearHistory } = usePromptHistory()

  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null)
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null)
  const [previewRows, setPreviewRows] = useState(10)
  const [lastPromptId, setLastPromptId] = useState<string | null>(null)
  const [lastHistoryId, setLastHistoryId] = useState<string | null>(null)
  const [lastChart, setLastChart] = useState<ChartPayload | null>(null)
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(undefined)

  function handleUploadComplete(newFiles: UploadedFile[]) {
    // Auto-select the first uploaded file if none is selected
    if (!selectedFile && newFiles.length > 0) {
      setSelectedFile(newFiles[0])
      setSelectedSheet(newFiles[0].sheets[0] ?? null)
    }
  }

  function handleFileSelect(file: UploadedFile) {
    setSelectedFile(file)
    setSelectedSheet(file.sheets[0] ?? null)
    setLastPromptId(null)
    setLastChart(null)
  }

  function handleSheetSelect(sheet: string) {
    setSelectedSheet(sheet)
    setLastPromptId(null)
    setLastChart(null)
  }

  function handleQueryComplete(
    result: QueryResponse,
    prompt: string,
    text: string,
    chart: ChartPayload | null,
  ) {
    setLastPromptId(result.prompt_id)
    setLastChart(chart)

    if (!selectedFile || !selectedSheet) return

    // Add to prompt history — also stores chart thumbnail reference
    addEntry({
      prompt_id: result.prompt_id,
      type: result.type,
      prompt,
      file_id: selectedFile.file_id,
      sheet: selectedSheet,
      text,
      chart,
      feedback: result.feedback,
    })

    // Keep track of the latest history entry id for feedback wiring
    // The newest entry is always at index 0 after addEntry
    // We'll get the id from usePromptHistory after re-render via history[0]
  }

  // When a history entry is clicked, pre-fill the query panel and select the file/sheet
  function handleSelectHistoryEntry(entry: HistoryEntry) {
    const file = files.find((f) => f.file_id === entry.file_id)
    if (file) {
      setSelectedFile(file)
      setSelectedSheet(entry.sheet)
    }
    setInitialPrompt(entry.prompt)
    setLastChart(entry.chart)
  }

  async function handleDeleteFile(fileId: string) {
    await deleteFile(fileId)
    if (selectedFile?.file_id === fileId) {
      setSelectedFile(null)
      setSelectedSheet(null)
      setLastPromptId(null)
      setLastChart(null)
    }
  }

  function handleFeedback(historyEntryId: string, feedback: 'thumbs_up' | 'thumbs_down') {
    updateFeedback(historyEntryId, feedback)
  }

  // Derive the latest history entry id for feedback wiring
  const latestHistoryId = history.length > 0 ? history[0].id : null

  // Sync lastHistoryId when history updates after a query
  useEffect(() => {
    if (lastPromptId && latestHistoryId && latestHistoryId !== lastHistoryId) {
      setLastHistoryId(latestHistoryId)
    }
  }, [lastPromptId, latestHistoryId, lastHistoryId])

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-sm">
          CS
        </div>
        <h1 className="text-lg font-semibold text-gray-800">Cyber Sierra — AI Data Explorer</h1>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Upload Files
            </h2>
            <FileUpload
              onUploadComplete={handleUploadComplete}
              uploadFiles={uploadFiles}
              isUploading={isUploading}
              uploadError={uploadError}
            />
          </div>

          {/* Uploaded files list */}
          {files.length > 0 && (
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Files
              </h2>
              <ul className="space-y-1">
                {files.map((file) => (
                  <li key={file.file_id} className="flex items-center gap-1">
                    <button
                      onClick={() => handleFileSelect(file)}
                      className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedFile?.file_id === file.file_id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="truncate block" title={file.original_filename}>
                        {file.original_filename}
                      </span>
                    </button>
                    <button
                      onClick={() => handleDeleteFile(file.file_id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                      title="Delete file"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Prompt history */}
          <div className="flex-1 p-4 overflow-y-auto">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              History
            </h2>
            <PromptHistory
              history={history}
              onSelectEntry={handleSelectHistoryEntry}
              onClearHistory={clearHistory}
            />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Sheet selector + N-row picker */}
          {selectedFile && (
            <div className="flex items-center gap-4 bg-white rounded-lg border border-gray-200 px-4 py-3">
              {/* Sheet selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500">Sheet</label>
                <select
                  value={selectedSheet ?? ''}
                  onChange={(e) => handleSheetSelect(e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {selectedFile.sheets.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* N-row picker */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500">Preview rows</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={previewRows}
                  onChange={(e) => setPreviewRows(Math.max(1, Math.min(1000, Number(e.target.value))))}
                  className="w-20 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Data preview */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Data Preview</h2>
            <DataPreview
              fileId={selectedFile?.file_id ?? ''}
              sheet={selectedSheet ?? ''}
              n={previewRows}
            />
          </div>

          {/* Query panel */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Ask AI</h2>
            <QueryPanel
              fileId={selectedFile?.file_id ?? ''}
              sheet={selectedSheet ?? ''}
              onQueryComplete={handleQueryComplete}
              initialPrompt={initialPrompt}
            />
          </div>

          {/* Chart output */}
          {lastChart && <ChartDisplay chart={lastChart} />}

          {/* Feedback */}
          {lastPromptId && lastHistoryId && (
            <FeedbackButtons
              promptId={lastPromptId}
              historyEntryId={lastHistoryId}
              onFeedback={handleFeedback}
            />
          )}
        </main>
      </div>
    </div>
  )
}
