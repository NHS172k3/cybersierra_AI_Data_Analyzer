import { useEffect, useRef, useState } from 'react'
import { getPreview, PreviewResponse } from '../api'

interface DataPreviewProps {
  fileId: string
  sheet: string
  n: number
}

export function DataPreview({ fileId, sheet, n }: DataPreviewProps) {
  const [data, setData] = useState<PreviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!fileId || !sheet) {
      setData(null)
      return
    }

    const controller = new AbortController()

    // Debounce N changes (e.g. typing in the input) to avoid a request per keystroke
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await getPreview(fileId, sheet, n, controller.signal)
        setData(result)
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load preview.')
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      controller.abort()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [fileId, sheet, n])

  if (!fileId || !sheet) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        Select a file and sheet to preview data.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-200 rounded" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-red-600 text-sm">{error}</p>
  }

  if (!data || data.rows.length === 0) {
    return <p className="text-gray-400 text-sm">No data to display.</p>
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">
        Showing {data.rows.length} row(s) · {data.columns.length} column(s)
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {data.columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2 text-left font-semibold text-gray-700 whitespace-nowrap border-b border-gray-200"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {data.columns.map((col) => (
                  <td
                    key={col}
                    className="px-4 py-2 text-gray-600 whitespace-nowrap border-b border-gray-100"
                  >
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
