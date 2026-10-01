import { describe, expect, it } from 'vitest'
import { computeTotals, createEstimate, createItem, createSection, lineMassKg } from './estimate'

function sample(settings = {}) {
  const e = createEstimate('t', settings)
  e.sections = [
    createSection('A', [
      createItem({ kind: 'material', qty: 2, price: 1000, unit: 'т' }),
      createItem({ kind: 'work', qty: 10, price: 500, unit: 'м²' }),
    ]),
    createSection('B', [
      createItem({ kind: 'machine', qty: 1, price: 2000 }),
      createItem({ kind: 'transport', qty: 1, price: 333.333, unit: 'рейс' }),
    ]),
  ]
  return e
}

describe('estimate totals', () => {
  it('sums by kind and rounds lines to kopecks', () => {
    const t = computeTotals(sample())
    expect(t.byKind.material).toBe(2000)
    expect(t.byKind.work).toBe(5000)
    expect(t.byKind.transport).toBe(333.33)
    expect(t.direct).toBe(9333.33)
    expect(t.total).toBe(9333.33)
    expect(t.massKg).toBe(2000)
  })

  it('applies markup, overhead, profit, contingency, discount and VAT on top', () => {
    const t = computeTotals(sample({ materialsMarkupPct: 10, overheadPct: 12, profitPct: 8, contingencyPct: 2, discountPct: 5, vatMode: 'on_top', vatPct: 22 }))
    expect(t.materialsMarkup).toBe(200)
    expect(t.overhead).toBe(840) // 12% of 7000
    expect(t.profit).toBe(560)
    expect(t.contingency).toBe(218.67) // 2% of 10933.33
    expect(t.subtotal).toBe(11152)
    expect(t.discount).toBe(557.6)
    expect(t.net).toBe(10594.4)
    expect(t.vat).toBe(2330.77)
    expect(t.total).toBe(12925.17)
  })

  it('extracts VAT when included', () => {
    const t = computeTotals(sample({ vatMode: 'included', vatPct: 20 }))
    expect(t.total).toBe(9333.33)
    expect(t.vat).toBe(1555.56)
  })

  it('recognises mass units', () => {
    expect(lineMassKg({ qty: 1.5, unit: 'т' })).toBe(1500)
    expect(lineMassKg({ qty: 15, unit: 'кг' })).toBe(15)
    expect(lineMassKg({ qty: 15, unit: 'м' })).toBe(0)
  })
})
