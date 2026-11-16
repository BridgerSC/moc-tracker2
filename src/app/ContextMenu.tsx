import { useEffect } from 'react'
import { uiStore, useUi } from '../store/uiStore'

const WIDTH = 170

/** The right-click menu. Closes on any outside press, scroll, Esc or after choosing. */
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
  const height = menu.items.length * 30 + 12
  const left = Math.min(menu.x, window.innerWidth - WIDTH - 8)
  const top = Math.min(menu.y, window.innerHeight - height - 8)

  return (
    <div
      role="menu"
      className="fixed z-[200] border border-[#2a2a2a] bg-[#161616] py-1.5 font-poppins text-[12px] shadow-[4px_4px_0_rgba(0,0,0,0.6)]"
      style={{ left, top, width: WIDTH }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((item) => (
        <div key={item.label}>
          {item.divider && <div className="my-1 h-px bg-[#2a2a2a]" />}
          <button
            type="button"
            role="menuitem"
            className={`block h-[30px] w-full px-3 text-left hover:bg-[#2a2a2a] ${item.danger ? 'text-[#e05050]' : 'text-[#e8e8e8]'}`}
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
