import type { ItemKind } from '@/lib/estimate'
import type { ProfileSpec } from '@/lib/metal'

export type DocKind = 'pdf' | 'sheet' | 'docx' | 'odt' | 'image' | 'text' | 'dxf' | 'archive' | 'cad' | 'other'

export interface DocFile {
  id: string
  /** Path inside the uploaded package, e.g. «Проект.zip/КМ/Спецификация.xlsx». */
  path: string
  name: string
  ext: string
  size: number
  kind: DocKind
  data: Uint8Array
  /** Id of the archive this file was extracted from. */
  parentId?: string
}

export type Cell = string | number
export interface DocTable {
  /** Sheet name, «Стр. 3» or «Таблица 2». */
  title: string
  rows: Cell[][]
}

export interface Position {
  id: string
  fileId: string
  /** Where it was found: sheet / page / table title. */
  source: string
  /** Section heading above the row, if any. */
  group?: string
  name: string
  unit: string
  qty: number
  price: number
  sum: number
  /** Total mass of the line when known (mass column or computed from a profile). */
  massKg?: number
  /** Rough (черновой) mass incl. cutting waste, when the document gives it. */
  massGrossKg?: number
  /** Price-catalog key (₸/т) when the row is a recognised metal profile with known mass. */
  metalPriceKey?: string
  kind: ItemKind
}

export interface MetalHit {
  id: string
  fileId: string
  source: string
  /** Original text of the line. */
  raw: string
  profile: ProfileSpec
  /** Normalised profile name, e.g. «Уголок 50×5». */
  name: string
  kgPerM: number
  qty: number
  unit: string
  /** null when the row lacks the data needed to get mass. */
  massKg: number | null
  massGrossKg?: number
  massFrom: 'column' | 'unit' | 'length' | 'none'
}

export interface DocAnalysis {
  status: 'pending' | 'processing' | 'done' | 'error' | 'unsupported'
  error?: string
  /** Plain text for search; capped to keep memory reasonable. */
  text: string
  pages?: number
  tables: DocTable[]
  positions: Position[]
  metal: MetalHit[]
  /** Sanitised HTML for DOCX preview. */
  html?: string
  notes?: string[]
}
