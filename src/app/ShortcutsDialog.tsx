import { Keyboard } from 'lucide-react'
import { uiStore, useUi } from '../store/uiStore'

const SHORTCUTS: [string, string][] = [
  ['Scroll', 'Wheel · Shift+wheel sideways'],
  ['Zoom', 'Ctrl+wheel · pinch'],
  ['Pan', 'Middle-drag · Alt+drag empty space'],
  ['Create block', 'Double-click a row'],
  ['Rename block', 'Double-click it · Enter / F2'],
  ['Select', 'Click · Shift+click · drag a box (Shift adds)'],
  ['Select all', 'Ctrl+A'],
  ['Move', 'Drag a block'],
  ['Ripple move', 'Shift+drag a block (pushes later blocks in its row)'],
  ['Duplicate', 'Alt+drag a block · Ctrl+D'],
  ['Resize', 'Drag an edge'],
  ['Ripple resize', 'Shift+drag an edge'],
  ['Rolling resize', 'Alt+drag an edge (moves the touching neighbour too)'],
  ['Copy / paste', 'Ctrl+C · Ctrl+V (pastes under the pointer)'],
  ['Delete', 'Delete / Backspace'],
  ['Undo / redo', 'Ctrl+Z · Ctrl+Shift+Z / Ctrl+Y'],
  ['Cancel / deselect', 'Esc'],
]

export function ShortcutsDialog() {
  const open = useUi((s) => s.shortcutsOpen)
  if (!open) return null
  const close = () => uiStore.getState().setShortcutsOpen(false)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={close}>
      <div
        role="dialog"
        aria-label="Keyboard shortcuts"
        className="w-full max-w-lg border border-[#2a2a2a] bg-[#111] p-6 shadow-[8px_8px_0_#A06CD5]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2 font-bebas text-2xl tracking-[2px] text-[#A06CD5]">
          <Keyboard size={20} /> Controls &amp; Shortcuts
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 font-poppins text-[12px]">
          {SHORTCUTS.map(([what, how]) => (
            <div key={what} className="contents">
              <dt className="text-[#888]">{what}</dt>
              <dd className="m-0 text-[#e8e8e8]">{how}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          autoFocus
          onClick={close}
          className="mt-6 w-full border border-[#A06CD5] py-2 font-poppins text-[11px] tracking-[1px] text-[#A06CD5] uppercase hover:bg-[#A06CD5] hover:text-[#0e0e0e]"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
