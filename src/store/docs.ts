import { create } from 'zustand'
import { analyzeDoc } from '@/docs/analyze'
import type { DocAnalysis, DocFile } from '@/docs/types'
import { unpackAll, type InputFile } from '@/docs/unpack'

interface DocsState {
  files: DocFile[]
  analyses: Record<string, DocAnalysis>
  warnings: string[]
  busy: boolean
  progress: { done: number; total: number; label: string }
  selectedId: string | null
  ingest(inputs: InputFile[]): Promise<void>
  select(id: string | null): void
  remove(id: string): void
  clear(): void
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

/**
 * Uploaded documents live only in memory of this tab: nothing is sent to a server and nothing
 * large is written to localStorage.
 */
export const useDocs = create<DocsState>()((set, get) => ({
  files: [],
  analyses: {},
  warnings: [],
  busy: false,
  progress: { done: 0, total: 0, label: '' },
  selectedId: null,

  async ingest(inputs) {
    if (!inputs.length) return
    set({ busy: true, progress: { done: 0, total: inputs.length, label: 'Чтение файлов…' } })
    try {
      const { files, warnings } = await unpackAll(inputs, {
        sevenZip: async (data, ext) => (await import('@/docs/sevenzip')).extractWith7z(data, ext),
        onProgress: (label) => set((s) => ({ progress: { ...s.progress, label } })),
      })
      const pending: Record<string, DocAnalysis> = {}
      for (const f of files) pending[f.id] = { status: 'pending', text: '', tables: [], positions: [], metal: [] }
      set((s) => ({
        files: [...s.files, ...files],
        analyses: { ...s.analyses, ...pending },
        warnings: [...s.warnings, ...warnings],
        selectedId: s.selectedId ?? files.find((f) => f.kind !== 'archive')?.id ?? null,
        progress: { done: 0, total: files.length, label: 'Анализ документов…' },
      }))
      let done = 0
      for (const f of files) {
        set((s) => ({ progress: { done, total: files.length, label: f.name }, analyses: { ...s.analyses, [f.id]: { ...s.analyses[f.id], status: 'processing' } } }))
        await tick()
        const a = await analyzeDoc(f)
        done++
        // The file may have been removed while it was being analysed.
        if (get().files.some((x) => x.id === f.id)) set((s) => ({ analyses: { ...s.analyses, [f.id]: a } }))
      }
    } finally {
      set((s) => ({ busy: false, progress: { ...s.progress, label: '' } }))
    }
  },

  select: (id) => set({ selectedId: id }),

  remove(id) {
    const all = get().files
    const drop = new Set([id])
    let grew = true
    while (grew) {
      grew = false
      for (const f of all) {
        if (f.parentId && drop.has(f.parentId) && !drop.has(f.id)) {
          drop.add(f.id)
          grew = true
        }
      }
    }
    set((s) => {
      const analyses = { ...s.analyses }
      for (const d of drop) delete analyses[d]
      return {
        files: s.files.filter((f) => !drop.has(f.id)),
        analyses,
        selectedId: s.selectedId && drop.has(s.selectedId) ? null : s.selectedId,
      }
    })
  },

  clear: () => set({ files: [], analyses: {}, warnings: [], selectedId: null }),
}))
