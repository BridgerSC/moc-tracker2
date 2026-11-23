import { X } from 'lucide-react'
import { useEffect } from 'react'
import { uiStore, useUi } from '../store/uiStore'

/** Short-lived status messages (saved, imported, view only…) at the bottom of the screen. */
export function Toast() {
  const notice = useUi((s) => s.notice)

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => uiStore.getState().setNotice(null), 6000)
    return () => clearTimeout(id)
  }, [notice])

  if (!notice) return null
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[180] flex max-w-[min(560px,calc(100vw-32px))] -translate-x-1/2 items-center gap-3 rounded-lg bg-ink py-2.5 pr-2.5 pl-4 text-[13px] text-white shadow-pop"
    >
      <span>{notice}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => uiStore.getState().setNotice(null)}
        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
      >
        <X size={14} />
      </button>
    </div>
  )
}
