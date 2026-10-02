import { Building2, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Field, Segmented, TextInput } from '@/components/ui/Field'
import { EmptyState, PageHeader, Stat } from '@/components/ui/misc'
import { T, Tf } from '@/i18n'
import { money } from '@/lib/format'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { Attachments, Card, ContractStatusBadge, PaperStatusBadge, RequisitesForm } from '../components/parts'
import { contractProgress, PAPER_KIND, paperTotals } from '../model'
import { useOffice } from '../store'
import type { PartyType } from '../types'
import { dateShort } from '../words'
import { NewContractDialog } from './NewContract'

export function CounterpartiesPage() {
  const list = useOffice((s) => s.counterparties)
  const contracts = useOffice((s) => s.contracts)
  const papers = useOffice((s) => s.papers)
  const add = useOffice((s) => s.addCounterparty)
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return list
      .filter((c) => !s || [c.name, c.bin, c.address, c.director, c.phone, c.email, ...c.tags].join(' ').toLowerCase().includes(s))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [list, q])
  const create = () => nav(`/office/counterparties/${add({})}`)

  return (
    <div>
      <PageHeader
        title={T('Контрагенты')}
        subtitle={T('Заказчики, поставщики и субподрядчики с реквизитами — подставляются в договоры и счета')}
        actions={<Button variant="primary" onClick={create}><Plus size={16} /> {T('Новый контрагент')}</Button>}
      />
      {list.length === 0 ? (
        <EmptyState icon={<Building2 size={36} strokeWidth={1.5} />} title={T('Контрагентов пока нет')} text={T('Добавьте заказчика или поставщика один раз — его реквизиты будут подставляться во все документы.')} action={<Button variant="primary" onClick={create}><Plus size={16} /> {T('Новый контрагент')}</Button>} />
      ) : (
        <>
          <div className="relative mb-4 max-w-md">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
            <TextInput className="pl-9" value={q} placeholder={T('Название, БИН, телефон…')} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((c) => {
              const cs = contracts.filter((x) => x.counterpartyId === c.id)
              const debt = cs.reduce((s, x) => s + contractProgress(x, papers).debt, 0)
              const active = cs.filter((x) => x.status === 'active').length
              return (
                <Link key={c.id} to={`/office/counterparties/${c.id}`} className="card lift block p-4">
                  <div className="truncate font-semibold">{c.name || T('Без названия')}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">{c.bin ? Tf('БИН/ИИН {0}', [c.bin]) : T('БИН не указан')}</div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <span>{Tf('Договоров: {0}', [cs.length])}</span>
                    {active > 0 && <span>{Tf('действующих: {0}', [active])}</span>}
                    {debt > 0 && <span className="font-medium text-accent-700 dark:text-accent-300">{Tf('долг {0}', [money(debt)])}</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export function CounterpartyPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const c = useOffice((s) => s.counterparties.find((x) => x.id === id))
  const contracts = useOffice((s) => s.contracts)
  const papers = useOffice((s) => s.papers)
  const { patchCounterparty, removeCounterparty } = useOffice.getState()
  const [creating, setCreating] = useState(false)
  if (!c) return <NotFoundPage />
  const set = (p: Parameters<typeof patchCounterparty>[1]) => patchCounterparty(c.id, p)
  const cs = contracts.filter((x) => x.counterpartyId === c.id)
  const ps = papers.filter((x) => x.counterpartyId === c.id).sort((a, b) => b.date.localeCompare(a.date))
  const sum = cs.reduce(
    (a, x) => {
      const pr = contractProgress(x, papers)
      return { total: a.total + pr.total, paid: a.paid + pr.paid, debt: a.debt + pr.debt }
    },
    { total: 0, paid: 0, debt: 0 },
  )

  return (
    <div>
      <div className="mb-1 text-sm text-zinc-500"><Link to="/office/counterparties" className="hover:underline">{T('Контрагенты')}</Link> /</div>
      <PageHeader
        title={c.name || T('Без названия')}
        subtitle={c.bin ? Tf('БИН/ИИН {0}', [c.bin]) : undefined}
        actions={
          <>
            <Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} /> {T('Договор с ним')}</Button>
            <Button variant="danger" onClick={() => { if (confirm(Tf('Удалить контрагента «{0}»? Договоры и документы останутся без контрагента.', [c.name]))) { removeCounterparty(c.id); nav('/office/counterparties') } }}>
              <Trash2 size={16} /> {T('Удалить')}
            </Button>
          </>
        }
      />
      <div className="stagger mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        <Stat countUp format={money} label={T('Сумма договоров')} value={(sum.total)} />
        <Stat countUp format={money} label={T('Оплачено')} value={(sum.paid)} />
        <Stat countUp format={money} label={T('Принято, но не оплачено')} value={(sum.debt)} accent={sum.debt > 0} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card title={T('Реквизиты')}>
            <div className="mb-4 max-w-xs">
              <Segmented value={c.type} onChange={(v) => set({ type: v as PartyType })} options={[{ value: 'company', label: T('Организация') }, { value: 'person', label: T('ИП / физлицо') }]} />
            </div>
            <RequisitesForm value={c} onChange={set} />
          </Card>
          <Card title={T('Заметки')}>
            <Field label={T('Метки')} hint={T('Через запятую')}>
              <TextInput value={c.tags.join(', ')} onChange={(e) => set({ tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
            </Field>
            <textarea className="input mt-3 min-h-24" value={c.notes} placeholder={T('Контактные лица, особенности работы…')} onChange={(e) => set({ notes: e.target.value })} />
          </Card>
        </div>
        <div className="space-y-5">
          <Card title={T('Договоры')}>
            {cs.length === 0 ? (
              <p className="text-sm text-zinc-500">{T('Договоров с этим контрагентом пока нет.')}</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {cs.map((x) => (
                  <li key={x.id}>
                    <Link to={`/office/contracts/${x.id}`} className="flex items-center gap-3 py-2 text-sm hover:underline">
                      <span className="w-40 shrink-0 font-medium">{Tf('№ {0} от {1}', [x.number, dateShort(x.date)])}</span>
                      <span className="min-w-0 flex-1 truncate text-zinc-500">{x.title}</span>
                      <ContractStatusBadge status={x.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={T('Счета и акты')}>
            {ps.length === 0 ? (
              <p className="text-sm text-zinc-500">{T('Документов пока нет.')}</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {ps.map((p) => (
                  <li key={p.id}>
                    <Link to={`/office/papers/${p.id}`} className="flex items-center gap-3 py-2 text-sm hover:underline">
                      <span className="w-40 shrink-0 font-medium">{PAPER_KIND[p.kind].short} № {p.number}</span>
                      <span className="w-24 text-zinc-500">{dateShort(p.date)}</span>
                      <span className="flex-1 text-right tabular-nums">{p.lines.length ? money(paperTotals(p).total) : ''}</span>
                      <PaperStatusBadge status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Attachments links={{ counterpartyId: c.id }} title={T('Файлы контрагента')} hint={T('Учредительные документы, доверенности, письма.')} />
        </div>
      </div>
      {creating && <NewContractDialog open onClose={() => setCreating(false)} preset={{ counterpartyId: c.id }} />}
    </div>
  )
}
