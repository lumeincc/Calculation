import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Values } from '@/calculators/types'

interface CalcInputsState {
  inputs: Record<string, Values>
  set(id: string, values: Values): void
  reset(id: string): void
}

/** Remembers the last inputs of every calculator between visits. */
export const useCalcInputs = create<CalcInputsState>()(
  persist(
    (set) => ({
      inputs: {},
      set: (id, values) => set((s) => ({ inputs: { ...s.inputs, [id]: values } })),
      reset: (id) =>
        set((s) => {
          const inputs = { ...s.inputs }
          delete inputs[id]
          return { inputs }
        }),
    }),
    { name: 'sr-calc', version: 1 },
  ),
)
