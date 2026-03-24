import { useState } from 'react'
import { HistoryEntry } from '../hooks/usePromptHistory'

interface PromptHistoryProps {
  history: HistoryEntry[]
  onSelectEntry: (entry: HistoryEntry) => void
  onClearHistory: () => void
}

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function getGroup(isoString: string): 'Today' | 'Yesterday' | 'Older' {
  const date = new Date(isoString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date >= today) return 'Today'
  if (date >= yesterday) return 'Yesterday'
  return 'Older'
}

export function PromptHistory({ history, onSelectEntry, onClearHistory }: PromptHistoryProps) {
  const [confirmClear, setConfirmClear] = useState(false)
  const [search, setSearch] = useState('')

  if (history.length === 0) {
    return (
      <div className="text-xs text-gray-400 text-center py-4">No prompt history yet.</div>
    )
  }

  const filtered = search.trim()
    ? history.filter((e) => e.prompt.toLowerCase().includes(search.toLowerCase()))
    : history

  const groups: { label: string; entries: HistoryEntry[] }[] = [
    { label: 'Today', entries: filtered.filter((e) => getGroup(e.timestamp) === 'Today') },
    { label: 'Yesterday', entries: filtered.filter((e) => getGroup(e.timestamp) === 'Yesterday') },
    { label: 'Older', entries: filtered.filter((e) => getGroup(e.timestamp) === 'Older') },
  ].filter((g) => g.entries.length > 0)

  return (
    <div className="flex flex-col gap-2">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search history…"
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />

      {/* Clear history */}
      <div className="flex justify-end">
        {confirmClear ? (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">Clear all?</span>
            <button
              onClick={() => { onClearHistory(); setConfirmClear(false) }}
              className="text-red-600 font-medium hover:underline"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="text-gray-400 hover:underline"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Clear history
          </button>
        )}
      </div>

      {/* Grouped entries */}
      {groups.map((group) => (
        <div key={group.label}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            {group.label}
          </p>
          <ul className="space-y-1">
            {group.entries.map((entry) => (
              <li key={entry.id}>
                <button
                  onClick={() => onSelectEntry(entry)}
                  className="w-full text-left rounded-lg px-3 py-2 hover:bg-blue-50 transition-colors group"
                >
                  <p className="text-sm text-gray-700 truncate group-hover:text-blue-700">
                    {entry.prompt.length > 60
                      ? entry.prompt.slice(0, 60) + '…'
                      : entry.prompt}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {formatRelativeDate(entry.timestamp)}
                    </span>
                    {entry.chart && (
                      <span className="text-xs bg-purple-100 text-purple-600 px-1 rounded">
                        chart
                      </span>
                    )}
                    {entry.feedback === 'thumbs_up' && (
                      <span className="text-xs text-green-500">👍</span>
                    )}
                    {entry.feedback === 'thumbs_down' && (
                      <span className="text-xs text-red-500">👎</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
