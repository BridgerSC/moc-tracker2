import { useMemo } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { docFingerprint, isEmptyDoc } from '../model/fingerprint'
import { TimelineFileError, parseTimelineFile, serializeTimelineFile, type ReadResult } from '../model/fileFormat'
import type { SyncMeta } from '../model/types'
import { docStore } from '../store/docStore'
import { uiStore, type ConfirmState } from '../store/uiStore'
import { decidePull, decidePush, type SyncSnapshot } from './decide'
import { GistError, keyOwner, readGist, writeGist } from './gist'

// Syncing the document with the shared Gist.
//
// "Base" is the shared version this browser last loaded or saved. Comparing the
// local document with the base tells us whether there are unsaved changes;
// comparing the base with what's in the Gist tells us whether someone else saved.

/** The live team Gist. A different one (e.g. a test copy) can be set in the access dialog or via VITE_GIST_ID. */
export const LIVE_GIST_ID = 'f3b1a82c99def062fd2747eb5ddb16b8'
export const DEFAULT_GIST_ID: string = import.meta.env.VITE_GIST_ID || LIVE_GIST_ID
export const GIST_FILENAME = 'data.json'

// Same keys as v4.8 for the key and name, so people don't have to re-enter them.
const TOKEN_KEY = 'moc_github_token'
const NAME_KEY = 'moc_username'
const GIST_KEY = 'moc_gist_id'
const BASE_KEY = 'moc_sync_base_v5'

const store = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set: (key: string, value: string | null) => {
    try {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    } catch {
      // Storage unavailable: settings last for this session only.
    }
  },
}

interface SavedBase {
  meta: SyncMeta
  fingerprint: string
  gistId: string
}

function loadBase(gistId: string): SavedBase | null {
  try {
    const saved = JSON.parse(store.get(BASE_KEY) ?? 'null') as SavedBase | null
    return saved && saved.gistId === gistId ? saved : null
  } catch {
    return null
  }
}

export type SyncStatus = 'idle' | 'loading' | 'saving'

export interface SyncState {
  token: string | null
  gistId: string
  username: string
  base: SyncMeta | null
  baseFingerprint: string | null
  status: SyncStatus
  error: string | null
  lastCheckedAt: number | null
  accessOpen: boolean
}

const initialGist = store.get(GIST_KEY) || DEFAULT_GIST_ID
const initialBase = loadBase(initialGist)

export const syncStore = createStore<SyncState>()(() => ({
  token: store.get(TOKEN_KEY),
  gistId: initialGist,
  username: store.get(NAME_KEY) ?? '',
  base: initialBase?.meta ?? null,
  baseFingerprint: initialBase?.fingerprint ?? null,
  status: 'idle',
  error: null,
  lastCheckedAt: null,
  accessOpen: false,
}))

export function useSync<T>(selector: (s: SyncState) => T): T {
  return useStore(syncStore, selector)
}

const set = (patch: Partial<SyncState>) => syncStore.setState(patch)
const notice = (text: string) => uiStore.getState().setNotice(text)
const localDoc = () => docStore.getState().history.present

function setBase(meta: SyncMeta, fingerprint: string) {
  const { gistId } = syncStore.getState()
  set({ base: meta, baseFingerprint: fingerprint })
  store.set(BASE_KEY, JSON.stringify({ meta, fingerprint, gistId } satisfies SavedBase))
}

function snapshot(): SyncSnapshot {
  const s = syncStore.getState()
  const doc = localDoc()
  return { base: s.base, baseFingerprint: s.baseFingerprint, localFingerprint: docFingerprint(doc), localIsEmpty: isEmptyDoc(doc) }
}

/** True when the local document differs from the last synced version (or was never synced and isn't empty). */
export function useHasUnsavedChanges(): boolean {
  const doc = useStore(docStore, (s) => s.history.present)
  const baseFingerprint = useSync((s) => s.baseFingerprint)
  return useMemo(
    () => (baseFingerprint === null ? !isEmptyDoc(doc) : docFingerprint(doc) !== baseFingerprint),
    [doc, baseFingerprint],
  )
}

function ask(confirm: Omit<ConfirmState, 'onConfirm' | 'onCancel' | 'secondary'> & { secondaryLabel?: string }) {
  return new Promise<'confirm' | 'secondary' | 'cancel'>((resolve) => {
    uiStore.getState().askConfirm({
      ...confirm,
      onConfirm: () => resolve('confirm'),
      onCancel: () => resolve('cancel'),
      secondary: confirm.secondaryLabel ? { label: confirm.secondaryLabel, onSelect: () => resolve('secondary') } : undefined,
    })
  })
}

const describe = (meta: SyncMeta) => {
  const who = meta.savedBy || 'Someone'
  const when = meta.savedAt ? new Date(meta.savedAt).toLocaleString() : 'recently'
  return `${who} (${when})`
}

function errorMessage(err: unknown): string {
  if (err instanceof GistError || err instanceof TimelineFileError) return err.message
  console.error(err)
  return 'Something went wrong while syncing.'
}

function handleError(err: unknown) {
  if (err instanceof GistError && err.kind === 'auth') forgetKey()
  set({ error: errorMessage(err), status: 'idle' })
}

async function fetchRemote(): Promise<ReadResult> {
  const { gistId, token } = syncStore.getState()
  const { text } = await readGist(gistId, GIST_FILENAME, token)
  const result = parseTimelineFile(text)
  if (result.warnings.length > 0) console.warn('Shared timeline needed repairs when loading:', result.warnings)
  return result
}

function adopt(remote: ReadResult, undoable: boolean) {
  docStore.getState().replace(remote.doc, { undoable })
  setBase(remote.meta, docFingerprint(remote.doc))
}

/**
 * Loads the shared timeline. Takes it automatically when there are no local
 * changes; asks when both sides changed. `initial`: first load of the page.
 */
export async function pull({ manual = false, initial = false } = {}) {
  if (syncStore.getState().status !== 'idle') return
  set({ status: 'loading', error: null })
  try {
    const remote = await fetchRemote()
    const fingerprint = docFingerprint(remote.doc)
    const decision = decidePull(snapshot(), { meta: remote.meta, fingerprint })
    set({ status: 'idle', lastCheckedAt: Date.now() })

    if (decision === 'same') {
      setBase(remote.meta, fingerprint)
      if (manual) notice('Up to date.')
    } else if (decision === 'up-to-date') {
      if (manual) notice('No newer version on the shared timeline.')
    } else if (decision === 'adopt') {
      adopt(remote, !initial)
      if (!initial) notice(`Loaded the latest version from ${describe(remote.meta)}.`)
    } else {
      const choice = await ask({
        title: 'Newer shared version',
        tone: 'info',
        message:
          `${describe(remote.meta)} saved a version you haven’t seen, and you have changes that aren’t uploaded.\n\n` +
          'Load theirs to see it (Ctrl+Z brings yours back), or keep yours and upload when ready.',
        confirmLabel: 'Load theirs',
        cancelLabel: 'Keep mine',
      })
      if (choice === 'confirm') adopt(remote, true)
    }
  } catch (err) {
    handleError(err)
  }
}

/** Uploads the local document, checking first that nobody else saved in between. */
export async function push() {
  const s = syncStore.getState()
  if (!s.token) return openAccess()
  if (s.status !== 'idle') return
  set({ status: 'saving', error: null })
  try {
    const remote = await fetchRemote()
    const remoteFingerprint = docFingerprint(remote.doc)

    if (decidePush(snapshot(), { meta: remote.meta, fingerprint: remoteFingerprint }) === 'conflict') {
      const choice = await ask({
        title: 'Someone else saved first',
        message:
          `${describe(remote.meta)} saved a version after you last synced.\n\n` +
          'Uploading now replaces their version with yours. Load theirs instead to see what changed (Ctrl+Z brings yours back).',
        confirmLabel: 'Overwrite theirs',
        secondaryLabel: 'Load theirs',
      })
      if (choice === 'secondary') adopt(remote, true)
      if (choice !== 'confirm') return set({ status: 'idle' })
    }

    if (remote.source !== 'v5') {
      const choice = await ask({
        title: 'Upgrade the shared file?',
        tone: 'info',
        message:
          'This is the first save from the new app. It converts the shared Gist to the new format (v5).\n\n' +
          'After this, the old v4.8 site can no longer read it. Make sure everyone moves to the new site.',
        confirmLabel: 'Upgrade and save',
      })
      if (choice !== 'confirm') return set({ status: 'idle' })
    }

    // Upload what's on screen now; edits made while saving stay as unsaved changes.
    const doc = localDoc()
    const meta: SyncMeta = {
      rev: Math.max(remote.meta.rev, s.base?.rev ?? 0) + 1,
      savedAt: new Date().toISOString(),
      savedBy: s.username.trim() || 'Anonymous',
    }
    const { gistId, token } = syncStore.getState()
    await writeGist(gistId, GIST_FILENAME, token!, serializeTimelineFile(doc, { rev: meta.rev, savedAt: meta.savedAt!, savedBy: meta.savedBy! }))
    setBase(meta, docFingerprint(doc))
    set({ status: 'idle', lastCheckedAt: Date.now() })
    notice(`Saved to the shared timeline (version ${meta.rev}).`)
  } catch (err) {
    handleError(err)
  }
}

// --- access ------------------------------------------------------------------------

export function openAccess() {
  set({ accessOpen: true })
}

export function closeAccess() {
  set({ accessOpen: false })
}

export function setUsername(name: string) {
  set({ username: name })
  store.set(NAME_KEY, name)
}

export function forgetKey() {
  set({ token: null })
  store.set(TOKEN_KEY, null)
}

/**
 * Checks a key can read the Gist and belongs to the Gist's owner (only the
 * owner can save to a Gist), then stores it. Returns an error message or null.
 */
export async function connect(token: string, gistId: string): Promise<string | null> {
  try {
    const [{ ownerLogin }, login] = await Promise.all([readGist(gistId, GIST_FILENAME, token), keyOwner(token)])
    if (ownerLogin && ownerLogin.toLowerCase() !== login.toLowerCase()) {
      return `This key belongs to ${login}, but the Gist belongs to ${ownerLogin}. Only the owner’s key can save to it.`
    }
  } catch (err) {
    return errorMessage(err)
  }
  const switching = gistId !== syncStore.getState().gistId
  set({ token, gistId, accessOpen: false, error: null })
  store.set(TOKEN_KEY, token)
  store.set(GIST_KEY, gistId === DEFAULT_GIST_ID ? null : gistId)
  if (switching) {
    // A different file: what we synced before doesn't apply to it.
    set({ base: null, baseFingerprint: null })
    store.set(BASE_KEY, null)
  }
  void pull({ manual: true })
  return null
}

/** Re-checks the Gist when the window regains focus, at most once a minute. */
export function startFocusChecks() {
  const onFocus = () => {
    const last = syncStore.getState().lastCheckedAt ?? 0
    if (Date.now() - last > 60_000) void pull()
  }
  window.addEventListener('focus', onFocus)
  return () => window.removeEventListener('focus', onFocus)
}
