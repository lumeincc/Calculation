/**
 * Document flow (документооборот): counterparties, contracts, invoices/acts and a file archive.
 * Metadata lives in localStorage (zustand), file contents in IndexedDB (see blobs.ts).
 */
import type { VatMode } from '@/lib/estimate'

/** Bank and legal details of a party, as printed in documents. */
export interface Requisites {
  name: string
  /** БИН / ИИН. */
  bin: string
  address: string
  bank: string
  /** ИИК (IBAN). */
  iik: string
  bik: string
  kbe: string
  /** Signer's short name for signatures: «Иванов И. И.». */
  director: string
  /** Signer's position: «Директор». */
  position: string
  /** «в лице …» in the genitive: «директора Иванова Ивана Ивановича». */
  represented: string
  /** «действующего на основании …»: «Устава», «доверенности № 5». */
  basis: string
  phone: string
  email: string
}

export type PartyType = 'company' | 'person'

export interface Counterparty extends Requisites {
  id: string
  type: PartyType
  notes: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export type ContractKind = 'construction' | 'subcontract' | 'supply' | 'services' | 'lease' | 'other'
export type ContractStatus = 'draft' | 'review' | 'signing' | 'active' | 'done' | 'terminated'
/** Our side in the deal: we do the work / supply (contractor) or we pay (client). */
export type Role = 'contractor' | 'client'

export interface Signature {
  signed: boolean
  /** ISO date yyyy-mm-dd. */
  date: string
  signer: string
  /** Archive file with the signed scan. */
  fileId?: string
}

export interface HistoryEntry {
  at: number
  text: string
}

export interface Contract {
  id: string
  number: string
  /** ISO date yyyy-mm-dd. */
  date: string
  city: string
  /** Subject: «устройство металлокаркаса склада». */
  title: string
  kind: ContractKind
  role: Role
  counterpartyId: string | null
  object: string
  amount: number
  vatMode: VatMode
  vatPct: number
  advancePct: number
  paymentDays: number
  warrantyMonths: number
  startDate: string
  endDate: string
  estimateId: string | null
  templateId: string | null
  /** Contract text with {{placeholders}}; values are substituted when shown or printed. */
  body: string
  status: ContractStatus
  sign: { us: Signature; them: Signature }
  notes: string
  tags: string[]
  history: HistoryEntry[]
  createdAt: number
  updatedAt: number
}

export type PaperKind = 'invoice' | 'act' | 'addendum' | 'letter' | 'other'
export type PaperStatus = 'draft' | 'sent' | 'signed' | 'paid' | 'cancelled'

export interface PaperLine {
  id: string
  name: string
  unit: string
  qty: number
  price: number
}

/** Invoice, act of completed works, addendum, letter… */
export interface Paper {
  id: string
  kind: PaperKind
  number: string
  date: string
  contractId: string | null
  counterpartyId: string | null
  role: Role
  title: string
  lines: PaperLine[]
  vatMode: VatMode
  vatPct: number
  /** Payment due date for invoices. */
  dueDate: string
  /** Reporting period for acts: «март 2026». */
  period: string
  /** Free text for addenda and letters (same markup as contracts). */
  body: string
  status: PaperStatus
  sign: { us: Signature; them: Signature }
  notes: string
  history: HistoryEntry[]
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  createdAt: number
}

export interface StoredFile {
  id: string
  name: string
  size: number
  type: string
  folderId: string | null
  tags: string[]
  note: string
  starred: boolean
  contractId?: string
  paperId?: string
  counterpartyId?: string
  createdAt: number
  updatedAt: number
}

export interface Template {
  id: string
  name: string
  kind: ContractKind
  body: string
  builtin?: boolean
  updatedAt: number
}
