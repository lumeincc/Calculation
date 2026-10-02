import { lang, locale, Tf } from '@/i18n'
const cache = new Map<string, Intl.NumberFormat>()

function nf(min: number, max: number): Intl.NumberFormat {
  const key = `${min}:${max}`
  let f = cache.get(key)
  if (!f) {
    f = new Intl.NumberFormat(locale, { minimumFractionDigits: min, maximumFractionDigits: max })
    cache.set(key, f)
  }
  return f
}

/** 12345.678 → "12 345,68" */
export function fmt(n: number, digits = 2, minDigits = 0): string {
  if (!Number.isFinite(n)) return '—'
  return nf(minDigits, digits).format(n)
}

export function fmtInt(n: number): string {
  return fmt(n, 0)
}

/** Money with 2 fixed decimals and the ruble sign. */
export function money(n: number, withSign = true): string {
  const s = fmt(n, 2, 2)
  return withSign ? `${s} ₸` : s
}

/** Mass in kg presented as "850 кг" or "12,35 т" depending on magnitude. */
export function mass(kg: number): string {
  return kg >= 1000 ? Tf('{0} т', [fmt(kg / 1000, 3)]) : Tf('{0} кг', [fmt(kg, 1)])
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Russian plural: plural(5, ['позиция', 'позиции', 'позиций']) → "позиций" */
export function plural(n: number, forms: [string, string, string]): string {
  if (lang === 'en') return Math.abs(n) === 1 ? forms[0] : forms[2]
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}
