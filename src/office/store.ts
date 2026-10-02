import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { T, Tf } from '@/i18n'
import { uid } from '@/lib/id'
import { CONTRACT_STATUS, emptySignature, EMPTY_REQUISITES, nextNumber, PAPER_KIND, PAPER_STATUS } from './model'
import { ADDENDUM_BODY, BUILTIN_TEMPLATES, defaultTemplateFor, LETTER_BODY } from './templates'
import type {
  Contract, ContractStatus, Counterparty, Folder, HistoryEntry, Paper, PaperKind, PaperStatus, Signature, StoredFile, Template,
} from './types'
import { todayIso } from './words'

type Side = 'us' | 'them'

interface OfficeState {
  counterparties: Counterparty[]
  contracts: Contract[]
  papers: Paper[]
  templates: Template[]
  folders: Folder[]
  files: StoredFile[]

  addCounterparty(p?: Partial<Counterparty>): string
  patchCounterparty(id: string, p: Partial<Counterparty>): void
  removeCounterparty(id: string): void

  createContract(p?: Partial<Contract>): string
  patchContract(id: string, p: Partial<Contract>): void
  setContractStatus(id: string, s: ContractStatus): void
  signContract(id: string, side: Side, sig: Partial<Signature>): void
  duplicateContract(id: string): string | null
  removeContract(id: string): void

  createPaper(kind: PaperKind, p?: Partial<Paper>): string
  patchPaper(id: string, p: Partial<Paper>): void
  setPaperStatus(id: string, s: PaperStatus): void
  signPaper(id: string, side: Side, sig: Partial<Signature>): void
  duplicatePaper(id: string): string | null
  removePaper(id: string): void

  addTemplate(p: Partial<Template>): string
  patchTemplate(id: string, p: Partial<Template>): void
  removeTemplate(id: string): void

  addFolder(name: string, parentId: string | null): string
  patchFolder(id: string, p: Partial<Pick<Folder, 'name' | 'parentId'>>): void
  /** Removes the folder with its subfolders; returns ids of the files that were inside. */
  removeFolder(id: string): string[]

  addFiles(files: StoredFile[]): void
  patchFile(id: string, p: Partial<StoredFile>): void
  moveFiles(ids: string[], folderId: string | null): void
  removeFiles(ids: string[]): void
}

const log = (text: string): HistoryEntry => ({ at: Date.now(), text })

/** All folder ids in a subtree, the root included. */
export function folderSubtree(folders: Folder[], id: string): Set<string> {
  const out = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const f of folders)
      if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id)
        grew = true
      }
  }
  return out
}

export const useOffice = create<OfficeState>()(
  persist(
    (set, get) => {
      const now = () => Date.now()
      const upContract = (id: string, fn: (c: Contract) => Contract) =>
        set((s) => ({ contracts: s.contracts.map((c) => (c.id === id ? { ...fn(c), updatedAt: now() } : c)) }))
      const upPaper = (id: string, fn: (p: Paper) => Paper) =>
        set((s) => ({ papers: s.papers.map((p) => (p.id === id ? { ...fn(p), updatedAt: now() } : p)) }))

      return {
        counterparties: [],
        contracts: [],
        papers: [],
        templates: [],
        folders: [],
        files: [],

        addCounterparty(p = {}) {
          const c: Counterparty = { ...EMPTY_REQUISITES, id: uid(), type: 'company', notes: '', tags: [], createdAt: now(), updatedAt: now(), ...p }
          set((s) => ({ counterparties: [c, ...s.counterparties] }))
          return c.id
        },
        patchCounterparty: (id, p) => set((s) => ({ counterparties: s.counterparties.map((c) => (c.id === id ? { ...c, ...p, updatedAt: now() } : c)) })),
        removeCounterparty: (id) =>
          set((s) => ({
            counterparties: s.counterparties.filter((c) => c.id !== id),
            contracts: s.contracts.map((c) => (c.counterpartyId === id ? { ...c, counterpartyId: null } : c)),
            papers: s.papers.map((p) => (p.counterpartyId === id ? { ...p, counterpartyId: null } : p)),
            files: s.files.map((f) => (f.counterpartyId === id ? { ...f, counterpartyId: undefined } : f)),
          })),

        createContract(p = {}) {
          const kind = p.kind ?? 'construction'
          const tpl = (p.templateId && [...BUILTIN_TEMPLATES, ...get().templates].find((t) => t.id === p.templateId)) || defaultTemplateFor(kind)
          const date = p.date ?? todayIso()
          const c: Contract = {
            id: uid(),
            number: nextNumber(get().contracts, Number(date.slice(0, 4))),
            date,
            city: '',
            title: '',
            kind,
            role: 'contractor',
            counterpartyId: null,
            object: '',
            amount: 0,
            vatMode: 'none',
            vatPct: 16,
            advancePct: 30,
            paymentDays: 10,
            warrantyMonths: 24,
            startDate: '',
            endDate: '',
            estimateId: null,
            templateId: tpl.id,
            body: tpl.body,
            status: 'draft',
            sign: { us: emptySignature(), them: emptySignature() },
            notes: '',
            tags: [],
            history: [log(T('Договор создан'))],
            createdAt: now(),
            updatedAt: now(),
            ...p,
          }
          set((s) => ({ contracts: [c, ...s.contracts] }))
          return c.id
        },
        patchContract: (id, p) => upContract(id, (c) => ({ ...c, ...p })),
        setContractStatus: (id, status) =>
          upContract(id, (c) => (c.status === status ? c : { ...c, status, history: [...c.history, log(Tf('Статус: {0}', [CONTRACT_STATUS[status].label]))] })),
        signContract: (id, side, sig) =>
          upContract(id, (c) => {
            const next = { ...c.sign, [side]: { ...c.sign[side], ...sig } }
            const history = [...c.history]
            if (sig.signed !== undefined && sig.signed !== c.sign[side].signed)
              history.push(log(sig.signed ? (side === 'us' ? T('Подписан нашей стороной') : T('Подписан контрагентом')) : side === 'us' ? T('Подпись нашей стороны снята') : T('Подпись контрагента снята')))
            // Both signatures → the contract is in force.
            let status = c.status
            if (next.us.signed && next.them.signed && ['draft', 'review', 'signing'].includes(status)) {
              status = 'active'
              history.push(log(Tf('Статус: {0}', [CONTRACT_STATUS.active.label])))
            }
            return { ...c, sign: next, status, history }
          }),
        duplicateContract(id) {
          const src = get().contracts.find((c) => c.id === id)
          if (!src) return null
          const { id: _id, number: _n, ...rest } = src
          return get().createContract({
            ...rest,
            date: todayIso(),
            status: 'draft',
            sign: { us: emptySignature(), them: emptySignature() },
            history: [log(Tf('Создан копированием договора № {0}', [src.number]))],
          })
        },
        removeContract: (id) =>
          set((s) => ({
            contracts: s.contracts.filter((c) => c.id !== id),
            papers: s.papers.map((p) => (p.contractId === id ? { ...p, contractId: null } : p)),
            files: s.files.map((f) => (f.contractId === id ? { ...f, contractId: undefined } : f)),
          })),

        createPaper(kind, p = {}) {
          const date = p.date ?? todayIso()
          const paper: Paper = {
            id: uid(),
            kind,
            number: nextNumber(get().papers.filter((x) => x.kind === kind), Number(date.slice(0, 4))),
            date,
            contractId: null,
            counterpartyId: null,
            role: 'contractor',
            title: '',
            lines: [],
            vatMode: 'none',
            vatPct: 16,
            dueDate: '',
            period: '',
            body: kind === 'addendum' ? ADDENDUM_BODY : kind === 'letter' ? LETTER_BODY : '',
            status: 'draft',
            sign: { us: emptySignature(), them: emptySignature() },
            notes: '',
            history: [log(Tf('{0} создан', [PAPER_KIND[kind].short]))],
            createdAt: now(),
            updatedAt: now(),
            ...p,
          }
          set((s) => ({ papers: [paper, ...s.papers] }))
          return paper.id
        },
        patchPaper: (id, p) => upPaper(id, (x) => ({ ...x, ...p })),
        setPaperStatus: (id, status) =>
          upPaper(id, (p) => (p.status === status ? p : { ...p, status, history: [...p.history, log(Tf('Статус: {0}', [PAPER_STATUS[status].label]))] })),
        signPaper: (id, side, sig) =>
          upPaper(id, (p) => {
            const next = { ...p.sign, [side]: { ...p.sign[side], ...sig } }
            const history = [...p.history]
            if (sig.signed !== undefined && sig.signed !== p.sign[side].signed)
              history.push(log(sig.signed ? (side === 'us' ? T('Подписан нашей стороной') : T('Подписан контрагентом')) : side === 'us' ? T('Подпись нашей стороны снята') : T('Подпись контрагента снята')))
            let status = p.status
            if (next.us.signed && next.them.signed && p.kind !== 'invoice' && p.kind !== 'letter' && (status === 'draft' || status === 'sent')) {
              status = 'signed'
              history.push(log(Tf('Статус: {0}', [PAPER_STATUS.signed.label])))
            }
            return { ...p, sign: next, status, history }
          }),
        duplicatePaper(id) {
          const src = get().papers.find((p) => p.id === id)
          if (!src) return null
          const { id: _id, number: _n, ...rest } = src
          return get().createPaper(src.kind, {
            ...rest,
            date: todayIso(),
            lines: src.lines.map((l) => ({ ...l, id: uid() })),
            status: 'draft',
            sign: { us: emptySignature(), them: emptySignature() },
            history: [log(Tf('Создан копированием документа № {0}', [src.number]))],
          })
        },
        removePaper: (id) =>
          set((s) => ({ papers: s.papers.filter((p) => p.id !== id), files: s.files.map((f) => (f.paperId === id ? { ...f, paperId: undefined } : f)) })),

        addTemplate(p) {
          const t: Template = { id: uid(), name: T('Новый шаблон'), kind: 'other', body: '', updatedAt: now(), ...p, builtin: false }
          set((s) => ({ templates: [...s.templates, t] }))
          return t.id
        },
        patchTemplate: (id, p) => set((s) => ({ templates: s.templates.map((t) => (t.id === id ? { ...t, ...p, updatedAt: now() } : t)) })),
        removeTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

        addFolder(name, parentId) {
          const f: Folder = { id: uid(), name, parentId, createdAt: now() }
          set((s) => ({ folders: [...s.folders, f] }))
          return f.id
        },
        patchFolder: (id, p) => {
          // A folder cannot be moved into itself or its own subfolder.
          if (p.parentId && folderSubtree(get().folders, id).has(p.parentId)) return
          set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, ...p } : f)) }))
        },
        removeFolder(id) {
          const tree = folderSubtree(get().folders, id)
          const gone = get().files.filter((f) => f.folderId && tree.has(f.folderId)).map((f) => f.id)
          set((s) => ({ folders: s.folders.filter((f) => !tree.has(f.id)), files: s.files.filter((f) => !(f.folderId && tree.has(f.folderId))) }))
          return gone
        },

        addFiles: (files) => set((s) => ({ files: [...files, ...s.files] })),
        patchFile: (id, p) => set((s) => ({ files: s.files.map((f) => (f.id === id ? { ...f, ...p, updatedAt: now() } : f)) })),
        moveFiles: (ids, folderId) => {
          const set_ = new Set(ids)
          set((s) => ({ files: s.files.map((f) => (set_.has(f.id) ? { ...f, folderId, updatedAt: now() } : f)) }))
        },
        removeFiles: (ids) => {
          const gone = new Set(ids)
          const clear = (sig: Signature) => (sig.fileId && gone.has(sig.fileId) ? { ...sig, fileId: undefined } : sig)
          set((s) => ({
            files: s.files.filter((f) => !gone.has(f.id)),
            contracts: s.contracts.map((c) => ({ ...c, sign: { us: clear(c.sign.us), them: clear(c.sign.them) } })),
            papers: s.papers.map((p) => ({ ...p, sign: { us: clear(p.sign.us), them: clear(p.sign.them) } })),
          }))
        },
      }
    },
    { name: 'sr-office', version: 1 },
  ),
)

export const allTemplates = (custom: Template[]) => [...BUILTIN_TEMPLATES, ...custom]
