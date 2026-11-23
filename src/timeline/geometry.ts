// Sizes and coordinate maths for the timeline canvas.

export const DAY_WIDTH = 40 // px per day at zoom 1
export const STEP_ROW_HEIGHT = 68
export const GROUP_ROW_HEIGHT = 36
export const BLOCK_INSET = 6 // vertical gap between a block and its row edges
export const RULER_HEIGHT = 48
export const DEADLINE_LANE_HEIGHT = 40
export const TIMELINE_HEADER_HEIGHT = RULER_HEIGHT + DEADLINE_LANE_HEIGHT
export const SIDEBAR_WIDTH = 220
export const MIN_ZOOM = 0.01
export const MAX_ZOOM = 3
/** Days shown either side of today. */
export const RANGE_DAYS = 3650
export const DEFAULT_BLOCK_DAYS = 5
/** Pointer travel before a press on a block becomes a drag. */
export const DRAG_THRESHOLD_PX = 3
/** Extra px rendered beyond each side of the viewport. */
export const RENDER_BUFFER_PX = 1200

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

/** Maps between day numbers and canvas x for one zoom level. `originDay` sits at x = 0. */
export interface Scale {
  originDay: number
  dayWidth: number
}

export const makeScale = (originDay: number, zoom: number): Scale => ({ originDay, dayWidth: DAY_WIDTH * zoom })
export const dayToX = (s: Scale, day: number) => (day - s.originDay) * s.dayWidth
export const xToDay = (s: Scale, x: number) => s.originDay + x / s.dayWidth
export const contentWidth = (s: Scale) => 2 * RANGE_DAYS * s.dayWidth
