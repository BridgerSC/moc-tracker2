// Undo/redo history over immutable values. Pure functions; the store wraps them.
//
// Differences from v4.8, which snapshotted by hand before some mutations:
// - Every change goes through `commit`, so nothing can skip the history
//   (v4.8 forgot double-click create and add-subtask).
// - A no-op change (same object back) records nothing, so focusing a field no
//   longer wipes the redo stack.
// - Rapid changes that share a `coalesceKey` (typing in one field) merge into a
//   single undo step.

export const HISTORY_LIMIT = 50
export const COALESCE_WINDOW_MS = 1500

export interface History<T> {
  past: T[]
  present: T
  future: T[]
  /** Coalescing state for the most recent commit. */
  lastKey: string | null
  lastAt: number
}

export interface CommitOptions {
  /** Commits with the same key within COALESCE_WINDOW_MS of each other merge into one undo step. */
  coalesceKey?: string
  /** Current time in ms; injectable for tests. */
  now?: number
}

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastAt: 0 }
}

export function commit<T>(history: History<T>, next: T, options: CommitOptions = {}): History<T> {
  if (Object.is(next, history.present)) return history

  const now = options.now ?? Date.now()
  const key = options.coalesceKey ?? null
  const merge = key !== null && key === history.lastKey && now - history.lastAt <= COALESCE_WINDOW_MS

  return {
    past: merge ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    lastKey: key,
    lastAt: now,
  }
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1)
  if (previous === undefined) return history
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastKey: null,
    lastAt: 0,
  }
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future
  if (next === undefined) return history
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: rest,
    lastKey: null,
    lastAt: 0,
  }
}

/** Ends any open coalescing run, so the next keyed commit starts a new undo step (e.g. on blur). */
export function seal<T>(history: History<T>): History<T> {
  return history.lastKey === null ? history : { ...history, lastKey: null }
}
