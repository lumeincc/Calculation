/** Пиломатериалы, утеплитель, лестница. */
import { Footprints, Thermometer, TreePine } from 'lucide-react'
import { ceil, pos, rad2deg, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult, type MaterialLine } from '../types'
import { T, Tf } from '@/i18n'

// ───────────────────────────── Пиломатериалы ─────────────────────────────

export const WOOD_SPECIES = {
  pine: { name: T('Сосна'), density: 520 },
  spruce: { name: T('Ель'), density: 450 },
  larch: { name: T('Лиственница'), density: 660 },
  birch: { name: T('Берёза'), density: 650 },
  oak: { name: T('Дуб'), density: 700 },
  aspen: { name: T('Осина'), density: 490 },
  cedar: { name: T('Кедр'), density: 440 },
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
  const name = Tf('{0} {1}×{2}×{3} м, {4} ({5} шт)', [pos(v.t) >= 100 && pos(v.w) >= 100 ? T('Брус') : T('Доска'), pos(v.t), pos(v.w), String(pos(v.length)).replace('.', ','), sp.name.toLowerCase(), pieces])
  return {
    metrics: [
      { label: T('Объём'), value: volume, unit: T('м³'), digits: 3, primary: true },
      { label: T('Количество'), value: pieces, unit: T('шт'), digits: 0, primary: true },
      { label: T('Штук в 1 м³'), value: perM3, unit: T('шт'), digits: 1, primary: true },
      { label: T('Объём одной штуки'), value: piece, unit: T('м³'), digits: 4 },
      { label: T('Погонных метров'), value: pieces * pos(v.length), unit: T('м'), digits: 1 },
      { label: T('Площадь покрытия (по ширине)'), value: pieces * pos(v.length) * (pos(v.w) / 1000), unit: T('м²'), digits: 2 },
      { label: T('Масса'), value: kg, unit: T('кг'), digits: 0, hint: Tf('{0} т', [round(kg / 1000, 2)]) },
    ],
    lines: [{ name, unit: T('м³'), qty: round(volume, 3), kind: 'material', priceKey: v.dried ? 'lumber-dry' : 'lumber' }],
  }
}

export const lumber = defineCalculator<LumberValues>({
  id: 'lumber',
  title: T('Пиломатериалы'),
  short: T('Кубатура доски и бруса, штук в кубе, масса по породе и влажности'),
  category: 'wood',
  icon: TreePine,
  keywords: [T('доска'), T('брус'), T('пиломатериалы'), T('куб'), T('кубатура'), T('штук в кубе'), T('лес'), T('древесина'), T('вагонка'), T('сосна'), T('лиственница')],
  sectionName: T('Пиломатериалы'),
  defaults: { t: 50, w: 150, length: 6, mode: 'pieces', pieces: 40, volume: 1, species: 'pine', moisture: 'transport', dried: false },
  groups: [
    {
      fields: [
        { key: 't', label: T('Толщина'), type: 'number', unit: T('мм'), step: 5, span: 2 },
        { key: 'w', label: T('Ширина'), type: 'number', unit: T('мм'), step: 5, span: 2 },
        { key: 'length', label: T('Длина'), type: 'select', span: 2, options: opts([[2, '2 м'], [3, '3 м'], [4, '4 м'], [5, '5 м'], [6, '6 м']]) },
        { key: 'mode', label: T('Известно'), type: 'segmented', span: 6, options: opts([['pieces', T('Количество штук')], ['volume', T('Объём, м³')]]) },
        { key: 'pieces', label: T('Количество'), type: 'number', unit: T('шт'), step: 1, visible: (v) => v.mode === 'pieces' },
        { key: 'volume', label: T('Объём'), type: 'number', unit: T('м³'), step: 0.1, visible: (v) => v.mode === 'volume' },
        { key: 'species', label: T('Порода'), type: 'select', options: Object.entries(WOOD_SPECIES).map(([k, s]) => ({ value: k, label: Tf('{0} ({1} кг/м³ сухая)', [s.name, s.density]) })) },
        { key: 'moisture', label: T('Влажность'), type: 'select', options: opts([['dry', T('Сухая (12%)')], ['transport', T('Транспортная (~22%)')], ['natural', T('Естественная (свежепил)')]]) },
        { key: 'dried', label: T('Камерная сушка, строганый'), type: 'toggle' },
      ],
    },
  ],
  compute: computeLumber,
  method: [T('Объём штуки = толщина × ширина × длина; штук в кубе = 1 / объём штуки. Масса — по плотности породы при 12% влажности с поправкой на влажность.')],
})

// ───────────────────────────── Утеплитель ─────────────────────────────

export const INSULATIONS = {
  wool: { name: T('Минеральная вата'), lambda: 0.04, priceKey: 'mineral-wool' },
  eps: { name: T('Пенополистирол (ППС)'), lambda: 0.038, priceKey: 'eps' },
  xps: { name: T('Экструдированный пенополистирол'), lambda: 0.032, priceKey: 'xps' },
  pir: { name: T('PIR-плиты'), lambda: 0.022, priceKey: 'pir' },
} as const

/** Теплопроводность в условиях эксплуатации Б, Вт/(м·°С), ориентировочно по СП 50.13330. */
export const WALL_MATERIALS = {
  none: { name: T('Без учёта стены'), lambda: 0 },
  brick: { name: T('Кирпич керамический полнотелый'), lambda: 0.81 },
  brickHollow: { name: T('Кирпич керамический пустотелый'), lambda: 0.58 },
  silicate: { name: T('Кирпич силикатный'), lambda: 0.87 },
  aerated500: { name: T('Газобетон D500'), lambda: 0.14 },
  aerated400: { name: T('Газобетон D400'), lambda: 0.12 },
  claydite: { name: T('Керамзитобетон D1200'), lambda: 0.52 },
  timber: { name: T('Брус / бревно (сосна)'), lambda: 0.18 },
  concrete: { name: T('Железобетон'), lambda: 2.04 },
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
    { label: T('Упаковок'), value: packs, unit: T('шт'), digits: 0, primary: true },
    { label: T('Объём утеплителя'), value: m3, unit: T('м³'), digits: 2, primary: true },
    { label: T('Плит'), value: pieces, unit: T('шт'), digits: 0, primary: true },
    { label: T('Слоёв'), value: layers, unit: T('шт'), digits: 0 },
    { label: T('Площадь в упаковке'), value: slabArea * perPack, unit: T('м²'), digits: 2 },
  ]
  const lines: MaterialLine[] = [
    { name: Tf('{0} {1} мм, {2} сл. ({3} уп.)', [ins.name, slabT, layers, packs]), unit: T('м³'), qty: round(m3, 3), kind: 'material', priceKey: ins.priceKey },
  ]
  if (v.vapor) lines.push({ name: T('Пароизоляционная плёнка'), unit: T('м²'), qty: round(area * 1.15, 1), kind: 'material', priceKey: 'vapor-barrier' })
  if (v.dowels) lines.push({ name: T('Дюбель-зонтик'), unit: T('шт'), qty: ceil(area * 6), kind: 'material', priceKey: 'facade-dowel' })
  const warnings: string[] = []
  if (v.thermal) {
    const wall = WALL_MATERIALS[v.wall] ?? WALL_MATERIALS.none
    const need = requiredInsulation(pos(v.rReq), wall.lambda, pos(v.wallT), ins.lambda)
    const rWall = wall.lambda > 0 ? pos(v.wallT) / 1000 / wall.lambda : 0
    const rTotal = R_SURFACES + rWall + pos(v.thickness) / 1000 / ins.lambda
    metrics.push(
      { label: T('Требуемая толщина утеплителя'), value: need, unit: T('мм'), digits: 0, primary: true, hint: Tf('рекомендуется {0} мм', [ceil(need / 50) * 50]) },
      { label: T('R конструкции с выбранной толщиной'), value: rTotal, unit: T('м²·°С/Вт'), digits: 2 },
    )
    if (rTotal < pos(v.rReq)) warnings.push(Tf('Сопротивление теплопередаче {0} меньше требуемого {1} — увеличьте толщину до {2} мм.', [round(rTotal, 2), pos(v.rReq), ceil(need / 50) * 50]))
  }
  if (v.works) lines.push({ name: T('Утепление (укладка плит)'), unit: T('м²'), qty: round(area * layers, 2), kind: 'work', priceKey: 'work-insulation' })
  return { metrics, lines, warnings }
}

export const insulation = defineCalculator<InsulationValues>({
  id: 'insulation',
  title: T('Утеплитель'),
  short: T('Плиты и упаковки утеплителя, плёнка, дюбели и подбор толщины по теплозащите'),
  category: 'walls',
  icon: Thermometer,
  keywords: [T('утеплитель'), T('утепление'), T('минвата'), T('роквул'), T('пенопласт'), T('пеноплэкс'), 'xps', 'pir', T('теплотехнический'), T('толщина утеплителя'), T('пароизоляция')],
  sectionName: T('Утепление'),
  defaults: {
    material: 'wool', area: 100, thickness: 150, slabL: 1200, slabW: 600, slabT: 50, perPack: 8, waste: 5,
    vapor: true, dowels: false, thermal: true, wall: 'aerated500', wallT: 300, rReq: 3.13, works: false,
  },
  groups: [
    {
      title: T('Утеплитель'),
      fields: [
        { key: 'material', label: T('Материал'), type: 'select', options: Object.entries(INSULATIONS).map(([k, i]) => ({ value: k, label: `${i.name} (λ ${String(i.lambda).replace('.', ',')})` })) },
        { key: 'area', label: T('Площадь утепления'), type: 'number', unit: T('м²'), step: 1 },
        { key: 'thickness', label: T('Общая толщина'), type: 'number', unit: T('мм'), step: 10 },
        { key: 'waste', label: T('Запас'), type: 'number', unit: '%', step: 1 },
        { key: 'slabL', label: T('Длина плиты'), type: 'number', unit: T('мм'), step: 10, span: 2 },
        { key: 'slabW', label: T('Ширина плиты'), type: 'number', unit: T('мм'), step: 10, span: 2 },
        { key: 'slabT', label: T('Толщина плиты'), type: 'number', unit: T('мм'), step: 10, span: 2 },
        { key: 'perPack', label: T('Плит в упаковке'), type: 'number', unit: T('шт'), step: 1 },
        { key: 'vapor', label: T('Пароизоляция'), type: 'toggle' },
        { key: 'dowels', label: T('Дюбели-зонтики (фасад)'), type: 'toggle' },
        { key: 'works', label: T('Добавить работы'), type: 'toggle' },
      ],
    },
    {
      title: T('Теплотехника'),
      fields: [
        { key: 'thermal', label: T('Подобрать толщину по теплозащите'), type: 'toggle', span: 6 },
        { key: 'rReq', label: T('Требуемое R₀'), type: 'number', unit: T('м²·°С/Вт'), step: 0.05, hint: T('Стены жилого дома: Москва ≈ 3,1; СПб ≈ 3,1; Новосибирск ≈ 3,7 (СП 50.13330)'), visible: (v) => v.thermal },
        { key: 'wall', label: T('Основание стены'), type: 'select', options: Object.entries(WALL_MATERIALS).map(([k, m]) => ({ value: k, label: m.lambda ? `${m.name} (λ ${String(m.lambda).replace('.', ',')})` : m.name })), visible: (v) => v.thermal },
        { key: 'wallT', label: T('Толщина стены'), type: 'number', unit: T('мм'), step: 10, visible: (v) => v.thermal && v.wall !== 'none' },
      ],
    },
  ],
  compute: computeInsulation,
  method: [
    T('Слоёв = ⌈толщина / толщина плиты⌉; плит = площадь × слои / площадь плиты × (1 + запас).'),
    T('Теплотехника: R₀ = 1/8,7 + δстены/λстены + δут/λут + 1/23; требуемая толщина δут = (R₀тр − Rповерхностей − Rстены) × λут.'),
    T('Значения λ — для условий эксплуатации Б, ориентировочно; для проекта используйте данные производителя.'),
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
  if (h < 150 || h > 190) warnings.push(Tf('Высота подступенка {0} мм вне удобного диапазона 150–190 мм.', [round(h, 0)]))
  if (b < 250 || b > 320) warnings.push(Tf('Глубина проступи {0} мм вне удобного диапазона 250–320 мм.', [round(b, 0)]))
  if (blondel < 600 || blondel > 650) warnings.push(Tf('Формула шага 2h + b = {0} мм, комфортно 600–650 мм.', [round(blondel, 0)]))
  if (angle > 42) warnings.push(Tf('Угол {0}° — лестница слишком крутая (комфортно 26–42°).', [round(angle, 1)]))
  const lines: MaterialLine[] = [
    { name: Tf('Ступень {0}×{1} мм', [pos(v.width), round(b + 30, 0)]), unit: T('шт'), qty: treads, kind: 'material', priceKey: 'stair-tread' },
    { name: Tf('Подступенок {0}×{1} мм', [pos(v.width), round(h, 0)]), unit: T('шт'), qty: n, kind: 'material', priceKey: 'stair-riser' },
    { name: Tf('Косоур 50×300 мм, 2 шт по {0} м', [round(stringer, 2)]), unit: T('м³'), qty: round(2 * stringer * 0.05 * 0.3, 3), kind: 'material', priceKey: 'lumber-dry' },
  ]
  if (v.works) lines.push({ name: T('Сборка и монтаж лестницы'), unit: T('компл'), qty: 1, kind: 'work', priceKey: 'work-stairs' })
  return {
    metrics: [
      { label: T('Подъёмов (подступенков)'), value: n, unit: T('шт'), digits: 0, primary: true },
      { label: T('Высота подъёма h'), value: h, unit: T('мм'), digits: 1, primary: true },
      { label: T('Глубина проступи b'), value: b, unit: T('мм'), digits: 0, primary: true },
      { label: T('Ступеней (проступей)'), value: treads, unit: T('шт'), digits: 0 },
      { label: T('Длина марша в плане'), value: run / 1000, unit: T('м'), digits: 2 },
      { label: T('Угол наклона'), value: angle, unit: '°', digits: 1 },
      { label: T('Длина косоура'), value: stringer, unit: T('м'), digits: 2 },
      { label: T('Формула шага 2h + b'), value: blondel, unit: T('мм'), digits: 0 },
    ],
    lines,
    warnings,
  }
}

export const stairs = defineCalculator<StairsValues>({
  id: 'stairs',
  title: T('Лестница'),
  short: T('Число ступеней, высота подъёма, проступь, угол и длина косоура по формуле Блонделя'),
  category: 'wood',
  icon: Footprints,
  keywords: [T('лестница'), T('ступени'), T('косоур'), T('тетива'), T('подступенок'), T('проступь'), T('марш'), T('блондель')],
  sectionName: T('Лестница'),
  defaults: { height: 2800, run: 0, width: 900, riser: 175, works: false },
  groups: [
    {
      fields: [
        { key: 'height', label: T('Высота от пола до пола'), type: 'number', unit: T('мм'), step: 10 },
        { key: 'riser', label: T('Желаемая высота ступени'), type: 'number', unit: T('мм'), step: 5 },
        { key: 'run', label: T('Длина проёма в плане'), type: 'number', unit: T('мм'), step: 50, hint: T('0 — подобрать по формуле шага') },
        { key: 'width', label: T('Ширина марша'), type: 'number', unit: T('мм'), step: 50 },
        { key: 'works', label: T('Добавить работы'), type: 'toggle' },
      ],
    },
  ],
  compute: computeStairs,
  method: [
    T('Подъёмов n = round(H / желаемая высота), h = H / n; ступеней на одну меньше — верхней ступенью служит пол.'),
    T('Без ограничения длины проступь подбирается по формуле шага 2h + b ≈ 630 мм.'),
    T('Длина косоура = √(H² + L²), где L — длина марша в плане.'),
  ],
})
