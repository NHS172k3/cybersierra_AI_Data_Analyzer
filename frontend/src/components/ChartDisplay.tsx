import Plot from 'react-plotly.js'
import type { ChartPayload } from '../api'

interface ChartDisplayProps {
  chart: ChartPayload | null
}

export function ChartDisplay({ chart }: ChartDisplayProps) {
  const plotlySpec = chart?.plotly_json
  if (!plotlySpec || typeof plotlySpec !== 'object') return null

  const data = Array.isArray((plotlySpec as { data?: unknown[] }).data)
    ? (plotlySpec as { data: unknown[] }).data
    : []
  const layout = typeof (plotlySpec as { layout?: unknown }).layout === 'object'
    ? (plotlySpec as { layout?: Record<string, unknown> }).layout
    : {}

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Interactive Chart</p>
      </div>
      <Plot
        data={data as never[]}
        layout={{ autosize: true, margin: { t: 36, r: 20, b: 48, l: 56 }, ...layout }}
        useResizeHandler
        style={{ width: '100%', height: '420px' }}
        config={{ responsive: true, displaylogo: false }}
      />
    </div>
  )
}
