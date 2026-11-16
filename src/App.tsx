import { AppHeader } from './app/AppHeader'
import { ConfirmDialog } from './app/ConfirmDialog'
import { ContextMenu } from './app/ContextMenu'
import { ShortcutsDialog } from './app/ShortcutsDialog'
import { useShortcuts } from './app/useShortcuts'
import { RightPanel } from './panels/RightPanel'
import { SubtaskBoard } from './panels/SubtaskBoard'
import { Timeline } from './timeline/Timeline'

export default function App() {
  useShortcuts()
  return (
    <div className="flex h-full flex-col overflow-hidden font-mono select-none">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <Timeline />
          <SubtaskBoard />
        </main>
        <RightPanel />
      </div>
      <ContextMenu />
      <ConfirmDialog />
      <ShortcutsDialog />
    </div>
  )
}
