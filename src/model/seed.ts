import { addDays, localToday } from './dates'
import type { TimelineDoc } from './types'

/** Example content for a first run with nothing saved (mirrors v4.8's seed, placed around today). */
export function seedDoc(today = localToday()): TimelineDoc {
  const d = (offset: number) => addDays(today, offset)
  return {
    projects: [
      { id: 'p1', name: 'Alpha Commercial', color: '#FFD166', deadline: d(14), archived: false, notes: '' },
      { id: 'p2', name: 'Beta Campaign', color: '#06D6A0', deadline: null, archived: false, notes: '' },
      { id: 'p3', name: 'Internal Training', color: '#118AB2', deadline: d(30), archived: false, notes: '' },
    ],
    groups: [
      { id: 'g1', name: 'Phase 1: Pre-Production', steps: [{ id: 's1', name: 'Pre-Production' }, { id: 's2', name: 'Scripting' }] },
      { id: 'g2', name: 'Phase 2: Production', steps: [{ id: 's3', name: 'Shooting' }, { id: 's4', name: 'Editing' }] },
      { id: 'g3', name: 'Phase 3: Finalization', steps: [{ id: 's5', name: 'VFX / Color' }, { id: 's6', name: 'Final Review' }] },
    ],
    tasks: [
      {
        id: 't1', projectId: 'p1', stepId: 's2', start: d(-2), duration: 5, title: 'Draft 1', notes: '',
        subtasks: [
          { id: 'st1', title: 'Write outline', status: 'done' },
          { id: 'st2', title: 'First pass', status: 'done' },
        ],
      },
      {
        id: 't2', projectId: 'p1', stepId: 's3', start: d(4), duration: 3, title: 'Studio A', notes: '',
        subtasks: [
          { id: 'st3', title: 'Lighting setup', status: 'progress' },
          { id: 'st4', title: 'Camera check', status: 'todo' },
        ],
      },
      { id: 't3', projectId: 'p2', stepId: 's1', start: d(0), duration: 10, title: 'Moodboards', notes: '', subtasks: [] },
    ],
  }
}
