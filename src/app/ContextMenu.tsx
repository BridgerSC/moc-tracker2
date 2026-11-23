import { useEffect } from 'react'
import { uiStore, useUi } from '../store/uiStore'

const WIDTH = 200

/** The right-click menu (also used for the toolbar's "more" button). Closes on outside press, scroll, Esc or a choice. */
export function ContextMenu() {
  const menu = useUi((s) => s.contextMenu)

  useEffect(() => {
    if (!menu) return
    const close = () => uiStore.getState().closeContextMenu()
    window.addEventListener('pointerdown', close)
    window.addEventListener('wheel', close, { passive: true })
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('wheel', close)
      window.removeEventListener('blur', close)
    }
  }, [menu])

  if (!menu) return null
  const height = menu.items.length * 32 + 12
  const left = Math.max(8, Math.min(menu.x, window.innerWidth - WIDTH - 8))
  const top = Math.max(8, Math.min(menu.y, window.innerHeight - height - 8))

  return (
    <div
      role="menu"
      className="fixed z-[200] rounded-lg border border-line bg-surface p-1 text-[13px] shadow-pop"
      style={{ left, top, width: WIDTH }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((item) => (
        <div key={item.label}>
          {item.divider && <div className="mx-1 my-1 h-px bg-line" />}
          <button
            type="button"
            role="menuitem"
            className={`flex h-8 w-full cursor-pointer items-center rounded-md px-2.5 text-left ${
              item.danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-sunken'
            }`}
            onClick={() => {
              uiStore.getState().closeContextMenu()
              item.onSelect()
            }}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  )
}
