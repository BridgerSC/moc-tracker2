import { AccessDialog } from './app/AccessDialog'
import { AppBar, Toolbar } from './app/AppHeader'
import { ConfirmDialog } from './app/ConfirmDialog'
import { ContextMenu } from './app/ContextMenu'
import { ShortcutsDialog } from './app/ShortcutsDialog'
import { Toast } from './app/Toast'
import { useShortcuts } from './app/useShortcuts'
import { RightPanel } from './panels/RightPanel'
import { SubtaskBoard } from './panels/SubtaskBoard'
import { Timeline } from './timeline/Timeline'

export default function App() {
  useShortcuts()
  return (
    <div className="flex h-full flex-col overflow-hidden select-none">
      <AppBar />
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <Toolbar />
          <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card">
              <Timeline />
              <SubtaskBoard />
            </div>
          </div>
        </main>
        <RightPanel />
      </div>
      <ContextMenu />
      <AccessDialog />
      <ConfirmDialog />
      <ShortcutsDialog />
      <Toast />
    </div>
  )
}
