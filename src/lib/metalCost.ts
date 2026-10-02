/**
 * Cost of a steel structure from its tonnage: metal by profile groups, fabrication per tonne,
 * painting per m², erection per tonne, delivery and markup. Prices are entered per project.
 */
import { round } from './num'
import { PRICE_GROUP_LABEL, type MetalPriceGroup } from './metal'
import type { ItemKind } from './estimate'

export interface CostItem {
  group: MetalPriceGroup
  massKg: number
  areaM2: number
}

export interface MetalCostSettings {
  singlePrice: boolean
  /** ₸/т for all metal when singlePrice. */
  metalPrice: number
  groupPrices: Partial<Record<MetalPriceGroup, number>>
  /** ₸/т for gratings, fasteners and other weight-only metal. */
  extraPrice: number
  fabrication: number
  paint: number
  montage: number
  delivery: number
  markupPct: number
}

export const DEFAULT_METAL_COST: MetalCostSettings = {
  singlePrice: false,
  metalPrice: 0,
  groupPrices: {},
  extraPrice: 0,
  fabrication: 0,
  paint: 0,
  montage: 0,
  delivery: 0,
  markupPct: 0,
}

export interface CostLine {
  section: 'Металл' | 'Работы' | 'Доставка и прочее'
  kind: ItemKind
  name: string
  unit: string
  qty: number
  price: number
  sum: number
}

export interface MetalCostResult {
  lines: CostLine[]
  tonnes: number
  areaM2: number
  subtotal: number
  markup: number
  total: number
  /** Total per tonne of structure. */
  perTonne: number
}

export function costGroups(items: CostItem[]): { group: MetalPriceGroup; massKg: number; areaM2: number }[] {
  const m = new Map<MetalPriceGroup, { group: MetalPriceGroup; massKg: number; areaM2: number }>()
  for (const it of items) {
    const g = m.get(it.group) ?? { group: it.group, massKg: 0, areaM2: 0 }
    g.massKg += it.massKg
    g.areaM2 += it.areaM2
    m.set(it.group, g)
  }
  return [...m.values()].sort((a, b) => b.massKg - a.massKg)
}

export function computeMetalCost(items: CostItem[], extraKg: number, s: MetalCostSettings): MetalCostResult {
  const lines: CostLine[] = []
  const add = (l: Omit<CostLine, 'sum'>) => {
    if (l.qty > 0) lines.push({ ...l, sum: round(l.qty * l.price, 2) })
  }
  const groups = costGroups(items)
  const profileT = groups.reduce((a, g) => a + g.massKg, 0) / 1000
  const extraT = Math.max(0, extraKg) / 1000
  const areaM2 = groups.reduce((a, g) => a + g.areaM2, 0)
  for (const g of groups) {
    const price = s.singlePrice ? s.metalPrice : (s.groupPrices[g.group] ?? 0)
    add({ section: 'Металл', kind: 'material', name: PRICE_GROUP_LABEL[g.group], unit: 'т', qty: round(g.massKg / 1000, 4), price })
  }
  add({ section: 'Металл', kind: 'material', name: 'Настил, метизы и прочий металл', unit: 'т', qty: round(extraT, 4), price: s.extraPrice })
  add({ section: 'Работы', kind: 'work', name: 'Изготовление металлоконструкций', unit: 'т', qty: round(profileT, 4), price: s.fabrication })
  add({ section: 'Работы', kind: 'work', name: 'Окраска металлоконструкций', unit: 'м²', qty: round(areaM2, 2), price: s.paint })
  add({ section: 'Работы', kind: 'work', name: 'Монтаж металлоконструкций', unit: 'т', qty: round(profileT + extraT, 4), price: s.montage })
  if (s.delivery > 0) add({ section: 'Доставка и прочее', kind: 'transport', name: 'Доставка', unit: 'усл. ед.', qty: 1, price: s.delivery })
  const subtotal = round(lines.reduce((a, l) => a + l.sum, 0), 2)
  const markup = round((subtotal * s.markupPct) / 100, 2)
  if (markup) lines.push({ section: 'Доставка и прочее', kind: 'other', name: `Наценка ${s.markupPct}%`, unit: 'усл. ед.', qty: 1, price: markup, sum: markup })
  const total = round(subtotal + markup, 2)
  const tonnes = profileT + extraT
  return { lines, tonnes, areaM2, subtotal, markup, total, perTonne: tonnes > 0 ? round(total / tonnes, 2) : 0 }
}
