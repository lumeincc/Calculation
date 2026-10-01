import { Fence } from 'lucide-react'
import { geo, STEEL_DENSITY } from '@/data/metals'
import { ceil, pos, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult } from '../types'

export const FENCE_SHEETS = {
  c8: { name: 'С8', usefulW: 1.15, fullW: 1.2 },
  c10: { name: 'С10', usefulW: 1.1, fullW: 1.15 },
  c20: { name: 'С20', usefulW: 1.1, fullW: 1.15 },
  c21: { name: 'С21', usefulW: 1.0, fullW: 1.051 },
} as const

const PIPES: Record<string, [number, number, number]> = {
  '60x60x2': [60, 60, 2], '60x40x2': [60, 40, 2], '80x80x3': [80, 80, 3], '40x20x2': [40, 20, 2], '40x40x2': [40, 40, 2],
}

export type FenceValues = {
  length: number
  height: number
  gates: number
  gateWidth: number
  step: number
  post: string
  burial: number
  lag: string
  lagRows: number
  sheet: keyof typeof FENCE_SHEETS
  holeD: number
  works: boolean
}

export function computeFence(v: FenceValues): CalcResult {
  const gates = Math.round(pos(v.gates))
  const net = Math.max(0, pos(v.length) - gates * pos(v.gateWidth))
  const step = Math.max(1, pos(v.step))
  const posts = ceil(net / step) + 1 + gates
  const postLen = pos(v.height) + pos(v.burial) + 0.05
  const [pa, pb, ps] = PIPES[v.post] ?? PIPES['60x60x2']
  const [la, lb, ls] = PIPES[v.lag] ?? PIPES['40x20x2']
  const postKg = geo.profilePipe(pa, pb, ps, STEEL_DENSITY) * postLen * posts
  const rows = Math.max(1, Math.round(pos(v.lagRows)))
  const lagM = net * rows * 1.05
  const lagKg = geo.profilePipe(la, lb, ls, STEEL_DENSITY) * lagM
  const sh = FENCE_SHEETS[v.sheet] ?? FENCE_SHEETS.c8
  const sheets = ceil(net / sh.usefulW)
  const sheetArea = sheets * sh.fullW * pos(v.height)
  const screws = sheets * rows * 5
  const r = pos(v.holeD) / 2000
  const concrete = posts * Math.PI * r * r * pos(v.burial)
  const warnings: string[] = []
  if (pos(v.height) > 1.8 && rows < 3) warnings.push('Для забора выше 1,8 м рекомендуется 3 ряда лаг.')
  if (step > 3) warnings.push('Шаг столбов больше 3 м — профнастил будет «парусить» под ветром.')
  return {
    metrics: [
      { label: 'Столбов', value: posts, unit: 'шт', digits: 0, primary: true, hint: `по ${round(postLen, 2)} м` },
      { label: 'Листов профнастила', value: sheets, unit: 'шт', digits: 0, primary: true, hint: `${sh.name}, ${pos(v.height)} м` },
      { label: 'Металл каркаса', value: (postKg + lagKg) / 1000, unit: 'т', digits: 3, primary: true },
      { label: 'Столбы, масса', value: postKg, unit: 'кг', digits: 0 },
      { label: 'Лаги', value: lagM, unit: 'м', digits: 1, hint: `${round(lagKg, 0)} кг` },
      { label: 'Бетон под столбы', value: concrete, unit: 'м³', digits: 2 },
      { label: 'Кровельных саморезов', value: screws, unit: 'шт', digits: 0 },
    ],
    lines: [
      { name: `Профнастил ${sh.name} ${pos(v.height)} м (${sheets} листов)`, unit: 'м²', qty: round(sheetArea, 2), kind: 'material', priceKey: 'fence-sheet' },
      { name: `Труба профильная ${v.post.replace(/x/g, '×')} — столбы ${posts} шт × ${round(postLen, 2)} м`, unit: 'т', qty: round(postKg / 1000, 4), kind: 'material', priceKey: 'metal-profile-pipe' },
      { name: `Труба профильная ${v.lag.replace(/x/g, '×')} — лаги ${round(lagM, 1)} м`, unit: 'т', qty: round(lagKg / 1000, 4), kind: 'material', priceKey: 'metal-profile-pipe' },
      { name: 'Саморез кровельный 4,8×35', unit: 'шт', qty: screws, kind: 'material', priceKey: 'roof-screw' },
      { name: 'Заглушка на столб', unit: 'шт', qty: posts, kind: 'material', priceKey: 'post-cap' },
      { name: 'Бетон М200 для бетонирования столбов', unit: 'м³', qty: round(concrete * 1.05, 2), kind: 'material', priceKey: 'concrete-M200' },
      ...(v.works ? [{ name: 'Монтаж забора из профнастила', unit: 'м', qty: round(net, 1), kind: 'work' as const, priceKey: 'work-fence' }] : []),
    ],
    warnings,
  }
}

export const fence = defineCalculator<FenceValues>({
  id: 'fence',
  title: 'Забор из профнастила',
  short: 'Столбы, лаги и тоннаж каркаса, листы, саморезы и бетон под столбы',
  category: 'metal',
  icon: Fence,
  keywords: ['забор', 'ограждение', 'профнастил', 'столбы', 'лаги', 'профтруба', 'ворота', 'калитка'],
  sectionName: 'Забор',
  defaults: {
    length: 100, height: 2, gates: 1, gateWidth: 4, step: 2.5, post: '60x60x2', burial: 1.2, lag: '40x20x2', lagRows: 3,
    sheet: 'c8', holeD: 200, works: false,
  },
  groups: [
    {
      title: 'Забор',
      fields: [
        { key: 'length', label: 'Длина забора', type: 'number', unit: 'м', step: 1 },
        { key: 'height', label: 'Высота', type: 'select', options: opts([[1.5, '1,5 м'], [1.8, '1,8 м'], [2, '2 м'], [2.5, '2,5 м']]) },
        { key: 'gates', label: 'Проёмов под ворота/калитки', type: 'number', unit: 'шт', step: 1 },
        { key: 'gateWidth', label: 'Средняя ширина проёма', type: 'number', unit: 'м', step: 0.5 },
        { key: 'sheet', label: 'Профнастил', type: 'select', options: Object.entries(FENCE_SHEETS).map(([k, s]) => ({ value: k, label: `${s.name} (полезная ширина ${String(s.usefulW).replace('.', ',')} м)` })) },
      ],
    },
    {
      title: 'Каркас',
      fields: [
        { key: 'step', label: 'Шаг столбов', type: 'number', unit: 'м', step: 0.1 },
        { key: 'post', label: 'Столбы', type: 'select', options: opts([['60x60x2', 'Труба 60×60×2'], ['60x40x2', 'Труба 60×40×2'], ['80x80x3', 'Труба 80×80×3']]) },
        { key: 'burial', label: 'Заглубление столбов', type: 'number', unit: 'м', step: 0.1 },
        { key: 'holeD', label: 'Диаметр скважины', type: 'number', unit: 'мм', step: 10 },
        { key: 'lag', label: 'Лаги', type: 'select', options: opts([['40x20x2', 'Труба 40×20×2'], ['40x40x2', 'Труба 40×40×2']]) },
        { key: 'lagRows', label: 'Рядов лаг', type: 'segmented', options: opts([[2, '2'], [3, '3']]) },
        { key: 'works', label: 'Добавить монтаж', type: 'toggle' },
      ],
    },
  ],
  compute: computeFence,
  method: [
    'Столбов = ⌈длина без проёмов / шаг⌉ + 1 + по одному на каждый проём ворот.',
    'Масса труб — по сечению с радиусами скругления ГОСТ 30245; лаги +5% на подрезку.',
    'Листов = ⌈длина / полезная ширина⌉; саморезы — 5 шт на лист на каждую лагу.',
  ],
})
