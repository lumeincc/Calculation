/**
 * Estimate (смета) domain model and the totals calculation.
 * Everything here is pure so it can be unit-tested and later reused by a server.
 */
import { uid } from './id'
import { round } from './num'

export type ItemKind = 'material' | 'work' | 'machine' | 'transport' | 'other'

export const KINDS: ItemKind[] = ['material', 'work', 'machine', 'transport', 'other']

export const KIND_LABEL: Record<ItemKind, { one: string; many: string; short: string }> = {
  material: { one: 'Материал', many: 'Материалы', short: 'М' },
  work: { one: 'Работа', many: 'Работы', short: 'Р' },
  machine: { one: 'Механизм', many: 'Машины и механизмы', short: 'Мх' },
  transport: { one: 'Доставка', many: 'Доставка', short: 'Д' },
  other: { one: 'Прочее', many: 'Прочие затраты', short: 'П' },
}

export const UNITS = [
  'шт', 'м', 'п.м', 'м²', 'м³', 'т', 'кг', 'л', 'упак', 'мешок', 'рулон', 'лист',
  'компл', 'ч', 'маш.-ч', 'рейс', 'смена', 'усл. ед.',
]

export interface EstimateItem {
  id: string
  kind: ItemKind
  name: string
  unit: string
  qty: number
  price: number
  note?: string
  /** Calculator id the line came from, for traceability. */
  source?: string
}

export interface EstimateSection {
  id: string
  name: string
  items: EstimateItem[]
}

export type VatMode = 'none' | 'on_top' | 'included'

export interface EstimateSettings {
  /** Наценка на материалы, % от стоимости материалов. */
  materialsMarkupPct: number
  /** Накладные расходы, % от стоимости работ и механизмов. */
  overheadPct: number
  /** Сметная прибыль, % от стоимости работ и механизмов. */
  profitPct: number
  /** Непредвиденные затраты, % от суммы прямых затрат, наценки, НР и СП. */
  contingencyPct: number
  discountPct: number
  vatMode: VatMode
  vatPct: number
}

export type DocType = 'estimate' | 'offer'

export interface Estimate {
  id: string
  name: string
  object: string
  client: string
  notes: string
  docType: DocType
  createdAt: number
  updatedAt: number
  sections: EstimateSection[]
  settings: EstimateSettings
}

export const DEFAULT_ESTIMATE_SETTINGS: EstimateSettings = {
  materialsMarkupPct: 0,
  overheadPct: 0,
  profitPct: 0,
  contingencyPct: 0,
  discountPct: 0,
  vatMode: 'none',
  vatPct: 22,
}

export function createSection(name = 'Новый раздел', items: EstimateItem[] = []): EstimateSection {
  return { id: uid(), name, items }
}

export function createItem(patch: Partial<EstimateItem> = {}): EstimateItem {
  return { id: uid(), kind: 'material', name: '', unit: 'шт', qty: 1, price: 0, ...patch }
}

export function createEstimate(
  name = 'Новая смета',
  settings: Partial<EstimateSettings> = {},
): Estimate {
  const now = Date.now()
  return {
    id: uid(),
    name,
    object: '',
    client: '',
    notes: '',
    docType: 'estimate',
    createdAt: now,
    updatedAt: now,
    sections: [createSection('Раздел 1')],
    settings: { ...DEFAULT_ESTIMATE_SETTINGS, ...settings },
  }
}

/** Line cost rounded to kopecks, as in printed estimates. */
export function lineTotal(item: Pick<EstimateItem, 'qty' | 'price'>): number {
  return round((Number(item.qty) || 0) * (Number(item.price) || 0), 2)
}

export function sectionTotal(section: EstimateSection): number {
  return round(section.items.reduce((s, it) => s + lineTotal(it), 0), 2)
}

/** Mass of a line in kg when its unit is a mass unit, else 0. Used for the tonnage summary. */
export function lineMassKg(item: Pick<EstimateItem, 'qty' | 'unit'>): number {
  const u = item.unit.trim().toLowerCase().replace(/\.$/, '')
  if (u === 'т' || u === 'тн' || u === 'тонн' || u === 'тонна') return item.qty * 1000
  if (u === 'кг') return item.qty
  return 0
}

export interface EstimateTotals {
  byKind: Record<ItemKind, number>
  direct: number
  materialsMarkup: number
  overhead: number
  profit: number
  contingency: number
  subtotal: number
  discount: number
  /** Сумма после скидки (без НДС при режиме «сверху», с НДС при режиме «в т.ч.»). */
  net: number
  vat: number
  total: number
  massKg: number
  itemsCount: number
}

export function computeTotals(estimate: Pick<Estimate, 'sections' | 'settings'>): EstimateTotals {
  const s = estimate.settings
  const byKind: Record<ItemKind, number> = { material: 0, work: 0, machine: 0, transport: 0, other: 0 }
  let massKg = 0
  let itemsCount = 0
  for (const section of estimate.sections) {
    for (const item of section.items) {
      byKind[item.kind] = (byKind[item.kind] ?? 0) + lineTotal(item)
      massKg += lineMassKg(item)
      itemsCount++
    }
  }
  for (const k of KINDS) byKind[k] = round(byKind[k], 2)

  const pct = (base: number, p: number) => round((base * (Number(p) || 0)) / 100, 2)
  const direct = round(KINDS.reduce((a, k) => a + byKind[k], 0), 2)
  const laborBase = byKind.work + byKind.machine
  const materialsMarkup = pct(byKind.material, s.materialsMarkupPct)
  const overhead = pct(laborBase, s.overheadPct)
  const profit = pct(laborBase, s.profitPct)
  const contingency = pct(direct + materialsMarkup + overhead + profit, s.contingencyPct)
  const subtotal = round(direct + materialsMarkup + overhead + profit + contingency, 2)
  const discount = pct(subtotal, s.discountPct)
  const net = round(subtotal - discount, 2)

  let vat = 0
  let total = net
  if (s.vatMode === 'on_top') {
    vat = pct(net, s.vatPct)
    total = round(net + vat, 2)
  } else if (s.vatMode === 'included') {
    vat = round((net * s.vatPct) / (100 + s.vatPct), 2)
  }

  return {
    byKind,
    direct,
    materialsMarkup,
    overhead,
    profit,
    contingency,
    subtotal,
    discount,
    net,
    vat,
    total,
    massKg,
    itemsCount,
  }
}

/** Deep copy with fresh ids — for «Дублировать». */
export function cloneEstimate(e: Estimate, name = `${e.name} (копия)`): Estimate {
  const now = Date.now()
  return {
    ...e,
    id: uid(),
    name,
    createdAt: now,
    updatedAt: now,
    settings: { ...e.settings },
    sections: e.sections.map((sec) => ({
      ...sec,
      id: uid(),
      items: sec.items.map((it) => ({ ...it, id: uid() })),
    })),
  }
}
