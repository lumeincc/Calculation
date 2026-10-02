/** Labels, numbering, totals and template rendering for the document flow. Pure functions. */
import { T } from '@/i18n'
import type { VatMode } from '@/lib/estimate'
import { round } from '@/lib/num'
import type { Company } from '@/store/settings'
import type { Contract, ContractKind, ContractStatus, Counterparty, Paper, PaperKind, PaperLine, PaperStatus, Requisites, Signature } from './types'
import { dateLong, moneyWords } from './words'

export const CONTRACT_KINDS: { value: ContractKind; label: string }[] = [
  { value: 'construction', label: T('Строительный подряд') },
  { value: 'subcontract', label: T('Субподряд') },
  { value: 'supply', label: T('Поставка') },
  { value: 'services', label: T('Оказание услуг') },
  { value: 'lease', label: T('Аренда техники') },
  { value: 'other', label: T('Другое') },
]
export const KIND_NAME = Object.fromEntries(CONTRACT_KINDS.map((k) => [k.value, k.label])) as Record<ContractKind, string>

/** How the parties are called in the contract: [client side, contractor side]. Always Russian — it is document text. */
export const PARTY_NAMES: Record<ContractKind, [string, string]> = {
  construction: ['Заказчик', 'Подрядчик'],
  subcontract: ['Генподрядчик', 'Субподрядчик'],
  supply: ['Покупатель', 'Поставщик'],
  services: ['Заказчик', 'Исполнитель'],
  lease: ['Арендатор', 'Арендодатель'],
  other: ['Заказчик', 'Исполнитель'],
}

type Tone = 'zinc' | 'brand' | 'green' | 'red' | 'blue' | 'amber'

export const CONTRACT_STATUS: Record<ContractStatus, { label: string; tone: Tone }> = {
  draft: { label: T('Черновик'), tone: 'zinc' },
  review: { label: T('На согласовании'), tone: 'amber' },
  signing: { label: T('На подписании'), tone: 'blue' },
  active: { label: T('Действует'), tone: 'green' },
  done: { label: T('Исполнен'), tone: 'brand' },
  terminated: { label: T('Расторгнут'), tone: 'red' },
}
export const CONTRACT_FLOW: ContractStatus[] = ['draft', 'review', 'signing', 'active', 'done', 'terminated']

export const PAPER_KINDS: { value: PaperKind; label: string; short: string }[] = [
  { value: 'invoice', label: T('Счёт на оплату'), short: T('Счёт') },
  { value: 'act', label: T('Акт выполненных работ'), short: T('Акт') },
  { value: 'addendum', label: T('Дополнительное соглашение'), short: T('Доп. соглашение') },
  { value: 'letter', label: T('Письмо'), short: T('Письмо') },
  { value: 'other', label: T('Другой документ'), short: T('Документ') },
]
export const PAPER_KIND = Object.fromEntries(PAPER_KINDS.map((k) => [k.value, k])) as Record<PaperKind, (typeof PAPER_KINDS)[number]>

export const PAPER_STATUS: Record<PaperStatus, { label: string; tone: Tone }> = {
  draft: { label: T('Черновик'), tone: 'zinc' },
  sent: { label: T('Отправлен'), tone: 'blue' },
  signed: { label: T('Подписан'), tone: 'green' },
  paid: { label: T('Оплачен'), tone: 'green' },
  cancelled: { label: T('Отменён'), tone: 'red' },
}
/** Statuses that make sense for each kind of paper. */
export const PAPER_FLOW: Record<PaperKind, PaperStatus[]> = {
  invoice: ['draft', 'sent', 'paid', 'cancelled'],
  act: ['draft', 'sent', 'signed', 'cancelled'],
  addendum: ['draft', 'sent', 'signed', 'cancelled'],
  letter: ['draft', 'sent'],
  other: ['draft', 'sent', 'signed', 'cancelled'],
}
/** Kinds whose body is free text rather than a table of lines. */
export const TEXT_PAPERS: PaperKind[] = ['addendum', 'letter', 'other']

export const VAT_OPTIONS = [{ value: 'none', label: T('Нет') }, { value: 'included', label: T('В т.ч.') }, { value: 'on_top', label: T('Сверху') }]

export const emptySignature = (): Signature => ({ signed: false, date: '', signer: '' })

export const EMPTY_REQUISITES: Requisites = {
  name: '', bin: '', address: '', bank: '', iik: '', bik: '', kbe: '', director: '', position: '', represented: '', basis: '', phone: '', email: '',
}

export function companyRequisites(c: Company): Requisites {
  return {
    name: c.name, bin: c.inn, address: c.address, bank: c.bank ?? '', iik: c.iik ?? '', bik: c.bik ?? '', kbe: c.kbe ?? '',
    director: c.signer, position: c.position ?? '', represented: c.represented ?? '', basis: c.basis ?? '', phone: c.phone, email: c.email,
  }
}

/** Next free number for documents of one kind in the current year: «1», «2»… (text before a slash or dash). */
export function nextNumber(existing: { number: string; date: string }[], year = new Date().getFullYear(), suffix = ''): string {
  let max = 0
  for (const e of existing) {
    if (!e.date.startsWith(String(year))) continue
    const n = Number.parseInt(e.number, 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${max + 1}${suffix}`
}

export interface VatTotals {
  net: number
  vat: number
  total: number
}

export function vatTotals(amount: number, mode: VatMode, pct: number): VatTotals {
  const a = round(amount, 2)
  if (mode === 'on_top') {
    const vat = round((a * pct) / 100, 2)
    return { net: a, vat, total: round(a + vat, 2) }
  }
  if (mode === 'included') return { net: a, vat: round((a * pct) / (100 + pct), 2), total: a }
  return { net: a, vat: 0, total: a }
}

export const lineSum = (l: Pick<PaperLine, 'qty' | 'price'>) => round((Number(l.qty) || 0) * (Number(l.price) || 0), 2)

export function paperTotals(p: Pick<Paper, 'lines' | 'vatMode' | 'vatPct'>): VatTotals {
  return vatTotals(p.lines.reduce((s, l) => s + lineSum(l), 0), p.vatMode, p.vatPct)
}

/** Russian VAT phrase for document text. */
export function vatPhrase(t: VatTotals, mode: VatMode, pct: number, fmtMoney: (n: number) => string): string {
  if (mode === 'none') return 'НДС не облагается'
  return `в том числе НДС ${pct}% — ${fmtMoney(t.vat)} тенге`
}

/** Placeholders available in templates, grouped for the editor. */
export const PLACEHOLDERS: { group: string; keys: [string, string][] }[] = [
  {
    group: T('Договор'),
    keys: [
      ['договор.номер', T('Номер')], ['договор.дата', T('Дата')], ['договор.город', T('Город')], ['договор.предмет', T('Предмет')],
      ['договор.объект', T('Объект')], ['договор.сумма', T('Сумма')], ['договор.сумма_прописью', T('Сумма прописью')], ['договор.ндс', T('НДС')],
      ['договор.аванс', T('Аванс, %')], ['договор.срок_оплаты', T('Срок оплаты, дней')], ['договор.гарантия', T('Гарантия, мес.')],
      ['договор.начало', T('Начало работ')], ['договор.окончание', T('Окончание работ')],
    ],
  },
  ...(['заказчик', 'исполнитель'] as const).map((side) => ({
    group: side === 'заказчик' ? T('Заказчик (покупатель)') : T('Исполнитель (подрядчик, поставщик)'),
    keys: [
      ['наименование', T('Наименование')], ['бин', T('БИН / ИИН')], ['адрес', T('Адрес')], ['банк', T('Банк')], ['иик', T('ИИК')], ['бик', T('БИК')],
      ['кбе', T('КБе')], ['руководитель', T('Подписант')], ['должность', T('Должность')], ['в_лице', T('«в лице … действующего на основании …»')],
      ['телефон', T('Телефон')], ['email', 'E-mail'],
    ].map(([k, l]) => [`${side}.${k}`, l] as [string, string]),
  })),
  { group: T('Документ (счёт, акт, письмо)'), keys: [['документ.номер', T('Номер')], ['документ.дата', T('Дата')]] },
  { group: T('Блоки'), keys: [['реквизиты', T('Реквизиты и подписи сторон')]] },
]

function partyContext(prefix: string, r: Requisites): Record<string, string> {
  const inPerson = r.represented
    ? `в лице ${r.represented}, действующего на основании ${r.basis || 'Устава'},`
    : r.basis
      ? `действующий на основании ${r.basis},`
      : ''
  return {
    [`${prefix}.наименование`]: r.name, [`${prefix}.бин`]: r.bin, [`${prefix}.адрес`]: r.address, [`${prefix}.банк`]: r.bank,
    [`${prefix}.иик`]: r.iik, [`${prefix}.бик`]: r.bik, [`${prefix}.кбе`]: r.kbe, [`${prefix}.руководитель`]: r.director,
    [`${prefix}.должность`]: r.position, [`${prefix}.в_лице`]: inPerson, [`${prefix}.телефон`]: r.phone, [`${prefix}.email`]: r.email,
  }
}

/** Both sides of a deal: which requisites are the client's and which the contractor's. */
export function sides(role: Contract['role'], us: Requisites, them: Requisites): { client: Requisites; contractor: Requisites } {
  return role === 'contractor' ? { client: them, contractor: us } : { client: us, contractor: them }
}

export function contractContext(c: Contract, us: Requisites, them: Requisites, fmtMoney: (n: number) => string): Record<string, string> {
  const { client, contractor } = sides(c.role, us, them)
  const t = vatTotals(c.amount, c.vatMode, c.vatPct)
  return {
    'договор.номер': c.number, 'договор.дата': dateLong(c.date), 'договор.город': c.city, 'договор.предмет': c.title,
    'договор.объект': c.object, 'договор.сумма': `${fmtMoney(t.total)} тенге`, 'договор.сумма_прописью': moneyWords(t.total),
    'договор.ндс': vatPhrase(t, c.vatMode, c.vatPct, fmtMoney), 'договор.аванс': String(c.advancePct),
    'договор.срок_оплаты': String(c.paymentDays), 'договор.гарантия': String(c.warrantyMonths),
    'договор.начало': dateLong(c.startDate), 'договор.окончание': dateLong(c.endDate),
    ...partyContext('заказчик', client),
    ...partyContext('исполнитель', contractor),
  }
}

/** Context for addenda and letters: the paper's own number/date plus its contract, if any. */
export function paperContext(p: Paper, contract: Contract | undefined, us: Requisites, them: Requisites, fmtMoney: (n: number) => string): Record<string, string> {
  const base = contract
    ? contractContext(contract, us, them, fmtMoney)
    : (() => {
        const { client, contractor } = sides(p.role, us, them)
        return { ...partyContext('заказчик', client), ...partyContext('исполнитель', contractor) }
      })()
  return { ...base, 'документ.номер': p.number, 'документ.дата': dateLong(p.date) }
}

export type Block =
  | { type: 'h1' | 'h2' | 'p'; text: string }
  | { type: 'split'; left: string; right: string }
  | { type: 'requisites' }
  | { type: 'gap' }

const PH = /\{\{\s*([^}\s]+)\s*\}\}/g

/** Substitutes {{placeholders}}; unknown or empty ones become a blank line to fill in by hand. */
export function fillPlaceholders(text: string, ctx: Record<string, string>): string {
  return text.replace(PH, (_, key: string) => {
    const v = ctx[key]
    return v && v.trim() ? v : '________'
  })
}

/**
 * Tiny markup: «# » centered title, «## » section heading, «a || b» a line with text on both
 * edges (city and date), {{реквизиты}} the parties' details with signatures, blank line = gap.
 */
export function parseBody(body: string, ctx: Record<string, string>): Block[] {
  const out: Block[] = []
  for (const raw of body.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    if (!line) {
      if (out.length && out[out.length - 1].type !== 'gap') out.push({ type: 'gap' })
      continue
    }
    if (/^\{\{\s*реквизиты\s*\}\}$/.test(line)) out.push({ type: 'requisites' })
    else if (line.startsWith('## ')) out.push({ type: 'h2', text: fillPlaceholders(line.slice(3), ctx) })
    else if (line.startsWith('# ')) out.push({ type: 'h1', text: fillPlaceholders(line.slice(2), ctx) })
    else if (line.includes('||')) {
      const [l, r] = line.split('||')
      out.push({ type: 'split', left: fillPlaceholders(l.trim(), ctx), right: fillPlaceholders(r.trim(), ctx) })
    } else out.push({ type: 'p', text: fillPlaceholders(line, ctx) })
  }
  return out
}

/** Placeholders used in a text that the template engine does not know (typos). */
export function unknownPlaceholders(body: string): string[] {
  const known = new Set(PLACEHOLDERS.flatMap((g) => g.keys.map(([k]) => k)))
  return [...new Set([...body.matchAll(PH)].map((m) => m[1]).filter((k) => !known.has(k)))]
}

/** Paid / accepted sums against a contract. */
export function contractProgress(c: Contract, papers: Paper[]) {
  let invoiced = 0
  let paid = 0
  let accepted = 0
  for (const p of papers) {
    if (p.contractId !== c.id || p.status === 'cancelled') continue
    const t = paperTotals(p).total
    if (p.kind === 'invoice') {
      invoiced += t
      if (p.status === 'paid') paid += t
    }
    if (p.kind === 'act' && p.status === 'signed') accepted += t
  }
  const total = vatTotals(c.amount, c.vatMode, c.vatPct).total
  return { total, invoiced: round(invoiced, 2), paid: round(paid, 2), accepted: round(accepted, 2), debt: round(Math.max(0, accepted - paid), 2) }
}

export function counterpartyLabel(c: Counterparty | undefined): string {
  return c ? c.name || T('Без названия') : T('Контрагент не выбран')
}

const RU_MONEY = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** Money as printed in documents (always Russian formatting: «1 234 567,80»). */
export const docMoney = (n: number) => RU_MONEY.format(n)
