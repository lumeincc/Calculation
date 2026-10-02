import { PanelsTopLeft } from 'lucide-react'
import { ceil, pos, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult, type MaterialLine, type RowValues } from '../types'
import { openingsArea, openingsField } from '../common'
import { T, Tf } from '@/i18n'

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
    metrics.push({ label: T('Стоек'), value: studs + extraStuds, unit: T('шт'), digits: 0 })
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
    metrics.push({ label: T('Вертикальных профилей'), value: rows, unit: T('шт'), digits: 0 })
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
    metrics.push({ label: T('Несущих профилей'), value: rows, unit: T('шт'), digits: 0 })
  }

  const coverArea = sheetArea * sides * layers
  const sheetM2 = SHEET_W * pos(v.sheetL)
  const sheets = sheetM2 > 0 ? ceil((coverArea * (1 + pos(v.waste) / 100)) / sheetM2) : 0
  const screws = ceil(coverArea * 25)
  const outerArea = sheetArea * sides
  const joints = outerArea * (1 / SHEET_W + 1 / Math.max(1, pos(v.sheetL)))
  const fillerKg = outerArea * 0.3

  metrics.unshift(
    { label: T('Листов ГКЛ'), value: sheets, unit: T('шт'), digits: 0, primary: true },
    { label: T('Площадь обшивки'), value: coverArea, unit: T('м²'), digits: 2, primary: true },
    { label: T('Профиля всего'), value: ps + pn + pp + ppn, unit: T('м'), digits: 1, primary: true },
  )
  const sheetName = v.sheet === 'gklv' ? T('Гипсокартон влагостойкий ГКЛВ 12,5 мм') : T('Гипсокартон ГКЛ 12,5 мм')
  lines.push({ name: Tf('{0} 1200×{1} ({2} листов)', [sheetName, Math.round(pos(v.sheetL) * 1000), sheets]), unit: T('м²'), qty: round(sheets * sheetM2, 2), kind: 'material', priceKey: v.sheet })
  const prof = (name: string, metres: number, key: string) => {
    if (metres <= 0) return
    const pcs = ceil(metres / profLen)
    metrics.push({ label: name, value: metres, unit: T('м'), digits: 1, hint: Tf('{0} шт по {1} м', [pcs, profLen]) })
    lines.push({ name: Tf('{0} ({1} шт по {2} м)', [name, pcs, profLen]), unit: T('м'), qty: pcs * profLen, kind: 'material', priceKey: key })
  }
  const w = pos(v.profile)
  prof(Tf('Профиль стоечный ПС {0}/50', [w]), ps, 'profile-ps')
  prof(Tf('Профиль направляющий ПН {0}/40', [w]), pn, 'profile-pn')
  prof(T('Профиль потолочный ПП 60/27'), pp, 'profile-pp')
  prof(T('Профиль направляющий ППН 28/27'), ppn, 'profile-ppn')
  const pcs = (name: string, n: number, unit: string, key: string) => {
    if (n > 0) lines.push({ name, unit, qty: n, kind: 'material', priceKey: key })
  }
  pcs(T('Подвес прямой'), hangers, T('шт'), 'hanger')
  pcs(T('Соединитель профилей'), connectors, T('шт'), 'profile-connector')
  pcs(T('Саморез для ГКЛ 3,5×25 / 3,5×35'), screws, T('шт'), 'screw-gkl')
  pcs(T('Саморез «клоп» 3,5×9,5'), ceil(flea * 1.1), T('шт'), 'screw-flea')
  pcs(T('Дюбель-гвоздь 6×40'), ceil(dowels * 1.1), T('шт'), 'dowel')
  pcs(T('Анкер-клин для подвесов'), anchors, T('шт'), 'anchor')
  pcs(T('Лента уплотнительная'), round(frameEdge * 1.05, 1), T('м'), 'sealing-tape')
  pcs(T('Лента армирующая (серпянка)'), ceil(joints), T('м'), 'serpyanka')
  if (fillerKg > 0) lines.push({ name: T('Шпаклёвка для швов ГКЛ, мешок 25 кг'), unit: T('мешок'), qty: ceil(fillerKg / 25), kind: 'material', priceKey: 'mix-joint-filler', priceFactor: 25 })
  if (v.insulation && sheetArea > 0) {
    const depth = v.kind === 'partition' ? w / 1000 : 0.05
    lines.push({ name: Tf('Минеральная вата {0} мм', [Math.round(depth * 1000)]), unit: T('м³'), qty: round(sheetArea * depth * 1.05, 3), kind: 'material', priceKey: 'mineral-wool' })
  }
  metrics.push(
    { label: T('Саморезов для ГКЛ'), value: screws, unit: T('шт'), digits: 0 },
    { label: T('Швов под серпянку'), value: joints, unit: T('м'), digits: 1 },
  )
  if (v.works) {
    const map = { partition: [T('Монтаж перегородки из ГКЛ'), 'work-drywall-partition'], lining: [T('Облицовка стен ГКЛ по каркасу'), 'work-drywall-lining'], ceiling: [T('Монтаж потолка из ГКЛ'), 'work-drywall-ceiling'] } as const
    const [name, key] = map[v.kind]
    lines.push({ name, unit: T('м²'), qty: round(sheetArea, 2), kind: 'work', priceKey: key })
  }
  const warnings: string[] = []
  if (v.kind === 'partition' && pos(v.height) > 3) warnings.push(T('Высота больше 3 м: стойки нужно наращивать или брать профиль 4 м, шаг — 400 мм.'))
  return { metrics, lines, warnings }
}

export const drywall = defineCalculator<DrywallValues>({
  id: 'drywall',
  title: T('Гипсокартон'),
  short: T('Перегородки, облицовка стен и потолки: листы ГКЛ, профили, подвесы, крепёж, лента'),
  category: 'walls',
  icon: PanelsTopLeft,
  keywords: [T('гипсокартон'), T('гкл'), T('гклв'), T('перегородка'), T('потолок'), T('профиль'), T('пс'), T('пн'), T('пп'), T('подвесы'), T('каркас'), T('кнауф')],
  sectionName: T('Гипсокартонные конструкции'),
  defaults: {
    kind: 'partition', length: 4, height: 2.7, roomL: 5, roomW: 4, sides: 2, layers: 1, step: 600, profile: 75,
    hangerStep: 800, openings: [{ w: 0.9, h: 2.1, n: 1 }], sheet: 'gkl', sheetL: 2.5, insulation: true, waste: 10, works: false,
  },
  groups: [
    {
      title: T('Конструкция'),
      fields: [
        { key: 'kind', label: T('Тип'), type: 'segmented', span: 6, options: opts([['partition', T('Перегородка')], ['lining', T('Облицовка стены')], ['ceiling', T('Потолок')]]) },
        { key: 'length', label: T('Длина'), type: 'number', unit: T('м'), step: 0.1, visible: (v) => v.kind !== 'ceiling' },
        { key: 'height', label: T('Высота'), type: 'number', unit: T('м'), step: 0.05, visible: (v) => v.kind !== 'ceiling' },
        { key: 'roomL', label: T('Длина помещения'), type: 'number', unit: T('м'), step: 0.1, visible: (v) => v.kind === 'ceiling' },
        { key: 'roomW', label: T('Ширина помещения'), type: 'number', unit: T('м'), step: 0.1, visible: (v) => v.kind === 'ceiling' },
        { key: 'profile', label: T('Ширина стоечного профиля'), type: 'select', options: opts([[50, '50 мм'], [75, '75 мм'], [100, '100 мм']]), visible: (v) => v.kind === 'partition' },
        { key: 'sides', label: T('Обшивка сторон'), type: 'segmented', options: opts([[1, '1'], [2, '2']]), visible: (v) => v.kind === 'partition' },
        { key: 'step', label: T('Шаг профилей'), type: 'select', options: opts([[400, '400 мм'], [600, '600 мм']]) },
        { key: 'hangerStep', label: T('Шаг подвесов'), type: 'number', unit: T('мм'), step: 50, visible: (v) => v.kind !== 'partition' },
        { ...openingsField<DrywallValues>('openings', T('Проёмы')), visible: (v) => v.kind !== 'ceiling' },
      ],
    },
    {
      title: T('Обшивка'),
      fields: [
        { key: 'sheet', label: T('Лист'), type: 'select', options: opts([['gkl', T('ГКЛ 12,5 мм')], ['gklv', T('ГКЛВ влагостойкий 12,5 мм')]]) },
        { key: 'sheetL', label: T('Длина листа'), type: 'select', options: opts([[2.5, '2500 мм'], [2.7, '2700 мм'], [3, '3000 мм']]) },
        { key: 'layers', label: T('Слоёв обшивки'), type: 'segmented', options: opts([[1, '1'], [2, '2']]) },
        { key: 'waste', label: T('Запас на подрезку'), type: 'number', unit: '%', step: 1 },
        { key: 'insulation', label: T('Звуко-/теплоизоляция'), type: 'toggle' },
        { key: 'works', label: T('Добавить работы'), type: 'toggle' },
      ],
    },
  ],
  compute: computeDrywall,
  method: [
    T('Перегородка: стойки ПС через шаг + крайние у стен, по 2 дополнительные стойки и перемычка ПН на каждый проём; ПН по полу и потолку.'),
    T('Облицовка и потолок: ПП 60/27 с шагом 600 мм, подвесы через 0,6–1 м, ППН 28/27 по периметру.'),
    T('Саморезы для ГКЛ ~25 шт на м² каждого слоя; серпянка — длина швов листов 1,2 × L; шпаклёвка для швов ~0,3 кг/м².'),
    T('Профиль считается штуками по 3 м без учёта переиспользования обрезков.'),
  ],
})
