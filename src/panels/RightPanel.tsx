import { Lock } from 'lucide-react'
import { selectLocked, useDoc } from '../store/docStore'
import { uiStore, useUi, type RightTab } from '../store/uiStore'
import { openAccess } from '../sync/syncState'
import { Inspector } from './Inspector'
import { ProjectsPanel } from './ProjectsPanel'

const TABS: [RightTab, string][] = [
  ['inspector', 'Details'],
  ['projects', 'Projects'],
]

export function RightPanel() {
  const open = useUi((s) => s.rightPanelOpen)
  const tab = useUi((s) => s.rightTab)
  const locked = useDoc(selectLocked)
  if (!open) return null

  return (
    <aside aria-label="Side panel" className="flex w-[320px] shrink-0 flex-col border-l border-line bg-surface">
      <div role="tablist" aria-label="Side panel" className="flex h-12 shrink-0 items-end gap-5 border-b border-line px-5">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => uiStore.getState().setRightTab(id)}
            className={`-mb-px cursor-pointer border-b-2 pb-2.5 text-[13px] font-medium transition-colors ${
              tab === id ? 'border-accent text-ink' : 'border-transparent text-ink-subtle hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="paper-scroll min-h-0 flex-1 overflow-y-auto">
        {locked && (
          <button
            type="button"
            onClick={openAccess}
            className="flex w-full cursor-pointer items-center gap-2 border-b border-warn/25 bg-warn-soft px-5 py-2.5 text-left text-[12px] text-warn-ink hover:bg-warn-soft/70"
          >
            <Lock size={13} /> View only. Add the team key to make changes.
          </button>
        )}
        {/* A disabled fieldset disables every control inside it. */}
        <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0">
          {tab === 'projects' ? <ProjectsPanel /> : <Inspector />}
        </fieldset>
      </div>
    </aside>
  )
}
