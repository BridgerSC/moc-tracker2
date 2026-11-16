export const FALLBACK_COLOR = '#666666'

const HEX6_RE = /^#[0-9a-f]{6}$/i
const HEX3_RE = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i
// Very old data stored Tailwind classes such as "bg-[#FFD166]".
const TAILWIND_CLASS_RE = /^bg-\[(#[0-9a-f]{3,6})\]$/i

/** Returns an uppercase "#RRGGBB" colour, or null if the value isn't one. */
export function parseColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  const fromClass = TAILWIND_CLASS_RE.exec(trimmed)?.[1]
  const candidate = fromClass ?? trimmed
  if (HEX6_RE.test(candidate)) return candidate.toUpperCase()
  const short = HEX3_RE.exec(candidate)
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase()
  return null
}
