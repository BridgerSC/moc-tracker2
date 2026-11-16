import { TimelineFileError, parseTimelineFile, serializeTimelineFile } from '../model/fileFormat'
import { docStore } from '../store/docStore'
import { uiStore } from '../store/uiStore'
import { syncStore } from '../sync/syncState'

const pad = (n: number) => String(n).padStart(2, '0')

/** Saves the current document as a v5 JSON file. */
export function downloadBackup() {
  const now = new Date()
  const base = syncStore.getState().base
  const text = serializeTimelineFile(docStore.getState().history.present, {
    rev: base.rev,
    savedAt: now.toISOString(),
    savedBy: base.savedBy ?? '',
  })
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `moc-timeline_${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Replaces the document with a v5 or v4.8 JSON file. Undoable. */
export async function importFile(file: File) {
  const ui = uiStore.getState()
  try {
    const result = parseTimelineFile(await file.text())
    docStore.getState().replace(result.doc, { undoable: true })
    ui.clearSelection()
    const fixes = result.warnings.length
    if (fixes > 0) console.warn(`Import of ${file.name}:`, result.warnings)
    ui.setNotice(
      `Imported ${file.name} (${result.source}): ${result.doc.tasks.length} blocks` +
        (fixes > 0 ? `, ${fixes} fix${fixes === 1 ? '' : 'es'} (see console)` : '') +
        '. Ctrl+Z to undo.',
    )
  } catch (err) {
    ui.setNotice(err instanceof TimelineFileError ? err.message : `Could not import ${file.name}.`)
  }
}
