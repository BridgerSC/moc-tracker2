import { KeyRound, X } from 'lucide-react'
import { useState } from 'react'
import { LIVE_GIST_ID, closeAccess, connect, forgetKey, setUsername, syncStore, useSync } from '../sync/syncState'
import { btn, dialog, fieldLabel, iconBtn, input } from '../ui/styles'

function AccessForm() {
  const saved = syncStore.getState()
  const [key, setKey] = useState('')
  const [gistId, setGistId] = useState(saved.gistId)
  const [name, setName] = useState(saved.username)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const hasKey = useSync((s) => s.token !== null)
  const isLive = gistId.trim() === LIVE_GIST_ID

  const submit = async () => {
    const token = key.trim() || saved.token
    if (!token) return setError('Paste the team key first.')
    setUsername(name.trim())
    setBusy(true)
    setError(await connect(token, gistId.trim() || LIVE_GIST_ID))
    setBusy(false)
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <p className="m-0 text-[13px] leading-relaxed text-ink-muted">
        The timeline is shared through a GitHub Gist. Anyone can view it; to make changes, enter the team key (a GitHub
        token from the Gist’s owner with Gist access). It’s kept only in this browser.
      </p>
      <label>
        <span className={fieldLabel}>Team key{hasKey && <span className="font-normal text-ink-subtle"> · saved on this device; leave empty to keep it</span>}</span>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={hasKey ? '••••••••••••' : 'github_pat_… or ghp_…'}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className={input}
        />
      </label>
      <label>
        <span className={fieldLabel}>Your name <span className="font-normal text-ink-subtle">· shown as “saved by”</span></span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Allen" className={input} />
      </label>
      <label>
        <span className={fieldLabel}>
          Gist ID{' '}
          <span className={`font-normal ${isLive ? 'text-ink-subtle' : 'text-warn-ink'}`}>
            · {isLive ? 'the live team timeline' : 'not the live one (testing on a copy)'}
          </span>
        </span>
        <input value={gistId} onChange={(e) => setGistId(e.target.value)} spellCheck={false} className={`${input} font-mono text-[12px]`} />
      </label>
      {error && <div className="rounded-md bg-danger-soft px-3 py-2 text-[12px] text-danger">{error}</div>}
      <div className="mt-1 flex flex-wrap justify-end gap-2">
        {hasKey && (
          <button
            type="button"
            onClick={() => {
              forgetKey()
              closeAccess()
            }}
            className={`${btn('danger')} mr-auto`}
          >
            Remove key
          </button>
        )}
        <button type="button" className={btn('secondary')} onClick={closeAccess}>
          Cancel
        </button>
        <button type="submit" disabled={busy} className={btn('primary')}>
          {busy ? 'Checking…' : 'Verify & connect'}
        </button>
      </div>
    </form>
  )
}

export function AccessDialog() {
  const open = useSync((s) => s.accessOpen)
  if (!open) return null
  return (
    <div className={`${dialog.backdrop} z-[120]`} onClick={closeAccess}>
      <div
        role="dialog"
        aria-label="Team access"
        className={`${dialog.panel} max-w-md`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && closeAccess()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
              <KeyRound size={17} />
            </div>
            <h2 className={dialog.title}>Team access</h2>
          </div>
          <button type="button" aria-label="Close" onClick={closeAccess} className={iconBtn}>
            <X size={16} />
          </button>
        </div>
        <AccessForm />
      </div>
    </div>
  )
}
