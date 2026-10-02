import { Fence } from 'lucide-react'
import { geo, STEEL_DENSITY } from '@/data/metals'
import { ceil, pos, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult } from '../types'
import { T, Tf } from '@/i18n'

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
  if (pos(v.height) > 1.8 && rows < 3) warnings.push(T('Для забора выше 1,8 м рекомендуется 3 ряда лаг.'))
  if (step > 3) warnings.push(T('Шаг столбов больше 3 м — профнастил будет «парусить» под ветром.'))
  return {
    metrics: [
      { label: T('Столбов'), value: posts, unit: T('шт'), digits: 0, primary: true, hint: Tf('по {0} м', [round(postLen, 2)]) },
      { label: T('Листов профнастила'), value: sheets, unit: T('шт'), digits: 0, primary: true, hint: Tf('{0}, {1} м', [sh.name, pos(v.height)]) },
      { label: T('Металл каркаса'), value: (postKg + lagKg) / 1000, unit: T('т'), digits: 3, primary: true },
      { label: T('Столбы, масса'), value: postKg, unit: T('кг'), digits: 0 },
      { label: T('Лаги'), value: lagM, unit: T('м'), digits: 1, hint: Tf('{0} кг', [round(lagKg, 0)]) },
      { label: T('Бетон под столбы'), value: concrete, unit: T('м³'), digits: 2 },
      { label: T('Кровельных саморезов'), value: screws, unit: T('шт'), digits: 0 },
    ],
    lines: [
      { name: Tf('Профнастил {0} {1} м ({2} листов)', [sh.name, pos(v.height), sheets]), unit: T('м²'), qty: round(sheetArea, 2), kind: 'material', priceKey: 'fence-sheet' },
      { name: Tf('Труба профильная {0} — столбы {1} шт × {2} м', [v.post.replace(/x/g, '×'), posts, round(postLen, 2)]), unit: T('т'), qty: round(postKg / 1000, 4), kind: 'material', priceKey: 'metal-profile-pipe' },
      { name: Tf('Труба профильная {0} — лаги {1} м', [v.lag.replace(/x/g, '×'), round(lagM, 1)]), unit: T('т'), qty: round(lagKg / 1000, 4), kind: 'material', priceKey: 'metal-profile-pipe' },
      { name: T('Саморез кровельный 4,8×35'), unit: T('шт'), qty: screws, kind: 'material', priceKey: 'roof-screw' },
      { name: T('Заглушка на столб'), unit: T('шт'), qty: posts, kind: 'material', priceKey: 'post-cap' },
      { name: T('Бетон М200 для бетонирования столбов'), unit: T('м³'), qty: round(concrete * 1.05, 2), kind: 'material', priceKey: 'concrete-M200' },
      ...(v.works ? [{ name: T('Монтаж забора из профнастила'), unit: T('м'), qty: round(net, 1), kind: 'work' as const, priceKey: 'work-fence' }] : []),
    ],
    warnings,
  }
}

export const fence = defineCalculator<FenceValues>({
  id: 'fence',
  title: T('Забор из профнастила'),
  short: T('Столбы, лаги и тоннаж каркаса, листы, саморезы и бетон под столбы'),
  category: 'metal',
  icon: Fence,
  keywords: [T('забор'), T('ограждение'), T('профнастил'), T('столбы'), T('лаги'), T('профтруба'), T('ворота'), T('калитка')],
  sectionName: T('Забор'),
  defaults: {
    length: 100, height: 2, gates: 1, gateWidth: 4, step: 2.5, post: '60x60x2', burial: 1.2, lag: '40x20x2', lagRows: 3,
    sheet: 'c8', holeD: 200, works: false,
  },
  groups: [
    {
      title: T('Забор'),
      fields: [
        { key: 'length', label: T('Длина забора'), type: 'number', unit: T('м'), step: 1 },
        { key: 'height', label: T('Высота'), type: 'select', options: opts([[1.5, '1,5 м'], [1.8, '1,8 м'], [2, '2 м'], [2.5, '2,5 м']]) },
        { key: 'gates', label: T('Проёмов под ворота/калитки'), type: 'number', unit: T('шт'), step: 1 },
        { key: 'gateWidth', label: T('Средняя ширина проёма'), type: 'number', unit: T('м'), step: 0.5 },
        { key: 'sheet', label: T('Профнастил'), type: 'select', options: Object.entries(FENCE_SHEETS).map(([k, s]) => ({ value: k, label: Tf('{0} (полезная ширина {1} м)', [s.name, String(s.usefulW).replace('.', ',')]) })) },
      ],
    },
    {
      title: T('Каркас'),
      fields: [
        { key: 'step', label: T('Шаг столбов'), type: 'number', unit: T('м'), step: 0.1 },
        { key: 'post', label: T('Столбы'), type: 'select', options: opts([['60x60x2', T('Труба 60×60×2')], ['60x40x2', T('Труба 60×40×2')], ['80x80x3', T('Труба 80×80×3')]]) },
        { key: 'burial', label: T('Заглубление столбов'), type: 'number', unit: T('м'), step: 0.1 },
        { key: 'holeD', label: T('Диаметр скважины'), type: 'number', unit: T('мм'), step: 10 },
        { key: 'lag', label: T('Лаги'), type: 'select', options: opts([['40x20x2', T('Труба 40×20×2')], ['40x40x2', T('Труба 40×40×2')]]) },
        { key: 'lagRows', label: T('Рядов лаг'), type: 'segmented', options: opts([[2, '2'], [3, '3']]) },
        { key: 'works', label: T('Добавить монтаж'), type: 'toggle' },
      ],
    },
  ],
  compute: computeFence,
  method: [
    T('Столбов = ⌈длина без проёмов / шаг⌉ + 1 + по одному на каждый проём ворот.'),
    T('Масса труб — по сечению с радиусами скругления ГОСТ 30245; лаги +5% на подрезку.'),
    T('Листов = ⌈длина / полезная ширина⌉; саморезы — 5 шт на лист на каждую лагу.'),
  ],
})
