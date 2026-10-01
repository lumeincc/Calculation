import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_PRICES, PRICE_MAP, type PriceEntry } from '@/data/prices'
import type { MaterialLine } from '@/calculators/types'
import { uid } from '@/lib/id'
import { round } from '@/lib/num'

interface PricesState {
  /** User overrides of catalog prices: key → price. */
  overrides: Record<string, number>
  /** User-added catalog entries. */
  custom: PriceEntry[]
  setPrice(key: string, price: number): void
  resetPrice(key: string): void
  resetAll(): void
  addCustom(entry: Omit<PriceEntry, 'key'>): void
  updateCustom(key: string, patch: Partial<PriceEntry>): void
  removeCustom(key: string): void
}

export const usePrices = create<PricesState>()(
  persist(
    (set) => ({
      overrides: {},
      custom: [],
      setPrice: (key, price) => set((s) => ({ overrides: { ...s.overrides, [key]: price } })),
      resetPrice: (key) =>
        set((s) => {
          const o = { ...s.overrides }
          delete o[key]
          return { overrides: o }
        }),
      resetAll: () => set({ overrides: {} }),
      addCustom: (entry) => set((s) => ({ custom: [...s.custom, { ...entry, key: `custom-${uid()}` }] })),
      updateCustom: (key, patch) => set((s) => ({ custom: s.custom.map((c) => (c.key === key ? { ...c, ...patch } : c)) })),
      removeCustom: (key) => set((s) => ({ custom: s.custom.filter((c) => c.key !== key) })),
    }),
    { name: 'sr-prices', version: 1 },
  ),
)

export function catalogEntries(custom: PriceEntry[]): PriceEntry[] {
  return [...DEFAULT_PRICES, ...custom]
}

export function priceOf(key: string | undefined, overrides: Record<string, number>, custom: PriceEntry[] = []): number {
  if (!key) return 0
  if (key in overrides) return overrides[key]
  return PRICE_MAP[key]?.price ?? custom.find((c) => c.key === key)?.price ?? 0
}

/** Unit price of a calculator line: catalog price × factor (e.g. ₽/кг × 25 кг bag), or its own price. */
export function linePrice(line: MaterialLine, overrides: Record<string, number>, custom: PriceEntry[] = []): number {
  if (line.priceKey) return round(priceOf(line.priceKey, overrides, custom) * (line.priceFactor ?? 1), 2)
  return line.price ?? 0
}
