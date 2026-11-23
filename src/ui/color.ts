// Colour helpers for project colours on the light "Paper" theme.

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

export const rgba = (hex: string, alpha: number) => `rgba(${rgb(hex).join(',')},${alpha})`

/** Mixes a colour with white: 0 = unchanged, 1 = white. */
export function tint(hex: string, amount: number): string {
  return '#' + rgb(hex).map((v) => Math.round(v + (255 - v) * amount).toString(16).padStart(2, '0')).join('')
}

/** How a project colour is drawn as a timeline block or pill: a pastel fill, a firmer edge, the pure colour as a dot. */
export function projectSwatch(hex: string) {
  return { fill: tint(hex, 0.7), edge: tint(hex, 0.35), dot: hex, track: tint(hex, 0.45) }
}
