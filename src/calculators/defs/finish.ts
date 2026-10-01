/** Отделочные калькуляторы: стяжка, сухие смеси, краска, обои, плитка, напольные покрытия. */
import { Brush, Layers, PaintRoller, Grid2x2, Scroll, SquareStack } from 'lucide-react'
import { ceil, floor, pos, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult, type MaterialLine, type RowValues } from '../types'
import { openingsArea, openingsField, withWaste } from '../common'

// ───────────────────────────── Стяжка ─────────────────────────────

export const SCREED_MIXES = {
  cps: { name: 'Пескобетон / ЦПС М300', kgPerMm: 2.0, priceKey: 'mix-cps', work: 'work-screed' },
  selfLevel: { name: 'Наливной пол', kgPerMm: 1.6, priceKey: 'mix-self-leveling', work: 'work-self-leveling' },
  mix: { name: 'Цемент + песок 1:3 (замес)', kgPerMm: 2.0, priceKey: '', work: 'work-screed' },
} as const

export type ScreedValues = {
  area: number
  perimeter: number
  thickness: number
  mix: keyof typeof SCREED_MIXES
  bag: number
  waste: number
  mesh: boolean
  beacons: boolean
  works: boolean
}

export function computeScreed(v: ScreedValues): CalcResult {
  const m = SCREED_MIXES[v.mix] ?? SCREED_MIXES.cps
  const area = pos(v.area)
  const t = pos(v.thickness)
  const kg = withWaste(area * t * m.kgPerMm, v.waste)
  const bag = Math.max(1, pos(v.bag))
  const volume = (area * t) / 1000
  const metrics: CalcResult['metrics'] = [
    { label: 'Объём стяжки', value: volume, unit: 'м³', digits: 3, primary: true },
    { label: 'Сухой смеси', value: kg, unit: 'кг', digits: 0, primary: true },
  ]
  const lines: MaterialLine[] = []
  const warnings: string[] = []
  if (v.mix === 'mix') {
    const cement = kg / 4
    const sand = (kg * 3) / 4
    const bags = ceil(cement / bag)
    metrics.push(
      { label: `Цемент М500, мешков по ${bag} кг`, value: bags, unit: 'шт', digits: 0, primary: true },
      { label: 'Песок', value: sand / 1600, unit: 'м³', digits: 2, hint: `${round(sand / 1000, 2)} т` },
    )
    lines.push(
      { name: `Цемент ПЦ500, мешок ${bag} кг`, unit: 'мешок', qty: bags, kind: 'material', priceKey: 'cement', priceFactor: bag },
      { name: 'Песок строительный', unit: 'м³', qty: round(sand / 1600, 2), kind: 'material', priceKey: 'bulk-sand' },
    )
  } else {
    const bags = ceil(kg / bag)
    metrics.push({ label: `Мешков по ${bag} кг`, value: bags, unit: 'шт', digits: 0, primary: true })
    lines.push({ name: `${m.name}, мешок ${bag} кг`, unit: 'мешок', qty: bags, kind: 'material', priceKey: m.priceKey, priceFactor: bag })
  }
  if (v.mix === 'selfLevel' && t > 50) warnings.push('Наливные полы обычно рассчитаны на слой до 30–50 мм — для большей толщины сделайте стяжку из ЦПС.')
  if (v.mix !== 'selfLevel' && t < 30) warnings.push('Цементно-песчаная стяжка тоньше 30 мм склонна к растрескиванию; при армировании — не менее 40 мм.')
  const tape = pos(v.perimeter) * 1.05
  if (tape > 0) lines.push({ name: 'Демпферная лента', unit: 'м', qty: round(tape, 1), kind: 'material', priceKey: 'damper-tape' })
  if (v.mesh) lines.push({ name: 'Сетка армирующая для стяжки', unit: 'м²', qty: round(area * 1.1, 1), kind: 'material', priceKey: 'screed-mesh' })
  if (v.beacons && v.mix !== 'selfLevel') {
    const n = ceil(area / (1.2 * 3))
    metrics.push({ label: 'Маяков (шаг 1,2 м)', value: n, unit: 'шт', digits: 0 })
    lines.push({ name: 'Маячковый профиль 3 м', unit: 'шт', qty: n, kind: 'material', priceKey: 'beacon' })
  }
  if (v.works) lines.push({ name: v.mix === 'selfLevel' ? 'Устройство наливного пола' : 'Устройство стяжки пола', unit: 'м²', qty: round(area, 2), kind: 'work', priceKey: m.work })
  return { metrics, lines, warnings }
}

export const screed = defineCalculator<ScreedValues>({
  id: 'screed',
  title: 'Стяжка и наливной пол',
  short: 'Сухая смесь или цемент с песком, мешки, маяки, сетка и демпферная лента',
  category: 'finish',
  icon: Layers,
  keywords: ['стяжка', 'пол', 'наливной', 'цпс', 'пескобетон', 'выравнивание', 'маяки', 'демпферная'],
  sectionName: 'Полы',
  defaults: { area: 20, perimeter: 18, thickness: 50, mix: 'cps', bag: 40, waste: 5, mesh: true, beacons: true, works: false },
  groups: [
    {
      fields: [
        { key: 'area', label: 'Площадь пола', type: 'number', unit: 'м²', step: 0.5 },
        { key: 'perimeter', label: 'Периметр помещения', type: 'number', unit: 'м', step: 0.5 },
        { key: 'thickness', label: 'Средняя толщина', type: 'number', unit: 'мм', step: 5 },
        { key: 'mix', label: 'Смесь', type: 'select', options: Object.entries(SCREED_MIXES).map(([k, m]) => ({ value: k, label: m.name })) },
        { key: 'bag', label: 'Мешок', type: 'select', options: opts([[20, '20 кг'], [25, '25 кг'], [40, '40 кг'], [50, '50 кг']]) },
        { key: 'waste', label: 'Запас', type: 'number', unit: '%', step: 1 },
        { key: 'mesh', label: 'Армирующая сетка', type: 'toggle' },
        { key: 'beacons', label: 'Маяки', type: 'toggle' },
        { key: 'works', label: 'Добавить работы', type: 'toggle' },
      ],
    },
  ],
  compute: computeScreed,
  method: [
    'Расход сухой смеси = площадь × толщина (мм) × расход на 1 мм: ЦПС ≈ 2,0 кг/м², наливной пол ≈ 1,6 кг/м².',
    'Замес 1:3 — по массе: ¼ цемента и ¾ песка (насыпная плотность песка 1,6 т/м³).',
    'Маяки ставят с шагом ~1,2 м; демпферная лента — по периметру +5%.',
  ],
})

// ───────────────────── Штукатурка, шпаклёвка ─────────────────────

export const DRY_MIXES = {
  plasterGypsum: { name: 'Штукатурка гипсовая', kgPerMm: 0.9, priceKey: 'mix-plaster-gypsum', work: 'work-plaster', beacons: true },
  plasterCement: { name: 'Штукатурка цементная', kgPerMm: 1.6, priceKey: 'mix-plaster-cement', work: 'work-plaster', beacons: true },
  puttyStart: { name: 'Шпаклёвка стартовая', kgPerMm: 1.0, priceKey: 'mix-putty-start', work: 'work-putty', beacons: false },
  puttyFinish: { name: 'Шпаклёвка финишная', kgPerMm: 1.1, priceKey: 'mix-putty-finish', work: 'work-putty', beacons: false },
} as const

export type DryMixValues = {
  mix: keyof typeof DRY_MIXES
  area: number
  thickness: number
  consumption: number
  bag: number
  waste: number
  primer: boolean
  beacons: boolean
  works: boolean
}

export function computeDryMix(v: DryMixValues): CalcResult {
  const m = DRY_MIXES[v.mix] ?? DRY_MIXES.plasterGypsum
  const area = pos(v.area)
  const perMm = pos(v.consumption) || m.kgPerMm
  const kg = withWaste(area * pos(v.thickness) * perMm, v.waste)
  const bag = Math.max(1, pos(v.bag))
  const bags = ceil(kg / bag)
  const lines: MaterialLine[] = [
    { name: `${m.name}, мешок ${bag} кг`, unit: 'мешок', qty: bags, kind: 'material', priceKey: m.priceKey, priceFactor: bag },
  ]
  const metrics: CalcResult['metrics'] = [
    { label: 'Смеси', value: kg, unit: 'кг', digits: 0, primary: true },
    { label: `Мешков по ${bag} кг`, value: bags, unit: 'шт', digits: 0, primary: true },
    { label: 'Расход на 1 м²', value: perMm * pos(v.thickness), unit: 'кг', digits: 2 },
  ]
  if (v.primer) {
    const l = area * 0.15 * 1.1
    metrics.push({ label: 'Грунтовка', value: l, unit: 'л', digits: 1, hint: `${ceil(l / 10)} кан. по 10 л` })
    lines.push({ name: 'Грунтовка глубокого проникновения, канистра 10 л', unit: 'шт', qty: ceil(l / 10), kind: 'material', priceKey: 'primer', priceFactor: 10 })
  }
  if (v.beacons && m.beacons) {
    const n = ceil(area / (1.5 * 3))
    metrics.push({ label: 'Маяков (шаг 1,5 м)', value: n, unit: 'шт', digits: 0 })
    lines.push({ name: 'Маячковый профиль 3 м', unit: 'шт', qty: n, kind: 'material', priceKey: 'beacon' })
  }
  if (v.works) lines.push({ name: m.work === 'work-plaster' ? 'Штукатурка стен по маякам' : 'Шпаклёвка стен', unit: 'м²', qty: round(area, 2), kind: 'work', priceKey: m.work })
  return { metrics, lines }
}

export const drymix = defineCalculator<DryMixValues>({
  id: 'drymix',
  title: 'Штукатурка и шпаклёвка',
  short: 'Расход гипсовой и цементной штукатурки, шпаклёвки, грунтовки и маяков',
  category: 'finish',
  icon: Brush,
  keywords: ['штукатурка', 'шпаклёвка', 'шпатлевка', 'ротбанд', 'выравнивание стен', 'грунтовка', 'маяки', 'смесь'],
  sectionName: 'Отделка стен',
  defaults: { mix: 'plasterGypsum', area: 50, thickness: 15, consumption: 0, bag: 30, waste: 5, primer: true, beacons: true, works: false },
  groups: [
    {
      fields: [
        { key: 'mix', label: 'Материал', type: 'select', options: Object.entries(DRY_MIXES).map(([k, m]) => ({ value: k, label: `${m.name} (~${m.kgPerMm} кг/м²·мм)` })) },
        { key: 'area', label: 'Площадь', type: 'number', unit: 'м²', step: 1 },
        { key: 'thickness', label: 'Средняя толщина слоя', type: 'number', unit: 'мм', step: 1 },
        { key: 'consumption', label: 'Свой расход на 1 мм', type: 'number', unit: 'кг/м²', step: 0.1, hint: '0 — типичный расход; точное значение указано на мешке' },
        { key: 'bag', label: 'Мешок', type: 'select', options: opts([[5, '5 кг'], [20, '20 кг'], [25, '25 кг'], [30, '30 кг']]) },
        { key: 'waste', label: 'Запас', type: 'number', unit: '%', step: 1 },
        { key: 'primer', label: 'Грунтовка', type: 'toggle' },
        { key: 'beacons', label: 'Маяки', type: 'toggle', visible: (v) => (DRY_MIXES[v.mix] ?? DRY_MIXES.plasterGypsum).beacons },
        { key: 'works', label: 'Добавить работы', type: 'toggle' },
      ],
    },
  ],
  compute: computeDryMix,
  method: [
    'Расход = площадь × толщина × расход на 1 мм. Типичные значения: гипсовая штукатурка 0,9; цементная 1,6; шпаклёвка 1,0–1,1 кг/м² на мм.',
    'Толщина штукатурки = средняя глубина перепадов стены + 5 мм над маяком.',
    'Грунтовка ~0,15 л/м² за один слой.',
  ],
})

// ───────────────────────────── Краска ─────────────────────────────

export type PaintValues = {
  area: number
  layers: number
  coverage: number
  can: number
  waste: number
  primer: boolean
  works: boolean
}

export function computePaint(v: PaintValues): CalcResult {
  const area = pos(v.area)
  const layers = Math.max(1, Math.round(pos(v.layers)))
  const liters = withWaste((area * layers) / Math.max(0.1, pos(v.coverage)), v.waste)
  const can = Math.max(0.1, pos(v.can))
  const cans = ceil(liters / can)
  const lines: MaterialLine[] = [
    { name: `Краска интерьерная, ведро ${String(can).replace('.', ',')} л`, unit: 'шт', qty: cans, kind: 'material', priceKey: 'paint-interior', priceFactor: can },
  ]
  const metrics: CalcResult['metrics'] = [
    { label: 'Краски', value: liters, unit: 'л', digits: 1, primary: true },
    { label: `Ёмкостей по ${can} л`, value: cans, unit: 'шт', digits: 0, primary: true },
    { label: 'Остаток', value: cans * can - liters, unit: 'л', digits: 1 },
  ]
  if (v.primer) {
    const l = area * 0.12 * 1.1
    metrics.push({ label: 'Грунтовки', value: l, unit: 'л', digits: 1 })
    lines.push({ name: 'Грунтовка, канистра 10 л', unit: 'шт', qty: ceil(l / 10), kind: 'material', priceKey: 'primer', priceFactor: 10 })
  }
  if (v.works) lines.push({ name: `Окраска в ${layers} слоя`, unit: 'м²', qty: round(area, 2), kind: 'work', priceKey: 'work-paint' })
  return { metrics, lines }
}

export const paint = defineCalculator<PaintValues>({
  id: 'paint',
  title: 'Краска',
  short: 'Литры и банки краски по площади, числу слоёв и укрывистости, грунтовка',
  category: 'finish',
  icon: PaintRoller,
  keywords: ['краска', 'покраска', 'окраска', 'эмаль', 'литры', 'банки', 'грунтовка', 'стены', 'потолок'],
  sectionName: 'Окраска',
  defaults: { area: 60, layers: 2, coverage: 9, can: 9, waste: 10, primer: true, works: false },
  groups: [
    {
      fields: [
        { key: 'area', label: 'Площадь окраски', type: 'number', unit: 'м²', step: 1 },
        { key: 'layers', label: 'Слоёв', type: 'segmented', options: opts([[1, '1'], [2, '2'], [3, '3']]) },
        { key: 'coverage', label: 'Укрывистость', type: 'number', unit: 'м²/л', step: 0.5, hint: 'На банке: «расход 1 л на 8–10 м²»' },
        { key: 'can', label: 'Ёмкость', type: 'select', options: opts([[0.9, '0,9 л'], [2.5, '2,5 л'], [4.5, '4,5 л'], [9, '9 л'], [10, '10 л'], [14, '14 л']]) },
        { key: 'waste', label: 'Запас', type: 'number', unit: '%', step: 1 },
        { key: 'primer', label: 'Грунтовка', type: 'toggle' },
        { key: 'works', label: 'Добавить работы', type: 'toggle' },
      ],
    },
  ],
  compute: computePaint,
  method: ['Литры = площадь × слои / укрывистость × (1 + запас). Запас 10–15% покрывает впитывание и потери на валике.'],
})

// ───────────────────────────── Обои ─────────────────────────────

export type WallpaperValues = {
  perimeter: number
  height: number
  openings: RowValues[]
  rollWidth: number
  rollLength: number
  rapport: number
  allowance: number
  gluePerPack: number
  works: boolean
}

export function computeWallpaper(v: WallpaperValues): CalcResult {
  const H = pos(v.height)
  const w = Math.max(0.1, pos(v.rollWidth))
  const R = pos(v.rapport) / 100
  let strip = H + pos(v.allowance) / 100
  if (R > 0) strip = ceil(strip / R) * R
  const perRoll = strip > 0 ? floor(pos(v.rollLength) / strip) : 0
  // Openings remove strips proportionally to the share of wall height they occupy.
  const openEquivalent = H > 0 ? (v.openings ?? []).reduce((s, r) => s + pos(r.w) * pos(r.n) * Math.min(1, pos(r.h) / H), 0) : 0
  const strips = ceil(Math.max(0, pos(v.perimeter) - openEquivalent) / w)
  const rolls = perRoll > 0 ? ceil(strips / perRoll) : 0
  const area = Math.max(0, pos(v.perimeter) * H - openingsArea(v.openings))
  const glue = ceil(area / Math.max(1, pos(v.gluePerPack)))
  const warnings = perRoll === 0 ? ['Длина полосы больше длины рулона — уточните размеры.'] : []
  const lines: MaterialLine[] = [
    { name: `Обои ${String(w).replace('.', ',')}×${String(pos(v.rollLength)).replace('.', ',')} м`, unit: 'рулон', qty: rolls, kind: 'material', priceKey: 'wallpaper-roll' },
    { name: 'Клей обойный', unit: 'упак', qty: glue, kind: 'material', priceKey: 'wallpaper-glue' },
  ]
  if (v.works) lines.push({ name: 'Поклейка обоев', unit: 'м²', qty: round(area, 2), kind: 'work', priceKey: 'work-wallpaper' })
  return {
    metrics: [
      { label: 'Рулонов', value: rolls, unit: 'шт', digits: 0, primary: true },
      { label: 'Полос', value: strips, unit: 'шт', digits: 0, primary: true },
      { label: 'Полос из рулона', value: perRoll, unit: 'шт', digits: 0, primary: true },
      { label: 'Длина полосы с подгонкой', value: strip, unit: 'м', digits: 2 },
      { label: 'Площадь оклейки', value: area, unit: 'м²', digits: 1 },
      { label: 'Пачек клея', value: glue, unit: 'шт', digits: 0 },
    ],
    lines,
    warnings,
  }
}

export const wallpaper = defineCalculator<WallpaperValues>({
  id: 'wallpaper',
  title: 'Обои',
  short: 'Рулоны с учётом раппорта, проёмов и подрезки, клей',
  category: 'finish',
  icon: Scroll,
  keywords: ['обои', 'рулоны', 'раппорт', 'поклейка', 'клей', 'флизелин', 'винил'],
  sectionName: 'Отделка стен',
  defaults: {
    perimeter: 16, height: 2.7, openings: [{ w: 1.4, h: 1.5, n: 1 }, { w: 0.9, h: 2.1, n: 1 }],
    rollWidth: 1.06, rollLength: 10.05, rapport: 0, allowance: 10, gluePerPack: 25, works: false,
  },
  groups: [
    {
      title: 'Помещение',
      fields: [
        { key: 'perimeter', label: 'Периметр стен', type: 'number', unit: 'м', step: 0.1 },
        { key: 'height', label: 'Высота оклейки', type: 'number', unit: 'м', step: 0.05 },
        openingsField<WallpaperValues>('openings'),
      ],
    },
    {
      title: 'Обои',
      fields: [
        { key: 'rollWidth', label: 'Ширина рулона', type: 'select', options: opts([[0.53, '0,53 м'], [0.7, '0,70 м'], [1.06, '1,06 м'], [1.4, '1,40 м']]) },
        { key: 'rollLength', label: 'Длина рулона', type: 'number', unit: 'м', step: 0.05 },
        { key: 'rapport', label: 'Раппорт', type: 'number', unit: 'см', step: 1, hint: '0 — без подгонки рисунка' },
        { key: 'allowance', label: 'Припуск на подрезку', type: 'number', unit: 'см', step: 1 },
        { key: 'gluePerPack', label: 'Пачка клея на', type: 'number', unit: 'м²', step: 5 },
        { key: 'works', label: 'Добавить работы', type: 'toggle' },
      ],
    },
  ],
  compute: computeWallpaper,
  method: [
    'Длина полосы = высота + припуск, округлённая вверх до кратного раппорта.',
    'Полос из рулона = ⌊длина рулона / длина полосы⌋; полос на комнату = ⌈(периметр − ширина проёмов × доля их высоты) / ширина рулона⌉.',
  ],
})

// ───────────────────────────── Плитка ─────────────────────────────

const TROWEL: Record<string, number> = { '4': 1.8, '6': 2.6, '8': 3.4, '10': 4.2, '12': 5.1 }
export const TILE_LAYOUTS = {
  straight: { name: 'Прямая', waste: 7 },
  offset: { name: 'Со смещением', waste: 10 },
  diagonal: { name: 'Диагональная', waste: 15 },
  herringbone: { name: 'Ёлочка', waste: 15 },
} as const

export type TileValues = {
  area: number
  tileL: number
  tileW: number
  joint: number
  tileT: number
  layout: keyof typeof TILE_LAYOUTS
  perBox: number
  trowel: string
  glueBag: number
  works: boolean
}

/** Grout consumption, kg/m²: (A + B) / (A·B) × joint width × depth × 1.6 (dimensions in mm). */
export function groutKgPerM2(a: number, b: number, joint: number, depth: number): number {
  if (a <= 0 || b <= 0) return 0
  return ((a + b) / (a * b)) * joint * depth * 1.6
}

export function computeTile(v: TileValues): CalcResult {
  const area = pos(v.area)
  const lay = TILE_LAYOUTS[v.layout] ?? TILE_LAYOUTS.straight
  const a = pos(v.tileL), b = pos(v.tileW), j = pos(v.joint)
  const tileArea = (a * b) / 1e6
  const cellArea = ((a + j) * (b + j)) / 1e6
  const pieces = cellArea > 0 ? ceil((area / cellArea) * (1 + lay.waste / 100)) : 0
  const perBox = Math.max(1, Math.round(pos(v.perBox)))
  const boxes = ceil(pieces / perBox)
  const buyArea = boxes * perBox * tileArea
  const glueKg = area * (TROWEL[v.trowel] ?? 3.4) * 1.05
  const glueBag = Math.max(1, pos(v.glueBag))
  const groutKg = groutKgPerM2(a, b, j, pos(v.tileT)) * area * 1.1
  const lines: MaterialLine[] = [
    { name: `Плитка ${a}×${b} мм (${boxes} кор. по ${perBox} шт)`, unit: 'м²', qty: round(buyArea, 2), kind: 'material', priceKey: 'tile' },
    { name: `Плиточный клей, мешок ${glueBag} кг`, unit: 'мешок', qty: ceil(glueKg / glueBag), kind: 'material', priceKey: 'mix-tile-glue', priceFactor: glueBag },
    { name: 'Затирка для швов, упаковка 2 кг', unit: 'упак', qty: ceil(groutKg / 2), kind: 'material', priceKey: 'mix-grout', priceFactor: 2 },
  ]
  if (v.works) lines.push({ name: 'Укладка плитки', unit: 'м²', qty: round(area, 2), kind: 'work', priceKey: 'work-tile' })
  return {
    metrics: [
      { label: 'Плиток с запасом', value: pieces, unit: 'шт', digits: 0, primary: true },
      { label: 'Коробок', value: boxes, unit: 'шт', digits: 0, primary: true },
      { label: 'Площадь к закупке', value: buyArea, unit: 'м²', digits: 2, primary: true },
      { label: 'Клей', value: glueKg, unit: 'кг', digits: 0, hint: `${ceil(glueKg / glueBag)} меш. по ${glueBag} кг` },
      { label: 'Затирка', value: groutKg, unit: 'кг', digits: 1 },
      { label: `Запас на подрезку (${lay.name.toLowerCase()})`, value: lay.waste, unit: '%', digits: 0 },
    ],
    lines,
  }
}

export const tile = defineCalculator<TileValues>({
  id: 'tile',
  title: 'Плитка',
  short: 'Плитка и коробки с учётом раскладки, плиточный клей и затирка',
  category: 'finish',
  icon: Grid2x2,
  keywords: ['плитка', 'кафель', 'керамогранит', 'укладка', 'затирка', 'клей', 'фуга', 'раскладка', 'ванная'],
  sectionName: 'Плиточные работы',
  defaults: { area: 12, tileL: 600, tileW: 300, joint: 2, tileT: 9, layout: 'straight', perBox: 8, trowel: '8', glueBag: 25, works: false },
  groups: [
    {
      fields: [
        { key: 'area', label: 'Площадь облицовки', type: 'number', unit: 'м²', step: 0.5 },
        { key: 'layout', label: 'Раскладка', type: 'select', options: Object.entries(TILE_LAYOUTS).map(([k, l]) => ({ value: k, label: `${l.name} (+${l.waste}%)` })) },
        { key: 'tileL', label: 'Длина плитки', type: 'number', unit: 'мм', step: 10, span: 2 },
        { key: 'tileW', label: 'Ширина плитки', type: 'number', unit: 'мм', step: 10, span: 2 },
        { key: 'tileT', label: 'Толщина плитки', type: 'number', unit: 'мм', step: 1, span: 2 },
        { key: 'joint', label: 'Ширина шва', type: 'number', unit: 'мм', step: 0.5 },
        { key: 'perBox', label: 'Плиток в коробке', type: 'number', unit: 'шт', step: 1 },
        { key: 'trowel', label: 'Зуб шпателя', type: 'select', options: Object.entries(TROWEL).map(([k, kg]) => ({ value: k, label: `${k} мм (~${String(kg).replace('.', ',')} кг/м²)` })) },
        { key: 'glueBag', label: 'Мешок клея', type: 'select', options: opts([[5, '5 кг'], [25, '25 кг']]) },
        { key: 'works', label: 'Добавить работы', type: 'toggle' },
      ],
    },
  ],
  compute: computeTile,
  method: [
    'Плиток = площадь / ((A + шов) × (B + шов)) × (1 + запас на раскладку).',
    'Затирка, кг/м² = (A + B) / (A × B) × ширина шва × глубина шва × 1,6.',
    'Расход клея зависит от зуба шпателя; крупноформатной плитке нужен зуб 10–12 мм и двойное нанесение.',
  ],
})

// ───────────────────────── Напольные покрытия ─────────────────────────

export type FlooringValues = {
  type: 'laminate' | 'parquet' | 'linoleum'
  roomL: number
  roomW: number
  doors: number
  doorWidth: number
  layout: 'straight' | 'diagonal'
  packArea: number
  rollWidth: number
  underlayRoll: number
  plinthLength: number
  works: boolean
}

export function computeFlooring(v: FlooringValues): CalcResult {
  const L = pos(v.roomL), W = pos(v.roomW)
  const area = L * W
  const doors = Math.round(pos(v.doors))
  const plinthM = Math.max(0, 2 * (L + W) - doors * pos(v.doorWidth))
  const plinthLen = Math.max(0.5, pos(v.plinthLength))
  const plinths = ceil((plinthM * 1.05) / plinthLen)
  const plinthParts = 4 + doors * 2 + Math.max(0, plinths - 4)
  const lines: MaterialLine[] = []
  const metrics: CalcResult['metrics'] = [{ label: 'Площадь пола', value: area, unit: 'м²', digits: 2 }]
  const warnings: string[] = []

  if (v.type === 'linoleum') {
    const rw = Math.max(0.5, pos(v.rollWidth))
    // Try both orientations; strips cut with 10 cm allowance.
    const variant = (span: number, run: number) => ceil(span / rw) * (run + 0.1)
    const alongL = variant(W, L), alongW = variant(L, W)
    const runM = Math.min(alongL, alongW)
    const buy = runM * rw
    metrics.unshift(
      { label: 'Линолеум к закупке', value: buy, unit: 'м²', digits: 2, primary: true },
      { label: `Погонных метров рулона ${rw} м`, value: runM, unit: 'м', digits: 2, primary: true },
      { label: 'Отход', value: buy - area, unit: 'м²', digits: 2 },
    )
    if (Math.min(L, W) > rw) warnings.push('Комната шире рулона — будет шов. Подберите более широкий рулон, если он есть.')
    lines.push({ name: `Линолеум, рулон ${rw} м`, unit: 'м²', qty: round(buy, 2), kind: 'material', priceKey: 'linoleum' })
    if (v.works) lines.push({ name: 'Настил линолеума', unit: 'м²', qty: round(area, 2), kind: 'work', priceKey: 'work-linoleum' })
  } else {
    const waste = v.layout === 'diagonal' ? 15 : 7
    const pack = Math.max(0.1, pos(v.packArea))
    const packs = ceil((area * (1 + waste / 100)) / pack)
    const underlay = ceil((area * 1.05) / Math.max(1, pos(v.underlayRoll)))
    metrics.unshift(
      { label: 'Упаковок', value: packs, unit: 'шт', digits: 0, primary: true },
      { label: 'Покрытие к закупке', value: packs * pack, unit: 'м²', digits: 2, primary: true },
      { label: 'Рулонов подложки', value: underlay, unit: 'шт', digits: 0, primary: true },
      { label: 'Запас на подрезку', value: waste, unit: '%', digits: 0 },
    )
    const isLam = v.type === 'laminate'
    lines.push(
      { name: `${isLam ? 'Ламинат' : 'Паркетная доска'} (${packs} уп. по ${pack} м²)`, unit: 'м²', qty: round(packs * pack, 3), kind: 'material', priceKey: isLam ? 'laminate' : 'parquet-board' },
      { name: `Подложка (рулон ${pos(v.underlayRoll)} м²)`, unit: 'м²', qty: underlay * pos(v.underlayRoll), kind: 'material', priceKey: 'underlay' },
    )
    if (v.works) lines.push({ name: 'Укладка покрытия с подложкой', unit: 'м²', qty: round(area, 2), kind: 'work', priceKey: 'work-laminate' })
  }
  metrics.push(
    { label: 'Длина плинтуса', value: plinthM, unit: 'м', digits: 2 },
    { label: `Планок плинтуса по ${plinthLen} м`, value: plinths, unit: 'шт', digits: 0 },
    { label: 'Углы, заглушки, соединители', value: plinthParts, unit: 'шт', digits: 0 },
  )
  lines.push(
    { name: `Плинтус напольный ${plinthLen} м`, unit: 'шт', qty: plinths, kind: 'material', priceKey: 'plinth', priceFactor: plinthLen / 2.5 },
    { name: 'Фурнитура плинтуса', unit: 'шт', qty: plinthParts, kind: 'material', priceKey: 'plinth-part' },
  )
  if (v.works) lines.push({ name: 'Монтаж плинтуса', unit: 'м', qty: round(plinthM, 1), kind: 'work', priceKey: 'work-plinth' })
  return { metrics, lines, warnings }
}

export const flooring = defineCalculator<FlooringValues>({
  id: 'flooring',
  title: 'Ламинат, паркет, линолеум',
  short: 'Упаковки покрытия, подложка, раскрой линолеума и плинтус с фурнитурой',
  category: 'finish',
  icon: SquareStack,
  keywords: ['ламинат', 'паркет', 'линолеум', 'пол', 'подложка', 'плинтус', 'упаковки', 'напольное'],
  sectionName: 'Полы',
  defaults: {
    type: 'laminate', roomL: 5, roomW: 4, doors: 1, doorWidth: 0.9, layout: 'straight', packArea: 2.131,
    rollWidth: 4, underlayRoll: 10, plinthLength: 2.5, works: false,
  },
  groups: [
    {
      fields: [
        { key: 'type', label: 'Покрытие', type: 'segmented', span: 6, options: opts([['laminate', 'Ламинат'], ['parquet', 'Паркетная доска'], ['linoleum', 'Линолеум']]) },
        { key: 'roomL', label: 'Длина комнаты', type: 'number', unit: 'м', step: 0.1, span: 2 },
        { key: 'roomW', label: 'Ширина комнаты', type: 'number', unit: 'м', step: 0.1, span: 2 },
        { key: 'doors', label: 'Дверных проёмов', type: 'number', unit: 'шт', step: 1, span: 2 },
        { key: 'layout', label: 'Укладка', type: 'segmented', options: opts([['straight', 'Прямая (+7%)'], ['diagonal', 'Диагональ (+15%)']]), visible: (v) => v.type !== 'linoleum' },
        { key: 'packArea', label: 'Площадь в упаковке', type: 'number', unit: 'м²', step: 0.001, visible: (v) => v.type !== 'linoleum' },
        { key: 'underlayRoll', label: 'Подложка в рулоне', type: 'number', unit: 'м²', step: 1, visible: (v) => v.type !== 'linoleum' },
        { key: 'rollWidth', label: 'Ширина рулона', type: 'select', options: opts([[1.5, '1,5 м'], [2, '2 м'], [2.5, '2,5 м'], [3, '3 м'], [3.5, '3,5 м'], [4, '4 м'], [5, '5 м']]), visible: (v) => v.type === 'linoleum' },
        { key: 'doorWidth', label: 'Ширина двери', type: 'number', unit: 'м', step: 0.05 },
        { key: 'plinthLength', label: 'Длина планки плинтуса', type: 'select', options: opts([[2, '2 м'], [2.2, '2,2 м'], [2.4, '2,4 м'], [2.5, '2,5 м']]) },
        { key: 'works', label: 'Добавить работы', type: 'toggle' },
      ],
    },
  ],
  compute: computeFlooring,
  method: [
    'Ламинат: упаковок = площадь × (1 + запас) / площадь упаковки; запас 5–7% при прямой укладке, 12–15% по диагонали.',
    'Линолеум: проверяются обе ориентации рулона, полосы режутся с припуском 10 см; выбирается вариант с меньшим отходом.',
    'Плинтус: периметр минус двери, +5% на подрезку; фурнитура — 4 внутренних угла, по 2 заглушки на дверь и соединители.',
  ],
})
