/**
 * Project packages describe the same metal several times: a summary «Выборка металла», a registry,
 * a tech card and every assembly drawing. Summing them multiplies the tonnage, so:
 * - documents with the same total are duplicates — only one is counted;
 * - when a summary exists, only the summary is counted by default, and the remaining documents
 *   (e.g. all drawings together) are shown as a cross-check against it.
 */
import { DRAWING_SOURCE } from './drawingSpec'
import type { DocKind, MetalHit, Position } from './types'

export interface MetalSource {
  fileId: string
  name: string
  kg: number
  rows: number
  summary: boolean
  /** An assembly drawing: one item of the package, never a duplicate of another drawing. */
  drawing: boolean
  /** File id of the document this one duplicates. */
  duplicateOf?: string
  /** Not counted because a summary covers it. */
  covered?: boolean
}

export interface SourceFile {
  id: string
  name: string
  kind: DocKind
}

const SUMMARY_RE = /выборк|сводн|итог|ведомост\S* металл|спецификац\S* металл/i

/** Two totals within 0.5% are considered the same metal. */
const same = (a: number, b: number) => a > 0 && b > 0 && Math.abs(a - b) <= 0.005 * Math.max(a, b)

export interface MetalSourcesResult {
  sources: MetalSource[]
  selected: Set<string>
  /** Sum of documents covered by the summary, for the cross-check. */
  check?: { coveredKg: number; summaryKg: number; files: number }
}

export function metalSources(files: SourceFile[], hits: MetalHit[]): MetalSourcesResult {
  const sources: MetalSource[] = []
  for (const f of files) {
    const own = hits.filter((h) => h.fileId === f.id)
    if (!own.length) continue
    sources.push({
      fileId: f.id, name: f.name, kg: own.reduce((s, h) => s + (h.massKg ?? 0), 0), rows: own.length,
      summary: SUMMARY_RE.test(f.name), drawing: own.every((h) => h.source === DRAWING_SOURCE),
    })
  }
  // Within each group of equal totals keep the summary document (or the one with fewer rows).
  const rank = (s: MetalSource) => (s.summary ? 0 : 1) * 1e9 + s.rows
  const kept: MetalSource[] = []
  for (const s of [...sources].sort((a, b) => rank(a) - rank(b))) {
    // Identical drawings (two equal beams) are separate items; only package-wide lists duplicate.
    const twin = s.drawing ? undefined : kept.find((k) => !k.drawing && same(k.kg, s.kg))
    if (twin) s.duplicateOf = twin.fileId
    else kept.push(s)
  }
  const summaries = kept.filter((k) => k.summary && k.kg > 0)
  if (!summaries.length) return { sources, selected: new Set(kept.filter((k) => k.kg > 0).map((k) => k.fileId)) }

  const covered = kept.filter((k) => !k.summary)
  for (const c of covered) c.covered = true
  return {
    sources,
    selected: new Set(summaries.map((s) => s.fileId)),
    check: covered.length
      ? { coveredKg: covered.reduce((a, c) => a + c.kg, 0), summaryKg: summaries.reduce((a, c) => a + c.kg, 0), files: covered.length }
      : undefined,
  }
}

export interface ExtraMetal {
  fileId: string
  name: string
  kg: number
  rows: number
}

const EXTRA_RE = /настил|метиз|анкер|болт|гайк|шайб|шпильк|решетчат|решётчат/i

/**
 * Metal that is not rolled sections — gratings, fasteners — listed by weight only.
 * Spreadsheets are preferred: PDF drawings of the same gratings would double count.
 */
export function extraMetal(files: SourceFile[], positions: Position[]): ExtraMetal[] {
  const groups = files
    .map((f) => {
      const rows = positions.filter((p) => p.fileId === f.id && (p.massKg ?? 0) > 0 && !p.metalPriceKey && (EXTRA_RE.test(f.name) || EXTRA_RE.test(p.name)))
      return { fileId: f.id, name: f.name, kind: f.kind, kg: rows.reduce((s, p) => s + (p.massKg ?? 0), 0), rows: rows.length }
    })
    .filter((g) => g.kg > 0)
  const nonPdf = groups.filter((g) => g.kind !== 'pdf')
  return (nonPdf.length ? nonPdf : groups).map(({ kind: _kind, ...g }) => g)
}
