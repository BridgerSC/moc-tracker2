import { TriangleAlert } from 'lucide-react'
import { uiStore, useUi } from '../store/uiStore'

export function ConfirmDialog() {
  const confirm = useUi((s) => s.confirm)
  if (!confirm) return null
  const close = () => uiStore.getState().closeConfirm()

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={close}>
      <div
        role="alertdialog"
        aria-label={confirm.title}
        className="w-full max-w-md border border-[#2a2a2a] bg-[#111] p-6 shadow-[8px_8px_0_#EF476F]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2 font-bebas text-2xl tracking-[2px] text-[#EF476F]">
          <TriangleAlert size={20} /> {confirm.title}
        </div>
        <p className="m-0 font-poppins text-[13px] leading-relaxed text-[#ccc]">{confirm.message}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="flex-1 border border-[#EF476F] bg-[#EF476F] py-2 font-poppins text-[11px] font-semibold tracking-[1px] text-[#0e0e0e] uppercase hover:brightness-110"
            onClick={() => {
              close()
              confirm.onConfirm()
            }}
          >
            {confirm.confirmLabel}
          </button>
          <button
            type="button"
            autoFocus
            className="flex-1 border border-[#444] py-2 font-poppins text-[11px] tracking-[1px] text-[#aaa] uppercase hover:border-[#888] hover:text-white"
            onClick={close}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
