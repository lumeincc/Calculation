/** Numeric helpers shared by all calculators. */

const EPS = 1e-9

/** Math.ceil that ignores float noise: ceil(10.000000001) === 10. */
export function ceil(x: number): number {
  return Math.ceil(x - EPS)
}

/** Math.floor that ignores float noise: floor(2.9999999999) === 3. */
export function floor(x: number): number {
  return Math.floor(x + EPS)
}

export function round(x: number, digits = 2): number {
  const k = 10 ** digits
  return Math.round((x + Number.EPSILON) * k) / k
}

/** Coerce anything to a finite non-negative number (empty input → 0). */
export function num(x: unknown): number {
  const n = typeof x === 'number' ? x : Number.parseFloat(String(x ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function pos(x: unknown): number {
  return Math.max(0, num(x))
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0)
}

export function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x))
}

export const deg2rad = (d: number) => (d * Math.PI) / 180
export const rad2deg = (r: number) => (r * 180) / Math.PI

/** Parse user-typed decimals, accepting both "2,5" and "2.5" and spaces as thousands separators. */
export function parseDecimal(input: string): number | null {
  const s = input.replace(/\s| /g, '').replace(',', '.')
  if (s === '' || s === '-' || s === '.') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
