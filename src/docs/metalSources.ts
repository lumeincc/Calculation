/**
 * Project packages describe the same metal several times (summary «Выборка металла», registry,
 * tech card, per-drawing specs). Summing them all multiplies the tonnage, so documents that carry
 * the same total are treated as duplicates and only one of them is counted by default.
 */
import type { MetalHit } from './types'

export interface MetalSource {
  fileId: string
  name: string
  kg: number
  rows: number
  summary: boolean
  /** File id of the document this one duplicates. */
  duplicateOf?: string
}

const SUMMARY_RE = /выборк|сводн|итог|ведомост\S* металл|спецификац\S* металл/i

/** Two totals within 0.5% are considered the same metal. */
const same = (a: number, b: number) => a > 0 && b > 0 && Math.abs(a - b) <= 0.005 * Math.max(a, b)

export function metalSources(files: { id: string; name: string }[], hits: MetalHit[]): { sources: MetalSource[]; selected: Set<string> } {
  const sources: MetalSource[] = []
  for (const f of files) {
    const own = hits.filter((h) => h.fileId === f.id)
    if (!own.length) continue
    sources.push({ fileId: f.id, name: f.name, kg: own.reduce((s, h) => s + (h.massKg ?? 0), 0), rows: own.length, summary: SUMMARY_RE.test(f.name) })
  }
  // Within each group of equal totals keep the summary document (or the one with fewer rows).
  const rank = (s: MetalSource) => (s.summary ? 0 : 1) * 1e9 + s.rows
  const ordered = [...sources].sort((a, b) => rank(a) - rank(b))
  const kept: MetalSource[] = []
  for (const s of ordered) {
    const twin = kept.find((k) => same(k.kg, s.kg))
    if (twin) s.duplicateOf = twin.fileId
    else kept.push(s)
  }
  return { sources, selected: new Set(kept.filter((k) => k.kg > 0).map((k) => k.fileId)) }
}
