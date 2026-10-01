import { House } from 'lucide-react'
import { ceil, deg2rad, pos, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult, type MaterialLine } from '../types'

export const ROOF_MATERIALS = {
  metalTile: { name: 'Металлочерепица', usefulW: 1.1, fullW: 1.19, battenStep: 0.35, minSlope: 14, priceKey: 'metal-tile' },
  profiled: { name: 'Профнастил кровельный НС-35', usefulW: 1.0, fullW: 1.06, battenStep: 0.5, minSlope: 8, priceKey: 'roof-profiled' },
  soft: { name: 'Гибкая черепица', usefulW: 0, fullW: 0, battenStep: 0, minSlope: 12, priceKey: 'soft-tile' },
  ondulin: { name: 'Ондулин', usefulW: 0, fullW: 0, battenStep: 0.45, minSlope: 6, priceKey: 'ondulin' },
} as const

export type RoofValues = {
  type: 'single' | 'gable' | 'hip'
  L: number
  W: number
  angle: number
  eave: number
  gableOverhang: number
  material: keyof typeof ROOF_MATERIALS
  rafterStep: number
  rafter: string
  works: boolean
}

export interface RoofGeometry {
  area: number
  rafterLen: number
  ridge: number
  hips: number
  eaves: number
  rakes: number
  rise: number
}

export function roofGeometry(v: Pick<RoofValues, 'type' | 'L' | 'W' | 'angle' | 'eave' | 'gableOverhang'>): RoofGeometry {
  const a = deg2rad(Math.min(75, Math.max(1, pos(v.angle))))
  const cos = Math.cos(a), tan = Math.tan(a)
  const L = pos(v.L), W = pos(v.W), oe = pos(v.eave), og = pos(v.gableOverhang)
  if (v.type === 'single') {
    const run = W + 2 * oe
    const len = L + 2 * og
    const rafterLen = run / cos
    return { area: len * rafterLen, rafterLen, ridge: 0, hips: 0, eaves: len, rakes: 2 * rafterLen, rise: W * tan }
  }
  if (v.type === 'gable') {
    const half = W / 2 + oe
    const len = L + 2 * og
    const rafterLen = half / cos
    return { area: 2 * len * rafterLen, rafterLen, ridge: len, hips: 0, eaves: 2 * len, rakes: 4 * rafterLen, rise: (W / 2) * tan }
  }
  // Hip roof with equal pitch on all sides: sloped area = plan area / cos α.
  const Lp = Math.max(L, W) + 2 * oe, Wp = Math.min(L, W) + 2 * oe
  const half = Wp / 2
  const h = half * tan
  return {
    area: (Lp * Wp) / cos,
    rafterLen: half / cos,
    ridge: Lp - Wp,
    hips: 4 * Math.sqrt(2 * half * half + h * h),
    eaves: 2 * (Lp + Wp),
    rakes: 0,
    rise: (Math.min(L, W) / 2) * tan,
  }
}

const RAFTERS: Record<string, number> = { '50x150': 0.05 * 0.15, '50x200': 0.05 * 0.2, '75x200': 0.075 * 0.2, '100x200': 0.1 * 0.2 }

export function computeRoof(v: RoofValues): CalcResult {
  const g = roofGeometry(v)
  const m = ROOF_MATERIALS[v.material] ?? ROOF_MATERIALS.metalTile
  const waste = v.type === 'hip' ? 0.18 : v.type === 'gable' ? 0.08 : 0.05
  const lines: MaterialLine[] = []
  const metrics: CalcResult['metrics'] = [
    { label: 'Площадь кровли', value: g.area, unit: 'м²', digits: 2, primary: true },
    { label: 'Длина ската (стропила)', value: g.rafterLen, unit: 'м', digits: 2, primary: true },
    { label: 'Высота подъёма конька', value: g.rise, unit: 'м', digits: 2, primary: true },
  ]
  const warnings: string[] = []
  if (pos(v.angle) < m.minSlope) warnings.push(`${m.name}: минимальный уклон ${m.minSlope}° — при меньшем уклоне возможны протечки.`)

  const ridgeTotal = g.ridge + g.hips
  if (v.material === 'soft') {
    const packs = ceil((g.area * (1 + waste)) / 3)
    const osb = ceil((g.area * 1.05) / 3.125)
    const carpet = ceil((g.area * 1.15) / 15)
    metrics.push({ label: 'Упаковок черепицы (3 м²)', value: packs, unit: 'шт', digits: 0 })
    lines.push(
      { name: 'Гибкая черепица (упаковка 3 м²)', unit: 'упак', qty: packs, kind: 'material', priceKey: 'soft-tile', priceFactor: 3 },
      { name: 'ОСП-3 9 мм 2500×1250 — сплошное основание', unit: 'лист', qty: osb, kind: 'material', priceKey: 'osb' },
      { name: 'Подкладочный ковёр (рулон 15 м²)', unit: 'рулон', qty: carpet, kind: 'material', priceKey: 'underlay-carpet' },
    )
  } else if (v.material === 'ondulin') {
    const sheets = ceil((g.area * (1 + waste)) / 1.6)
    metrics.push({ label: 'Листов ондулина', value: sheets, unit: 'шт', digits: 0 })
    lines.push({ name: 'Ондулин 2000×950 мм', unit: 'лист', qty: sheets, kind: 'material', priceKey: 'ondulin' })
  } else {
    const buy = g.area * (1 + waste) * (m.fullW / m.usefulW)
    const columns = v.type === 'hip' ? 0 : ceil((v.type === 'single' ? g.eaves : g.eaves / 2) / m.usefulW)
    metrics.push({ label: 'Покрытия к закупке', value: buy, unit: 'м²', digits: 1 })
    if (columns) metrics.push({ label: 'Листов по ширине ската', value: columns, unit: 'шт', digits: 0, hint: `длина листа ≈ ${round(g.rafterLen, 2)} м` })
    lines.push({ name: m.name, unit: 'м²', qty: round(buy, 1), kind: 'material', priceKey: m.priceKey })
    const planks = ceil(g.eaves / 1.9) + ceil(g.rakes / 1.9)
    if (planks) lines.push({ name: 'Планки карнизные и торцевые 2 м', unit: 'шт', qty: planks, kind: 'material', priceKey: 'roof-ridge' })
    lines.push({ name: 'Саморез кровельный 4,8×35', unit: 'шт', qty: ceil(g.area * 8 + ridgeTotal * 4), kind: 'material', priceKey: 'roof-screw' })
  }
  if (ridgeTotal > 0) {
    const pcs = ceil(ridgeTotal / 1.9)
    metrics.push({ label: 'Конёк и рёбра', value: ridgeTotal, unit: 'м', digits: 2, hint: `${pcs} элементов по 2 м` })
    if (v.material !== 'soft') lines.push({ name: 'Конёк 2 м', unit: 'шт', qty: pcs, kind: 'material', priceKey: 'roof-ridge' })
  }
  if (v.material !== 'soft') {
    lines.push({ name: 'Мембрана гидро-ветрозащитная (рулон 75 м²)', unit: 'рулон', qty: ceil((g.area * 1.15) / 75), kind: 'material', priceKey: 'membrane' })
    const battens = (g.area / m.battenStep) * 1.05
    const battensM3 = battens * 0.025 * 0.1
    metrics.push({ label: 'Обрешётка 25×100', value: battens, unit: 'м', digits: 0, hint: `${round(battensM3, 3)} м³` })
    lines.push({ name: `Доска обрешётки 25×100 (шаг ${m.battenStep * 1000} мм)`, unit: 'м³', qty: round(battensM3, 3), kind: 'material', priceKey: 'lumber' })
  }
  const step = Math.max(0.3, pos(v.rafterStep) / 1000)
  const rafterM = g.area / step + g.hips
  const rafterM3 = rafterM * (RAFTERS[v.rafter] ?? RAFTERS['50x200'])
  const rafterCount = v.type === 'hip' ? 0 : (ceil(pos(v.L) / step) + 1) * (v.type === 'gable' ? 2 : 1)
  metrics.push({ label: `Стропила ${v.rafter.replace('x', '×')}`, value: rafterM, unit: 'м', digits: 1, hint: `${round(rafterM3, 2)} м³${rafterCount ? ` · ${rafterCount} шт` : ''}` })
  const counter = rafterM * 0.05 * 0.05
  lines.push(
    { name: `Стропила ${v.rafter.replace('x', '×')} мм`, unit: 'м³', qty: round(rafterM3, 3), kind: 'material', priceKey: 'lumber' },
    { name: 'Контррейка 50×50 мм', unit: 'м³', qty: round(counter, 3), kind: 'material', priceKey: 'lumber' },
  )
  if (v.works) {
    lines.push(
      { name: 'Монтаж стропильной системы', unit: 'м²', qty: round(g.area, 1), kind: 'work', priceKey: 'work-rafters' },
      { name: 'Монтаж кровельного покрытия', unit: 'м²', qty: round(g.area, 1), kind: 'work', priceKey: 'work-roofing' },
    )
  }
  if (v.type === 'hip') warnings.push('Для вальмовой кровли количество стропил и раскрой листов приближённые — уточняйте по проекту.')
  return { metrics, lines, warnings }
}

export const roof = defineCalculator<RoofValues>({
  id: 'roof',
  title: 'Кровля',
  short: 'Площадь ската, покрытие, коньки, мембрана, обрешётка и стропила для 1-, 2- и 4-скатной крыши',
  category: 'roof',
  icon: House,
  keywords: ['кровля', 'крыша', 'металлочерепица', 'профнастил', 'гибкая черепица', 'ондулин', 'стропила', 'обрешётка', 'конёк', 'скат', 'мембрана'],
  sectionName: 'Кровля',
  defaults: { type: 'gable', L: 10, W: 8, angle: 30, eave: 0.5, gableOverhang: 0.3, material: 'metalTile', rafterStep: 600, rafter: '50x200', works: false },
  groups: [
    {
      title: 'Крыша',
      fields: [
        { key: 'type', label: 'Форма', type: 'segmented', span: 6, options: opts([['single', 'Односкатная'], ['gable', 'Двускатная'], ['hip', 'Вальмовая']]) },
        { key: 'L', label: 'Длина дома (вдоль конька)', type: 'number', unit: 'м', step: 0.1 },
        { key: 'W', label: 'Ширина дома (пролёт)', type: 'number', unit: 'м', step: 0.1 },
        { key: 'angle', label: 'Угол наклона', type: 'number', unit: '°', step: 1 },
        { key: 'eave', label: 'Карнизный свес', type: 'number', unit: 'м', step: 0.05 },
        { key: 'gableOverhang', label: 'Фронтонный свес', type: 'number', unit: 'м', step: 0.05, visible: (v) => v.type !== 'hip' },
      ],
    },
    {
      title: 'Материалы',
      fields: [
        { key: 'material', label: 'Покрытие', type: 'select', options: Object.entries(ROOF_MATERIALS).map(([k, m]) => ({ value: k, label: `${m.name} (от ${m.minSlope}°)` })) },
        { key: 'rafter', label: 'Сечение стропил', type: 'select', options: opts([['50x150', '50×150 мм'], ['50x200', '50×200 мм'], ['75x200', '75×200 мм'], ['100x200', '100×200 мм']]) },
        { key: 'rafterStep', label: 'Шаг стропил', type: 'select', options: opts([[600, '600 мм'], [800, '800 мм'], [1000, '1000 мм']]) },
        { key: 'works', label: 'Добавить работы', type: 'toggle' },
      ],
    },
  ],
  compute: computeRoof,
  method: [
    'Площадь ската = проекция / cos α. Для вальмовой крыши с одинаковым уклоном всех скатов площадь = площадь плана со свесами / cos α.',
    'Запас покрытия: односкатная 5%, двускатная 8%, вальмовая 18%; листовые материалы пересчитаны с полезной на полную ширину.',
    'Обрешётка: длина ≈ площадь / шаг; стропила: погонаж ≈ площадь / шаг стропил (+ диагональные рёбра для вальмы).',
  ],
})
