import { useEffect, useState } from 'react'
import { patchPromptFeedback } from '../api'

interface FeedbackButtonsProps {
  promptId: string
  historyEntryId: string
  onFeedback: (historyEntryId: string, feedback: 'thumbs_up' | 'thumbs_down') => void
}

export function FeedbackButtons({ promptId, historyEntryId, onFeedback }: FeedbackButtonsProps) {
  const [rating, setRating] = useState<'thumbs_up' | 'thumbs_down' | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  // Reset when a new query comes in
  useEffect(() => {
    setRating(null)
    setSubmitted(false)
  }, [promptId])

  async function handleRate(r: 'thumbs_up' | 'thumbs_down') {
    if (submitted || loading) return
    setLoading(true)
    try {
      await patchPromptFeedback(promptId, { feedback: r })
      setRating(r)
      setSubmitted(true)
      onFeedback(historyEntryId, r)
    } catch {
      // Non-critical — don't block the user
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">Was this helpful?</span>
      <button
        onClick={() => handleRate('thumbs_up')}
        disabled={submitted || loading}
        title="Thumbs up"
        className={`text-xl transition-all disabled:cursor-default ${
          rating === 'thumbs_up'
            ? 'text-green-500 scale-110'
            : 'text-gray-300 hover:text-green-400 disabled:hover:text-gray-300'
        }`}
      >
        👍
      </button>
      <button
        onClick={() => handleRate('thumbs_down')}
        disabled={submitted || loading}
        title="Thumbs down"
        className={`text-xl transition-all disabled:cursor-default ${
          rating === 'thumbs_down'
            ? 'text-red-500 scale-110'
            : 'text-gray-300 hover:text-red-400 disabled:hover:text-gray-300'
        }`}
      >
        👎
      </button>
      {submitted && (
        <span className="text-xs text-gray-400 ml-1">Thanks for your feedback!</span>
      )}
    </div>
  )
}
