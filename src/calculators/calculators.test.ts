import { describe, expect, it } from 'vitest'
import { kgPerMetre } from '@/lib/metal'
import { computeConcrete, concrete, concreteMix } from './defs/concrete'
import { computeMetal, metal } from './defs/metal'
import { computeRebar, rebar, withLaps } from './defs/rebar'
import { brickWallThickness, computeMasonry, masonry } from './defs/masonry'
import { computeTile, groutKgPerM2, computeWallpaper, wallpaper, computeFlooring, flooring } from './defs/finish'
import { roofGeometry } from './defs/roof'
import { pitVolume, truckTrips, computeBulk, bulk } from './defs/earth'
import { computeStairs, computeLumber, lumber, requiredInsulation } from './defs/wood'
import { convert } from './defs/units'
import { computeFence, fence } from './defs/fence'

const metric = (r: { metrics: { label: string; value: number }[] }, label: string) =>
  r.metrics.find((m) => m.label.startsWith(label))?.value

describe('metal', () => {
  it('matches GOST table values for geometric profiles', () => {
    expect(kgPerMetre({ type: 'profilePipe', a: 40, b: 20, s: 2 })).toBeCloseTo(1.68, 2) // ГОСТ 30245: 1,68
    expect(kgPerMetre({ type: 'profilePipe', a: 60, b: 60, s: 2 })).toBeCloseTo(3.56, 1)
    expect(kgPerMetre({ type: 'pipe', a: 57, s: 3.5 })).toBeCloseTo(4.62, 2) // ГОСТ 8732: 4,62
    expect(kgPerMetre({ type: 'round', a: 20 })).toBeCloseTo(2.466, 3)
    expect(kgPerMetre({ type: 'sheet', s: 10 })).toBeCloseTo(78.5, 5) // kg/m²
    expect(kgPerMetre({ type: 'rebar', a: 12 })).toBe(0.888)
    expect(kgPerMetre({ type: 'angle', size: '50×5' })).toBe(3.77)
  })

  it('rescales table profiles by density', () => {
    expect(kgPerMetre({ type: 'beam', size: '№20', materialId: 'aluminum' })).toBeCloseTo(21 * 2700 / 7850, 5)
  })

  it('computes tonnage by length and length by mass', () => {
    const byLen = computeMetal({ ...metal.defaults, profile: 'channel', channelSize: '№10', length: 12, count: 10 })
    expect(metric(byLen, 'Общая масса')).toBeCloseTo(8.59 * 120 / 1000, 6)
    const byMass = computeMetal({ ...metal.defaults, profile: 'channel', channelSize: '№10', mode: 'mass', targetMass: 1, length: 12 })
    expect(metric(byMass, 'Общая длина')).toBeCloseTo(1000 / 8.59, 3)
    expect(byMass.lines[0].unit).toBe('т')
  })

  it('handles sheets by piece', () => {
    const r = computeMetal({ ...metal.defaults, profile: 'sheet', s: 4, sheetW: 1.5, sheetL: 6, count: 3 })
    expect(metric(r, 'Масса одного листа')).toBeCloseTo(4 * 7.85 * 9, 6)
  })
})

describe('concrete', () => {
  it('computes strip foundation volume, waste and mixer trips', () => {
    const r = computeConcrete({ ...concrete.defaults, shape: 'strip', stripL: 36, stripW: 0.4, stripH: 1.2, waste: 0, mixer: 9 })
    expect(metric(r, 'Объём конструкции')).toBeCloseTo(17.28, 6)
    expect(metric(r, 'Рейсов миксера')).toBe(2)
    expect(r.lines[0].priceKey).toBe('concrete-M250')
  })

  it('derives a plausible mix', () => {
    const m = concreteMix('M200', 'm400')
    expect(m.cementKg).toBeGreaterThan(230)
    expect(m.cementKg).toBeLessThan(300)
    const r = computeConcrete({ ...concrete.defaults, shape: 'volume', volume: 1, waste: 0, supply: 'self', grade: 'M200', cement: 'm400', bag: 50 })
    expect(metric(r, 'Мешков по 50 кг')).toBe(Math.ceil(m.cementKg / 50))
  })
})

describe('rebar', () => {
  it('adds laps for runs longer than a stock bar', () => {
    expect(withLaps(10, 11.7, 0.48)).toBe(10)
    expect(withLaps(20, 11.7, 0.48)).toBeCloseTo(20.48, 6)
  })

  it('computes a slab mesh', () => {
    const r = computeRebar({ ...rebar.defaults, type: 'slab', slabL: 6.1, slabW: 4.1, cover: 50, step: 200, layers: 1, d: '12' })
    // 6 m × 4 m net: 21 bars along 6 m and 31 bars along 4 m
    expect(metric(r, 'Стержней в слое')).toBe(21 + 31)
    const metres = 21 * 6 + 31 * 4
    expect(metric(r, 'Масса арматуры')).toBeCloseTo((metres * 0.888) / 1000, 6)
  })
})

describe('masonry', () => {
  it('uses standard brick counts per m²', () => {
    expect(brickWallThickness(3, 250, 120, 10)).toBe(380)
    const r = computeMasonry({ ...masonry.defaults, length: 10, height: 1, openings: [], waste: 0, thickness: '1' })
    expect(metric(r, 'Кирпичей на 1 м²')).toBeCloseTo(102.56, 1)
  })

  it('uses glue for thin-joint blocks', () => {
    const r = computeMasonry({ ...masonry.defaults, material: 'block', joint: 3, length: 10, height: 3, openings: [], waste: 0 })
    expect(r.lines.some((l) => l.priceKey === 'mix-block-glue')).toBe(true)
    // glue ≈ 25–30 kg per m³ of masonry for 600×250 blocks with a 3 mm joint
    const vol = metric(r, 'Объём кладки')!
    const kg = metric(r, 'Клей')!
    expect(kg / vol).toBeGreaterThan(24)
    expect(kg / vol).toBeLessThan(32)
  })
})

describe('finishing', () => {
  it('grout formula', () => {
    expect(groutKgPerM2(300, 300, 2, 8)).toBeCloseTo(0.1707, 3)
  })

  it('tile pieces with straight layout', () => {
    const r = computeTile({ area: 10, tileL: 500, tileW: 500, joint: 0, tileT: 8, layout: 'straight', perBox: 4, trowel: '8', glueBag: 25, works: false })
    expect(metric(r, 'Плиток')).toBe(43) // 40 × 1.07 = 42.8
    expect(metric(r, 'Коробок')).toBe(11)
  })

  it('wallpaper rolls', () => {
    const r = computeWallpaper({ ...wallpaper.defaults, perimeter: 16, height: 2.5, openings: [], rollWidth: 1.06, rollLength: 10.05, rapport: 0, allowance: 10 })
    expect(metric(r, 'Полос из рулона')).toBe(3) // 10.05 / 2.6
    expect(metric(r, 'Полос')).toBe(16)
    expect(metric(r, 'Рулонов')).toBe(6)
  })

  it('linoleum picks the cheaper orientation', () => {
    const r = computeFlooring({ ...flooring.defaults, type: 'linoleum', roomL: 5, roomW: 3.5, rollWidth: 4 })
    expect(metric(r, 'Погонных метров')).toBeCloseTo(5.1, 6)
  })
})

describe('roof', () => {
  it('gable area = 2 × length × rafter', () => {
    const g = roofGeometry({ type: 'gable', L: 10, W: 8, angle: 30, eave: 0, gableOverhang: 0 })
    expect(g.rafterLen).toBeCloseTo(4 / Math.cos(Math.PI / 6), 6)
    expect(g.area).toBeCloseTo(80 / Math.cos(Math.PI / 6), 6)
  })

  it('hip roof area equals plan / cos', () => {
    const g = roofGeometry({ type: 'hip', L: 12, W: 8, angle: 45, eave: 0, gableOverhang: 0 })
    expect(g.area).toBeCloseTo(96 * Math.SQRT2, 6)
    expect(g.ridge).toBe(4)
  })
})

describe('earth & bulk', () => {
  it('pit volume with vertical walls is a box', () => {
    expect(pitVolume(10, 5, 2, 0)).toBeCloseTo(100, 9)
  })
  it('pit volume with slopes (prismoid)', () => {
    // bottom 10×10, top 14×14, H = 2 (m = 1)
    expect(pitVolume(10, 10, 2, 1)).toBeCloseTo((2 / 6) * (100 + 4 * 144 + 196), 9)
  })
  it('trips are limited by volume or payload', () => {
    expect(truckTrips(25, 20, { m3: 10, tons: 15 })).toBe(3)
    expect(truckTrips(10, 40, { m3: 10, tons: 15 })).toBe(3)
  })
  it('bulk tonnage', () => {
    const r = computeBulk({ ...bulk.defaults, material: 'sand-river', mode: 'volume', volume: 10 })
    expect(metric(r, 'Масса')).toBeCloseTo(16, 6)
  })
})

describe('wood, stairs, insulation, units, fence', () => {
  it('boards per cubic metre', () => {
    const r = computeLumber({ ...lumber.defaults, t: 50, w: 150, length: 6 })
    expect(metric(r, 'Штук в 1 м³')).toBeCloseTo(22.22, 2)
  })
  it('stairs follow the step formula', () => {
    const r = computeStairs({ height: 2800, run: 0, width: 900, riser: 175, works: false })
    expect(metric(r, 'Подъёмов')).toBe(16)
    expect(metric(r, 'Высота подъёма')).toBe(175)
    expect(metric(r, 'Глубина проступи')).toBe(280)
    expect(r.warnings).toEqual([])
  })
  it('insulation thickness for aerated concrete wall', () => {
    const t = requiredInsulation(3.13, 0.14, 300, 0.04)
    expect(t).toBeGreaterThan(30)
    expect(t).toBeLessThan(50)
  })
  it('units', () => {
    const r = convert('pressure', 1, 'mpa')
    expect(r.find((x) => x.id === 'kgfcm2')!.value).toBeCloseTo(10.197, 3)
  })
  it('fence posts and sheets', () => {
    const r = computeFence({ ...fence.defaults, length: 54, gates: 1, gateWidth: 4, step: 2.5 })
    expect(metric(r, 'Столбов')).toBe(20 + 1 + 1)
    expect(metric(r, 'Листов')).toBe(Math.ceil(50 / 1.15))
  })
})
