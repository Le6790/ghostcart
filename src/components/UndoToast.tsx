import { useEffect } from 'react'

/** A short-lived message with an Undo action. Dismisses itself after `durationMs`. */
export function UndoToast({
  message,
  onUndo,
  onDismiss,
  durationMs = 8000,
}: {
  message: string
  onUndo: () => void
  onDismiss: () => void
  durationMs?: number
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs)
    return () => clearTimeout(t)
  }, [message, durationMs, onDismiss])

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg bg-slate-800 dark:bg-slate-700 px-4 py-3 text-sm text-white shadow-lg"
    >
      <span>{message}</span>
      <span className="flex items-center gap-3">
        <button className="font-semibold text-emerald-300 underline" onClick={onUndo}>
          Undo
        </button>
        <button className="text-slate-300" aria-label="Dismiss" onClick={onDismiss}>
          ✕
        </button>
      </span>
    </div>
  )
}
