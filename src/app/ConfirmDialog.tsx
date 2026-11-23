import { CircleHelp, TriangleAlert } from 'lucide-react'
import { uiStore, useUi } from '../store/uiStore'
import { btn, dialog } from '../ui/styles'

export function ConfirmDialog() {
  const confirm = useUi((s) => s.confirm)
  if (!confirm) return null
  const danger = confirm.tone !== 'info'
  const cancel = () => {
    uiStore.getState().closeConfirm()
    confirm.onCancel?.()
  }
  const choose = (fn: () => void) => () => {
    uiStore.getState().closeConfirm()
    fn()
  }

  return (
    <div className={`${dialog.backdrop} z-[150]`} onClick={cancel}>
      <div role="alertdialog" aria-label={confirm.title} className={`${dialog.panel} max-w-md`} onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-3.5">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              danger ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent-ink'
            }`}
          >
            {danger ? <TriangleAlert size={17} /> : <CircleHelp size={17} />}
          </div>
          <div className="flex flex-col gap-2 pt-1.5">
            <h2 className={dialog.title}>{confirm.title}</h2>
            <p className="m-0 text-[13px] leading-relaxed whitespace-pre-line text-ink-muted">{confirm.message}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" autoFocus className={btn('secondary')} onClick={cancel}>
            {confirm.cancelLabel ?? 'Cancel'}
          </button>
          {confirm.secondary && (
            <button type="button" className={btn('secondary')} onClick={choose(confirm.secondary.onSelect)}>
              {confirm.secondary.label}
            </button>
          )}
          <button
            type="button"
            className={danger ? `${btn('primary')} bg-danger hover:bg-danger/90` : btn('primary')}
            onClick={choose(confirm.onConfirm)}
          >
            {confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
