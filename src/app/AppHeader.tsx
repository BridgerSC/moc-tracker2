import { CalendarClock, FileDown, FileUp, Keyboard, PanelRight, Redo2, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { selectCanRedo, selectCanUndo, docStore, useDoc } from '../store/docStore'
import { uiStore, useUi } from '../store/uiStore'
import { downloadBackup, importFile } from './fileActions'

function IconButton({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-[#2a2a2a] bg-[#161616] text-[#aaa] transition-colors hover:border-[#555] hover:text-white disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  )
}

export function AppHeader() {
  const canUndo = useDoc(selectCanUndo)
  const canRedo = useDoc(selectCanRedo)
  const notice = useUi((s) => s.notice)
  const fileInput = useRef<HTMLInputElement>(null)
  const ui = uiStore.getState()

  // Notices fade after a while.
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => uiStore.getState().setNotice(null), 6000)
    return () => clearTimeout(id)
  }, [notice])

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-[#2a2a2a] bg-[#0e0e0e] px-4">
      <h1 className="m-0 font-bebas text-[32px] leading-none tracking-[3px] text-white">MOC TIMELINE</h1>

      <div className="min-w-0 flex-1">
        {notice && (
          <div className="flex max-w-xl items-center gap-2 truncate font-poppins text-[11px] text-[#aaa]">
            <span className="truncate">{notice}</span>
            <button type="button" aria-label="Dismiss" className="text-[#666] hover:text-white" onClick={() => ui.setNotice(null)}>
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <IconButton title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => docStore.getState().undo()}>
          <Undo2 size={15} />
        </IconButton>
        <IconButton title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => docStore.getState().redo()}>
          <Redo2 size={15} />
        </IconButton>
        <div className="mx-1.5 h-5 w-px bg-[#2a2a2a]" />
        <IconButton title="Zoom out (Ctrl+wheel)" onClick={() => ui.setZoom(uiStore.getState().zoom / 1.4)}>
          <ZoomOut size={15} />
        </IconButton>
        <IconButton title="Zoom in (Ctrl+wheel)" onClick={() => ui.setZoom(uiStore.getState().zoom * 1.4)}>
          <ZoomIn size={15} />
        </IconButton>
        <IconButton title="Jump to today" onClick={() => ui.requestToday()}>
          <CalendarClock size={15} />
        </IconButton>
        <div className="mx-1.5 h-5 w-px bg-[#2a2a2a]" />
        <IconButton title="Import a JSON backup (v4.8 or v5)" onClick={() => fileInput.current?.click()}>
          <FileUp size={15} />
        </IconButton>
        <IconButton title="Download a backup" onClick={downloadBackup}>
          <FileDown size={15} />
        </IconButton>
        <IconButton title="Keyboard shortcuts (?)" onClick={() => ui.setShortcutsOpen(true)}>
          <Keyboard size={15} />
        </IconButton>
        <IconButton
          title="Show/hide the side panel"
          onClick={() => ui.setRightPanelOpen(!uiStore.getState().rightPanelOpen)}
        >
          <PanelRight size={15} />
        </IconButton>
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
    </header>
  )
}
