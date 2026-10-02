import { BrickWall } from 'lucide-react'
import { ceil, pos, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult, type MaterialLine, type RowValues } from '../types'
import { openingsArea, openingsField, withWaste } from '../common'
import { T, Tf } from '@/i18n'

export const BRICKS = {
  single: { name: T('Кирпич одинарный 250×120×65'), l: 250, w: 120, h: 65, pallet: 480, priceKey: 'brick-single' },
  onehalf: { name: T('Кирпич полуторный 250×120×88'), l: 250, w: 120, h: 88, pallet: 352, priceKey: 'brick-onehalf' },
  double: { name: T('Камень двойной 250×120×138'), l: 250, w: 120, h: 138, pallet: 200, priceKey: 'brick-double' },
  euro: { name: T('Кирпич евро 250×85×65'), l: 250, w: 85, h: 65, pallet: 480, priceKey: 'brick-euro' },
} as const

export const BLOCKS = {
  aerated: { name: T('Газобетонный блок'), priceKey: 'block-aerated' },
  foam: { name: T('Пенобетонный блок'), priceKey: 'block-foam' },
  claydite: { name: T('Керамзитобетонный блок'), priceKey: 'block-claydite' },
} as const

export type MasonryValues = {
  material: 'brick' | 'block'
  brick: keyof typeof BRICKS
  thickness: string
  block: keyof typeof BLOCKS
  blockL: number
  blockH: number
  blockW: number
  joint: number
  length: number
  height: number
  openings: RowValues[]
  waste: number
  bag: number
  mesh: boolean
  meshRows: number
  works: boolean
}

/** Wall thickness (mm) for n half-bricks. */
export function brickWallThickness(halfBricks: number, l: number, w: number, j: number): number {
  const full = Math.floor(halfBricks / 2)
  const half = halfBricks % 2
  return full * l + half * w + Math.max(0, full + half - 1) * j
}

export function computeMasonry(v: MasonryValues): CalcResult {
  const wallArea = pos(v.length) * pos(v.height)
  const net = Math.max(0, wallArea - openingsArea(v.openings))
  const j = pos(v.joint) / 1000
  const metrics: CalcResult['metrics'] = []
  const lines: MaterialLine[] = []
  let thicknessM: number
  let pieces: number
  let unitVolume: number
  let rowH: number

  if (v.material === 'brick') {
    const b = BRICKS[v.brick] ?? BRICKS.single
    const halves = Math.round(Number(v.thickness) * 2)
    thicknessM = brickWallThickness(halves, b.l, b.w, pos(v.joint)) / 1000
    const perM2 = halves / (((b.l / 1000) + j) * ((b.h / 1000) + j))
    pieces = net * perM2
    unitVolume = (b.l * b.w * b.h) / 1e9
    rowH = b.h / 1000 + j
    metrics.push({ label: T('Кирпичей на 1 м² стены'), value: perM2, unit: T('шт'), digits: 1 })
  } else {
    const L = pos(v.blockL) / 1000, H = pos(v.blockH) / 1000, W = pos(v.blockW) / 1000
    thicknessM = W
    const perM2 = L > 0 && H > 0 ? 1 / ((L + j) * (H + j)) : 0
    pieces = net * perM2
    unitVolume = L * H * W
    rowH = H + j
    metrics.push({ label: T('Блоков на 1 м² стены'), value: perM2, unit: T('шт'), digits: 2 })
  }

  const piecesBuy = ceil(withWaste(pieces, v.waste))
  const masonryVolume = net * thicknessM
  const jointVolume = Math.max(0, masonryVolume - pieces * unitVolume)
  const isGlue = v.material === 'block' && pos(v.joint) <= 5
  // Dry mix needed for joints: mortar ≈ 1.7 t of dry mix per m³; thin-joint glue ≈ 1.5 t per m³ of joints.
  const mixKg = jointVolume * (isGlue ? 1500 : 1700) * 1.1
  const bag = Math.max(1, pos(v.bag))
  const bags = ceil(mixKg / bag)

  metrics.unshift(
    { label: v.material === 'brick' ? T('Кирпича с запасом') : T('Блоков с запасом'), value: piecesBuy, unit: T('шт'), digits: 0, primary: true },
    { label: T('Объём кладки'), value: masonryVolume, unit: T('м³'), digits: 2, primary: true },
    { label: isGlue ? T('Клей') : T('Кладочная смесь'), value: mixKg, unit: T('кг'), digits: 0, primary: true, hint: Tf('{0} меш. по {1} кг', [bags, bag]) },
  )
  metrics.push(
    { label: T('Площадь стен за вычетом проёмов'), value: net, unit: T('м²'), digits: 2 },
    { label: T('Толщина стены'), value: thicknessM * 1000, unit: T('мм'), digits: 0 },
    { label: isGlue ? T('Объём клеевых швов') : T('Объём раствора'), value: jointVolume, unit: T('м³'), digits: 3 },
  )

  if (v.material === 'brick') {
    const b = BRICKS[v.brick] ?? BRICKS.single
    metrics.push({ label: Tf('Поддонов (по {0} шт)', [b.pallet]), value: ceil(piecesBuy / b.pallet), unit: T('шт'), digits: 0 })
    lines.push({ name: b.name, unit: T('шт'), qty: piecesBuy, kind: 'material', priceKey: b.priceKey })
  } else {
    const blk = BLOCKS[v.block] ?? BLOCKS.aerated
    const m3 = piecesBuy * unitVolume
    metrics.push({ label: T('Объём блоков к закупке'), value: m3, unit: T('м³'), digits: 2 })
    lines.push({
      name: Tf('{0} {1}×{2}×{3} мм ({4} шт)', [blk.name, pos(v.blockL), pos(v.blockH), pos(v.blockW), piecesBuy]),
      unit: T('м³'), qty: round(m3, 3), kind: 'material', priceKey: blk.priceKey,
    })
  }
  lines.push({
    name: Tf('{0}, мешок {1} кг', [isGlue ? T('Клей для газобетона') : T('Кладочная смесь М150'), bag]),
    unit: T('мешок'), qty: bags, kind: 'material', priceKey: isGlue ? 'mix-block-glue' : 'mix-masonry', priceFactor: bag,
  })

  if (v.mesh) {
    const rows = rowH > 0 ? pos(v.height) / rowH : 0
    const meshLayers = Math.floor(rows / Math.max(1, Math.round(pos(v.meshRows))))
    const meshArea = meshLayers * pos(v.length) * thicknessM * 1.1
    metrics.push({ label: T('Армирующих рядов'), value: meshLayers, unit: T('шт'), digits: 0 })
    lines.push({ name: T('Сетка кладочная'), unit: T('м²'), qty: round(meshArea, 1), kind: 'material', priceKey: 'masonry-mesh' })
  }
  if (v.works) {
    lines.push({
      name: v.material === 'brick' ? T('Кладка из кирпича') : T('Кладка из блоков'),
      unit: T('м³'), qty: round(masonryVolume, 2), kind: 'work',
      priceKey: v.material === 'brick' ? 'work-masonry-brick' : 'work-masonry-block',
    })
  }
  const warnings: string[] = []
  if (net === 0) warnings.push(T('Площадь стен равна нулю — проверьте размеры и проёмы.'))
  return { metrics, lines, warnings }
}

export const masonry = defineCalculator<MasonryValues>({
  id: 'masonry',
  title: T('Кирпич и блоки'),
  short: T('Количество кирпича или газобетона, раствор или клей, поддоны, кладочная сетка'),
  category: 'walls',
  icon: BrickWall,
  keywords: [T('кирпич'), T('кладка'), T('газобетон'), T('газоблок'), T('пеноблок'), T('блоки'), T('стена'), T('раствор'), T('клей'), T('поддон'), T('керамзитоблок')],
  sectionName: T('Стены'),
  defaults: {
    material: 'brick', brick: 'single', thickness: '1', block: 'aerated', blockL: 600, blockH: 250, blockW: 300,
    joint: 10, length: 40, height: 3, openings: [{ w: 1.5, h: 1.5, n: 6 }, { w: 1, h: 2.1, n: 1 }],
    waste: 5, bag: 40, mesh: false, meshRows: 5, works: false,
  },
  groups: [
    {
      title: T('Материал'),
      fields: [
        { key: 'material', label: T('Материал стен'), type: 'segmented', span: 6, options: opts([['brick', T('Кирпич')], ['block', T('Блоки')]]) },
        { key: 'brick', label: T('Формат кирпича'), type: 'select', options: Object.entries(BRICKS).map(([k, b]) => ({ value: k, label: b.name })), visible: (v) => v.material === 'brick' },
        { key: 'thickness', label: T('Толщина стены'), type: 'select', options: opts([['0.5', T('В полкирпича')], ['1', T('В 1 кирпич')], ['1.5', T('В 1,5 кирпича')], ['2', T('В 2 кирпича')], ['2.5', T('В 2,5 кирпича')]]), visible: (v) => v.material === 'brick' },
        { key: 'block', label: T('Вид блока'), type: 'select', options: Object.entries(BLOCKS).map(([k, b]) => ({ value: k, label: b.name })), visible: (v) => v.material === 'block' },
        { key: 'blockL', label: T('Длина блока'), type: 'number', unit: T('мм'), step: 10, span: 2, visible: (v) => v.material === 'block' },
        { key: 'blockH', label: T('Высота блока'), type: 'number', unit: T('мм'), step: 10, span: 2, visible: (v) => v.material === 'block' },
        { key: 'blockW', label: T('Толщина (стена)'), type: 'number', unit: T('мм'), step: 25, span: 2, visible: (v) => v.material === 'block' },
        { key: 'joint', label: T('Толщина шва'), type: 'number', unit: T('мм'), step: 1, hint: T('Раствор 10–12 мм, клей 2–3 мм') },
        { key: 'bag', label: T('Мешок смеси'), type: 'select', options: opts([[25, '25 кг'], [40, '40 кг'], [50, '50 кг']]) },
      ],
    },
    {
      title: T('Стены'),
      fields: [
        { key: 'length', label: T('Общая длина стен'), type: 'number', unit: T('м'), step: 0.5, hint: T('Периметр + перегородки той же толщины') },
        { key: 'height', label: T('Высота стен'), type: 'number', unit: T('м'), step: 0.1 },
        openingsField<MasonryValues>('openings'),
        { key: 'waste', label: T('Запас на бой и подрезку'), type: 'number', unit: '%', step: 1 },
        { key: 'mesh', label: T('Кладочная сетка'), type: 'toggle' },
        { key: 'meshRows', label: T('Сетка через каждые'), type: 'number', unit: T('рядов'), step: 1, visible: (v) => v.mesh },
        { key: 'works', label: T('Добавить работы'), type: 'toggle' },
      ],
    },
  ],
  compute: computeMasonry,
  method: [
    T('Кирпич: на 1 м² стены в полкирпича = 1 / ((l + шов) × (h + шов)); толщина в n полукирпичей умножает это число на n (например, 1 кирпич одинарный ≈ 102 шт/м²).'),
    T('Блоки: штук на м² = 1 / ((L + шов) × (H + шов)), толщина стены равна толщине блока.'),
    T('Объём швов = объём кладки − объём кирпичей; сухой смеси ≈ 1,7 т на м³ раствора (клея ≈ 1,5 т на м³ швов) с запасом 10%.'),
  ],
})
