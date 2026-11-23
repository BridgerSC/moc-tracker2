// Shared class names for controls, so every button and field looks the same.

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dashed'

const base =
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-40'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover shadow-card',
  secondary: 'border border-line bg-surface text-ink hover:bg-subtle hover:border-line-strong shadow-card',
  ghost: 'text-ink-muted hover:bg-sunken hover:text-ink',
  danger: 'border border-line bg-surface text-danger hover:bg-danger-soft hover:border-danger/40',
  dashed: 'border border-dashed border-line-strong text-ink-muted hover:border-accent hover:text-accent-ink hover:bg-accent-soft/40',
}

export function btn(variant: Variant = 'secondary', size: 'sm' | 'md' = 'md') {
  return `${base} ${variants[variant]} ${size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]'}`
}

export const iconBtn =
  'inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-35'

export const input =
  'h-8 w-full min-w-0 rounded-md border border-line bg-surface px-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-subtle hover:border-line-strong focus:border-accent focus:ring-3 focus:ring-accent/15 disabled:bg-subtle disabled:text-ink-muted'

export const textarea = `${input} h-auto min-h-[96px] resize-y py-2 leading-relaxed paper-scroll`

export const fieldLabel = 'mb-1.5 block text-[12px] font-medium text-ink-muted'

/** Track + item classes for a segmented control. */
export const segmented = {
  track: 'inline-flex items-center gap-0.5 rounded-md bg-sunken p-0.5',
  item: (active: boolean) =>
    `h-7 cursor-pointer rounded-[5px] px-2.5 text-[12px] font-medium transition-colors ${
      active ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
    }`,
}

export const dialog = {
  backdrop: 'fixed inset-0 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]',
  panel: 'w-full rounded-lg border border-line bg-surface p-6 shadow-pop',
  title: 'm-0 text-[17px] font-semibold tracking-[-0.01em] text-ink',
}

/** Status colours shared by sub-tasks now and shots later: told apart by lightness as well as hue. */
export const STATUS_STYLES = {
  todo: { label: 'To do', fill: '#E7E7E2', ink: '#3F3F3A', edge: '#BDBDB6' },
  progress: { label: 'In progress', fill: '#BFD5FB', ink: '#123A8A', edge: '#5B8DEF' },
  review: { label: 'Review', fill: '#FDE2A7', ink: '#6B4500', edge: '#E0A324' },
  done: { label: 'Done', fill: '#B8EBD3', ink: '#0B5236', edge: '#2FA877' },
} as const
