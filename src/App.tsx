import { AppHeader } from './app/AppHeader'
import { ShortcutsDialog } from './app/ShortcutsDialog'
import { useShortcuts } from './app/useShortcuts'
import { Timeline } from './timeline/Timeline'

export default function App() {
  useShortcuts()
  return (
    <div className="flex h-full flex-col overflow-hidden font-mono select-none">
      <AppHeader />
      <Timeline />
      <ShortcutsDialog />
    </div>
  )
}
