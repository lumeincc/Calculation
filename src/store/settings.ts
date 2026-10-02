import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_ESTIMATE_SETTINGS, type EstimateSettings } from '@/lib/estimate'

export type Theme = 'light' | 'dark' | 'system'

export interface Company {
  name: string
  inn: string
  address: string
  phone: string
  email: string
  signer: string
  /** Bank details and signer data for contracts and invoices (document flow). */
  bank?: string
  iik?: string
  bik?: string
  kbe?: string
  position?: string
  represented?: string
  basis?: string
  city?: string
}

interface SettingsState {
  theme: Theme
  company: Company
  estimateDefaults: EstimateSettings
  setTheme(t: Theme): void
  setCompany(c: Partial<Company>): void
  setEstimateDefaults(s: Partial<EstimateSettings>): void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      company: { name: '', inn: '', address: '', phone: '', email: '', signer: '' },
      estimateDefaults: DEFAULT_ESTIMATE_SETTINGS,
      setTheme: (theme) => set({ theme }),
      setCompany: (c) => set((s) => ({ company: { ...s.company, ...c } })),
      setEstimateDefaults: (e) => set((s) => ({ estimateDefaults: { ...s.estimateDefaults, ...e } })),
    }),
    { name: 'sr-settings', version: 1 },
  ),
)

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}
