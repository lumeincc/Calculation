/**
 * Assembly drawings (КМД) carry a small «Спецификация» with a three-line header that does not
 * survive PDF text extraction as a table. Detail rows are still recognisable on their own:
 * «G-1 | 1 | Тр.кв.160X160X5.0 | 5862 | C255 | 139.7 | 139.7» — mark, qty, section, length,
 * steel, mass of one, mass of all. The drawing also states «Вес марки» and «Вес всех марок»,
 * whose ratio is the number of identical assemblies.
 */
import { kgPerMetre, profileName } from '@/lib/metal'
import { parseProfile } from '@/lib/metalParse'
import { uid } from '@/lib/id'
import { parseNum } from './tables'
import type { DocTable, MetalHit } from './types'

export const DRAWING_SOURCE = 'Спецификация чертежа'

const num = (s: string | undefined) => (s === undefined ? null : parseNum(s.replace(/\s*кг\.?$/i, '')))

/** Number labelled by `re`: in the same cell («Вес марки: 67.6 кг»), later cells, or the next line. */
function findAfter(lines: string[][], re: RegExp): number | null {
  for (let li = 0; li < lines.length; li++) {
    const l = lines[li]
    for (let i = 0; i < l.length; i++) {
      if (!re.test(l[i])) continue
      const inline = l[i].match(/:\s*([\d\s.,]+)\s*кг/i)
      if (inline && num(inline[1])) return num(inline[1])
      const rest = [...l.slice(i + 1), ...(lines[li + 1] ?? [])]
      // Prefer «173.5 кг» over bare numbers (a bare «1» nearby is usually a quantity).
      for (const c of [...rest.filter((x) => /кг/i.test(x)), ...rest.filter((x) => /^[\d\s.,]+$/.test(x))]) {
        const v = num(c)
        if (v !== null && v > 0) return v
      }
    }
  }
  return null
}

export function extractDrawingSpec(tables: DocTable[], fileId: string): { hits: MetalHit[]; marks: number; totalKg: number } | null {
  const lines = tables.flatMap((t) => t.rows.map((r) => r.map((c) => String(c ?? '').trim())))
  const one = findAfter(lines, /^вес\s+марки/i)
  // «Вес всех марок» may be glued to neighbouring text; the shipping list «Всего:» says the same.
  const all = findAfter(lines, /вес\s+всех\s+марок/i) ?? findAfter(lines, /^всего:?$/i) ?? one
  if (all === null) return null
  const marks = one ? Math.max(1, Math.round(all / one)) : 1
  const hits: MetalHit[] = []
  const seen = new Set<string>()
  const partial: { profile: NonNullable<ReturnType<typeof parseProfile>>; raw: string; mAll: number }[] = []
  for (const l of lines) {
    for (let p = 1; p < l.length; p++) {
      const profile = /[a-zа-я]|^[-–—]/i.test(l[p]) ? parseProfile(l[p]) : null
      if (!profile) continue
      const qty = num(l[p - 1])
      const nums = l.slice(p + 1).map(num).filter((x): x is number => x !== null)
      if (qty === null || !Number.isInteger(qty) || qty <= 0) continue
      if (nums.length < 3) {
        // Columns glued by the PDF («243Лист ромб 4,07.7»): keep the last number for reconciliation.
        const last = num(l[l.length - 1])
        if (last && last > 0) partial.push({ profile, raw: l[p], mAll: last })
        continue
      }
      const [len, m1, mAll] = [nums[0], nums[nums.length - 2], nums[nums.length - 1]]
      // Guard against dimension lines: mass of all must equal qty × mass of one (rounded).
      if (!(mAll > 0) || Math.abs(m1 * qty - mAll) > Math.max(0.15 * mAll, 0.2)) continue
      const key = l.join('|')
      if (seen.has(key)) continue
      seen.add(key)
      const massKg = mAll * marks
      hits.push({
        id: uid(), fileId, source: DRAWING_SOURCE, raw: l[p], profile, name: profileName(profile),
        kgPerM: kgPerMetre(profile), qty: (len / 1000) * qty * marks, unit: 'м', massKg, massFrom: 'column',
      })
      break
    }
  }
  // A glued row is accepted when it exactly closes the gap to «Вес марки» minus welds.
  if (one !== null && partial.length) {
    const welds = findAfter(lines, /вес\s+сварных\s+швов/i) ?? 0
    const parsed = hits.reduce((acc, h) => acc + (h.massKg ?? 0), 0) / marks
    const gap = one - welds - parsed
    const fit = partial.find((x) => Math.abs(x.mAll - gap) <= Math.max(0.02 * x.mAll, 0.3))
    if (fit) {
      hits.push({
        id: uid(), fileId, source: DRAWING_SOURCE, raw: fit.raw, profile: fit.profile, name: profileName(fit.profile),
        kgPerM: kgPerMetre(fit.profile), qty: 0, unit: '', massKg: fit.mAll * marks, massFrom: 'column',
      })
    }
  }
  return hits.length ? { hits, marks, totalKg: all } : null
}
