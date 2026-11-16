import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { docStore, onEditBlocked } from './store/docStore'
import { uiStore } from './store/uiStore'
import { loadLocal, startAutosave } from './sync/localSave'
import { openAccess, pull, startFocusChecks, syncStore } from './sync/syncState'

// Show this browser's last copy straight away, then check the shared timeline.
const local = loadLocal()
if (local) docStore.getState().replace(local.doc, { undoable: false })
startAutosave(docStore, () => syncStore.getState().base ?? { rev: 0, savedAt: null, savedBy: null })

// Without a GitHub key the timeline is view-only.
const applyLock = () => docStore.getState().setLocked(!syncStore.getState().token)
applyLock()
syncStore.subscribe((s, prev) => {
  if (s.token !== prev.token) applyLock()
})
onEditBlocked(() => {
  uiStore.getState().setNotice('View only. Add the team key (lock button, top right) to make changes.')
  openAccess()
})

void pull({ initial: true })
startFocusChecks()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
