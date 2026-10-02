/**
 * Interface language. Russian strings in the code are the translation keys; other languages map
 * them in a dictionary (exact strings, plus templates with {0}, {1}… for dynamic parts).
 * The language is fixed for a page load — switching reloads the page, so even module-level
 * constants (calculator definitions, catalogs) are built in the right language.
 */
import { en } from './en'

export type Lang = 'ru' | 'en'
export const LANGS: { value: Lang; label: string; short: string }[] = [
  { value: 'ru', label: 'Русский', short: 'RU' },
  { value: 'en', label: 'English', short: 'EN' },
]

const KEY = 'sr-lang'

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'ru' || saved === 'en') return saved
  } catch {
    /* storage unavailable */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'ru'
  return /^(ru|kk|uk|be|ky|uz|tg|hy|az)/.test(nav) ? 'ru' : 'en'
}

export const lang: Lang = typeof window === 'undefined' ? 'ru' : detect()
export const locale = lang === 'en' ? 'en-US' : 'ru-RU'
if (typeof document !== 'undefined') document.documentElement.lang = lang

export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l)
  } catch {
    /* ignore */
  }
  document.documentElement.lang = l
  location.reload()
}

const dict: Record<string, string> = lang === 'en' ? en : {}

/** Templates: «Мешков по {0} кг» → regex, for strings assembled at runtime elsewhere. */
const templates = Object.keys(dict)
  .filter((k) => k.includes('{0}'))
  .map((k) => {
    const parts = k.split(/\{\d\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const order = [...k.matchAll(/\{(\d)\}/g)].map((m) => Number(m[1]))
    return { re: new RegExp(`^${parts.join('(.+?)')}$`), order, out: dict[k] }
  })

function fill(s: string, args: unknown[]): string {
  return s.replace(/\{(\d)\}/g, (_, i: string) => String(args[Number(i)] ?? ''))
}

/** Translates a Russian UI string (returns it unchanged in Russian or when no translation exists). */
export function T(ru: string): string {
  if (lang === 'ru' || !ru) return ru
  const exact = dict[ru]
  if (exact !== undefined) return exact
  const trimmed = ru.trim()
  if (trimmed !== ru && dict[trimmed] !== undefined) return ru.replace(trimmed, dict[trimmed])
  for (const tpl of templates) {
    const m = ru.match(tpl.re)
    if (m) {
      const args: string[] = []
      tpl.order.forEach((idx, i) => (args[idx] = T(m[i + 1])))
      return fill(tpl.out, args)
    }
  }
  return ru
}

/** Translates a template with placeholders: Tf(«Мешков по {0} кг», [bag]). */
export function Tf(ru: string, args: unknown[]): string {
  const tpl = lang === 'ru' ? ru : (dict[ru] ?? ru)
  return fill(tpl, args)
}
