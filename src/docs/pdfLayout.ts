/**
 * PDF text has no table structure — only positioned text runs. These helpers rebuild lines,
 * then align cells to the columns of a detected header so spec tables survive extraction.
 */
import { detectHeader } from './tables'
import type { Cell } from './types'

export interface PdfItem {
  str: string
  x: number
  y: number
  w: number
  h: number
}

export interface PdfCell {
  text: string
  x0: number
  x1: number
}

export function itemsToLines(items: PdfItem[]): PdfCell[][] {
  const sorted = items.filter((i) => i.str.trim() !== '').sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: PdfItem[][] = []
  for (const it of sorted) {
    const line = lines[lines.length - 1]
    const tol = Math.max(2, (it.h || 8) * 0.45)
    if (line && Math.abs(line[0].y - it.y) <= tol) line.push(it)
    else lines.push([it])
  }
  return lines.map((line) => {
    line.sort((a, b) => a.x - b.x)
    const cells: PdfCell[] = []
    let cur: PdfCell | null = null
    for (const it of line) {
      const charW = it.str.length ? it.w / it.str.length : 4
      if (cur && it.x - cur.x1 <= Math.max(4, charW * 1.6)) {
        cur.text += (it.x - cur.x1 > charW * 0.25 ? ' ' : '') + it.str
        cur.x1 = Math.max(cur.x1, it.x + it.w)
      } else {
        if (cur) cells.push(cur)
        cur = { text: it.str, x0: it.x, x1: it.x + it.w }
      }
    }
    if (cur) cells.push(cur)
    return cells.map((c) => ({ ...c, text: c.text.replace(/\s+/g, ' ').trim() }))
  })
}

export type Columns = [number, number][]

/** Columns = merged x-intervals of the header cells. */
function columnsFrom(lines: PdfCell[][]): Columns {
  const iv = lines.flat().map((c) => [c.x0, c.x1] as [number, number]).sort((a, b) => a[0] - b[0])
  const cols: Columns = []
  for (const [a, b] of iv) {
    const last = cols[cols.length - 1]
    if (last && a <= last[1] - 1) last[1] = Math.max(last[1], b)
    else cols.push([a, b])
  }
  return cols
}

function place(line: PdfCell[], cols: Columns): Cell[] {
  const out: string[] = cols.map(() => '')
  for (const c of line) {
    const mid = (c.x0 + c.x1) / 2
    let best = 0
    let bestD = Infinity
    cols.forEach(([a, b], i) => {
      const d = mid < a ? a - mid : mid > b ? mid - b : 0
      if (d < bestD) [best, bestD] = [i, d]
    })
    out[best] = out[best] ? `${out[best]} ${c.text}` : c.text
  }
  return out
}

/**
 * Aligns one page. `carry` is the header (lines + columns) of the previous page so that
 * continuation pages without their own header are still parsed.
 */
export function alignPage(lines: PdfCell[][], carry?: { header: PdfCell[][]; cols: Columns }) {
  const plain = lines.map((l) => l.map((c) => c.text))
  const h = detectHeader(plain)
  if (h) {
    const headerLines = lines.slice(h.headerRow, h.dataStart)
    const cols = columnsFrom(headerLines)
    if (cols.length >= 2) {
      return { rows: lines.map((l) => place(l, cols)), carry: { header: headerLines, cols } }
    }
  }
  if (carry) {
    return { rows: [...carry.header.map((l) => place(l, carry.cols)), ...lines.map((l) => place(l, carry.cols))], carry }
  }
  return { rows: plain as Cell[][], carry: undefined }
}
