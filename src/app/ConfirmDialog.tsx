import { CircleHelp, TriangleAlert } from 'lucide-react'
import { uiStore, useUi } from '../store/uiStore'

export function ConfirmDialog() {
  const confirm = useUi((s) => s.confirm)
  if (!confirm) return null
  const accent = confirm.tone === 'info' ? '#118AB2' : '#EF476F'
  const cancel = () => {
    uiStore.getState().closeConfirm()
    confirm.onCancel?.()
  }
  const choose = (fn: () => void) => () => {
    uiStore.getState().closeConfirm()
    fn()
  }
  const button = 'flex-1 border py-2 px-2 font-poppins text-[11px] tracking-[1px] uppercase'

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={cancel}>
      <div
        role="alertdialog"
        aria-label={confirm.title}
        className="w-full max-w-md border border-[#2a2a2a] bg-[#111] p-6"
        style={{ boxShadow: `8px 8px 0 ${accent}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2 font-bebas text-2xl tracking-[2px]" style={{ color: accent }}>
          {confirm.tone === 'info' ? <CircleHelp size={20} /> : <TriangleAlert size={20} />} {confirm.title}
        </div>
        <p className="m-0 font-poppins text-[13px] leading-relaxed whitespace-pre-line text-[#ccc]">{confirm.message}</p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            className={`${button} font-semibold text-[#0e0e0e] hover:brightness-110`}
            style={{ background: accent, borderColor: accent }}
            onClick={choose(confirm.onConfirm)}
          >
            {confirm.confirmLabel}
          </button>
          {confirm.secondary && (
            <button
              type="button"
              className={`${button} border-[#666] text-[#ddd] hover:border-white hover:text-white`}
              onClick={choose(confirm.secondary.onSelect)}
            >
              {confirm.secondary.label}
            </button>
          )}
          <button
            type="button"
            autoFocus
            className={`${button} border-[#444] text-[#aaa] hover:border-[#888] hover:text-white`}
            onClick={cancel}
          >
            {confirm.cancelLabel ?? 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
