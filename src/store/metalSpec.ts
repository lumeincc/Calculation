import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from '@/lib/id'
import type { ProfileSpec } from '@/lib/metal'

export interface SpecRow {
  id: string
  name: string
  /** Price key of the catalog entry for this kind of profile. */
  priceKey: string
  kgPerM: number
  length: number
  count: number
  massKg: number
  /** Section, for painting area and price groups (absent in rows saved by older versions). */
  profile?: ProfileSpec
  /** Where the row came from: calculator or a document name. */
  source?: string
}

interface MetalSpecState {
  rows: SpecRow[]
  add(rows: Omit<SpecRow, 'id'>[]): void
  patch(id: string, p: Partial<SpecRow>): void
  remove(id: string): void
  clear(): void
}

/** Specification of rolled metal (тоннаж) collected from the calculator and documents. */
export const useMetalSpec = create<MetalSpecState>()(
  persist(
    (set) => ({
      rows: [],
      add: (rows) => set((s) => ({ rows: [...s.rows, ...rows.map((r) => ({ ...r, id: uid() }))] })),
      patch: (id, p) => set((s) => ({ rows: s.rows.map((r) => (r.id === id ? { ...r, ...p } : r)) })),
      remove: (id) => set((s) => ({ rows: s.rows.filter((r) => r.id !== id) })),
      clear: () => set({ rows: [] }),
    }),
    { name: 'sr-metal-spec', version: 1 },
  ),
)
