import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_METAL_COST, type MetalCostSettings } from '@/lib/metalCost'

interface MetalCostState {
  settings: MetalCostSettings
  set(p: Partial<MetalCostSettings>): void
}

/** Prices of the last cost calculation — they change from project to project, so only prefilled. */
export const useMetalCost = create<MetalCostState>()(
  persist(
    (set) => ({
      settings: DEFAULT_METAL_COST,
      set: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
    }),
    { name: 'sr-metal-cost', version: 1 },
  ),
)
