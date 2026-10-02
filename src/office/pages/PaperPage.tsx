import { Copy, ListRestart, Printer, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, NumberInput, Segmented, Select, TextInput } from '@/components/ui/Field'
import { T, Tf } from '@/i18n'
import type { VatMode } from '@/lib/estimate'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useSettings } from '@/store/settings'
import { toast } from '@/store/toast'
import { estimateLines } from '../actions'
import { BodyEditor } from '../components/BodyEditor'
import { Attachments, Card, History, LinesEditor, SignaturePanel, StatusPicker } from '../components/parts'
import { CounterpartyPicker } from '../components/pickers'
import { companyRequisites, docMoney, EMPTY_REQUISITES, PAPER_FLOW, PAPER_KIND, PAPER_STATUS, paperContext, paperTotals, PARTY_NAMES, sides, TEXT_PAPERS, VAT_OPTIONS } from '../model'
import { useOffice } from '../store'
import type { Role } from '../types'
import { dateShort } from '../words'

export function PaperPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const p = useOffice((s) => s.papers.find((x) => x.id === id))
  const contracts = useOffice((s) => s.contracts)
  const counterparty = useOffice((s) => s.counterparties.find((x) => x.id === p?.counterpartyId))
  const { patchPaper, setPaperStatus, signPaper, duplicatePaper, removePaper } = useOffice.getState()
  const company = useSettings((s) => s.company)
  const contract = contracts.find((c) => c.id === p?.contractId)
  const us = useMemo(() => companyRequisites(company), [company])
  const them = counterparty ?? EMPTY_REQUISITES
  const ctx = useMemo(() => (p ? paperContext(p, contract, us, them, docMoney) : {}), [p, contract, us, them])
  if (!p) return <NotFoundPage />

  const set = (x: Parameters<typeof patchPaper>[1]) => patchPaper(p.id, x)
  const k = PAPER_KIND[p.kind]
  const names = PARTY_NAMES[contract?.kind ?? 'other']
  const { client, contractor } = sides(p.role, us, them)
  const totals = paperTotals(p)
  const isText = TEXT_PAPERS.includes(p.kind)
  const ourName = p.role === 'contractor' ? names[1] : names[0]
  const theirName = p.role === 'contractor' ? names[0] : names[1]

  return (
    <div>
      <div className="mb-1 text-sm text-zinc-500">
        <Link to="/office/papers" className="hover:underline">{T('Счета и акты')}</Link>
        {contract && (
          <>
            {' / '}
            <Link to={`/office/contracts/${contract.id}`} className="hover:underline">{Tf('Договор № {0}', [contract.number])}</Link>
          </>
        )}
      </div>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{Tf('{0} № {1} от {2}', [k.label, p.number || '—', dateShort(p.date) || '—'])}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{counterparty?.name || T('Контрагент не выбран')}</p>
          <div className="mt-3"><StatusPicker value={p.status} flow={PAPER_FLOW[p.kind]} labels={PAPER_STATUS} onChange={(s) => setPaperStatus(p.id, s)} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={`/office/print/paper/${p.id}`} variant="primary"><Printer size={16} /> {T('Печать / PDF')}</ButtonLink>
          <Button onClick={() => { const nid = duplicatePaper(p.id); if (nid) nav(`/office/papers/${nid}`) }}><Copy size={16} /> {T('Дублировать')}</Button>
          <Button variant="danger" onClick={() => { if (confirm(Tf('Удалить «{0} № {1}»?', [k.short, p.number]))) { removePaper(p.id); nav(contract ? `/office/contracts/${contract.id}` : '/office/papers') } }}>
            <Trash2 size={16} /> {T('Удалить')}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {isText ? (
            <Card title={T('Текст документа')}>
              <BodyEditor value={p.body} onChange={(body) => set({ body })} ctx={ctx} names={names} client={client} contractor={contractor} />
            </Card>
          ) : (
            <Card
              title={p.kind === 'act' ? T('Выполненные работы') : T('Позиции')}
              actions={
                contract?.estimateId ? (
                  <Button size="sm" onClick={() => { if (!p.lines.length || confirm(T('Заменить позиции строками из сметы договора?'))) { set({ lines: estimateLines(contract.estimateId!, contract.amount) }); toast(T('Позиции заполнены из сметы')) } }}>
                    <ListRestart size={15} /> {T('Заполнить из сметы')}
                  </Button>
                ) : undefined
              }
            >
              <LinesEditor lines={p.lines} onChange={(lines) => set({ lines })} totals={{ ...totals, mode: p.vatMode, pct: p.vatPct }} />
            </Card>
          )}
          {p.kind !== 'invoice' && (
            <Card title={T('Подписи')}>
              <SignaturePanel sign={p.sign} onSign={(side, s) => signPaper(p.id, side, s)} signers={[us.director, them.director]} names={[ourName, theirName]} links={{ paperId: p.id }} />
            </Card>
          )}
          <Attachments links={{ paperId: p.id }} title={T('Файлы документа')} />
        </div>

        <div className="space-y-5">
          <Card title={T('Реквизиты документа')}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="grid grid-cols-2 gap-3">
                <Field label={T('Номер')} htmlFor="p-num"><TextInput id="p-num" value={p.number} onChange={(e) => set({ number: e.target.value })} /></Field>
                <Field label={T('Дата')} htmlFor="p-date"><TextInput id="p-date" type="date" value={p.date} onChange={(e) => set({ date: e.target.value })} /></Field>
              </div>
              <Field label={T('Договор')} htmlFor="p-contract">
                <Select
                  id="p-contract"
                  value={p.contractId ?? ''}
                  onChange={(v) => {
                    const c = contracts.find((x) => x.id === v)
                    set(c ? { contractId: c.id, counterpartyId: c.counterpartyId, role: c.role, vatMode: c.vatMode, vatPct: c.vatPct } : { contractId: null })
                  }}
                  options={[{ value: '', label: T('— без договора —') }, ...contracts.map((c) => ({ value: c.id, label: Tf('№ {0} от {1}', [c.number, dateShort(c.date)]) }))]}
                />
              </Field>
              <Field label={T('Контрагент')} htmlFor="p-cp"><CounterpartyPicker id="p-cp" value={p.counterpartyId} onChange={(v) => set({ counterpartyId: v })} /></Field>
              <Field label={T('Мы')}>
                <Segmented value={p.role} onChange={(v) => set({ role: v as Role })} options={[{ value: 'contractor', label: T('Исполнитель') }, { value: 'client', label: T('Заказчик') }]} />
              </Field>
              {p.kind === 'invoice' && (
                <Field label={T('Оплатить до')} htmlFor="p-due"><TextInput id="p-due" type="date" value={p.dueDate} onChange={(e) => set({ dueDate: e.target.value })} /></Field>
              )}
              {p.kind === 'act' && (
                <Field label={T('Отчётный период')} htmlFor="p-period"><TextInput id="p-period" value={p.period} placeholder={T('например, март 2026')} onChange={(e) => set({ period: e.target.value })} /></Field>
              )}
              {!isText && (
                <div className="grid grid-cols-[1fr_7rem] gap-3">
                  <Field label={T('НДС')}><Segmented value={p.vatMode} onChange={(v) => set({ vatMode: v as VatMode })} options={VAT_OPTIONS} /></Field>
                  <Field label={T('Ставка')}><NumberInput unit="%" value={p.vatPct} onChange={(v) => set({ vatPct: v })} /></Field>
                </div>
              )}
            </div>
          </Card>
          <Card title={T('Заметки')}>
            <textarea className="input min-h-20" value={p.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Card>
          <Card title={T('История')}><History items={p.history} /></Card>
        </div>
      </div>
    </div>
  )
}
