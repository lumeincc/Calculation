import { Plus, Receipt, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextInput } from '@/components/ui/Field'
import { EmptyState, Modal, PageHeader } from '@/components/ui/misc'
import { T, Tf } from '@/i18n'
import { money } from '@/lib/format'
import { createForContract } from '../actions'
import { PaperStatusBadge } from '../components/parts'
import { PAPER_KIND, PAPER_KINDS, PAPER_STATUS, paperTotals } from '../model'
import { useOffice } from '../store'
import type { PaperKind } from '../types'
import { dateShort, daysUntil } from '../words'

export function NewPaperDialog({ open, onClose, kind: initialKind = 'invoice', contractId: initialContract = '' }: { open: boolean; onClose(): void; kind?: PaperKind; contractId?: string }) {
  const nav = useNavigate()
  const contracts = useOffice((s) => s.contracts)
  const cps = useOffice((s) => s.counterparties)
  const create = useOffice((s) => s.createPaper)
  const [kind, setKind] = useState<PaperKind>(initialKind)
  const [contractId, setContractId] = useState(initialContract)
  const name = new Map(cps.map((c) => [c.id, c.name]))
  const submit = () => {
    const c = contracts.find((x) => x.id === contractId)
    const id = c ? createForContract(c, kind, kind === 'invoice' ? 'advance' : 'empty') : create(kind)
    onClose()
    nav(`/office/papers/${id}`)
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={T('Новый документ')}
      footer={
        <>
          <Button onClick={onClose}>{T('Отмена')}</Button>
          <Button variant="primary" onClick={submit}>{T('Создать')}</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label={T('Вид документа')} htmlFor="np-kind"><Select id="np-kind" value={kind} onChange={(v) => setKind(v as PaperKind)} options={PAPER_KINDS} /></Field>
        <Field label={T('По договору')} htmlFor="np-contract" hint={T('Контрагент, НДС и сумма возьмутся из договора.')}>
          <Select
            id="np-contract"
            value={contractId}
            onChange={setContractId}
            options={[{ value: '', label: T('— без договора —') }, ...contracts.map((c) => ({ value: c.id, label: `№ ${c.number} · ${name.get(c.counterpartyId ?? '') || T('Контрагент не выбран')}` }))]}
          />
        </Field>
      </div>
    </Modal>
  )
}

export function PapersPage() {
  const papers = useOffice((s) => s.papers)
  const contracts = useOffice((s) => s.contracts)
  const cps = useOffice((s) => s.counterparties)
  const [params, setParams] = useSearchParams()
  const kind = (params.get('kind') ?? '') as PaperKind | ''
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(params.get('new') === '1')
  const cpName = useMemo(() => new Map(cps.map((c) => [c.id, c.name])), [cps])
  const contractNo = useMemo(() => new Map(contracts.map((c) => [c.id, c.number])), [contracts])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return papers
      .filter((p) => !kind || p.kind === kind)
      .filter((p) => !status || p.status === status)
      .filter((p) => !s || [p.number, p.title, cpName.get(p.counterpartyId ?? '') ?? '', ...p.lines.map((l) => l.name)].join(' ').toLowerCase().includes(s))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  }, [papers, kind, status, q, cpName])

  const unpaid = papers.filter((p) => p.kind === 'invoice' && p.status === 'sent').reduce((s, p) => s + paperTotals(p).total, 0)

  return (
    <div>
      <PageHeader
        title={T('Счета и акты')}
        subtitle={unpaid > 0 ? Tf('Ожидает оплаты по выставленным счетам: {0}', [money(unpaid)]) : T('Счета на оплату, акты выполненных работ, дополнительные соглашения и письма')}
        actions={<Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} /> {T('Новый документ')}</Button>}
      />
      <div className="stagger mb-4 flex flex-wrap gap-2">
        {[{ value: '', short: T('Все') }, ...PAPER_KINDS].map((k) => (
          <button
            key={k.value}
            onClick={() => setParams(k.value ? { kind: k.value } : {})}
            className={`rounded-full border px-3 py-1 text-sm transition ${kind === k.value ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900' : 'border-zinc-300 text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100'}`}
          >
            {k.short}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
          <TextInput className="pl-9" value={q} placeholder={T('Номер, контрагент, позиция…')} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-48" value={status} onChange={setStatus} options={[{ value: '', label: T('Все статусы') }, ...Object.entries(PAPER_STATUS).map(([value, s]) => ({ value, label: s.label }))]} />
      </div>
      {papers.length === 0 ? (
        <EmptyState
          icon={<Receipt size={36} strokeWidth={1.5} />}
          title={T('Документов пока нет')}
          text={T('Счёт или акт удобнее создавать из карточки договора — сумма, НДС и реквизиты подставятся сами.')}
          action={<Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} /> {T('Новый документ')}</Button>}
        />
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">{T('Ничего не найдено')}</p>
      ) : (
        <>
        <div className="stagger space-y-2 sm:hidden">
          {list.map((p) => (
            <Link key={p.id} to={`/office/papers/${p.id}`} className="lift card flex items-center gap-3 p-4 active:bg-zinc-50 dark:active:bg-zinc-800/40">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{PAPER_KIND[p.kind].short} № {p.number} <span className="font-normal text-zinc-500">· {dateShort(p.date)}</span></div>
                <div className="truncate text-sm text-zinc-600 dark:text-zinc-400">{cpName.get(p.counterpartyId ?? '') || '—'}</div>
              </div>
              <div className="text-right">
                {p.lines.length > 0 && <div className="text-sm font-semibold tabular-nums">{money(paperTotals(p).total)}</div>}
                <PaperStatusBadge status={p.status} />
              </div>
            </Link>
          ))}
        </div>
        <div className="card hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                <th className="px-4 py-2.5 font-medium">{T('Документ')}</th>
                <th className="px-4 py-2.5 font-medium">{T('Контрагент')}</th>
                <th className="px-4 py-2.5 font-medium">{T('Договор')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{T('Сумма')}</th>
                <th className="px-4 py-2.5 font-medium">{T('Статус')}</th>
              </tr>
            </thead>
            <tbody className="stagger">
              {list.map((p) => {
                const overdue = p.kind === 'invoice' && p.status === 'sent' && (daysUntil(p.dueDate) ?? 1) < 0
                return (
                  <tr key={p.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3">
                      <Link to={`/office/papers/${p.id}`} className="font-semibold hover:underline">{PAPER_KIND[p.kind].short} № {p.number}</Link>
                      <div className="text-xs text-zinc-500">{dateShort(p.date)}</div>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3">{cpName.get(p.counterpartyId ?? '') || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{p.contractId ? <Link className="hover:underline" to={`/office/contracts/${p.contractId}`}>№ {contractNo.get(p.contractId)}</Link> : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">{p.lines.length ? money(paperTotals(p).total) : '—'}</td>
                    <td className="px-4 py-3">
                      <PaperStatusBadge status={p.status} />
                      {overdue && <div className="mt-1 text-xs font-medium text-red-600">{T('Просрочен')}</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
      {creating && <NewPaperDialog open onClose={() => setCreating(false)} kind={kind || 'invoice'} />}
    </div>
  )
}
