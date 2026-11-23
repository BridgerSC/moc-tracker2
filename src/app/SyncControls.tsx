import { CloudUpload, KeyRound, Lock, RefreshCw, TriangleAlert } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { openAccess, pull, push, useHasUnsavedChanges, useSync } from '../sync/syncState'
import { btn, iconBtn } from '../ui/styles'

const shortTime = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/** Shared-timeline status plus Refresh / Upload / team-access buttons. */
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
  else label = `Saved ${shortTime(base.savedAt)}${base.savedBy ? ` by ${base.savedBy}` : ''}`

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? (
        <span title={error} className="flex max-w-[280px] items-center gap-1.5 text-[12px] text-danger">
          <TriangleAlert size={13} className="shrink-0" />
          <span className="truncate">{error}</span>
        </span>
      ) : (
        <span
          title={base?.savedAt ? `${new Date(base.savedAt).toLocaleString()}${base.rev ? ` · version ${base.rev}` : ''}` : undefined}
          className="flex items-center gap-2 text-[12px] text-ink-subtle"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${unsaved && token ? 'bg-warn' : 'bg-ok'}`} />
          {label}
        </span>
      )}
      {unsaved && token && (
        <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn-ink">Unsaved changes</span>
      )}

      <button
        type="button"
        className={iconBtn}
        title="Check for a newer shared version"
        aria-label="Refresh"
        disabled={busy}
        onClick={() => void pull({ manual: true })}
      >
        <RefreshCw size={15} className={status === 'loading' ? 'animate-spin' : ''} />
      </button>

      {token ? (
        <>
          <button
            type="button"
            className={btn('primary')}
            title={unsaved ? 'Save your changes to the shared timeline' : 'Nothing to upload'}
            disabled={busy || !unsaved}
            onClick={() => void push()}
          >
            <CloudUpload size={15} /> {status === 'saving' ? 'Saving…' : 'Upload'}
          </button>
          <button type="button" className={`${iconBtn} text-ok`} title="Team access (key, name, Gist)" aria-label="Team access" onClick={openAccess}>
            <KeyRound size={15} />
          </button>
        </>
      ) : (
        <button type="button" className={btn('secondary')} title="View only. Add the team key to edit." onClick={openAccess}>
          <Lock size={14} className="text-warn" /> View only
        </button>
      )}
    </div>
  )
}
