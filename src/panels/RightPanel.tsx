import { uiStore, useUi, type RightTab } from '../store/uiStore'
import { Inspector } from './Inspector'
import { ProjectsPanel } from './ProjectsPanel'

const TABS: [RightTab, string][] = [
  ['projects', 'Projects'],
  ['inspector', 'Inspector'],
]

export function RightPanel() {
  const open = useUi((s) => s.rightPanelOpen)
  const tab = useUi((s) => s.rightTab)
  if (!open) return null

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-[#2a2a2a] bg-[#0e0e0e]">
      <div className="flex h-8 shrink-0 border-b border-[#2a2a2a] bg-[#161616]">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => uiStore.getState().setRightTab(id)}
            className={`flex-1 border-b font-poppins text-[10px] tracking-[1px] uppercase transition-colors ${
              tab === id ? 'border-white bg-[#0e0e0e] text-white' : 'border-transparent text-[#666] hover:text-[#aaa]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="brutal-scroll min-h-0 flex-1 overflow-y-auto">{tab === 'projects' ? <ProjectsPanel /> : <Inspector />}</div>
    </aside>
  )
}
