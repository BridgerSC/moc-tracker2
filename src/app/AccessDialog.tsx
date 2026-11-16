import { KeyRound, X } from 'lucide-react'
import { useState } from 'react'
import { inputClass } from '../panels/fields'
import { LIVE_GIST_ID, closeAccess, connect, forgetKey, setUsername, syncStore, useSync } from '../sync/syncState'

function AccessForm() {
  const saved = syncStore.getState()
  const [key, setKey] = useState('')
  const [gistId, setGistId] = useState(saved.gistId)
  const [name, setName] = useState(saved.username)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const hasKey = useSync((s) => s.token !== null)

  const submit = async () => {
    const token = key.trim() || saved.token
    if (!token) return setError('Paste the team key first.')
    setUsername(name.trim())
    setBusy(true)
    setError(await connect(token, gistId.trim() || LIVE_GIST_ID))
    setBusy(false)
  }

  const label = 'mb-1.5 block font-poppins text-[9px] tracking-[1.5px] text-[#777] uppercase'

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <p className="m-0 font-poppins text-[12px] leading-relaxed text-[#aaa]">
        The timeline is shared through a GitHub Gist. Anyone can view it; to make changes, enter the team key (a
        GitHub token from the Gist’s owner with Gist access). It is kept only in this browser.
      </p>
      <label>
        <span className={label}>Team key {hasKey && '(one is saved on this device; leave empty to keep it)'}</span>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={hasKey ? '••••••••••••' : 'github_pat_… or ghp_…'}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className={inputClass}
        />
      </label>
      <label>
        <span className={label}>Your name (shown as “saved by”)</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Allen" className={inputClass} />
      </label>
      <label>
        <span className={label}>
          Gist ID {gistId.trim() === LIVE_GIST_ID ? '(the live team timeline)' : '(not the live one: testing on a copy)'}
        </span>
        <input value={gistId} onChange={(e) => setGistId(e.target.value)} spellCheck={false} className={`${inputClass} font-mono`} />
      </label>
      {error && <div className="font-poppins text-[11px] text-[#EF476F]">{error}</div>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 border border-[#06D6A0] bg-[#06D6A0] py-2 font-poppins text-[11px] font-semibold tracking-[1px] text-[#0e0e0e] uppercase hover:brightness-110 disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Verify & connect'}
        </button>
        {hasKey && (
          <button
            type="button"
            onClick={() => {
              forgetKey()
              closeAccess()
            }}
            className="border border-[#3a1a1a] px-3 py-2 font-poppins text-[11px] tracking-[1px] text-[#c05050] uppercase hover:border-[#e05050] hover:text-[#e05050]"
          >
            Remove key
          </button>
        )}
      </div>
    </form>
  )
}

export function AccessDialog() {
  const open = useSync((s) => s.accessOpen)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={closeAccess}>
      <div
        role="dialog"
        aria-label="Team access"
        className="w-full max-w-md border border-[#2a2a2a] bg-[#111] p-6 shadow-[8px_8px_0_#06D6A0]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && closeAccess()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bebas text-2xl tracking-[2px] text-[#06D6A0]">
            <KeyRound size={20} /> Team access
          </div>
          <button type="button" aria-label="Close" onClick={closeAccess} className="text-[#666] hover:text-white">
            <X size={16} />
          </button>
        </div>
        <AccessForm />
      </div>
    </div>
  )
}
