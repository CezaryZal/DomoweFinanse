import { CheckCircle2, X } from 'lucide-react'
import type { Feedback } from '../../types'

export function FeedbackBanner({ feedback, error, onDismiss }: { feedback: Feedback | null; error: string; onDismiss: () => void }) {
  if (!feedback && !error) return null

  const message = error || feedback?.message
  const type = error ? 'error' : 'success'
  return <div className={`feedback-banner ${type}`} role="alert" aria-live="polite">
    {type === 'success' && <CheckCircle2 size={17} />}
    <span>{message}</span>
    <button className="icon-button" onClick={onDismiss} aria-label="Zamknij komunikat"><X size={16} /></button>
  </div>
}
