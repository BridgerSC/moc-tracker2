import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { seedDoc } from './model/seed'
import { docStore } from './store/docStore'
import { loadLocal, startAutosave } from './sync/localSave'
import { syncStore } from './sync/syncState'

// Start from this browser's autosave, or example data on a first run.
const local = loadLocal()
if (local) {
  docStore.getState().replace(local.doc, { undoable: false })
  syncStore.getState().setBase(local.meta)
} else {
  docStore.getState().replace(seedDoc(), { undoable: false })
}
startAutosave(docStore, () => syncStore.getState().base)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
