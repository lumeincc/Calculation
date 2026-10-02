/** Земляные работы и сыпучие материалы (тоннаж, рейсы самосвалов). */
import { Shovel, Truck } from 'lucide-react'
import { BULK_MATERIALS, SOILS, TRUCKS } from '@/data/bulk'
import { ceil, pos, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult, type MaterialLine } from '../types'
import { T, Tf } from '@/i18n'

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
    top = Tf('{0} × {1} м', [round(pos(v.a) + 2 * m * pos(v.depth), 2), round(pos(v.b) + 2 * m * pos(v.depth), 2)])
  } else if (v.type === 'trench') {
    V = trenchVolume(pos(v.trenchL), pos(v.trenchW), pos(v.depth), m)
    top = Tf('{0} м', [round(pos(v.trenchW) + 2 * m * pos(v.depth), 2)])
  } else V = pos(v.volume)
  const loose = V * soil.loosening
  const tons = V * soil.density
  const truck = TRUCKS.find((t) => t.id === v.truck) ?? TRUCKS[2]
  const trips = v.removeAll ? truckTrips(loose, tons, truck) : 0
  const metrics: CalcResult['metrics'] = [
    { label: T('Объём грунта в плотном теле'), value: V, unit: T('м³'), digits: 2, primary: true, hint: top ? Tf('по верху {0}', [top]) : undefined },
    { label: T('Объём в разрыхлённом состоянии'), value: loose, unit: T('м³'), digits: 2, primary: true },
    { label: T('Масса грунта'), value: tons, unit: T('т'), digits: 1, primary: true },
    { label: T('Коэффициент разрыхления'), value: soil.loosening, digits: 2 },
  ]
  if (v.removeAll) metrics.push({ label: Tf('Рейсов: {0}', [truck.name]), value: trips, unit: T('рейс'), digits: 0, primary: true })
  const lines: MaterialLine[] = []
  if (v.works) lines.push({ name: Tf('Разработка грунта ({0})', [soil.name.toLowerCase()]), unit: T('м³'), qty: round(V, 2), kind: 'work', priceKey: 'work-excavation' })
  if (v.removeAll) lines.push({ name: Tf('Вывоз грунта: {0}', [truck.name]), unit: T('рейс'), qty: trips, kind: 'transport', priceKey: 'truck-trip' })
  const warnings: string[] = []
  if (v.type !== 'volume' && pos(v.depth) > 1.5 && m < soil.slope) warnings.push(Tf('Для грунта «{0}» при глубине более 1,5 м без крепления стенок рекомендуемый откос не круче 1:{1} (СНиП 12-04-2002).', [soil.name, soil.slope]))
  return { metrics, lines, warnings }
}

export const earthwork = defineCalculator<EarthValues>({
  id: 'earthwork',
  title: T('Котлован и траншея'),
  short: T('Объём выемки с откосами, разрыхление, масса грунта и рейсы самосвалов на вывоз'),
  category: 'earth',
  icon: Shovel,
  keywords: [T('котлован'), T('траншея'), T('земляные'), T('грунт'), T('выемка'), T('откос'), T('разрыхление'), T('вывоз'), T('самосвал'), T('экскаватор')],
  sectionName: T('Земляные работы'),
  defaults: { type: 'pit', a: 12, b: 10, depth: 2, slope: 0.5, trenchL: 40, trenchW: 0.6, volume: 100, soil: 'loam', truck: 'kamaz15', removeAll: true, works: true },
  groups: [
    {
      title: T('Выемка'),
      fields: [
        { key: 'type', label: T('Тип'), type: 'segmented', span: 6, options: opts([['pit', T('Котлован')], ['trench', T('Траншея')], ['volume', T('Объём')]]) },
        { key: 'a', label: T('Длина по дну'), type: 'number', unit: T('м'), step: 0.5, span: 2, visible: (v) => v.type === 'pit' },
        { key: 'b', label: T('Ширина по дну'), type: 'number', unit: T('м'), step: 0.5, span: 2, visible: (v) => v.type === 'pit' },
        { key: 'trenchL', label: T('Длина траншеи'), type: 'number', unit: T('м'), step: 1, span: 2, visible: (v) => v.type === 'trench' },
        { key: 'trenchW', label: T('Ширина по дну'), type: 'number', unit: T('м'), step: 0.1, span: 2, visible: (v) => v.type === 'trench' },
        { key: 'depth', label: T('Глубина'), type: 'number', unit: T('м'), step: 0.1, span: 2, visible: (v) => v.type !== 'volume' },
        { key: 'slope', label: T('Откос 1:m'), type: 'number', unit: 'm', step: 0.05, hint: T('0 — вертикальные стенки'), visible: (v) => v.type !== 'volume' },
        { key: 'volume', label: T('Объём выемки'), type: 'number', unit: T('м³'), step: 1, visible: (v) => v.type === 'volume' },
        { key: 'soil', label: T('Грунт'), type: 'select', options: SOILS.map((s) => ({ value: s.id, label: Tf('{0} — Кр {1}, {2} т/м³', [s.name, s.loosening, s.density]) })) },
      ],
    },
    {
      title: T('Вывоз'),
      fields: [
        { key: 'removeAll', label: T('Вывозить грунт'), type: 'toggle' },
        { key: 'truck', label: T('Самосвал'), type: 'select', options: TRUCKS.map((t) => ({ value: t.id, label: t.name })), visible: (v) => v.removeAll },
        { key: 'works', label: T('Добавить разработку грунта'), type: 'toggle' },
      ],
    },
  ],
  compute: computeEarth,
  method: [
    T('Котлован с откосами — призматоид: V = H/6 × (S низа + 4·S середины + S верха).'),
    T('Траншея: V = (b + m·H) × H × L.'),
    T('Разрыхлённый объём = V × Кр (первоначальное разрыхление по СП 45.13330); рейсы — по объёму кузова и грузоподъёмности, берётся большее.'),
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
    { label: T('Масса'), value: tons, unit: T('т'), digits: 2, primary: true },
    { label: T('Объём (насыпной)'), value: m3, unit: T('м³'), digits: 2, primary: true },
    { label: T('Рейсов'), value: trips, unit: T('рейс'), digits: 0, primary: true, hint: truck.name },
    { label: T('Насыпная плотность'), value: mat.density, unit: T('т/м³'), digits: 2 },
    { label: T('Кубов в 1 тонне'), value: 1 / mat.density, unit: T('м³'), digits: 3 },
  ]
  if (v.mode === 'layer') metrics.push({ label: T('Объём слоя в уплотнённом виде'), value: compacted, unit: T('м³'), digits: 2 })
  const lines: MaterialLine[] = [
    { name: Tf('{0} ({1} т)', [mat.name, round(tons, 2)]), unit: T('м³'), qty: round(m3, 2), kind: 'material', priceKey: mat.priceKey },
  ]
  if (v.delivery) lines.push({ name: Tf('Доставка: {0}', [truck.name]), unit: T('рейс'), qty: trips, kind: 'transport', priceKey: 'truck-trip' })
  return { metrics, lines }
}

export const bulk = defineCalculator<BulkValues>({
  id: 'bulk',
  title: T('Сыпучие: тоннаж и доставка'),
  short: T('Перевод кубов в тонны для песка, щебня, ПГС, грунта; подсыпка с уплотнением и рейсы самосвалов'),
  category: 'earth',
  icon: Truck,
  keywords: [T('тоннаж'), T('тонны'), T('кубы'), T('песок'), T('щебень'), T('пгс'), T('керамзит'), T('грунт'), T('отсев'), T('самосвал'), T('доставка'), T('подсыпка'), T('насыпная плотность'), T('камаз')],
  sectionName: T('Сыпучие материалы'),
  defaults: { material: 'granite-5-20', mode: 'volume', volume: 20, mass: 30, layerL: 10, layerW: 8, layerT: 200, compaction: 1.3, truck: 'kamaz10', delivery: true },
  groups: [
    {
      fields: [
        { key: 'material', label: T('Материал'), type: 'select', span: 6, options: BULK_MATERIALS.map((m) => ({ value: m.id, label: Tf('{0} — {1} т/м³', [m.name, m.density]) })) },
        { key: 'mode', label: T('Исходные данные'), type: 'segmented', span: 6, options: opts([['volume', T('Объём, м³')], ['mass', T('Масса, т')], ['layer', T('Слой подсыпки')]]) },
        { key: 'volume', label: T('Объём'), type: 'number', unit: T('м³'), step: 1, visible: (v) => v.mode === 'volume' },
        { key: 'mass', label: T('Масса'), type: 'number', unit: T('т'), step: 1, visible: (v) => v.mode === 'mass' },
        { key: 'layerL', label: T('Длина'), type: 'number', unit: T('м'), step: 0.5, span: 2, visible: (v) => v.mode === 'layer' },
        { key: 'layerW', label: T('Ширина'), type: 'number', unit: T('м'), step: 0.5, span: 2, visible: (v) => v.mode === 'layer' },
        { key: 'layerT', label: T('Толщина слоя'), type: 'number', unit: T('мм'), step: 10, span: 2, visible: (v) => v.mode === 'layer' },
        { key: 'compaction', label: T('Коэффициент уплотнения'), type: 'number', step: 0.05, hint: T('Песок 1,1–1,2; щебень 1,25–1,3'), visible: (v) => v.mode === 'layer' },
        { key: 'truck', label: T('Самосвал'), type: 'select', options: TRUCKS.map((t) => ({ value: t.id, label: t.name })) },
        { key: 'delivery', label: T('Добавить доставку'), type: 'toggle' },
      ],
    },
  ],
  compute: computeBulk,
  method: [
    T('Масса = объём × насыпная плотность. Плотность зависит от фракции и влажности — значения средние.'),
    T('Подсыпка: объём к закупке = объём слоя × коэффициент уплотнения.'),
    T('Рейсы = max(⌈объём / объём кузова⌉, ⌈масса / грузоподъёмность⌉).'),
  ],
})
