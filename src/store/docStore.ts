import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { emptyDoc, type TimelineDoc } from '../model/types'
import * as H from './history'

// The timeline document and its undo history.
//
// All edits go through `apply(recipe)`, where `recipe` returns a new document
// (or the same one for "no change"). Drags and other continuous gestures should
// preview in the UI and call `apply` once on release.
//
// While `locked` (view-only: no GitHub key), edits and undo/redo are refused and
// `onBlocked` is called so the UI can explain why. `replace` still works, so the
// shared timeline can be loaded.

export type Recipe = (doc: TimelineDoc) => TimelineDoc

export interface DocState {
  history: H.History<TimelineDoc>
  locked: boolean
  /** Applies an edit as one undo step (or merges it into the previous one, see `coalesceKey`). */
  apply: (recipe: Recipe, options?: H.CommitOptions) => void
  undo: () => void
  redo: () => void
  /** Closes the current coalescing run, e.g. when a text field loses focus. */
  seal: () => void
  /**
   * Replaces the whole document, e.g. after loading from the Gist.
   * `undoable: false` also clears the history (initial load); `true` lets the user undo the replacement.
   */
  replace: (doc: TimelineDoc, options: { undoable: boolean }) => void
  setLocked: (locked: boolean) => void
  /** For UI that starts an edit (drag, rename…): true if editing is allowed; otherwise explains why and returns false. */
  ensureEditable: () => boolean
}

export function createDocStore(initial: TimelineDoc = emptyDoc(), onBlocked: () => void = () => {}) {
  return createStore<DocState>()((set, get) => {
    const guard = (fn: () => void) => () => (get().locked ? onBlocked() : fn())
    return {
      history: H.createHistory(initial),
      locked: false,
      apply: (recipe, options) => {
        if (get().locked) return onBlocked()
        set((s) => {
          const next = H.commit(s.history, recipe(s.history.present), options)
          return next === s.history ? s : { history: next }
        })
      },
      undo: guard(() => set((s) => ({ history: H.undo(s.history) }))),
      redo: guard(() => set((s) => ({ history: H.redo(s.history) }))),
      seal: () => set((s) => ({ history: H.seal(s.history) })),
      replace: (doc, { undoable }) =>
        set((s) => ({ history: undoable ? H.commit(H.seal(s.history), doc) : H.createHistory(doc) })),
      setLocked: (locked) => set({ locked }),
      ensureEditable: () => {
        if (!get().locked) return true
        onBlocked()
        return false
      },
    }
  })
}

export type DocStore = ReturnType<typeof createDocStore>

let blockedHandler: () => void = () => {}
/** Sets what happens when an edit is attempted while locked (e.g. show a notice). */
export function onEditBlocked(handler: () => void) {
  blockedHandler = handler
}

/** The app-wide document store. */
export const docStore = createDocStore(emptyDoc(), () => blockedHandler())

export function useDoc<T>(selector: (state: DocState) => T): T {
  return useStore(docStore, selector)
}

export const selectDoc = (s: DocState) => s.history.present
export const selectCanUndo = (s: DocState) => !s.locked && s.history.past.length > 0
export const selectCanRedo = (s: DocState) => !s.locked && s.history.future.length > 0
export const selectLocked = (s: DocState) => s.locked
