import type { Task } from '../model/types'

// Copy/paste of blocks within the app, plus where the pointer last was so a
// paste lands under it. Plain module state: none of this needs to re-render.

let copied: readonly Task[] = []
let pointerDay: number | null = null

export const clipboard = {
  copy(tasks: readonly Task[]) {
    copied = tasks
  },
  get tasks() {
    return copied
  },
}

export const pointer = {
  set day(day: number | null) {
    pointerDay = day
  },
  get day() {
    return pointerDay
  },
}
