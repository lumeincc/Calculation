/** Creating invoices and acts from a contract (and its estimate). */
import { T, Tf } from '@/i18n'
import { computeTotals, lineTotal } from '@/lib/estimate'
import { uid } from '@/lib/id'
import { round } from '@/lib/num'
import { useEstimates } from '@/store/estimates'
import { paperTotals } from './model'
import { useOffice } from './store'
import type { Contract, PaperKind, PaperLine } from './types'
import { dateShort } from './words'

const ref = (c: Contract) => Tf('по договору № {0} от {1}', [c.number, dateShort(c.date)])

/** Estimate items with prices scaled so that their sum equals `amount` (markups, discount spread evenly). */
export function estimateLines(estimateId: string, amount: number): PaperLine[] {
  const e = useEstimates.getState().estimates.find((x) => x.id === estimateId)
  if (!e) return []
  const items = e.sections.flatMap((s) => s.items).filter((i) => i.qty > 0 && i.price > 0)
  const direct = items.reduce((s, i) => s + lineTotal(i), 0)
  if (!items.length || direct <= 0) return []
  const k = amount / direct
  const lines: PaperLine[] = items.map((i) => ({ id: uid(), name: i.name, unit: i.unit, qty: i.qty, price: round(i.price * k, 2) }))
  // Put the rounding remainder into the last line so the act matches the contract to the tiyn.
  const diff = round(amount - lines.reduce((s, l) => s + round(l.qty * l.price, 2), 0), 2)
  const last = lines[lines.length - 1]
  if (diff !== 0) {
    if (last.qty === 1) last.price = round(last.price + diff, 2)
    else lines.push({ id: uid(), name: T('Округление'), unit: T('усл. ед.'), qty: 1, price: diff })
  }
  return lines
}

export type InvoicePreset = 'advance' | 'rest' | 'empty'

export function createForContract(c: Contract, kind: PaperKind, preset: InvoicePreset = 'empty'): string {
  const office = useOffice.getState()
  const base = { contractId: c.id, counterpartyId: c.counterpartyId, role: c.role, vatMode: c.vatMode, vatPct: c.vatPct }
  let lines: PaperLine[] = []
  let title = ''
  if (kind === 'invoice') {
    if (preset === 'advance') {
      lines = [{ id: uid(), name: Tf('Аванс {0}% {1}: {2}', [c.advancePct, ref(c), c.title]), unit: T('усл. ед.'), qty: 1, price: round((c.amount * c.advancePct) / 100, 2) }]
    } else if (preset === 'rest') {
      const invoiced = office.papers
        .filter((p) => p.contractId === c.id && p.kind === 'invoice' && p.status !== 'cancelled')
        .reduce((s, p) => s + p.lines.reduce((a, l) => a + round(l.qty * l.price, 2), 0), 0)
      lines = [{ id: uid(), name: Tf('Окончательный расчёт {0}: {1}', [ref(c), c.title]), unit: T('усл. ед.'), qty: 1, price: round(Math.max(0, c.amount - invoiced), 2) }]
    }
  } else if (kind === 'act') {
    const acted = office.papers
      .filter((p) => p.contractId === c.id && p.kind === 'act' && p.status !== 'cancelled')
      .reduce((s, p) => s + paperTotals({ ...p, vatMode: 'none' }).total, 0)
    const rest = round(Math.max(0, c.amount - acted), 2)
    lines = c.estimateId && acted === 0 ? estimateLines(c.estimateId, c.amount) : []
    if (!lines.length) lines = [{ id: uid(), name: c.title || T('Работы по договору'), unit: T('усл. ед.'), qty: 1, price: rest }]
    title = c.title
  }
  return office.createPaper(kind, { ...base, lines, title })
}

/** Contract fields taken from an estimate: subject, site, amount and VAT. */
export function fromEstimate(id: string): Partial<Contract> {
  const e = useEstimates.getState().estimates.find((x) => x.id === id)
  if (!e) return {}
  const t = computeTotals(e)
  const s = e.settings
  const office = useOffice.getState()
  const match = e.client.trim() && office.counterparties.find((c) => c.name.trim().toLowerCase() === e.client.trim().toLowerCase())
  return {
    estimateId: e.id,
    title: e.name,
    object: e.object,
    amount: s.vatMode === 'on_top' ? t.net : t.total,
    vatMode: s.vatMode,
    vatPct: s.vatPct,
    ...(match ? { counterpartyId: match.id } : {}),
  }
}
