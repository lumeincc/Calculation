import { Cuboid } from 'lucide-react'
import { ceil, pos, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult, type MaterialLine } from '../types'
import { withWaste } from '../common'
import { T, Tf } from '@/i18n'

/**
 * Пропорции Ц:П:Щ по массе для цемента М400 и М500 и ориентировочное В/Ц.
 * Общераспространённая таблица подбора; точный состав подбирает лаборатория.
 */
export const CONCRETE_GRADES = [
  { grade: 'M100', cls: 'B7,5', m400: [4.6, 7.0], m500: [5.8, 8.1], wc: 0.85 },
  { grade: 'M150', cls: 'B12,5', m400: [3.5, 5.7], m500: [4.5, 6.6], wc: 0.75 },
  { grade: 'M200', cls: 'B15', m400: [2.8, 4.8], m500: [3.5, 5.6], wc: 0.65 },
  { grade: 'M250', cls: 'B20', m400: [2.1, 3.9], m500: [2.6, 4.5], wc: 0.6 },
  { grade: 'M300', cls: 'B22,5', m400: [1.9, 3.7], m500: [2.4, 4.3], wc: 0.55 },
  { grade: 'M350', cls: 'B25', m400: [1.55, 3.2], m500: [2.0, 3.75], wc: 0.5 },
  { grade: 'M400', cls: 'B30', m400: [1.2, 2.7], m500: [1.6, 3.2], wc: 0.45 },
] as const

const CONCRETE_DENSITY = 2400 // kg/m³, fresh heavy concrete
const SAND_DENSITY = 1600 // kg/m³ bulk
const GRAVEL_DENSITY = 1450 // kg/m³ bulk

export type ConcreteShape = 'slab' | 'strip' | 'columns' | 'volume'

export type ConcreteValues = {
  shape: ConcreteShape
  slabL: number
  slabW: number
  slabT: number
  stripL: number
  stripW: number
  stripH: number
  colType: 'round' | 'square'
  colD: number
  colH: number
  colN: number
  volume: number
  grade: string
  waste: number
  supply: 'ready' | 'self'
  mixer: number
  cement: 'm400' | 'm500'
  bag: number
  formwork: boolean
  works: boolean
}

export function concreteGeometry(v: ConcreteValues): { volume: number; formwork: number } {
  switch (v.shape) {
    case 'slab': {
      const l = pos(v.slabL), w = pos(v.slabW), t = pos(v.slabT) / 1000
      return { volume: l * w * t, formwork: 2 * (l + w) * t }
    }
    case 'strip': {
      const l = pos(v.stripL), w = pos(v.stripW), h = pos(v.stripH)
      return { volume: l * w * h, formwork: 2 * l * h }
    }
    case 'columns': {
      const d = pos(v.colD) / 1000, h = pos(v.colH), n = Math.round(pos(v.colN))
      const area = v.colType === 'round' ? (Math.PI * d * d) / 4 : d * d
      const perim = v.colType === 'round' ? Math.PI * d : 4 * d
      return { volume: area * h * n, formwork: perim * h * n }
    }
    default:
      return { volume: pos(v.volume), formwork: 0 }
  }
}

export function concreteMix(grade: string, cement: 'm400' | 'm500') {
  const g = CONCRETE_GRADES.find((x) => x.grade === grade) ?? CONCRETE_GRADES[2]
  const [s, gr] = g[cement]
  const cementKg = CONCRETE_DENSITY / (1 + s + gr + g.wc)
  return { cementKg, sandKg: cementKg * s, gravelKg: cementKg * gr, waterL: cementKg * g.wc, cls: g.cls }
}

export function computeConcrete(v: ConcreteValues): CalcResult {
  const geo = concreteGeometry(v)
  const volume = withWaste(geo.volume, v.waste)
  const mix = concreteMix(v.grade, v.cement)
  const gradeLabel = `${v.grade.replace('M', T('М'))} (${mix.cls})`
  const metrics: CalcResult['metrics'] = [
    { label: T('Объём бетона с запасом'), value: volume, unit: T('м³'), digits: 2, primary: true },
    { label: T('Объём конструкции'), value: geo.volume, unit: T('м³'), digits: 3 },
    { label: T('Масса бетона'), value: (volume * CONCRETE_DENSITY) / 1000, unit: T('т'), digits: 2, primary: true },
  ]
  const lines: MaterialLine[] = []
  const warnings: string[] = []

  if (v.supply === 'ready') {
    const trips = ceil(volume / Math.max(1, pos(v.mixer)))
    metrics.push({ label: Tf('Рейсов миксера по {0} м³', [pos(v.mixer)]), value: trips, unit: T('рейс'), digits: 0, primary: true })
    lines.push({ name: Tf('Бетон товарный {0}', [gradeLabel]), unit: T('м³'), qty: round(volume, 2), kind: 'material', priceKey: `concrete-${v.grade}` })
    lines.push({ name: T('Доставка бетона миксером'), unit: T('рейс'), qty: trips, kind: 'transport', priceKey: 'mixer-trip' })
  } else {
    const bag = Math.max(1, pos(v.bag))
    const cementKg = mix.cementKg * volume
    const bags = ceil(cementKg / bag)
    const sandM3 = (mix.sandKg * volume) / SAND_DENSITY
    const gravelM3 = (mix.gravelKg * volume) / GRAVEL_DENSITY
    metrics.push(
      { label: Tf('Цемент {0}', [v.cement === 'm500' ? 'М500' : 'М400']), value: cementKg, unit: T('кг'), digits: 0, primary: true },
      { label: Tf('Мешков по {0} кг', [bag]), value: bags, unit: T('шт'), digits: 0, primary: true },
      { label: T('Песок'), value: sandM3, unit: T('м³'), digits: 2, hint: Tf('{0} т', [round((mix.sandKg * volume) / 1000, 2)]) },
      { label: T('Щебень'), value: gravelM3, unit: T('м³'), digits: 2, hint: Tf('{0} т', [round((mix.gravelKg * volume) / 1000, 2)]) },
      { label: T('Вода'), value: mix.waterL * volume, unit: T('л'), digits: 0 },
      { label: T('Цемента на 1 м³'), value: mix.cementKg, unit: T('кг'), digits: 0 },
    )
    lines.push(
      { name: Tf('Цемент {0}, мешок {1} кг', [v.cement === 'm500' ? 'ПЦ500' : 'ПЦ400', bag]), unit: T('мешок'), qty: bags, kind: 'material', priceKey: 'cement', priceFactor: bag },
      { name: T('Песок строительный'), unit: T('м³'), qty: round(sandM3, 2), kind: 'material', priceKey: 'bulk-sand' },
      { name: T('Щебень гранитный 5–20'), unit: T('м³'), qty: round(gravelM3, 2), kind: 'material', priceKey: 'bulk-gravel-granite' },
    )
    if (volume > 3) warnings.push(T('Для объёма больше 3 м³ обычно выгоднее заказать товарный бетон: замес вручную не даёт монолитной заливки.'))
  }

  if (v.formwork && geo.formwork > 0) {
    metrics.push({ label: T('Площадь опалубки'), value: geo.formwork, unit: T('м²'), digits: 1 })
    lines.push({ name: T('Щиты / доска для опалубки'), unit: T('м²'), qty: round(geo.formwork, 1), kind: 'material', priceKey: 'formwork-board' })
  }
  if (v.works) {
    lines.push({ name: T('Бетонирование конструкций'), unit: T('м³'), qty: round(geo.volume, 2), kind: 'work', priceKey: 'work-concrete' })
    if (v.formwork && geo.formwork > 0)
      lines.push({ name: T('Устройство и разборка опалубки'), unit: T('м²'), qty: round(geo.formwork, 1), kind: 'work', priceKey: 'work-formwork' })
  }
  if (geo.volume === 0) warnings.push(T('Задайте размеры конструкции.'))
  return { metrics, lines, warnings }
}

export const concrete = defineCalculator<ConcreteValues>({
  id: 'concrete',
  title: T('Бетон и фундамент'),
  short: T('Объём бетона для плиты, ленты и столбов, состав замеса, миксеры, опалубка'),
  category: 'foundation',
  icon: Cuboid,
  keywords: [T('бетон'), T('фундамент'), T('плита'), T('лента'), T('ленточный'), T('столбы'), T('сваи'), T('цемент'), T('щебень'), T('песок'), T('миксер'), T('опалубка'), T('кубы')],
  sectionName: T('Фундамент'),
  defaults: {
    shape: 'strip',
    slabL: 10, slabW: 8, slabT: 250,
    stripL: 36, stripW: 0.4, stripH: 1.2,
    colType: 'round', colD: 300, colH: 2, colN: 16,
    volume: 10,
    grade: 'M250', waste: 3, supply: 'ready', mixer: 9, cement: 'm500', bag: 50,
    formwork: true, works: false,
  },
  groups: [
    {
      title: T('Конструкция'),
      fields: [
        {
          key: 'shape', label: T('Тип'), type: 'segmented', span: 6,
          options: opts([['strip', T('Лента')], ['slab', T('Плита')], ['columns', T('Столбы')], ['volume', T('Объём')]]),
        },
        { key: 'stripL', label: T('Общая длина ленты'), hint: T('Периметр + внутренние стены'), type: 'number', unit: T('м'), step: 0.5, span: 2, visible: (v) => v.shape === 'strip' },
        { key: 'stripW', label: T('Ширина ленты'), type: 'number', unit: T('м'), step: 0.05, span: 2, visible: (v) => v.shape === 'strip' },
        { key: 'stripH', label: T('Высота ленты'), type: 'number', unit: T('м'), step: 0.05, span: 2, visible: (v) => v.shape === 'strip' },
        { key: 'slabL', label: T('Длина'), type: 'number', unit: T('м'), step: 0.1, span: 2, visible: (v) => v.shape === 'slab' },
        { key: 'slabW', label: T('Ширина'), type: 'number', unit: T('м'), step: 0.1, span: 2, visible: (v) => v.shape === 'slab' },
        { key: 'slabT', label: T('Толщина'), type: 'number', unit: T('мм'), step: 10, span: 2, visible: (v) => v.shape === 'slab' },
        { key: 'colType', label: T('Сечение'), type: 'segmented', options: opts([['round', T('Круглое')], ['square', T('Квадратное')]]), span: 6, visible: (v) => v.shape === 'columns' },
        { key: 'colD', label: T('Диаметр / сторона'), type: 'number', unit: T('мм'), step: 10, span: 2, visible: (v) => v.shape === 'columns' },
        { key: 'colH', label: T('Высота (глубина)'), type: 'number', unit: T('м'), step: 0.1, span: 2, visible: (v) => v.shape === 'columns' },
        { key: 'colN', label: T('Количество'), type: 'number', unit: T('шт'), step: 1, span: 2, visible: (v) => v.shape === 'columns' },
        { key: 'volume', label: T('Объём бетона'), type: 'number', unit: T('м³'), step: 0.5, visible: (v) => v.shape === 'volume' },
      ],
    },
    {
      title: T('Бетон'),
      fields: [
        {
          key: 'grade', label: T('Марка (класс)'), type: 'select',
          options: CONCRETE_GRADES.map((g) => ({ value: g.grade, label: `${g.grade.replace('M', T('М'))} (${g.cls})` })),
        },
        { key: 'waste', label: T('Запас на потери'), type: 'number', unit: '%', step: 1 },
        { key: 'supply', label: T('Поставка'), type: 'segmented', span: 6, options: opts([['ready', T('Товарный бетон')], ['self', T('Замес на месте')]]) },
        { key: 'mixer', label: T('Объём миксера'), type: 'select', options: opts([[5, '5 м³'], [7, '7 м³'], [9, '9 м³'], [10, '10 м³'], [12, '12 м³']]), visible: (v) => v.supply === 'ready' },
        { key: 'cement', label: T('Цемент'), type: 'select', options: opts([['m500', T('М500 (ЦЕМ I 42,5)')], ['m400', T('М400 (ЦЕМ II 32,5)')]]), visible: (v) => v.supply === 'self' },
        { key: 'bag', label: T('Мешок цемента'), type: 'select', options: opts([[25, '25 кг'], [40, '40 кг'], [50, '50 кг']]), visible: (v) => v.supply === 'self' },
        { key: 'formwork', label: T('Считать опалубку'), type: 'toggle' },
        { key: 'works', label: T('Добавить работы'), type: 'toggle' },
      ],
    },
  ],
  compute: computeConcrete,
  method: [
    T('Лента: V = L × b × h; плита: V = a × b × t; столбы: V = S сечения × h × n.'),
    T('Опалубка: две боковые стороны ленты, торцы плиты, боковая поверхность столбов.'),
    T('Состав замеса — по массовым пропорциям Ц:П:Щ для выбранной марки и цемента при плотности смеси 2400 кг/м³. Насыпная плотность песка 1,6 т/м³, щебня 1,45 т/м³.'),
    T('Запас на потери (растекание, неровность основания) обычно 2–5%.'),
  ],
})
