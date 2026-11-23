import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { createGroup, deleteBlocks, duplicateBlocks } from '../app/actions'
import { FALLBACK_COLOR } from '../model/colors'
import { fromDayNumber, localToday, nowAsDayNumber, toDayNumber } from '../model/dates'
import { addTask, makeCloneIds, updateTask } from '../model/edits'
import { newId } from '../model/ids'
import type { Project, Task } from '../model/types'
import { docStore, selectDoc, useDoc } from '../store/docStore'
import { uiStore, useUi } from '../store/uiStore'
import { pointer } from './clipboard'
import {
  DEADLINE_LANE_HEIGHT,
  DEFAULT_BLOCK_DAYS,
  DRAG_THRESHOLD_PX,
  RANGE_DAYS,
  RENDER_BUFFER_PX,
  SIDEBAR_WIDTH,
  TIMELINE_HEADER_HEIGHT,
  contentWidth,
  dayToX,
  makeScale,
  xToDay,
} from './geometry'
import { applyGesture, type Gesture } from './gesture'
import { RowLabels } from './RowLabels'
import { layoutRows, stepAtY, stepContainingY, type RowLayout } from './rows'
import { runPointerSession } from './session'
import { TaskBlock, type BlockPart } from './TaskBlock'
import { computeTicks, weekendDays } from './ticks'
import { TimelineHeader } from './TimelineHeader'
import { TitleEditor } from './TitleEditor'
import { projectSwatch } from '../ui/color'
import { iconBtn } from '../ui/styles'

const NO_PROJECT = { name: 'No Project', color: FALLBACK_COLOR }

/** Tasks that are drawn: on a visible row and not in an archived project. */
function shownTasks(tasks: readonly Task[], layout: RowLayout, projects: ReadonlyMap<string, Project>): Task[] {
  return tasks.filter(
    (t) => layout.stepById.has(t.stepId) && !(t.projectId !== null && projects.get(t.projectId)?.archived),
  )
}

export function Timeline() {
  const doc = useDoc(selectDoc)
  const { zoom, selection, collapsedGroups, gesture, editingTaskId, todayRequest } = useUi(
    useShallow((s) => ({
      zoom: s.zoom,
      selection: s.selection,
      collapsedGroups: s.collapsedGroups,
      gesture: s.gesture,
      editingTaskId: s.editingTaskId,
      todayRequest: s.todayRequest,
    })),
  )

  // --- derived layout ---------------------------------------------------------
  const [originDay] = useState(() => toDayNumber(localToday()) - RANGE_DAYS)
  const [nowDay, setNowDay] = useState(() => nowAsDayNumber())
  useEffect(() => {
    const id = setInterval(() => setNowDay(nowAsDayNumber()), 60_000)
    return () => clearInterval(id)
  }, [])

  const scale = useMemo(() => makeScale(originDay, zoom), [originDay, zoom])
  const layout = useMemo(() => layoutRows(doc.groups, collapsedGroups), [doc.groups, collapsedGroups])
  const visibleStepIds = useMemo(() => layout.steps.map((s) => s.id), [layout])
  const view = useMemo(() => (gesture ? applyGesture(doc, gesture, visibleStepIds) : doc), [doc, gesture, visibleStepIds])
  const projectById = useMemo(() => new Map(view.projects.map((p) => [p.id, p])), [view.projects])
  const shown = useMemo(() => shownTasks(view.tasks, layout, projectById), [view.tasks, layout, projectById])

  // --- scrolling and viewport -------------------------------------------------------
  const scrollerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const scrollLeftRef = useRef(0)
  const prevScaleRef = useRef(scale)
  const rafRef = useRef(0)

  // Latest values for window listeners and imperative code.
  const latest = useRef({ doc, layout, scale, visibleStepIds, shown })
  useLayoutEffect(() => {
    latest.current = { doc, layout, scale, visibleStepIds, shown }
  })

  const readViewport = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    scrollLeftRef.current = el.scrollLeft
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() =>
      setViewport({ left: el.scrollLeft, top: el.scrollTop, width: el.clientWidth, height: el.clientHeight }),
    )
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const observer = new ResizeObserver(readViewport)
    observer.observe(el)
    return () => observer.disconnect()
  }, [readViewport])

  // Keep the day under the zoom anchor (pointer, or the centre) fixed when zoom changes.
  useLayoutEffect(() => {
    const prev = prevScaleRef.current
    prevScaleRef.current = scale
    const el = scrollerRef.current
    if (prev === scale || !el) return
    const anchor = uiStore.getState().zoomAnchorPx ?? SIDEBAR_WIDTH + (el.clientWidth - SIDEBAR_WIDTH) / 2
    const day = xToDay(prev, scrollLeftRef.current + anchor - SIDEBAR_WIDTH)
    el.scrollLeft = dayToX(scale, day) + SIDEBAR_WIDTH - anchor
    scrollLeftRef.current = el.scrollLeft
    // Update the visible range before paint; waiting for the scroll event would
    // draw one frame with the new zoom but the old scroll position (blocks vanish).
    setViewport((v) => ({ ...v, left: el.scrollLeft }))
  }, [scale])

  // Scroll so "now" sits a third of the way across: on load and when Today is pressed.
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const visibleWidth = el.clientWidth - SIDEBAR_WIDTH
    el.scrollLeft = dayToX(latest.current.scale, nowAsDayNumber()) - visibleWidth / 3
    scrollLeftRef.current = el.scrollLeft
    // Synchronously, so the first paint is right even if animation frames are paused (background tab).
    setViewport({ left: el.scrollLeft, top: el.scrollTop, width: el.clientWidth, height: el.clientHeight })
  }, [todayRequest])

  // Ctrl/Cmd+wheel (and trackpad pinch, which browsers report the same way) zooms; plain wheel scrolls.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const perUnit = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.002
      const ui = uiStore.getState()
      const anchor = Math.max(SIDEBAR_WIDTH, e.clientX - el.getBoundingClientRect().left)
      ui.setZoom(ui.zoom * Math.exp(-e.deltaY * perUnit), anchor)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // --- pointer helpers -----------------------------------------------------------
  const canvasPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) }
  }

  const commitGesture = () => {
    const ui = uiStore.getState()
    const g = ui.gesture
    if (g && (g.kind === 'move' || g.kind === 'resize' || g.kind === 'deadline')) {
      const ids = latest.current.visibleStepIds
      docStore.getState().apply((d) => applyGesture(d, g, ids))
      if (g.kind === 'move' && g.cloneIds) ui.select(g.cloneIds.values())
    }
    ui.setGesture(null)
  }

  const onBlockPointerDown = useCallback((e: ReactPointerEvent, taskId: string, part: BlockPart) => {
    if (e.button !== 0) return // middle button bubbles up to the canvas and pans
    e.stopPropagation()
    e.preventDefault()
    ;(document.activeElement as HTMLElement | null)?.blur()

    const ui = uiStore.getState()
    const task = latest.current.doc.tasks.find((t) => t.id === taskId)
    if (!task) return
    const wasSelected = ui.selection.has(taskId)
    const { shiftKey: shift, altKey: alt } = e
    if (docStore.getState().locked) {
      // View only: clicking still selects (to inspect), but nothing can be dragged.
      ui.select([taskId], shift ? 'toggle' : 'replace')
      return
    }
    if (!shift && !alt && !wasSelected) ui.select([taskId])

    const startClient = { x: e.clientX, y: e.clientY }
    const start = canvasPoint(e.clientX, e.clientY)
    const anchorIndex = latest.current.visibleStepIds.indexOf(task.stepId)
    let ids: ReadonlySet<string> = new Set()
    let cloneIds: Map<string, string> | null = null
    let started = false
    let last = { days: NaN, rowDelta: NaN }

    runPointerSession(
      (ev) => {
        if (!started) {
          if (Math.hypot(ev.clientX - startClient.x, ev.clientY - startClient.y) < DRAG_THRESHOLD_PX) return
          started = true
          const rolling = alt && part !== 'body'
          if (rolling || !wasSelected) {
            ids = new Set([taskId])
            uiStore.getState().select([taskId])
          } else {
            ids = new Set(uiStore.getState().selection)
          }
          if (alt && part === 'body') cloneIds = makeCloneIds(ids)
        }
        const { scale, layout, visibleStepIds } = latest.current
        const p = canvasPoint(ev.clientX, ev.clientY)
        const days = Math.round((p.x - start.x) / scale.dayWidth)
        let rowDelta = 0
        if (part === 'body' && !shift && anchorIndex >= 0) {
          const target = stepAtY(layout, p.y)
          rowDelta = target ? visibleStepIds.indexOf(target.id) - anchorIndex : 0
        }
        if (days === last.days && rowDelta === last.rowDelta) return
        last = { days, rowDelta }
        const g: Gesture =
          part === 'body'
            ? { kind: 'move', ids, days, rowDelta, ripple: shift, cloneIds }
            : { kind: 'resize', ids, edge: part, days, mode: alt ? 'rolling' : shift ? 'ripple' : 'normal' }
        uiStore.getState().setGesture(g)
      },
      () => {
        if (started) return commitGesture()
        // A click, not a drag.
        const s = uiStore.getState()
        if (shift) s.select([taskId], 'toggle')
        else if (!alt && s.selection.size > 1) s.select([taskId])
        else if (alt) s.select([taskId])
      },
    )
  }, [])

  const onCanvasPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current
    if (!el) return

    // Pan: middle button anywhere, or Alt + left button on empty canvas.
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault()
      const from = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
      uiStore.getState().setGesture({ kind: 'pan' })
      document.body.style.cursor = 'grabbing'
      runPointerSession(
        (ev) => {
          el.scrollLeft = from.left - (ev.clientX - from.x)
          el.scrollTop = from.top - (ev.clientY - from.y)
        },
        () => {
          document.body.style.cursor = ''
          uiStore.getState().setGesture(null)
        },
      )
      return
    }
    if (e.button !== 0) return

    // Selection box. Shift adds to the existing selection; a plain click clears it.
    ;(document.activeElement as HTMLElement | null)?.blur()
    const ui = uiStore.getState()
    const base = e.shiftKey ? new Set(ui.selection) : new Set<string>()
    if (!e.shiftKey) ui.clearSelection()
    const start = canvasPoint(e.clientX, e.clientY)
    let started = false

    runPointerSession(
      (ev) => {
        const p = canvasPoint(ev.clientX, ev.clientY)
        if (!started && Math.hypot(p.x - start.x, p.y - start.y) < DRAG_THRESHOLD_PX) return
        started = true
        const s = uiStore.getState()
        s.setGesture({ kind: 'marquee', x0: start.x, y0: start.y, x1: p.x, y1: p.y })
        const { scale, layout, shown } = latest.current
        const [minX, maxX] = [Math.min(start.x, p.x), Math.max(start.x, p.x)]
        const [minY, maxY] = [Math.min(start.y, p.y), Math.max(start.y, p.y)]
        const hits = shown.filter((t) => {
          const row = layout.stepById.get(t.stepId)
          if (!row) return false
          const x0 = dayToX(scale, toDayNumber(t.start))
          const x1 = x0 + t.duration * scale.dayWidth
          return x1 >= minX && x0 <= maxX && row.top + row.height >= minY && row.top <= maxY
        })
        s.select([...base, ...hits.map((t) => t.id)])
      },
      () => uiStore.getState().setGesture(null),
    )
  }

  const onCanvasPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointer.day = Math.floor(xToDay(scale, canvasPoint(e.clientX, e.clientY).x))
  }

  // Double-click empty space on a row to create a block and name it.
  const onCanvasDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const p = canvasPoint(e.clientX, e.clientY)
    const row = stepContainingY(layout, p.y)
    if (!row || !docStore.getState().ensureEditable()) return
    const project = doc.projects.find((pr) => !pr.archived)
    const task: Task = {
      id: newId('t'),
      projectId: project?.id ?? null,
      stepId: row.id,
      start: fromDayNumber(Math.floor(xToDay(scale, p.x))),
      duration: DEFAULT_BLOCK_DAYS,
      title: '',
      notes: '',
      subtasks: [],
    }
    docStore.getState().apply((d) => addTask(d, task))
    uiStore.getState().select([task.id])
    uiStore.getState().setEditing(task.id)
  }

  const onRename = useCallback((taskId: string) => {
    uiStore.getState().select([taskId])
    if (docStore.getState().ensureEditable()) uiStore.getState().setEditing(taskId)
  }, [])

  const onBlockContextMenu = useCallback((e: ReactMouseEvent, taskId: string) => {
    e.preventDefault()
    if (!docStore.getState().ensureEditable()) return
    const ui = uiStore.getState()
    if (!ui.selection.has(taskId)) ui.select([taskId])
    const ids = new Set(uiStore.getState().selection)
    const many = ids.size > 1
    ui.openContextMenu(e.clientX, e.clientY, [
      ...(many ? [] : [{ label: 'Rename', onSelect: () => onRename(taskId) }]),
      { label: many ? `Duplicate ${ids.size} blocks` : 'Duplicate', onSelect: () => duplicateBlocks(ids) },
      { label: many ? `Delete ${ids.size} blocks` : 'Delete', danger: true, divider: true, onSelect: () => deleteBlocks(ids) },
    ])
  }, [onRename])

  // Drag a deadline flag to move the deadline; click it to open the project.
  const onFlagPointerDown = (e: ReactPointerEvent, projectId: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    if (docStore.getState().locked) return uiStore.getState().showProject(projectId)
    const startX = e.clientX
    let started = false
    let lastDays = NaN
    runPointerSession(
      (ev) => {
        if (!started && Math.abs(ev.clientX - startX) < DRAG_THRESHOLD_PX) return
        started = true
        const days = Math.round((ev.clientX - startX) / latest.current.scale.dayWidth)
        if (days === lastDays) return
        lastDays = days
        uiStore.getState().setGesture({ kind: 'deadline', projectId, days })
      },
      () => {
        if (started) commitGesture()
        else uiStore.getState().showProject(projectId)
      },
    )
  }

  // --- what to draw -----------------------------------------------------------
  const width = contentWidth(scale)
  const canvasHeight = Math.max(layout.height + 160, viewport.height - TIMELINE_HEADER_HEIGHT)
  const lastRangeDay = originDay + 2 * RANGE_DAYS
  const firstDay = Math.max(originDay, Math.floor(xToDay(scale, viewport.left - SIDEBAR_WIDTH - RENDER_BUFFER_PX)))
  const lastDay = Math.min(lastRangeDay, Math.ceil(xToDay(scale, viewport.left + viewport.width - SIDEBAR_WIDTH + RENDER_BUFFER_PX)))
  const dayZoom = scale.dayWidth >= 24

  const ticks = useMemo(() => computeTicks(zoom, firstDay, lastDay, dayZoom), [zoom, firstDay, lastDay, dayZoom])
  const weekends = useMemo(() => (zoom > 0.15 ? weekendDays(firstDay, lastDay) : []), [zoom, firstDay, lastDay])
  const deadlineProjects = useMemo(() => view.projects.filter((p) => !p.archived && p.deadline), [view.projects])
  const visibleTasks = shown.filter((t) => {
    const start = toDayNumber(t.start)
    return start <= lastDay && start + t.duration >= firstDay
  })
  const editingTask = editingTaskId ? view.tasks.find((t) => t.id === editingTaskId) : undefined
  const editingRow = editingTask ? layout.stepById.get(editingTask.stepId) : undefined
  const marquee = gesture?.kind === 'marquee' ? gesture : null

  return (
    <div
      ref={scrollerRef}
      className="paper-scroll relative min-h-0 flex-1 overflow-auto bg-surface"
      onScroll={readViewport}
      onAuxClick={(e) => e.button === 1 && e.preventDefault()}
    >
      <div className="relative" style={{ width: SIDEBAR_WIDTH + width, height: TIMELINE_HEADER_HEIGHT + canvasHeight }}>
        {/* Sticky top band: corner + ruler/deadlines */}
        <div className="sticky top-0 z-30 flex" style={{ width: SIDEBAR_WIDTH + width }}>
          <div
            className="sticky left-0 z-40 flex shrink-0 flex-col border-r border-line bg-surface"
            style={{ width: SIDEBAR_WIDTH, height: TIMELINE_HEADER_HEIGHT }}
          >
            <div className="flex flex-1 items-end justify-between border-b border-line pr-2 pb-2 pl-4">
              <span className="text-[11px] font-medium tracking-[0.04em] text-ink-subtle uppercase">Rows</span>
              <button type="button" title="New category" aria-label="New category" onClick={createGroup} className={`${iconBtn} h-7 w-7`}>
                <Plus size={15} />
              </button>
            </div>
            <div className="flex items-center border-b border-line px-4 text-[12px] text-ink-subtle" style={{ height: DEADLINE_LANE_HEIGHT }}>
              Deadlines
            </div>
          </div>
          <TimelineHeader
            scale={scale}
            width={width}
            ticks={ticks}
            tickWidth={dayZoom ? scale.dayWidth : null}
            todayDay={Math.floor(nowDay)}
            nowDay={nowDay}
            projects={deadlineProjects}
            showFlagNames={zoom > 0.4}
            onFlagPointerDown={onFlagPointerDown}
          />
        </div>

        <div className="flex">
          <div className="sticky left-0 z-20 shrink-0" style={{ width: SIDEBAR_WIDTH }}>
            <RowLabels layout={layout} groups={doc.groups} height={canvasHeight} />
          </div>

          <div
            ref={canvasRef}
            className="relative shrink-0 overflow-hidden"
            style={{ width, height: canvasHeight }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onDoubleClick={onCanvasDoubleClick}
          >
            {/* Background layers (never receive pointer events) */}
            <div className="pointer-events-none absolute inset-0">
              {weekends.map((day) => (
                <div key={`we-${day}`} className="absolute top-0 bottom-0 bg-ink/[0.028]" style={{ left: dayToX(scale, day), width: scale.dayWidth }} />
              ))}
              {layout.rows.map((row) => (
                <div
                  key={`row-${row.id}`}
                  className={`absolute inset-x-0 border-b border-line ${row.kind === 'group' ? 'bg-subtle' : ''}`}
                  style={{ top: row.top, height: row.height }}
                />
              ))}
              <div className="absolute inset-x-0 bottom-0 bg-canvas/70" style={{ top: layout.height }} />
              {ticks.map((t) => (
                <div
                  key={`tick-${t.day}`}
                  className="absolute top-0 bottom-0 w-px bg-line"
                  style={{ left: dayToX(scale, t.day), opacity: t.major ? 1 : 0.55 }}
                />
              ))}
              {deadlineProjects.map((p) => (
                <div
                  key={`dl-${p.id}`}
                  className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed"
                  style={{ left: dayToX(scale, toDayNumber(p.deadline!) + 1) - 1, borderColor: projectSwatch(p.color).edge }}
                />
              ))}
              <div className="absolute top-0 bottom-0 z-30 w-[2px] bg-accent" style={{ left: dayToX(scale, nowDay) - 1 }} />
            </div>

            {visibleTasks.map((t) => {
              const row = layout.stepById.get(t.stepId)!
              const project = (t.projectId !== null && projectById.get(t.projectId)) || NO_PROJECT
              return (
                <TaskBlock
                  key={t.id}
                  task={t}
                  color={project.color}
                  projectName={project.name || 'Unnamed'}
                  left={dayToX(scale, toDayNumber(t.start))}
                  top={row.top}
                  width={t.duration * scale.dayWidth}
                  selected={selection.has(t.id)}
                  onPointerDown={onBlockPointerDown}
                  onRename={onRename}
                  onContextMenu={onBlockContextMenu}
                />
              )
            })}

            {marquee && (
              <div
                className="pointer-events-none absolute z-30 rounded-sm border border-accent bg-accent/10"
                style={{
                  left: Math.min(marquee.x0, marquee.x1),
                  top: Math.min(marquee.y0, marquee.y1),
                  width: Math.abs(marquee.x1 - marquee.x0),
                  height: Math.abs(marquee.y1 - marquee.y0),
                }}
              />
            )}

            {editingTask && editingRow && (
              <TitleEditor
                key={editingTask.id}
                initial={editingTask.title}
                left={dayToX(scale, toDayNumber(editingTask.start))}
                top={editingRow.top}
                width={editingTask.duration * scale.dayWidth}
                onCommit={(title) => {
                  docStore.getState().apply((d) => updateTask(d, editingTask.id, { title }))
                  uiStore.getState().setEditing(null)
                }}
                onCancel={() => uiStore.getState().setEditing(null)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
