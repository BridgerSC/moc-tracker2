import { CloudUpload, KeyRound, Lock, RefreshCw, TriangleAlert } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { openAccess, pull, push, useHasUnsavedChanges, useSync } from '../sync/syncState'

const timeAgo = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/** Shared-timeline status plus Refresh / Upload / key buttons. */
export function SyncControls() {
  const { token, status, error, base } = useSync(
    useShallow((s) => ({ token: s.token, status: s.status, error: s.error, base: s.base })),
  )
  const unsaved = useHasUnsavedChanges()
  const busy = status !== 'idle'

  let label: string
  if (status === 'loading') label = 'Checking…'
  else if (status === 'saving') label = 'Saving…'
  else if (!base) label = 'Not synced yet'
  else label = `${base.rev > 0 ? `v${base.rev} · ` : ''}saved ${timeAgo(base.savedAt)}${base.savedBy ? ` by ${base.savedBy}` : ''}`

  return (
    <div className="flex items-center gap-1.5">
      <div className="mr-1 flex max-w-[260px] flex-col items-end font-poppins leading-tight">
        {error ? (
          <span className="flex items-center gap-1 truncate text-[10px] text-[#EF476F]" title={error}>
            <TriangleAlert size={11} className="shrink-0" /> <span className="truncate">{error}</span>
          </span>
        ) : (
          <span className="truncate text-[10px] text-[#777]" title={base?.savedAt ? new Date(base.savedAt).toLocaleString() : undefined}>
            {label}
          </span>
        )}
        {unsaved && token && <span className="text-[10px] text-[#e0a040]">● Unsaved changes</span>}
      </div>

      <button
        type="button"
        title="Check for a newer shared version"
        aria-label="Refresh"
        disabled={busy}
        onClick={() => void pull({ manual: true })}
        className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-[#2a2a2a] bg-[#161616] text-[#aaa] hover:border-[#555] hover:text-white disabled:opacity-40"
      >
        <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} />
      </button>

      {token ? (
        <>
          <button
            type="button"
            title={unsaved ? 'Save your changes to the shared timeline' : 'Nothing to upload'}
            disabled={busy || !unsaved}
            onClick={() => void push()}
            className="flex h-8 items-center gap-1.5 rounded-[3px] border border-[#06D6A0] bg-[#06D6A0]/10 px-3 font-poppins text-[10px] font-semibold tracking-[1px] text-[#06D6A0] uppercase hover:bg-[#06D6A0]/20 disabled:border-[#2a2a2a] disabled:bg-transparent disabled:text-[#555]"
          >
            <CloudUpload size={14} /> {status === 'saving' ? 'Saving' : 'Upload'}
          </button>
          <button
            type="button"
            title="Team access (key, name, Gist)"
            aria-label="Team access"
            onClick={openAccess}
            className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-[#2a2a2a] bg-[#161616] text-[#06D6A0] hover:border-[#555]"
          >
            <KeyRound size={14} />
          </button>
        </>
      ) : (
        <button
          type="button"
          title="View only. Add the team key to edit."
          onClick={openAccess}
          className="flex h-8 items-center gap-1.5 rounded-[3px] border border-[#e0a040]/50 px-3 font-poppins text-[10px] tracking-[1px] text-[#e0a040] uppercase hover:bg-[#e0a040]/10"
        >
          <Lock size={13} /> View only
        </button>
      )}
    </div>
  )
}
