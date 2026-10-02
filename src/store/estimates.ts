import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  cloneEstimate, createEstimate, createItem, createSection,
  type Estimate, type EstimateItem, type EstimateSection, type EstimateSettings,
} from '@/lib/estimate'
import { uid } from '@/lib/id'
import { T } from '@/i18n'

type Dir = -1 | 1

interface EstimatesState {
  estimates: Estimate[]
  lastId: string | null
  create(name?: string, settings?: Partial<EstimateSettings>): string
  duplicate(id: string): string | null
  remove(id: string): void
  importEstimate(e: Estimate): string
  patch(id: string, p: Partial<Pick<Estimate, 'name' | 'object' | 'client' | 'notes' | 'docType'>>): void
  setSettings(id: string, s: Partial<EstimateSettings>): void
  setLast(id: string): void
  addSection(id: string, name?: string): string
  patchSection(id: string, sid: string, p: Partial<Pick<EstimateSection, 'name'>>): void
  removeSection(id: string, sid: string): void
  moveSection(id: string, sid: string, dir: Dir): void
  /** Adds items to a section; when `sid` is null a new section named `sectionName` is created. */
  addItems(id: string, sid: string | null, items: Partial<EstimateItem>[], sectionName?: string): string
  patchItem(id: string, sid: string, itemId: string, p: Partial<EstimateItem>): void
  removeItem(id: string, sid: string, itemId: string): void
  duplicateItem(id: string, sid: string, itemId: string): void
  moveItem(id: string, sid: string, itemId: string, dir: Dir): void
}

function move<T>(arr: T[], index: number, dir: Dir): T[] {
  const j = index + dir
  if (index < 0 || j < 0 || j >= arr.length) return arr
  const out = arr.slice()
  ;[out[index], out[j]] = [out[j], out[index]]
  return out
}

export const useEstimates = create<EstimatesState>()(
  persist(
    (set, get) => {
      const update = (id: string, fn: (e: Estimate) => Estimate) =>
        set((s) => ({ estimates: s.estimates.map((e) => (e.id === id ? { ...fn(e), updatedAt: Date.now() } : e)) }))
      const updateSection = (id: string, sid: string, fn: (sec: EstimateSection) => EstimateSection) =>
        update(id, (e) => ({ ...e, sections: e.sections.map((sec) => (sec.id === sid ? fn(sec) : sec)) }))

      return {
        estimates: [],
        lastId: null,
        create(name, settings) {
          const e = createEstimate(name, settings)
          set((s) => ({ estimates: [e, ...s.estimates], lastId: e.id }))
          return e.id
        },
        duplicate(id) {
          const src = get().estimates.find((e) => e.id === id)
          if (!src) return null
          const copy = cloneEstimate(src)
          set((s) => ({ estimates: [copy, ...s.estimates] }))
          return copy.id
        },
        remove: (id) => set((s) => ({ estimates: s.estimates.filter((e) => e.id !== id), lastId: s.lastId === id ? null : s.lastId })),
        importEstimate(e) {
          const copy = cloneEstimate(e, e.name)
          set((s) => ({ estimates: [copy, ...s.estimates] }))
          return copy.id
        },
        patch: (id, p) => update(id, (e) => ({ ...e, ...p })),
        setSettings: (id, p) => update(id, (e) => ({ ...e, settings: { ...e.settings, ...p } })),
        setLast: (id) => set({ lastId: id }),
        addSection(id, name = T('Новый раздел')) {
          const sec = createSection(name)
          update(id, (e) => ({ ...e, sections: [...e.sections, sec] }))
          return sec.id
        },
        patchSection: (id, sid, p) => updateSection(id, sid, (sec) => ({ ...sec, ...p })),
        removeSection: (id, sid) => update(id, (e) => ({ ...e, sections: e.sections.filter((s) => s.id !== sid) })),
        moveSection: (id, sid, dir) =>
          update(id, (e) => ({ ...e, sections: move(e.sections, e.sections.findIndex((s) => s.id === sid), dir) })),
        addItems(id, sid, items, sectionName) {
          const created = items.map((p) => createItem(p))
          let target = sid
          update(id, (e) => {
            const exists = target && e.sections.some((s) => s.id === target)
            if (!exists) {
              const empty = e.sections.length === 1 && e.sections[0].items.length === 0
              const sec = createSection(sectionName ?? T('Новый раздел'), created)
              target = sec.id
              // Replace the untouched default section instead of leaving it empty.
              return { ...e, sections: empty ? [sec] : [...e.sections, sec] }
            }
            return { ...e, sections: e.sections.map((s) => (s.id === target ? { ...s, items: [...s.items, ...created] } : s)) }
          })
          set({ lastId: id })
          return target ?? ''
        },
        patchItem: (id, sid, itemId, p) =>
          updateSection(id, sid, (sec) => ({ ...sec, items: sec.items.map((it) => (it.id === itemId ? { ...it, ...p } : it)) })),
        removeItem: (id, sid, itemId) => updateSection(id, sid, (sec) => ({ ...sec, items: sec.items.filter((it) => it.id !== itemId) })),
        duplicateItem: (id, sid, itemId) =>
          updateSection(id, sid, (sec) => {
            const i = sec.items.findIndex((it) => it.id === itemId)
            if (i < 0) return sec
            const items = sec.items.slice()
            items.splice(i + 1, 0, { ...sec.items[i], id: uid() })
            return { ...sec, items }
          }),
        moveItem: (id, sid, itemId, dir) =>
          updateSection(id, sid, (sec) => ({ ...sec, items: move(sec.items, sec.items.findIndex((it) => it.id === itemId), dir) })),
      }
    },
    { name: 'sr-estimates', version: 1 },
  ),
)
