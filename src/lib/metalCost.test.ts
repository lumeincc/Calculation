import { describe, expect, it } from 'vitest'
import { computeMetalCost, DEFAULT_METAL_COST } from './metalCost'

describe('metal structure cost', () => {
  it('prices metal by group, works by tonne and m², and adds markup', () => {
    const r = computeMetalCost(
      [
        { group: 'profilePipe', massKg: 4000, areaM2: 150 },
        { group: 'sheet', massKg: 1000, areaM2: 25 },
        { group: 'profilePipe', massKg: 1000, areaM2: 40 },
      ],
      500,
      { ...DEFAULT_METAL_COST, groupPrices: { profilePipe: 500_000, sheet: 450_000 }, extraPrice: 900_000, fabrication: 300_000, paint: 2_000, montage: 150_000, delivery: 100_000, markupPct: 10 },
    )
    const sum = (name: string) => r.lines.find((l) => l.name.startsWith(name))!.sum
    expect(sum('Труба профильная')).toBe(2_500_000)
    expect(sum('Лист')).toBe(450_000)
    expect(sum('Настил')).toBe(450_000)
    expect(sum('Изготовление')).toBe(1_800_000) // 6 t of rolled metal
    expect(sum('Окраска')).toBe(430_000) // 215 m²
    expect(sum('Монтаж')).toBe(975_000) // 6.5 t
    expect(r.subtotal).toBe(6_705_000)
    expect(r.total).toBe(7_375_500)
    expect(r.perTonne).toBe(1_134_692.31)
  })

  it('uses one price for all metal when asked', () => {
    const r = computeMetalCost([{ group: 'angle', massKg: 2000, areaM2: 0 }, { group: 'beam', massKg: 1000, areaM2: 0 }], 0, { ...DEFAULT_METAL_COST, singlePrice: true, metalPrice: 400_000 })
    expect(r.total).toBe(1_200_000)
  })
})
