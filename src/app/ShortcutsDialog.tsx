import { X } from 'lucide-react'
import { uiStore, useUi } from '../store/uiStore'
import { dialog, iconBtn } from '../ui/styles'

const SHORTCUTS: [string, string[]][] = [
  ['Scroll', ['Wheel', 'Shift + wheel']],
  ['Zoom', ['Ctrl + wheel', 'Pinch']],
  ['Pan', ['Middle-drag', 'Alt + drag']],
  ['Create a block', ['Double-click a row']],
  ['Rename', ['Double-click', 'Enter', 'F2']],
  ['Select', ['Click', 'Shift + click', 'Drag a box']],
  ['Select all', ['Ctrl + A']],
  ['Ripple move', ['Shift + drag']],
  ['Duplicate', ['Alt + drag', 'Ctrl + D']],
  ['Ripple resize', ['Shift + drag edge']],
  ['Rolling resize', ['Alt + drag edge']],
  ['Copy / paste', ['Ctrl + C', 'Ctrl + V']],
  ['Delete', ['Delete']],
  ['Undo / redo', ['Ctrl + Z', 'Ctrl + Shift + Z']],
  ['Cancel / deselect', ['Esc']],
]

export function ShortcutsDialog() {
  const open = useUi((s) => s.shortcutsOpen)
  if (!open) return null
  const close = () => uiStore.getState().setShortcutsOpen(false)

  return (
    <div className={`${dialog.backdrop} z-[100]`} onClick={close}>
      <div role="dialog" aria-label="Keyboard shortcuts" className={`${dialog.panel} max-w-lg`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className={dialog.title}>Keyboard shortcuts</h2>
          <button type="button" autoFocus aria-label="Close" className={iconBtn} onClick={close}>
            <X size={16} />
          </button>
        </div>
        <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2.5 text-[13px]">
          {SHORTCUTS.map(([what, keys]) => (
            <div key={what} className="contents">
              <dt className="text-ink-muted">{what}</dt>
              <dd className="m-0 flex flex-wrap gap-1.5">
                {keys.map((k) => (
                  <kbd key={k} className="rounded-[5px] border border-line border-b-line-strong bg-subtle px-1.5 py-0.5 font-sans text-[12px] text-ink">
                    {k}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
