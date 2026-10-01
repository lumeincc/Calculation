/** Пиломатериалы, утеплитель, лестница. */
import { Footprints, Thermometer, TreePine } from 'lucide-react'
import { ceil, pos, rad2deg, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult, type MaterialLine } from '../types'

// ───────────────────────────── Пиломатериалы ─────────────────────────────

export const WOOD_SPECIES = {
  pine: { name: 'Сосна', density: 520 },
  spruce: { name: 'Ель', density: 450 },
  larch: { name: 'Лиственница', density: 660 },
  birch: { name: 'Берёза', density: 650 },
  oak: { name: 'Дуб', density: 700 },
  aspen: { name: 'Осина', density: 490 },
  cedar: { name: 'Кедр', density: 440 },
} as const

const MOISTURE: Record<string, number> = { dry: 1, transport: 1.1, natural: 1.55 }

export type LumberValues = {
  t: number
  w: number
  length: number
  mode: 'pieces' | 'volume'
  pieces: number
  volume: number
  species: keyof typeof WOOD_SPECIES
  moisture: string
  dried: boolean
}

export function computeLumber(v: LumberValues): CalcResult {
  const piece = (pos(v.t) / 1000) * (pos(v.w) / 1000) * pos(v.length)
  const perM3 = piece > 0 ? 1 / piece : 0
  const pieces = v.mode === 'pieces' ? Math.round(pos(v.pieces)) : piece > 0 ? ceil(pos(v.volume) / piece) : 0
  const volume = pieces * piece
  const sp = WOOD_SPECIES[v.species] ?? WOOD_SPECIES.pine
  const kg = volume * sp.density * (MOISTURE[v.moisture] ?? 1)
  const name = `${pos(v.t) >= 100 && pos(v.w) >= 100 ? 'Брус' : 'Доска'} ${pos(v.t)}×${pos(v.w)}×${String(pos(v.length)).replace('.', ',')} м, ${sp.name.toLowerCase()} (${pieces} шт)`
  return {
    metrics: [
      { label: 'Объём', value: volume, unit: 'м³', digits: 3, primary: true },
      { label: 'Количество', value: pieces, unit: 'шт', digits: 0, primary: true },
      { label: 'Штук в 1 м³', value: perM3, unit: 'шт', digits: 1, primary: true },
      { label: 'Объём одной штуки', value: piece, unit: 'м³', digits: 4 },
      { label: 'Погонных метров', value: pieces * pos(v.length), unit: 'м', digits: 1 },
      { label: 'Площадь покрытия (по ширине)', value: pieces * pos(v.length) * (pos(v.w) / 1000), unit: 'м²', digits: 2 },
      { label: 'Масса', value: kg, unit: 'кг', digits: 0, hint: `${round(kg / 1000, 2)} т` },
    ],
    lines: [{ name, unit: 'м³', qty: round(volume, 3), kind: 'material', priceKey: v.dried ? 'lumber-dry' : 'lumber' }],
  }
}

export const lumber = defineCalculator<LumberValues>({
  id: 'lumber',
  title: 'Пиломатериалы',
  short: 'Кубатура доски и бруса, штук в кубе, масса по породе и влажности',
  category: 'wood',
  icon: TreePine,
  keywords: ['доска', 'брус', 'пиломатериалы', 'куб', 'кубатура', 'штук в кубе', 'лес', 'древесина', 'вагонка', 'сосна', 'лиственница'],
  sectionName: 'Пиломатериалы',
  defaults: { t: 50, w: 150, length: 6, mode: 'pieces', pieces: 40, volume: 1, species: 'pine', moisture: 'transport', dried: false },
  groups: [
    {
      fields: [
        { key: 't', label: 'Толщина', type: 'number', unit: 'мм', step: 5, span: 2 },
        { key: 'w', label: 'Ширина', type: 'number', unit: 'мм', step: 5, span: 2 },
        { key: 'length', label: 'Длина', type: 'select', span: 2, options: opts([[2, '2 м'], [3, '3 м'], [4, '4 м'], [5, '5 м'], [6, '6 м']]) },
        { key: 'mode', label: 'Известно', type: 'segmented', span: 6, options: opts([['pieces', 'Количество штук'], ['volume', 'Объём, м³']]) },
        { key: 'pieces', label: 'Количество', type: 'number', unit: 'шт', step: 1, visible: (v) => v.mode === 'pieces' },
        { key: 'volume', label: 'Объём', type: 'number', unit: 'м³', step: 0.1, visible: (v) => v.mode === 'volume' },
        { key: 'species', label: 'Порода', type: 'select', options: Object.entries(WOOD_SPECIES).map(([k, s]) => ({ value: k, label: `${s.name} (${s.density} кг/м³ сухая)` })) },
        { key: 'moisture', label: 'Влажность', type: 'select', options: opts([['dry', 'Сухая (12%)'], ['transport', 'Транспортная (~22%)'], ['natural', 'Естественная (свежепил)']]) },
        { key: 'dried', label: 'Камерная сушка, строганый', type: 'toggle' },
      ],
    },
  ],
  compute: computeLumber,
  method: ['Объём штуки = толщина × ширина × длина; штук в кубе = 1 / объём штуки. Масса — по плотности породы при 12% влажности с поправкой на влажность.'],
})

// ───────────────────────────── Утеплитель ─────────────────────────────

export const INSULATIONS = {
  wool: { name: 'Минеральная вата', lambda: 0.04, priceKey: 'mineral-wool' },
  eps: { name: 'Пенополистирол (ППС)', lambda: 0.038, priceKey: 'eps' },
  xps: { name: 'Экструдированный пенополистирол', lambda: 0.032, priceKey: 'xps' },
  pir: { name: 'PIR-плиты', lambda: 0.022, priceKey: 'pir' },
} as const

/** Теплопроводность в условиях эксплуатации Б, Вт/(м·°С), ориентировочно по СП 50.13330. */
export const WALL_MATERIALS = {
  none: { name: 'Без учёта стены', lambda: 0 },
  brick: { name: 'Кирпич керамический полнотелый', lambda: 0.81 },
  brickHollow: { name: 'Кирпич керамический пустотелый', lambda: 0.58 },
  silicate: { name: 'Кирпич силикатный', lambda: 0.87 },
  aerated500: { name: 'Газобетон D500', lambda: 0.14 },
  aerated400: { name: 'Газобетон D400', lambda: 0.12 },
  claydite: { name: 'Керамзитобетон D1200', lambda: 0.52 },
  timber: { name: 'Брус / бревно (сосна)', lambda: 0.18 },
  concrete: { name: 'Железобетон', lambda: 2.04 },
} as const

export type InsulationValues = {
  material: keyof typeof INSULATIONS
  area: number
  thickness: number
  slabL: number
  slabW: number
  slabT: number
  perPack: number
  waste: number
  vapor: boolean
  dowels: boolean
  thermal: boolean
  wall: keyof typeof WALL_MATERIALS
  wallT: number
  rReq: number
  works: boolean
}

export const R_SURFACES = 1 / 8.7 + 1 / 23

export function requiredInsulation(rReq: number, wallLambda: number, wallTmm: number, insLambda: number): number {
  const rWall = wallLambda > 0 ? wallTmm / 1000 / wallLambda : 0
  return Math.max(0, (rReq - R_SURFACES - rWall) * insLambda) * 1000
}

export function computeInsulation(v: InsulationValues): CalcResult {
  const ins = INSULATIONS[v.material] ?? INSULATIONS.wool
  const area = pos(v.area)
  const slabT = Math.max(1, pos(v.slabT))
  const layers = Math.max(1, ceil(pos(v.thickness) / slabT))
  const slabArea = (pos(v.slabL) * pos(v.slabW)) / 1e6
  const pieces = slabArea > 0 ? ceil(((area * layers) / slabArea) * (1 + pos(v.waste) / 100)) : 0
  const perPack = Math.max(1, Math.round(pos(v.perPack)))
  const packs = ceil(pieces / perPack)
  const m3 = pieces * slabArea * (slabT / 1000)
  const metrics: CalcResult['metrics'] = [
    { label: 'Упаковок', value: packs, unit: 'шт', digits: 0, primary: true },
    { label: 'Объём утеплителя', value: m3, unit: 'м³', digits: 2, primary: true },
    { label: 'Плит', value: pieces, unit: 'шт', digits: 0, primary: true },
    { label: 'Слоёв', value: layers, unit: 'шт', digits: 0 },
    { label: 'Площадь в упаковке', value: slabArea * perPack, unit: 'м²', digits: 2 },
  ]
  const lines: MaterialLine[] = [
    { name: `${ins.name} ${slabT} мм, ${layers} сл. (${packs} уп.)`, unit: 'м³', qty: round(m3, 3), kind: 'material', priceKey: ins.priceKey },
  ]
  if (v.vapor) lines.push({ name: 'Пароизоляционная плёнка', unit: 'м²', qty: round(area * 1.15, 1), kind: 'material', priceKey: 'vapor-barrier' })
  if (v.dowels) lines.push({ name: 'Дюбель-зонтик', unit: 'шт', qty: ceil(area * 6), kind: 'material', priceKey: 'facade-dowel' })
  const warnings: string[] = []
  if (v.thermal) {
    const wall = WALL_MATERIALS[v.wall] ?? WALL_MATERIALS.none
    const need = requiredInsulation(pos(v.rReq), wall.lambda, pos(v.wallT), ins.lambda)
    const rWall = wall.lambda > 0 ? pos(v.wallT) / 1000 / wall.lambda : 0
    const rTotal = R_SURFACES + rWall + pos(v.thickness) / 1000 / ins.lambda
    metrics.push(
      { label: 'Требуемая толщина утеплителя', value: need, unit: 'мм', digits: 0, primary: true, hint: `рекомендуется ${ceil(need / 50) * 50} мм` },
      { label: 'R конструкции с выбранной толщиной', value: rTotal, unit: 'м²·°С/Вт', digits: 2 },
    )
    if (rTotal < pos(v.rReq)) warnings.push(`Сопротивление теплопередаче ${round(rTotal, 2)} меньше требуемого ${pos(v.rReq)} — увеличьте толщину до ${ceil(need / 50) * 50} мм.`)
  }
  if (v.works) lines.push({ name: 'Утепление (укладка плит)', unit: 'м²', qty: round(area * layers, 2), kind: 'work', priceKey: 'work-insulation' })
  return { metrics, lines, warnings }
}

export const insulation = defineCalculator<InsulationValues>({
  id: 'insulation',
  title: 'Утеплитель',
  short: 'Плиты и упаковки утеплителя, плёнка, дюбели и подбор толщины по теплозащите',
  category: 'walls',
  icon: Thermometer,
  keywords: ['утеплитель', 'утепление', 'минвата', 'роквул', 'пенопласт', 'пеноплэкс', 'xps', 'pir', 'теплотехнический', 'толщина утеплителя', 'пароизоляция'],
  sectionName: 'Утепление',
  defaults: {
    material: 'wool', area: 100, thickness: 150, slabL: 1200, slabW: 600, slabT: 50, perPack: 8, waste: 5,
    vapor: true, dowels: false, thermal: true, wall: 'aerated500', wallT: 300, rReq: 3.13, works: false,
  },
  groups: [
    {
      title: 'Утеплитель',
      fields: [
        { key: 'material', label: 'Материал', type: 'select', options: Object.entries(INSULATIONS).map(([k, i]) => ({ value: k, label: `${i.name} (λ ${String(i.lambda).replace('.', ',')})` })) },
        { key: 'area', label: 'Площадь утепления', type: 'number', unit: 'м²', step: 1 },
        { key: 'thickness', label: 'Общая толщина', type: 'number', unit: 'мм', step: 10 },
        { key: 'waste', label: 'Запас', type: 'number', unit: '%', step: 1 },
        { key: 'slabL', label: 'Длина плиты', type: 'number', unit: 'мм', step: 10, span: 2 },
        { key: 'slabW', label: 'Ширина плиты', type: 'number', unit: 'мм', step: 10, span: 2 },
        { key: 'slabT', label: 'Толщина плиты', type: 'number', unit: 'мм', step: 10, span: 2 },
        { key: 'perPack', label: 'Плит в упаковке', type: 'number', unit: 'шт', step: 1 },
        { key: 'vapor', label: 'Пароизоляция', type: 'toggle' },
        { key: 'dowels', label: 'Дюбели-зонтики (фасад)', type: 'toggle' },
        { key: 'works', label: 'Добавить работы', type: 'toggle' },
      ],
    },
    {
      title: 'Теплотехника',
      fields: [
        { key: 'thermal', label: 'Подобрать толщину по теплозащите', type: 'toggle', span: 6 },
        { key: 'rReq', label: 'Требуемое R₀', type: 'number', unit: 'м²·°С/Вт', step: 0.05, hint: 'Стены жилого дома: Москва ≈ 3,1; СПб ≈ 3,1; Новосибирск ≈ 3,7 (СП 50.13330)', visible: (v) => v.thermal },
        { key: 'wall', label: 'Основание стены', type: 'select', options: Object.entries(WALL_MATERIALS).map(([k, m]) => ({ value: k, label: m.lambda ? `${m.name} (λ ${String(m.lambda).replace('.', ',')})` : m.name })), visible: (v) => v.thermal },
        { key: 'wallT', label: 'Толщина стены', type: 'number', unit: 'мм', step: 10, visible: (v) => v.thermal && v.wall !== 'none' },
      ],
    },
  ],
  compute: computeInsulation,
  method: [
    'Слоёв = ⌈толщина / толщина плиты⌉; плит = площадь × слои / площадь плиты × (1 + запас).',
    'Теплотехника: R₀ = 1/8,7 + δстены/λстены + δут/λут + 1/23; требуемая толщина δут = (R₀тр − Rповерхностей − Rстены) × λут.',
    'Значения λ — для условий эксплуатации Б, ориентировочно; для проекта используйте данные производителя.',
  ],
})

// ───────────────────────────── Лестница ─────────────────────────────

export type StairsValues = {
  height: number
  run: number
  width: number
  riser: number
  works: boolean
}

export function computeStairs(v: StairsValues): CalcResult {
  const H = pos(v.height)
  const n = Math.max(2, Math.round(H / Math.max(100, pos(v.riser) || 170)))
  const h = H / n
  const treads = n - 1
  const b = pos(v.run) > 0 ? pos(v.run) / treads : Math.min(320, Math.max(250, 630 - 2 * h))
  const run = b * treads
  const angle = rad2deg(Math.atan2(h, b))
  const stringer = Math.sqrt(H * H + run * run) / 1000
  const blondel = 2 * h + b
  const warnings: string[] = []
  if (h < 150 || h > 190) warnings.push(`Высота подступенка ${round(h, 0)} мм вне удобного диапазона 150–190 мм.`)
  if (b < 250 || b > 320) warnings.push(`Глубина проступи ${round(b, 0)} мм вне удобного диапазона 250–320 мм.`)
  if (blondel < 600 || blondel > 650) warnings.push(`Формула шага 2h + b = ${round(blondel, 0)} мм, комфортно 600–650 мм.`)
  if (angle > 42) warnings.push(`Угол ${round(angle, 1)}° — лестница слишком крутая (комфортно 26–42°).`)
  const lines: MaterialLine[] = [
    { name: `Ступень ${pos(v.width)}×${round(b + 30, 0)} мм`, unit: 'шт', qty: treads, kind: 'material', priceKey: 'stair-tread' },
    { name: `Подступенок ${pos(v.width)}×${round(h, 0)} мм`, unit: 'шт', qty: n, kind: 'material', priceKey: 'stair-riser' },
    { name: `Косоур 50×300 мм, 2 шт по ${round(stringer, 2)} м`, unit: 'м³', qty: round(2 * stringer * 0.05 * 0.3, 3), kind: 'material', priceKey: 'lumber-dry' },
  ]
  if (v.works) lines.push({ name: 'Сборка и монтаж лестницы', unit: 'компл', qty: 1, kind: 'work', priceKey: 'work-stairs' })
  return {
    metrics: [
      { label: 'Подъёмов (подступенков)', value: n, unit: 'шт', digits: 0, primary: true },
      { label: 'Высота подъёма h', value: h, unit: 'мм', digits: 1, primary: true },
      { label: 'Глубина проступи b', value: b, unit: 'мм', digits: 0, primary: true },
      { label: 'Ступеней (проступей)', value: treads, unit: 'шт', digits: 0 },
      { label: 'Длина марша в плане', value: run / 1000, unit: 'м', digits: 2 },
      { label: 'Угол наклона', value: angle, unit: '°', digits: 1 },
      { label: 'Длина косоура', value: stringer, unit: 'м', digits: 2 },
      { label: 'Формула шага 2h + b', value: blondel, unit: 'мм', digits: 0 },
    ],
    lines,
    warnings,
  }
}

export const stairs = defineCalculator<StairsValues>({
  id: 'stairs',
  title: 'Лестница',
  short: 'Число ступеней, высота подъёма, проступь, угол и длина косоура по формуле Блонделя',
  category: 'wood',
  icon: Footprints,
  keywords: ['лестница', 'ступени', 'косоур', 'тетива', 'подступенок', 'проступь', 'марш', 'блондель'],
  sectionName: 'Лестница',
  defaults: { height: 2800, run: 0, width: 900, riser: 175, works: false },
  groups: [
    {
      fields: [
        { key: 'height', label: 'Высота от пола до пола', type: 'number', unit: 'мм', step: 10 },
        { key: 'riser', label: 'Желаемая высота ступени', type: 'number', unit: 'мм', step: 5 },
        { key: 'run', label: 'Длина проёма в плане', type: 'number', unit: 'мм', step: 50, hint: '0 — подобрать по формуле шага' },
        { key: 'width', label: 'Ширина марша', type: 'number', unit: 'мм', step: 50 },
        { key: 'works', label: 'Добавить работы', type: 'toggle' },
      ],
    },
  ],
  compute: computeStairs,
  method: [
    'Подъёмов n = round(H / желаемая высота), h = H / n; ступеней на одну меньше — верхней ступенью служит пол.',
    'Без ограничения длины проступь подбирается по формуле шага 2h + b ≈ 630 мм.',
    'Длина косоура = √(H² + L²), где L — длина марша в плане.',
  ],
})
