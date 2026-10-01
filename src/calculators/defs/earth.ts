/** Земляные работы и сыпучие материалы (тоннаж, рейсы самосвалов). */
import { Shovel, Truck } from 'lucide-react'
import { BULK_MATERIALS, SOILS, TRUCKS } from '@/data/bulk'
import { ceil, pos, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult, type MaterialLine } from '../types'

export function truckTrips(volumeM3: number, tons: number, cap: { tons: number; m3: number }): number {
  if (volumeM3 <= 0 && tons <= 0) return 0
  return Math.max(ceil(volumeM3 / Math.max(0.1, cap.m3)), ceil(tons / Math.max(0.1, cap.tons)))
}

// ───────────────────────────── Котлован ─────────────────────────────

export type EarthValues = {
  type: 'pit' | 'trench' | 'volume'
  a: number
  b: number
  depth: number
  slope: number
  trenchL: number
  trenchW: number
  volume: number
  soil: string
  truck: string
  removeAll: boolean
  works: boolean
}

/** Prismoid volume for a pit with bottom a×b, depth H and slope 1:m. */
export function pitVolume(a: number, b: number, H: number, m: number): number {
  const A1 = a * b
  const A2 = (a + 2 * m * H) * (b + 2 * m * H)
  const Am = (a + m * H) * (b + m * H)
  return (H / 6) * (A1 + 4 * Am + A2)
}

export function trenchVolume(L: number, b: number, H: number, m: number): number {
  return (b + m * H) * H * L
}

export function computeEarth(v: EarthValues): CalcResult {
  const soil = SOILS.find((s) => s.id === v.soil) ?? SOILS[2]
  const m = pos(v.slope)
  let V: number
  let top = ''
  if (v.type === 'pit') {
    V = pitVolume(pos(v.a), pos(v.b), pos(v.depth), m)
    top = `${round(pos(v.a) + 2 * m * pos(v.depth), 2)} × ${round(pos(v.b) + 2 * m * pos(v.depth), 2)} м`
  } else if (v.type === 'trench') {
    V = trenchVolume(pos(v.trenchL), pos(v.trenchW), pos(v.depth), m)
    top = `${round(pos(v.trenchW) + 2 * m * pos(v.depth), 2)} м`
  } else V = pos(v.volume)
  const loose = V * soil.loosening
  const tons = V * soil.density
  const truck = TRUCKS.find((t) => t.id === v.truck) ?? TRUCKS[2]
  const trips = v.removeAll ? truckTrips(loose, tons, truck) : 0
  const metrics: CalcResult['metrics'] = [
    { label: 'Объём грунта в плотном теле', value: V, unit: 'м³', digits: 2, primary: true, hint: top ? `по верху ${top}` : undefined },
    { label: 'Объём в разрыхлённом состоянии', value: loose, unit: 'м³', digits: 2, primary: true },
    { label: 'Масса грунта', value: tons, unit: 'т', digits: 1, primary: true },
    { label: 'Коэффициент разрыхления', value: soil.loosening, digits: 2 },
  ]
  if (v.removeAll) metrics.push({ label: `Рейсов: ${truck.name}`, value: trips, unit: 'рейс', digits: 0, primary: true })
  const lines: MaterialLine[] = []
  if (v.works) lines.push({ name: `Разработка грунта (${soil.name.toLowerCase()})`, unit: 'м³', qty: round(V, 2), kind: 'work', priceKey: 'work-excavation' })
  if (v.removeAll) lines.push({ name: `Вывоз грунта: ${truck.name}`, unit: 'рейс', qty: trips, kind: 'transport', priceKey: 'truck-trip' })
  const warnings: string[] = []
  if (v.type !== 'volume' && pos(v.depth) > 1.5 && m < soil.slope) warnings.push(`Для грунта «${soil.name}» при глубине более 1,5 м без крепления стенок рекомендуемый откос не круче 1:${soil.slope} (СНиП 12-04-2002).`)
  return { metrics, lines, warnings }
}

export const earthwork = defineCalculator<EarthValues>({
  id: 'earthwork',
  title: 'Котлован и траншея',
  short: 'Объём выемки с откосами, разрыхление, масса грунта и рейсы самосвалов на вывоз',
  category: 'earth',
  icon: Shovel,
  keywords: ['котлован', 'траншея', 'земляные', 'грунт', 'выемка', 'откос', 'разрыхление', 'вывоз', 'самосвал', 'экскаватор'],
  sectionName: 'Земляные работы',
  defaults: { type: 'pit', a: 12, b: 10, depth: 2, slope: 0.5, trenchL: 40, trenchW: 0.6, volume: 100, soil: 'loam', truck: 'kamaz15', removeAll: true, works: true },
  groups: [
    {
      title: 'Выемка',
      fields: [
        { key: 'type', label: 'Тип', type: 'segmented', span: 6, options: opts([['pit', 'Котлован'], ['trench', 'Траншея'], ['volume', 'Объём']]) },
        { key: 'a', label: 'Длина по дну', type: 'number', unit: 'м', step: 0.5, span: 2, visible: (v) => v.type === 'pit' },
        { key: 'b', label: 'Ширина по дну', type: 'number', unit: 'м', step: 0.5, span: 2, visible: (v) => v.type === 'pit' },
        { key: 'trenchL', label: 'Длина траншеи', type: 'number', unit: 'м', step: 1, span: 2, visible: (v) => v.type === 'trench' },
        { key: 'trenchW', label: 'Ширина по дну', type: 'number', unit: 'м', step: 0.1, span: 2, visible: (v) => v.type === 'trench' },
        { key: 'depth', label: 'Глубина', type: 'number', unit: 'м', step: 0.1, span: 2, visible: (v) => v.type !== 'volume' },
        { key: 'slope', label: 'Откос 1:m', type: 'number', unit: 'm', step: 0.05, hint: '0 — вертикальные стенки', visible: (v) => v.type !== 'volume' },
        { key: 'volume', label: 'Объём выемки', type: 'number', unit: 'м³', step: 1, visible: (v) => v.type === 'volume' },
        { key: 'soil', label: 'Грунт', type: 'select', options: SOILS.map((s) => ({ value: s.id, label: `${s.name} — Кр ${s.loosening}, ${s.density} т/м³` })) },
      ],
    },
    {
      title: 'Вывоз',
      fields: [
        { key: 'removeAll', label: 'Вывозить грунт', type: 'toggle' },
        { key: 'truck', label: 'Самосвал', type: 'select', options: TRUCKS.map((t) => ({ value: t.id, label: t.name })), visible: (v) => v.removeAll },
        { key: 'works', label: 'Добавить разработку грунта', type: 'toggle' },
      ],
    },
  ],
  compute: computeEarth,
  method: [
    'Котлован с откосами — призматоид: V = H/6 × (S низа + 4·S середины + S верха).',
    'Траншея: V = (b + m·H) × H × L.',
    'Разрыхлённый объём = V × Кр (первоначальное разрыхление по СП 45.13330); рейсы — по объёму кузова и грузоподъёмности, берётся большее.',
  ],
})

// ───────────────────────── Сыпучие: тоннаж ─────────────────────────

export type BulkValues = {
  material: string
  mode: 'volume' | 'mass' | 'layer'
  volume: number
  mass: number
  layerL: number
  layerW: number
  layerT: number
  compaction: number
  truck: string
  delivery: boolean
}

export function computeBulk(v: BulkValues): CalcResult {
  const mat = BULK_MATERIALS.find((m) => m.id === v.material) ?? BULK_MATERIALS[0]
  let m3: number
  let compacted = 0
  if (v.mode === 'mass') m3 = pos(v.mass) / mat.density
  else if (v.mode === 'layer') {
    compacted = pos(v.layerL) * pos(v.layerW) * (pos(v.layerT) / 1000)
    m3 = compacted * (pos(v.compaction) || 1)
  } else m3 = pos(v.volume)
  const tons = m3 * mat.density
  const truck = TRUCKS.find((t) => t.id === v.truck) ?? TRUCKS[2]
  const trips = truckTrips(m3, tons, truck)
  const metrics: CalcResult['metrics'] = [
    { label: 'Масса', value: tons, unit: 'т', digits: 2, primary: true },
    { label: 'Объём (насыпной)', value: m3, unit: 'м³', digits: 2, primary: true },
    { label: 'Рейсов', value: trips, unit: 'рейс', digits: 0, primary: true, hint: truck.name },
    { label: 'Насыпная плотность', value: mat.density, unit: 'т/м³', digits: 2 },
    { label: 'Кубов в 1 тонне', value: 1 / mat.density, unit: 'м³', digits: 3 },
  ]
  if (v.mode === 'layer') metrics.push({ label: 'Объём слоя в уплотнённом виде', value: compacted, unit: 'м³', digits: 2 })
  const lines: MaterialLine[] = [
    { name: `${mat.name} (${round(tons, 2)} т)`, unit: 'м³', qty: round(m3, 2), kind: 'material', priceKey: mat.priceKey },
  ]
  if (v.delivery) lines.push({ name: `Доставка: ${truck.name}`, unit: 'рейс', qty: trips, kind: 'transport', priceKey: 'truck-trip' })
  return { metrics, lines }
}

export const bulk = defineCalculator<BulkValues>({
  id: 'bulk',
  title: 'Сыпучие: тоннаж и доставка',
  short: 'Перевод кубов в тонны для песка, щебня, ПГС, грунта; подсыпка с уплотнением и рейсы самосвалов',
  category: 'earth',
  icon: Truck,
  keywords: ['тоннаж', 'тонны', 'кубы', 'песок', 'щебень', 'пгс', 'керамзит', 'грунт', 'отсев', 'самосвал', 'доставка', 'подсыпка', 'насыпная плотность', 'камаз'],
  sectionName: 'Сыпучие материалы',
  defaults: { material: 'granite-5-20', mode: 'volume', volume: 20, mass: 30, layerL: 10, layerW: 8, layerT: 200, compaction: 1.3, truck: 'kamaz10', delivery: true },
  groups: [
    {
      fields: [
        { key: 'material', label: 'Материал', type: 'select', span: 6, options: BULK_MATERIALS.map((m) => ({ value: m.id, label: `${m.name} — ${m.density} т/м³` })) },
        { key: 'mode', label: 'Исходные данные', type: 'segmented', span: 6, options: opts([['volume', 'Объём, м³'], ['mass', 'Масса, т'], ['layer', 'Слой подсыпки']]) },
        { key: 'volume', label: 'Объём', type: 'number', unit: 'м³', step: 1, visible: (v) => v.mode === 'volume' },
        { key: 'mass', label: 'Масса', type: 'number', unit: 'т', step: 1, visible: (v) => v.mode === 'mass' },
        { key: 'layerL', label: 'Длина', type: 'number', unit: 'м', step: 0.5, span: 2, visible: (v) => v.mode === 'layer' },
        { key: 'layerW', label: 'Ширина', type: 'number', unit: 'м', step: 0.5, span: 2, visible: (v) => v.mode === 'layer' },
        { key: 'layerT', label: 'Толщина слоя', type: 'number', unit: 'мм', step: 10, span: 2, visible: (v) => v.mode === 'layer' },
        { key: 'compaction', label: 'Коэффициент уплотнения', type: 'number', step: 0.05, hint: 'Песок 1,1–1,2; щебень 1,25–1,3', visible: (v) => v.mode === 'layer' },
        { key: 'truck', label: 'Самосвал', type: 'select', options: TRUCKS.map((t) => ({ value: t.id, label: t.name })) },
        { key: 'delivery', label: 'Добавить доставку', type: 'toggle' },
      ],
    },
  ],
  compute: computeBulk,
  method: [
    'Масса = объём × насыпная плотность. Плотность зависит от фракции и влажности — значения средние.',
    'Подсыпка: объём к закупке = объём слоя × коэффициент уплотнения.',
    'Рейсы = max(⌈объём / объём кузова⌉, ⌈масса / грузоподъёмность⌉).',
  ],
})
