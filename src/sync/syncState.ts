import { createStore } from 'zustand/vanilla'
import type { SyncMeta } from '../model/types'

// Which shared (Gist) version the local document is based on.
// Milestone 4 fills this in from the Gist; until then it stays at "never synced".

export interface SyncState {
  base: SyncMeta
  setBase: (base: SyncMeta) => void
}

export const syncStore = createStore<SyncState>()((set) => ({
  base: { rev: 0, savedAt: null, savedBy: null },
  setBase: (base) => set({ base }),
}))
