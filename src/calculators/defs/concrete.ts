import { Cuboid } from 'lucide-react'
import { ceil, pos, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult, type MaterialLine } from '../types'
import { withWaste } from '../common'

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
  const gradeLabel = `${v.grade.replace('M', 'М')} (${mix.cls})`
  const metrics: CalcResult['metrics'] = [
    { label: 'Объём бетона с запасом', value: volume, unit: 'м³', digits: 2, primary: true },
    { label: 'Объём конструкции', value: geo.volume, unit: 'м³', digits: 3 },
    { label: 'Масса бетона', value: (volume * CONCRETE_DENSITY) / 1000, unit: 'т', digits: 2, primary: true },
  ]
  const lines: MaterialLine[] = []
  const warnings: string[] = []

  if (v.supply === 'ready') {
    const trips = ceil(volume / Math.max(1, pos(v.mixer)))
    metrics.push({ label: `Рейсов миксера по ${pos(v.mixer)} м³`, value: trips, unit: 'рейс', digits: 0, primary: true })
    lines.push({ name: `Бетон товарный ${gradeLabel}`, unit: 'м³', qty: round(volume, 2), kind: 'material', priceKey: `concrete-${v.grade}` })
    lines.push({ name: 'Доставка бетона миксером', unit: 'рейс', qty: trips, kind: 'transport', priceKey: 'mixer-trip' })
  } else {
    const bag = Math.max(1, pos(v.bag))
    const cementKg = mix.cementKg * volume
    const bags = ceil(cementKg / bag)
    const sandM3 = (mix.sandKg * volume) / SAND_DENSITY
    const gravelM3 = (mix.gravelKg * volume) / GRAVEL_DENSITY
    metrics.push(
      { label: `Цемент ${v.cement === 'm500' ? 'М500' : 'М400'}`, value: cementKg, unit: 'кг', digits: 0, primary: true },
      { label: `Мешков по ${bag} кг`, value: bags, unit: 'шт', digits: 0, primary: true },
      { label: 'Песок', value: sandM3, unit: 'м³', digits: 2, hint: `${round((mix.sandKg * volume) / 1000, 2)} т` },
      { label: 'Щебень', value: gravelM3, unit: 'м³', digits: 2, hint: `${round((mix.gravelKg * volume) / 1000, 2)} т` },
      { label: 'Вода', value: mix.waterL * volume, unit: 'л', digits: 0 },
      { label: 'Цемента на 1 м³', value: mix.cementKg, unit: 'кг', digits: 0 },
    )
    lines.push(
      { name: `Цемент ${v.cement === 'm500' ? 'ПЦ500' : 'ПЦ400'}, мешок ${bag} кг`, unit: 'мешок', qty: bags, kind: 'material', priceKey: 'cement', priceFactor: bag },
      { name: 'Песок строительный', unit: 'м³', qty: round(sandM3, 2), kind: 'material', priceKey: 'bulk-sand' },
      { name: 'Щебень гранитный 5–20', unit: 'м³', qty: round(gravelM3, 2), kind: 'material', priceKey: 'bulk-gravel-granite' },
    )
    if (volume > 3) warnings.push('Для объёма больше 3 м³ обычно выгоднее заказать товарный бетон: замес вручную не даёт монолитной заливки.')
  }

  if (v.formwork && geo.formwork > 0) {
    metrics.push({ label: 'Площадь опалубки', value: geo.formwork, unit: 'м²', digits: 1 })
    lines.push({ name: 'Щиты / доска для опалубки', unit: 'м²', qty: round(geo.formwork, 1), kind: 'material', priceKey: 'formwork-board' })
  }
  if (v.works) {
    lines.push({ name: 'Бетонирование конструкций', unit: 'м³', qty: round(geo.volume, 2), kind: 'work', priceKey: 'work-concrete' })
    if (v.formwork && geo.formwork > 0)
      lines.push({ name: 'Устройство и разборка опалубки', unit: 'м²', qty: round(geo.formwork, 1), kind: 'work', priceKey: 'work-formwork' })
  }
  if (geo.volume === 0) warnings.push('Задайте размеры конструкции.')
  return { metrics, lines, warnings }
}

export const concrete = defineCalculator<ConcreteValues>({
  id: 'concrete',
  title: 'Бетон и фундамент',
  short: 'Объём бетона для плиты, ленты и столбов, состав замеса, миксеры, опалубка',
  category: 'foundation',
  icon: Cuboid,
  keywords: ['бетон', 'фундамент', 'плита', 'лента', 'ленточный', 'столбы', 'сваи', 'цемент', 'щебень', 'песок', 'миксер', 'опалубка', 'кубы'],
  sectionName: 'Фундамент',
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
      title: 'Конструкция',
      fields: [
        {
          key: 'shape', label: 'Тип', type: 'segmented', span: 6,
          options: opts([['strip', 'Лента'], ['slab', 'Плита'], ['columns', 'Столбы'], ['volume', 'Объём']]),
        },
        { key: 'stripL', label: 'Общая длина ленты', hint: 'Периметр + внутренние стены', type: 'number', unit: 'м', step: 0.5, span: 2, visible: (v) => v.shape === 'strip' },
        { key: 'stripW', label: 'Ширина ленты', type: 'number', unit: 'м', step: 0.05, span: 2, visible: (v) => v.shape === 'strip' },
        { key: 'stripH', label: 'Высота ленты', type: 'number', unit: 'м', step: 0.05, span: 2, visible: (v) => v.shape === 'strip' },
        { key: 'slabL', label: 'Длина', type: 'number', unit: 'м', step: 0.1, span: 2, visible: (v) => v.shape === 'slab' },
        { key: 'slabW', label: 'Ширина', type: 'number', unit: 'м', step: 0.1, span: 2, visible: (v) => v.shape === 'slab' },
        { key: 'slabT', label: 'Толщина', type: 'number', unit: 'мм', step: 10, span: 2, visible: (v) => v.shape === 'slab' },
        { key: 'colType', label: 'Сечение', type: 'segmented', options: opts([['round', 'Круглое'], ['square', 'Квадратное']]), span: 6, visible: (v) => v.shape === 'columns' },
        { key: 'colD', label: 'Диаметр / сторона', type: 'number', unit: 'мм', step: 10, span: 2, visible: (v) => v.shape === 'columns' },
        { key: 'colH', label: 'Высота (глубина)', type: 'number', unit: 'м', step: 0.1, span: 2, visible: (v) => v.shape === 'columns' },
        { key: 'colN', label: 'Количество', type: 'number', unit: 'шт', step: 1, span: 2, visible: (v) => v.shape === 'columns' },
        { key: 'volume', label: 'Объём бетона', type: 'number', unit: 'м³', step: 0.5, visible: (v) => v.shape === 'volume' },
      ],
    },
    {
      title: 'Бетон',
      fields: [
        {
          key: 'grade', label: 'Марка (класс)', type: 'select',
          options: CONCRETE_GRADES.map((g) => ({ value: g.grade, label: `${g.grade.replace('M', 'М')} (${g.cls})` })),
        },
        { key: 'waste', label: 'Запас на потери', type: 'number', unit: '%', step: 1 },
        { key: 'supply', label: 'Поставка', type: 'segmented', span: 6, options: opts([['ready', 'Товарный бетон'], ['self', 'Замес на месте']]) },
        { key: 'mixer', label: 'Объём миксера', type: 'select', options: opts([[5, '5 м³'], [7, '7 м³'], [9, '9 м³'], [10, '10 м³'], [12, '12 м³']]), visible: (v) => v.supply === 'ready' },
        { key: 'cement', label: 'Цемент', type: 'select', options: opts([['m500', 'М500 (ЦЕМ I 42,5)'], ['m400', 'М400 (ЦЕМ II 32,5)']]), visible: (v) => v.supply === 'self' },
        { key: 'bag', label: 'Мешок цемента', type: 'select', options: opts([[25, '25 кг'], [40, '40 кг'], [50, '50 кг']]), visible: (v) => v.supply === 'self' },
        { key: 'formwork', label: 'Считать опалубку', type: 'toggle' },
        { key: 'works', label: 'Добавить работы', type: 'toggle' },
      ],
    },
  ],
  compute: computeConcrete,
  method: [
    'Лента: V = L × b × h; плита: V = a × b × t; столбы: V = S сечения × h × n.',
    'Опалубка: две боковые стороны ленты, торцы плиты, боковая поверхность столбов.',
    'Состав замеса — по массовым пропорциям Ц:П:Щ для выбранной марки и цемента при плотности смеси 2400 кг/м³. Насыпная плотность песка 1,6 т/м³, щебня 1,45 т/м³.',
    'Запас на потери (растекание, неровность основания) обычно 2–5%.',
  ],
})
