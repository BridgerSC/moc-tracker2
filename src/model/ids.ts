// Random IDs. v4.8 used Date.now(), which collided when two things were created
// in the same millisecond and was not unique across people editing at once.

export type IdPrefix = 'p' | 'g' | 's' | 't' | 'st'

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`
}
