import { Grid3x3 } from 'lucide-react'
import { REBAR, rebarKgPerM } from '@/data/metals'
import { ceil, floor, pos, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult, type MaterialLine } from '../types'
import { T, Tf } from '@/i18n'

export type RebarValues = {
  type: 'slab' | 'strip'
  slabL: number
  slabW: number
  slabT: number
  step: number
  layers: number
  d: string
  stripL: number
  stripW: number
  stripH: number
  bars: number
  stirrupD: string
  stirrupStep: number
  cover: number
  stock: number
  lap: number
  works: boolean
}

/** Length of one run of bar including laps when it is longer than the stock bar. */
export function withLaps(len: number, stock: number, lapM: number): number {
  if (len <= 0) return 0
  const joints = Math.max(0, ceil(len / Math.max(0.5, stock)) - 1)
  return len + joints * lapM
}

const TIE_KG = 0.3 * 0.0089 // 30 cm of 1.2 mm wire per tie

export function computeRebar(v: RebarValues): CalcResult {
  const c = pos(v.cover) / 1000
  const stock = pos(v.stock) || 11.7
  const groups = new Map<number, number>() // diameter → metres
  const add = (d: number, m: number) => groups.set(d, (groups.get(d) ?? 0) + m)
  let ties = 0
  const metrics: CalcResult['metrics'] = []
  const warnings: string[] = []

  if (v.type === 'slab') {
    const d = Number(v.d)
    const lap = (pos(v.lap) * d) / 1000
    const L = pos(v.slabL) - 2 * c, W = pos(v.slabW) - 2 * c
    const step = Math.max(50, pos(v.step)) / 1000
    if (L <= 0 || W <= 0) warnings.push(T('Размеры плиты меньше защитного слоя.'))
    const nAlongL = floor(Math.max(0, W) / step) + 1 // bars running along L
    const nAlongW = floor(Math.max(0, L) / step) + 1
    const layers = Math.max(1, Math.round(pos(v.layers)))
    const perLayer = nAlongL * withLaps(L, stock, lap) + nAlongW * withLaps(W, stock, lap)
    add(d, perLayer * layers)
    ties = nAlongL * nAlongW * layers
    if (layers >= 2) {
      // П-shaped supports between meshes, ~1 per m², same diameter rounded to ≥10 mm
      const h = pos(v.slabT) / 1000 - 2 * c - (2 * d) / 1000
      const supports = ceil(Math.max(0, L) * Math.max(0, W))
      const dSup = Math.max(10, d >= 12 ? d - 2 : 10)
      add(dSup, supports * (2 * Math.max(0.1, h) + 0.4))
      metrics.push({ label: T('Поддерживающих П-каркасов'), value: supports, unit: T('шт'), digits: 0 })
    }
    metrics.push({ label: T('Стержней в слое'), value: nAlongL + nAlongW, unit: T('шт'), digits: 0 })
  } else {
    const d = Number(v.d)
    const lap = (pos(v.lap) * d) / 1000
    const P = pos(v.stripL)
    const nBars = Math.max(2, Math.round(pos(v.bars)))
    // laps along the run + anchoring at ~4 corners per closed contour
    const runs = withLaps(P, stock, lap)
    add(d, nBars * runs)
    const ds = Number(v.stirrupD)
    const sStep = Math.max(100, pos(v.stirrupStep)) / 1000
    const nStirrups = ceil(P / sStep) + 1
    const sw = pos(v.stripW) - 2 * c, sh = pos(v.stripH) - 2 * c
    const stirrupLen = 2 * Math.max(0, sw) + 2 * Math.max(0, sh) + 0.2
    add(ds, nStirrups * stirrupLen)
    ties = nStirrups * nBars
    metrics.push(
      { label: T('Хомутов'), value: nStirrups, unit: T('шт'), digits: 0 },
      { label: T('Длина хомута'), value: stirrupLen, unit: T('м'), digits: 2 },
    )
  }

  let totalKg = 0
  const lines: MaterialLine[] = []
  const rows = [...groups.entries()].sort((a, b) => b[0] - a[0])
  for (const [d, metres] of rows) {
    const kg = metres * rebarKgPerM(d)
    totalKg += kg
    const smooth = d <= 8 && v.type === 'strip' && String(d) === v.stirrupD
    metrics.push({
      label: Tf('⌀{0}: длина', [d]), value: metres, unit: T('м'), digits: 1,
      hint: Tf('{0} кг · {1} прутков по {2} м', [round(kg, 1), ceil(metres / stock), stock]),
    })
    lines.push({
      name: Tf('Арматура ⌀{0} {1}', [d, smooth ? 'А240' : 'А500С']),
      unit: T('т'), qty: round(kg / 1000, 4), kind: 'material', priceKey: smooth ? 'rebar-a240' : 'rebar-a500',
    })
  }
  const wireKg = ties * TIE_KG * 1.1
  metrics.unshift(
    { label: T('Масса арматуры'), value: totalKg / 1000, unit: T('т'), digits: 3, primary: true },
    { label: T('Вязальная проволока'), value: wireKg, unit: T('кг'), digits: 1, primary: true },
    { label: T('Узлов вязки'), value: ties, unit: T('шт'), digits: 0, primary: true },
  )
  lines.push({ name: T('Проволока вязальная 1,2 мм'), unit: T('кг'), qty: round(wireKg, 1), kind: 'material', priceKey: 'tie-wire' })
  if (v.works) lines.push({ name: T('Армирование (вязка каркасов и сеток)'), unit: T('т'), qty: round(totalKg / 1000, 3), kind: 'work', priceKey: 'work-rebar' })
  return { metrics, lines, warnings }
}

const rebarOptions = REBAR.filter((r) => r.d <= 32).map((r) => ({ value: String(r.d), label: Tf('⌀{0} мм', [r.d]) }))

export const rebar = defineCalculator<RebarValues>({
  id: 'rebar',
  title: T('Арматура'),
  short: T('Армирование плиты и ленточного фундамента: метры, тонны, прутки, хомуты, проволока'),
  category: 'foundation',
  icon: Grid3x3,
  keywords: [T('арматура'), T('армирование'), T('сетка'), T('каркас'), T('хомуты'), T('вязальная'), T('проволока'), T('плита'), T('лента'), T('тоннаж'), 'а500'],
  sectionName: T('Армирование'),
  defaults: {
    type: 'slab', slabL: 10, slabW: 8, slabT: 250, step: 200, layers: 2, d: '12',
    stripL: 36, stripW: 0.4, stripH: 1.2, bars: 6, stirrupD: '8', stirrupStep: 300,
    cover: 50, stock: 11.7, lap: 40, works: false,
  },
  groups: [
    {
      title: T('Конструкция'),
      fields: [
        { key: 'type', label: T('Тип'), type: 'segmented', span: 6, options: opts([['slab', T('Плита (сетка)')], ['strip', T('Лента (каркас)')]]) },
        { key: 'slabL', label: T('Длина плиты'), type: 'number', unit: T('м'), step: 0.1, span: 2, visible: (v) => v.type === 'slab' },
        { key: 'slabW', label: T('Ширина плиты'), type: 'number', unit: T('м'), step: 0.1, span: 2, visible: (v) => v.type === 'slab' },
        { key: 'slabT', label: T('Толщина плиты'), type: 'number', unit: T('мм'), step: 10, span: 2, visible: (v) => v.type === 'slab' },
        { key: 'step', label: T('Шаг сетки'), type: 'select', options: opts([[100, '100 мм'], [150, '150 мм'], [200, '200 мм'], [250, '250 мм'], [300, '300 мм']]), visible: (v) => v.type === 'slab' },
        { key: 'layers', label: T('Сеток (слоёв)'), type: 'segmented', options: opts([[1, '1'], [2, '2']]), visible: (v) => v.type === 'slab' },
        { key: 'stripL', label: T('Общая длина ленты'), type: 'number', unit: T('м'), step: 0.5, span: 2, visible: (v) => v.type === 'strip' },
        { key: 'stripW', label: T('Ширина ленты'), type: 'number', unit: T('м'), step: 0.05, span: 2, visible: (v) => v.type === 'strip' },
        { key: 'stripH', label: T('Высота ленты'), type: 'number', unit: T('м'), step: 0.05, span: 2, visible: (v) => v.type === 'strip' },
        { key: 'bars', label: T('Продольных стержней в сечении'), type: 'number', unit: T('шт'), step: 1, visible: (v) => v.type === 'strip' },
        { key: 'stirrupD', label: T('Диаметр хомутов'), type: 'select', options: opts([[6, '⌀6 мм'], [8, '⌀8 мм'], [10, '⌀10 мм']]), visible: (v) => v.type === 'strip' },
        { key: 'stirrupStep', label: T('Шаг хомутов'), type: 'number', unit: T('мм'), step: 50, visible: (v) => v.type === 'strip' },
      ],
    },
    {
      title: T('Арматура'),
      fields: [
        { key: 'd', label: T('Диаметр рабочей арматуры'), type: 'select', options: rebarOptions },
        { key: 'cover', label: T('Защитный слой'), type: 'number', unit: T('мм'), step: 5 },
        { key: 'stock', label: T('Длина прутка'), type: 'select', options: opts([[11.7, '11,7 м'], [6, '6 м']]) },
        { key: 'lap', label: T('Нахлёст'), type: 'number', unit: 'd', step: 5, hint: T('В диаметрах; обычно 30–50d') },
        { key: 'works', label: T('Добавить работы'), type: 'toggle' },
      ],
    },
  ],
  compute: computeRebar,
  method: [
    T('Плита: стержней вдоль каждой стороны = ⌊(ширина − 2·защитный слой) / шаг⌋ + 1; длины стержней увеличиваются на нахлёст в каждом стыке прутков.'),
    T('Для двух сеток добавлены поддерживающие П-каркасы — примерно 1 шт на м².'),
    T('Лента: продольные стержни × длина ленты + нахлёсты; хомуты по периметру сечения за вычетом защитного слоя + 20 см на загибы.'),
    T('Вязальная проволока: ~30 см проволоки ⌀1,2 мм на узел, +10% запас.'),
  ],
})
