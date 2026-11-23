import { CalendarClock, Ellipsis, PanelRight, Redo2, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { useRef } from 'react'
import { docStore, selectCanRedo, selectCanUndo, useDoc } from '../store/docStore'
import { uiStore, useUi } from '../store/uiStore'
import { tickInterval } from '../timeline/ticks'
import { btn, iconBtn, segmented } from '../ui/styles'
import { downloadBackup, importFile } from './fileActions'
import { SyncControls } from './SyncControls'

/** Top bar: app name, sections, and the shared-timeline controls. */
export function AppBar() {
  return (
    <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-surface px-5 py-2">
      <div className="flex items-center gap-2.5">
        <div aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-[12px] font-bold text-white">
          M
        </div>
        <span className="text-[15px] font-semibold tracking-[-0.01em]">MoC Timeline</span>
      </div>
      <nav aria-label="Sections" className="flex items-center gap-1">
        <a href="#" aria-current="page" className="inline-flex h-8 items-center rounded-md bg-sunken px-3 text-[13px] font-medium text-ink no-underline">
          Production
        </a>
      </nav>
      <div className="flex-1" />
      <SyncControls />
    </header>
  )
}

const ZOOM_PRESETS = [
  { label: 'Day', zoom: 1, interval: 'day' },
  { label: 'Week', zoom: 0.35, interval: 'week' },
  { label: 'Month', zoom: 0.09, interval: 'month' },
] as const

/** Page toolbar: view controls, undo/redo and file actions. */
export function Toolbar() {
  const canUndo = useDoc(selectCanUndo)
  const canRedo = useDoc(selectCanRedo)
  const zoom = useUi((s) => s.zoom)
  const panelOpen = useUi((s) => s.rightPanelOpen)
  const fileInput = useRef<HTMLInputElement>(null)
  const moreButton = useRef<HTMLButtonElement>(null)
  const ui = uiStore.getState()
  const interval = tickInterval(zoom)

  const openMore = () => {
    const r = moreButton.current?.getBoundingClientRect()
    if (!r) return
    ui.openContextMenu(r.right - 190, r.bottom + 6, [
      { label: 'Import JSON backup…', onSelect: () => fileInput.current?.click() },
      { label: 'Download backup', onSelect: downloadBackup },
      { label: 'Keyboard shortcuts', divider: true, onSelect: () => ui.setShortcutsOpen(true) },
    ])
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 px-5 pt-4 pb-3">
      <h1 className="m-0 mr-3 text-[20px] font-semibold tracking-[-0.015em]">Production</h1>
      <div className="flex-1" />

      <div role="group" aria-label="Zoom level" className={segmented.track}>
        {ZOOM_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={interval === p.interval}
            className={segmented.item(interval === p.interval)}
            onClick={() => ui.setZoom(p.zoom)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <button type="button" className={iconBtn} title="Zoom out (Ctrl+wheel)" aria-label="Zoom out" onClick={() => ui.setZoom(uiStore.getState().zoom / 1.4)}>
        <ZoomOut size={16} />
      </button>
      <button type="button" className={iconBtn} title="Zoom in (Ctrl+wheel)" aria-label="Zoom in" onClick={() => ui.setZoom(uiStore.getState().zoom * 1.4)}>
        <ZoomIn size={16} />
      </button>
      <button type="button" className={btn('secondary')} onClick={() => ui.requestToday()}>
        <CalendarClock size={14} /> Today
      </button>

      <div className="mx-1 h-5 w-px bg-line" />

      <button type="button" className={iconBtn} title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onClick={() => docStore.getState().undo()}>
        <Undo2 size={16} />
      </button>
      <button type="button" className={iconBtn} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!canRedo} onClick={() => docStore.getState().redo()}>
        <Redo2 size={16} />
      </button>
      <button ref={moreButton} type="button" className={iconBtn} title="More" aria-label="More actions" onClick={openMore}>
        <Ellipsis size={16} />
      </button>
      <button
        type="button"
        className={`${iconBtn} ${panelOpen ? 'bg-sunken text-ink' : ''}`}
        title="Show/hide the side panel"
        aria-label="Toggle side panel"
        aria-pressed={panelOpen}
        onClick={() => ui.setRightPanelOpen(!panelOpen)}
      >
        <PanelRight size={16} />
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void importFile(file)
        }}
      />
    </div>
  )
}
