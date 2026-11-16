import type { SyncMeta } from '../model/types'

// What to do when the shared file is read or about to be written, given what
// this browser last synced ("base") and what it has now. Pure, so it can be tested.

/** Identifies one saved version of the shared file. v4.8 files all have rev 0, so the timestamp is included. */
export const versionKey = (meta: SyncMeta) => `${meta.rev}|${meta.savedAt ?? ''}`

export interface SyncSnapshot {
  /** Last version synced with, or null if this browser never synced. */
  base: SyncMeta | null
  /** Fingerprint of the document as last synced. */
  baseFingerprint: string | null
  localFingerprint: string
  localIsEmpty: boolean
}

export interface RemoteSnapshot {
  meta: SyncMeta
  fingerprint: string
}

export type PullDecision =
  /** Same content as local: just record the remote as the new base. */
  | 'same'
  /** Remote unchanged since the last sync (local may have its own pending changes). */
  | 'up-to-date'
  /** Remote changed and local has no pending changes: take the remote. */
  | 'adopt'
  /** Both changed: ask which to keep. */
  | 'conflict'

export function decidePull(local: SyncSnapshot, remote: RemoteSnapshot): PullDecision {
  if (remote.fingerprint === local.localFingerprint) return 'same'
  if (local.base === null || local.baseFingerprint === null) return local.localIsEmpty ? 'adopt' : 'conflict'
  if (versionKey(remote.meta) === versionKey(local.base)) return 'up-to-date'
  return local.localFingerprint === local.baseFingerprint ? 'adopt' : 'conflict'
}

export type PushDecision = 'ok' | 'conflict'

/** Before uploading: has someone else saved since our base? */
export function decidePush(local: SyncSnapshot, remote: RemoteSnapshot): PushDecision {
  if (local.base === null || local.baseFingerprint === null) return 'conflict'
  if (versionKey(remote.meta) === versionKey(local.base)) return 'ok'
  return remote.fingerprint === local.baseFingerprint ? 'ok' : 'conflict'
}
