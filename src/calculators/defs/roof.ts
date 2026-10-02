import { House } from 'lucide-react'
import { ceil, deg2rad, pos, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult, type MaterialLine } from '../types'
import { T, Tf } from '@/i18n'

export const ROOF_MATERIALS = {
  metalTile: { name: T('Металлочерепица'), usefulW: 1.1, fullW: 1.19, battenStep: 0.35, minSlope: 14, priceKey: 'metal-tile' },
  profiled: { name: T('Профнастил кровельный НС-35'), usefulW: 1.0, fullW: 1.06, battenStep: 0.5, minSlope: 8, priceKey: 'roof-profiled' },
  soft: { name: T('Гибкая черепица'), usefulW: 0, fullW: 0, battenStep: 0, minSlope: 12, priceKey: 'soft-tile' },
  ondulin: { name: T('Ондулин'), usefulW: 0, fullW: 0, battenStep: 0.45, minSlope: 6, priceKey: 'ondulin' },
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
    { label: T('Площадь кровли'), value: g.area, unit: T('м²'), digits: 2, primary: true },
    { label: T('Длина ската (стропила)'), value: g.rafterLen, unit: T('м'), digits: 2, primary: true },
    { label: T('Высота подъёма конька'), value: g.rise, unit: T('м'), digits: 2, primary: true },
  ]
  const warnings: string[] = []
  if (pos(v.angle) < m.minSlope) warnings.push(Tf('{0}: минимальный уклон {1}° — при меньшем уклоне возможны протечки.', [m.name, m.minSlope]))

  const ridgeTotal = g.ridge + g.hips
  if (v.material === 'soft') {
    const packs = ceil((g.area * (1 + waste)) / 3)
    const osb = ceil((g.area * 1.05) / 3.125)
    const carpet = ceil((g.area * 1.15) / 15)
    metrics.push({ label: T('Упаковок черепицы (3 м²)'), value: packs, unit: T('шт'), digits: 0 })
    lines.push(
      { name: T('Гибкая черепица (упаковка 3 м²)'), unit: T('упак'), qty: packs, kind: 'material', priceKey: 'soft-tile', priceFactor: 3 },
      { name: T('ОСП-3 9 мм 2500×1250 — сплошное основание'), unit: T('лист'), qty: osb, kind: 'material', priceKey: 'osb' },
      { name: T('Подкладочный ковёр (рулон 15 м²)'), unit: T('рулон'), qty: carpet, kind: 'material', priceKey: 'underlay-carpet' },
    )
  } else if (v.material === 'ondulin') {
    const sheets = ceil((g.area * (1 + waste)) / 1.6)
    metrics.push({ label: T('Листов ондулина'), value: sheets, unit: T('шт'), digits: 0 })
    lines.push({ name: T('Ондулин 2000×950 мм'), unit: T('лист'), qty: sheets, kind: 'material', priceKey: 'ondulin' })
  } else {
    const buy = g.area * (1 + waste) * (m.fullW / m.usefulW)
    const columns = v.type === 'hip' ? 0 : ceil((v.type === 'single' ? g.eaves : g.eaves / 2) / m.usefulW)
    metrics.push({ label: T('Покрытия к закупке'), value: buy, unit: T('м²'), digits: 1 })
    if (columns) metrics.push({ label: T('Листов по ширине ската'), value: columns, unit: T('шт'), digits: 0, hint: Tf('длина листа ≈ {0} м', [round(g.rafterLen, 2)]) })
    lines.push({ name: m.name, unit: T('м²'), qty: round(buy, 1), kind: 'material', priceKey: m.priceKey })
    const planks = ceil(g.eaves / 1.9) + ceil(g.rakes / 1.9)
    if (planks) lines.push({ name: T('Планки карнизные и торцевые 2 м'), unit: T('шт'), qty: planks, kind: 'material', priceKey: 'roof-ridge' })
    lines.push({ name: T('Саморез кровельный 4,8×35'), unit: T('шт'), qty: ceil(g.area * 8 + ridgeTotal * 4), kind: 'material', priceKey: 'roof-screw' })
  }
  if (ridgeTotal > 0) {
    const pcs = ceil(ridgeTotal / 1.9)
    metrics.push({ label: T('Конёк и рёбра'), value: ridgeTotal, unit: T('м'), digits: 2, hint: Tf('{0} элементов по 2 м', [pcs]) })
    if (v.material !== 'soft') lines.push({ name: T('Конёк 2 м'), unit: T('шт'), qty: pcs, kind: 'material', priceKey: 'roof-ridge' })
  }
  if (v.material !== 'soft') {
    lines.push({ name: T('Мембрана гидро-ветрозащитная (рулон 75 м²)'), unit: T('рулон'), qty: ceil((g.area * 1.15) / 75), kind: 'material', priceKey: 'membrane' })
    const battens = (g.area / m.battenStep) * 1.05
    const battensM3 = battens * 0.025 * 0.1
    metrics.push({ label: T('Обрешётка 25×100'), value: battens, unit: T('м'), digits: 0, hint: Tf('{0} м³', [round(battensM3, 3)]) })
    lines.push({ name: Tf('Доска обрешётки 25×100 (шаг {0} мм)', [m.battenStep * 1000]), unit: T('м³'), qty: round(battensM3, 3), kind: 'material', priceKey: 'lumber' })
  }
  const step = Math.max(0.3, pos(v.rafterStep) / 1000)
  const rafterM = g.area / step + g.hips
  const rafterM3 = rafterM * (RAFTERS[v.rafter] ?? RAFTERS['50x200'])
  const rafterCount = v.type === 'hip' ? 0 : (ceil(pos(v.L) / step) + 1) * (v.type === 'gable' ? 2 : 1)
  metrics.push({ label: Tf('Стропила {0}', [v.rafter.replace('x', '×')]), value: rafterM, unit: T('м'), digits: 1, hint: Tf('{0} м³{1}', [round(rafterM3, 2), rafterCount ? Tf(' · {0} шт', [rafterCount]) : '']) })
  const counter = rafterM * 0.05 * 0.05
  lines.push(
    { name: Tf('Стропила {0} мм', [v.rafter.replace('x', '×')]), unit: T('м³'), qty: round(rafterM3, 3), kind: 'material', priceKey: 'lumber' },
    { name: T('Контррейка 50×50 мм'), unit: T('м³'), qty: round(counter, 3), kind: 'material', priceKey: 'lumber' },
  )
  if (v.works) {
    lines.push(
      { name: T('Монтаж стропильной системы'), unit: T('м²'), qty: round(g.area, 1), kind: 'work', priceKey: 'work-rafters' },
      { name: T('Монтаж кровельного покрытия'), unit: T('м²'), qty: round(g.area, 1), kind: 'work', priceKey: 'work-roofing' },
    )
  }
  if (v.type === 'hip') warnings.push(T('Для вальмовой кровли количество стропил и раскрой листов приближённые — уточняйте по проекту.'))
  return { metrics, lines, warnings }
}

export const roof = defineCalculator<RoofValues>({
  id: 'roof',
  title: T('Кровля'),
  short: T('Площадь ската, покрытие, коньки, мембрана, обрешётка и стропила для 1-, 2- и 4-скатной крыши'),
  category: 'roof',
  icon: House,
  keywords: [T('кровля'), T('крыша'), T('металлочерепица'), T('профнастил'), T('гибкая черепица'), T('ондулин'), T('стропила'), T('обрешётка'), T('конёк'), T('скат'), T('мембрана')],
  sectionName: T('Кровля'),
  defaults: { type: 'gable', L: 10, W: 8, angle: 30, eave: 0.5, gableOverhang: 0.3, material: 'metalTile', rafterStep: 600, rafter: '50x200', works: false },
  groups: [
    {
      title: T('Крыша'),
      fields: [
        { key: 'type', label: T('Форма'), type: 'segmented', span: 6, options: opts([['single', T('Односкатная')], ['gable', T('Двускатная')], ['hip', T('Вальмовая')]]) },
        { key: 'L', label: T('Длина дома (вдоль конька)'), type: 'number', unit: T('м'), step: 0.1 },
        { key: 'W', label: T('Ширина дома (пролёт)'), type: 'number', unit: T('м'), step: 0.1 },
        { key: 'angle', label: T('Угол наклона'), type: 'number', unit: '°', step: 1 },
        { key: 'eave', label: T('Карнизный свес'), type: 'number', unit: T('м'), step: 0.05 },
        { key: 'gableOverhang', label: T('Фронтонный свес'), type: 'number', unit: T('м'), step: 0.05, visible: (v) => v.type !== 'hip' },
      ],
    },
    {
      title: T('Материалы'),
      fields: [
        { key: 'material', label: T('Покрытие'), type: 'select', options: Object.entries(ROOF_MATERIALS).map(([k, m]) => ({ value: k, label: Tf('{0} (от {1}°)', [m.name, m.minSlope]) })) },
        { key: 'rafter', label: T('Сечение стропил'), type: 'select', options: opts([['50x150', '50×150 мм'], ['50x200', '50×200 мм'], ['75x200', '75×200 мм'], ['100x200', '100×200 мм']]) },
        { key: 'rafterStep', label: T('Шаг стропил'), type: 'select', options: opts([[600, '600 мм'], [800, '800 мм'], [1000, '1000 мм']]) },
        { key: 'works', label: T('Добавить работы'), type: 'toggle' },
      ],
    },
  ],
  compute: computeRoof,
  method: [
    T('Площадь ската = проекция / cos α. Для вальмовой крыши с одинаковым уклоном всех скатов площадь = площадь плана со свесами / cos α.'),
    T('Запас покрытия: односкатная 5%, двускатная 8%, вальмовая 18%; листовые материалы пересчитаны с полезной на полную ширину.'),
    T('Обрешётка: длина ≈ площадь / шаг; стропила: погонаж ≈ площадь / шаг стропил (+ диагональные рёбра для вальмы).'),
  ],
})
