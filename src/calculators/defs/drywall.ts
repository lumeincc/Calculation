import { PanelsTopLeft } from 'lucide-react'
import { ceil, pos, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult, type MaterialLine, type RowValues } from '../types'
import { openingsArea, openingsField } from '../common'

export type DrywallValues = {
  kind: 'partition' | 'lining' | 'ceiling'
  length: number
  height: number
  roomL: number
  roomW: number
  sides: number
  layers: number
  step: number
  profile: number
  hangerStep: number
  openings: RowValues[]
  sheet: 'gkl' | 'gklv'
  sheetL: number
  insulation: boolean
  waste: number
  works: boolean
}

const SHEET_W = 1.2

export function computeDrywall(v: DrywallValues): CalcResult {
  const step = Math.max(0.3, pos(v.step) / 1000)
  const profLen = 3
  const layers = Math.max(1, Math.round(pos(v.layers)))
  const lines: MaterialLine[] = []
  const metrics: CalcResult['metrics'] = []
  let sheetArea: number // area of one side of the construction (net)
  let sides = 1
  let ps = 0, pn = 0, pp = 0, ppn = 0, hangers = 0, connectors = 0, dowels = 0, anchors = 0, flea = 0
  let frameEdge = 0 // length of the frame pressed to walls → sealing tape

  if (v.kind === 'partition') {
    const L = pos(v.length), H = pos(v.height)
    sides = Math.max(1, Math.round(pos(v.sides)))
    const openings = v.openings ?? []
    sheetArea = Math.max(0, L * H - openingsArea(openings))
    const studs = ceil(L / step) + 1
    const extraStuds = openings.reduce((s, r) => s + 2 * Math.round(pos(r.n)), 0)
    ps = (studs + extraStuds) * H
    pn = 2 * L + openings.reduce((s, r) => s + (pos(r.w) + 0.4) * Math.round(pos(r.n)), 0)
    dowels = ceil((2 * L) / 0.5) + 2 * ceil(H / 0.75)
    flea = (studs + extraStuds) * 4
    frameEdge = 2 * L + 2 * H
    metrics.push({ label: 'Стоек', value: studs + extraStuds, unit: 'шт', digits: 0 })
  } else if (v.kind === 'lining') {
    const L = pos(v.length), H = pos(v.height)
    sheetArea = Math.max(0, L * H - openingsArea(v.openings))
    const rows = ceil(L / step) + 1
    const perRow = Math.max(1, ceil(H / Math.max(0.4, pos(v.hangerStep))) - 1)
    pp = rows * H
    ppn = 2 * L
    hangers = rows * perRow
    dowels = ceil((2 * L) / 0.5) + hangers * 2
    flea = hangers * 2 + rows * 4
    frameEdge = 2 * L
    metrics.push({ label: 'Вертикальных профилей', value: rows, unit: 'шт', digits: 0 })
  } else {
    const L = pos(v.roomL), W = pos(v.roomW)
    sheetArea = L * W
    const rows = Math.max(1, ceil(W / step) - 1)
    const perRow = Math.max(1, ceil(L / Math.max(0.4, pos(v.hangerStep))) - 1)
    pp = rows * L
    connectors = L > profLen ? rows * (ceil(L / profLen) - 1) : 0
    ppn = 2 * (L + W)
    hangers = rows * perRow
    dowels = ceil(ppn / 0.5)
    anchors = hangers
    flea = hangers * 2 + rows * 4 + connectors * 4
    frameEdge = ppn
    metrics.push({ label: 'Несущих профилей', value: rows, unit: 'шт', digits: 0 })
  }

  const coverArea = sheetArea * sides * layers
  const sheetM2 = SHEET_W * pos(v.sheetL)
  const sheets = sheetM2 > 0 ? ceil((coverArea * (1 + pos(v.waste) / 100)) / sheetM2) : 0
  const screws = ceil(coverArea * 25)
  const outerArea = sheetArea * sides
  const joints = outerArea * (1 / SHEET_W + 1 / Math.max(1, pos(v.sheetL)))
  const fillerKg = outerArea * 0.3

  metrics.unshift(
    { label: 'Листов ГКЛ', value: sheets, unit: 'шт', digits: 0, primary: true },
    { label: 'Площадь обшивки', value: coverArea, unit: 'м²', digits: 2, primary: true },
    { label: 'Профиля всего', value: ps + pn + pp + ppn, unit: 'м', digits: 1, primary: true },
  )
  const sheetName = v.sheet === 'gklv' ? 'Гипсокартон влагостойкий ГКЛВ 12,5 мм' : 'Гипсокартон ГКЛ 12,5 мм'
  lines.push({ name: `${sheetName} 1200×${Math.round(pos(v.sheetL) * 1000)} (${sheets} листов)`, unit: 'м²', qty: round(sheets * sheetM2, 2), kind: 'material', priceKey: v.sheet })
  const prof = (name: string, metres: number, key: string) => {
    if (metres <= 0) return
    const pcs = ceil(metres / profLen)
    metrics.push({ label: name, value: metres, unit: 'м', digits: 1, hint: `${pcs} шт по ${profLen} м` })
    lines.push({ name: `${name} (${pcs} шт по ${profLen} м)`, unit: 'м', qty: pcs * profLen, kind: 'material', priceKey: key })
  }
  const w = pos(v.profile)
  prof(`Профиль стоечный ПС ${w}/50`, ps, 'profile-ps')
  prof(`Профиль направляющий ПН ${w}/40`, pn, 'profile-pn')
  prof('Профиль потолочный ПП 60/27', pp, 'profile-pp')
  prof('Профиль направляющий ППН 28/27', ppn, 'profile-ppn')
  const pcs = (name: string, n: number, unit: string, key: string) => {
    if (n > 0) lines.push({ name, unit, qty: n, kind: 'material', priceKey: key })
  }
  pcs('Подвес прямой', hangers, 'шт', 'hanger')
  pcs('Соединитель профилей', connectors, 'шт', 'profile-connector')
  pcs('Саморез для ГКЛ 3,5×25 / 3,5×35', screws, 'шт', 'screw-gkl')
  pcs('Саморез «клоп» 3,5×9,5', ceil(flea * 1.1), 'шт', 'screw-flea')
  pcs('Дюбель-гвоздь 6×40', ceil(dowels * 1.1), 'шт', 'dowel')
  pcs('Анкер-клин для подвесов', anchors, 'шт', 'anchor')
  pcs('Лента уплотнительная', round(frameEdge * 1.05, 1), 'м', 'sealing-tape')
  pcs('Лента армирующая (серпянка)', ceil(joints), 'м', 'serpyanka')
  if (fillerKg > 0) lines.push({ name: 'Шпаклёвка для швов ГКЛ, мешок 25 кг', unit: 'мешок', qty: ceil(fillerKg / 25), kind: 'material', priceKey: 'mix-joint-filler', priceFactor: 25 })
  if (v.insulation && sheetArea > 0) {
    const depth = v.kind === 'partition' ? w / 1000 : 0.05
    lines.push({ name: `Минеральная вата ${Math.round(depth * 1000)} мм`, unit: 'м³', qty: round(sheetArea * depth * 1.05, 3), kind: 'material', priceKey: 'mineral-wool' })
  }
  metrics.push(
    { label: 'Саморезов для ГКЛ', value: screws, unit: 'шт', digits: 0 },
    { label: 'Швов под серпянку', value: joints, unit: 'м', digits: 1 },
  )
  if (v.works) {
    const map = { partition: ['Монтаж перегородки из ГКЛ', 'work-drywall-partition'], lining: ['Облицовка стен ГКЛ по каркасу', 'work-drywall-lining'], ceiling: ['Монтаж потолка из ГКЛ', 'work-drywall-ceiling'] } as const
    const [name, key] = map[v.kind]
    lines.push({ name, unit: 'м²', qty: round(sheetArea, 2), kind: 'work', priceKey: key })
  }
  const warnings: string[] = []
  if (v.kind === 'partition' && pos(v.height) > 3) warnings.push('Высота больше 3 м: стойки нужно наращивать или брать профиль 4 м, шаг — 400 мм.')
  return { metrics, lines, warnings }
}

export const drywall = defineCalculator<DrywallValues>({
  id: 'drywall',
  title: 'Гипсокартон',
  short: 'Перегородки, облицовка стен и потолки: листы ГКЛ, профили, подвесы, крепёж, лента',
  category: 'walls',
  icon: PanelsTopLeft,
  keywords: ['гипсокартон', 'гкл', 'гклв', 'перегородка', 'потолок', 'профиль', 'пс', 'пн', 'пп', 'подвесы', 'каркас', 'кнауф'],
  sectionName: 'Гипсокартонные конструкции',
  defaults: {
    kind: 'partition', length: 4, height: 2.7, roomL: 5, roomW: 4, sides: 2, layers: 1, step: 600, profile: 75,
    hangerStep: 800, openings: [{ w: 0.9, h: 2.1, n: 1 }], sheet: 'gkl', sheetL: 2.5, insulation: true, waste: 10, works: false,
  },
  groups: [
    {
      title: 'Конструкция',
      fields: [
        { key: 'kind', label: 'Тип', type: 'segmented', span: 6, options: opts([['partition', 'Перегородка'], ['lining', 'Облицовка стены'], ['ceiling', 'Потолок']]) },
        { key: 'length', label: 'Длина', type: 'number', unit: 'м', step: 0.1, visible: (v) => v.kind !== 'ceiling' },
        { key: 'height', label: 'Высота', type: 'number', unit: 'м', step: 0.05, visible: (v) => v.kind !== 'ceiling' },
        { key: 'roomL', label: 'Длина помещения', type: 'number', unit: 'м', step: 0.1, visible: (v) => v.kind === 'ceiling' },
        { key: 'roomW', label: 'Ширина помещения', type: 'number', unit: 'м', step: 0.1, visible: (v) => v.kind === 'ceiling' },
        { key: 'profile', label: 'Ширина стоечного профиля', type: 'select', options: opts([[50, '50 мм'], [75, '75 мм'], [100, '100 мм']]), visible: (v) => v.kind === 'partition' },
        { key: 'sides', label: 'Обшивка сторон', type: 'segmented', options: opts([[1, '1'], [2, '2']]), visible: (v) => v.kind === 'partition' },
        { key: 'step', label: 'Шаг профилей', type: 'select', options: opts([[400, '400 мм'], [600, '600 мм']]) },
        { key: 'hangerStep', label: 'Шаг подвесов', type: 'number', unit: 'мм', step: 50, visible: (v) => v.kind !== 'partition' },
        { ...openingsField<DrywallValues>('openings', 'Проёмы'), visible: (v) => v.kind !== 'ceiling' },
      ],
    },
    {
      title: 'Обшивка',
      fields: [
        { key: 'sheet', label: 'Лист', type: 'select', options: opts([['gkl', 'ГКЛ 12,5 мм'], ['gklv', 'ГКЛВ влагостойкий 12,5 мм']]) },
        { key: 'sheetL', label: 'Длина листа', type: 'select', options: opts([[2.5, '2500 мм'], [2.7, '2700 мм'], [3, '3000 мм']]) },
        { key: 'layers', label: 'Слоёв обшивки', type: 'segmented', options: opts([[1, '1'], [2, '2']]) },
        { key: 'waste', label: 'Запас на подрезку', type: 'number', unit: '%', step: 1 },
        { key: 'insulation', label: 'Звуко-/теплоизоляция', type: 'toggle' },
        { key: 'works', label: 'Добавить работы', type: 'toggle' },
      ],
    },
  ],
  compute: computeDrywall,
  method: [
    'Перегородка: стойки ПС через шаг + крайние у стен, по 2 дополнительные стойки и перемычка ПН на каждый проём; ПН по полу и потолку.',
    'Облицовка и потолок: ПП 60/27 с шагом 600 мм, подвесы через 0,6–1 м, ППН 28/27 по периметру.',
    'Саморезы для ГКЛ ~25 шт на м² каждого слоя; серпянка — длина швов листов 1,2 × L; шпаклёвка для швов ~0,3 кг/м².',
    'Профиль считается штуками по 3 м без учёта переиспользования обрезков.',
  ],
})
