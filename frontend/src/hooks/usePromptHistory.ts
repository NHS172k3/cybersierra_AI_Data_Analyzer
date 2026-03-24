import { useCallback, useEffect, useState } from 'react'
import type { ChartPayload } from '../api'

const STORAGE_KEY = 'prompt_history'
const MAX_HISTORY_ENTRIES = 100

export interface HistoryEntry {
  id: string
  prompt_id: string
  type: 'viz' | 'text' | 'both'
  prompt: string
  file_id: string
  sheet: string
  timestamp: string // ISO 8601
  text: string
  chart: ChartPayload | null
  feedback: 'thumbs_up' | 'thumbs_down' | null
}

interface UsePromptHistoryReturn {
  history: HistoryEntry[]
  addEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void
  updateFeedback: (id: string, feedback: 'thumbs_up' | 'thumbs_down') => void
  clearHistory: () => void
}

function normalizeHistoryEntry(entry: unknown): HistoryEntry | null {
  if (!entry || typeof entry !== 'object') return null
  const value = entry as Record<string, unknown>
  const prompt = typeof value.prompt === 'string' ? value.prompt : ''
  const fileId = typeof value.file_id === 'string' ? value.file_id : ''
  const sheet = typeof value.sheet === 'string' ? value.sheet : ''
  const timestamp = typeof value.timestamp === 'string' ? value.timestamp : new Date().toISOString()
  const id = typeof value.id === 'string' ? value.id : crypto.randomUUID()
  const promptId = typeof value.prompt_id === 'string' ? value.prompt_id : id

  const rawType = value.type
  const type: 'viz' | 'text' | 'both' = rawType === 'viz' || rawType === 'both' ? rawType : 'text'

  const text = typeof value.text === 'string'
    ? value.text
    : typeof value.response === 'string'
      ? value.response
      : ''

  const chart = value.chart && typeof value.chart === 'object' && 'plotly_json' in value.chart
    ? (value.chart as ChartPayload)
    : null

  const rawFeedback = value.feedback
  let feedback: 'thumbs_up' | 'thumbs_down' | null = null
  if (rawFeedback === 'thumbs_up' || rawFeedback === 'thumbs_down') {
    feedback = rawFeedback
  } else if (rawFeedback === 'up') {
    feedback = 'thumbs_up'
  } else if (rawFeedback === 'down') {
    feedback = 'thumbs_down'
  }

  if (!prompt || !fileId || !sheet) return null

  return {
    id,
    prompt_id: promptId,
    type,
    prompt,
    file_id: fileId,
    sheet,
    timestamp,
    text,
    chart,
    feedback,
  }
}

function loadFromStorage(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeHistoryEntry)
      .filter((entry): entry is HistoryEntry => entry !== null)
  } catch {
    // Malformed JSON — reset silently
    return []
  }
}

export function usePromptHistory(): UsePromptHistoryReturn {
  const [history, setHistory] = useState<HistoryEntry[]>(loadFromStorage)

  // Persist to localStorage whenever history changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  }, [history])

  const addEntry = useCallback((entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: HistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }
    setHistory((prev) => [newEntry, ...prev].slice(0, MAX_HISTORY_ENTRIES))
  }, [])

  const updateFeedback = useCallback((id: string, feedback: 'thumbs_up' | 'thumbs_down') => {
    setHistory((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, feedback } : entry)),
    )
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { history, addEntry, updateFeedback, clearHistory }
}
