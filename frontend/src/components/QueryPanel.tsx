import type { ChartPayload, QueryResponse } from '../api'
import { useEffect, useRef, useState } from 'react'
import { runQuery } from '../api'

interface QueryPanelProps {
  fileId: string
  sheet: string
  onQueryComplete: (
    result: QueryResponse,
    prompt: string,
    text: string,
    chart: ChartPayload | null,
  ) => void
  initialPrompt?: string
}

export function QueryPanel({ fileId, sheet, onQueryComplete, initialPrompt }: QueryPanelProps) {
  const [prompt, setPrompt] = useState(initialPrompt ?? '')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const answerRef = useRef<HTMLDivElement>(null)

  // Pre-fill when parent passes a history entry's prompt
  useEffect(() => {
    if (initialPrompt !== undefined) {
      setPrompt(initialPrompt)
    }
  }, [initialPrompt])

  // Elapsed time counter while loading
  useEffect(() => {
    if (!loading) {
      setElapsed(0)
      return
    }
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(timer)
  }, [loading])

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [prompt])

  const controllerRef = useRef<AbortController | null>(null)

  async function handleSubmit() {
    if (!prompt.trim() || !fileId || !sheet) return

    // Cancel any in-flight query
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const result = await runQuery({ file_id: fileId, sheet, prompt: prompt.trim() }, controller.signal)
      if (controller.signal.aborted) return
      setAnswer(result.text)
      onQueryComplete(result, prompt.trim(), result.text, result.chart)
      setTimeout(() => answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Query failed.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void handleSubmit()
    }
  }

  const canSubmit = prompt.trim().length > 0 && !!fileId && !!sheet && !loading

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[56px] overflow-hidden"
          placeholder={
            fileId ? 'Ask a question about your data… (Ctrl+Enter to submit)' : 'Upload a file first.'
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!fileId || !sheet || loading}
          rows={2}
        />
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {loading ? (
            <span className="flex items-center gap-1">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {elapsed > 0 ? `Thinking… ${elapsed}s` : 'Thinking…'}
            </span>
          ) : (
            'Ask AI'
          )}
        </button>
      </div>

      {/* Suggested prompts — shown when no answer yet and file is selected */}
      {answer === null && !loading && fileId && sheet && !prompt.trim() && (
        <div className="flex flex-wrap gap-2">
          {['Summarize this dataset', 'How many rows and columns?', 'Show column statistics', 'Plot a distribution chart'].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setPrompt(suggestion)}
              className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {answer !== null && !loading && (
        <div ref={answerRef} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">{answer}</pre>
        </div>
      )}
    </div>
  )
}
