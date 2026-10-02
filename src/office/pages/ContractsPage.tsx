import { FileSignature, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Select, TextInput } from '@/components/ui/Field'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { T, Tf } from '@/i18n'
import { money } from '@/lib/format'
import { ContractStatusBadge } from '../components/parts'
import { CONTRACT_FLOW, CONTRACT_KINDS, CONTRACT_STATUS, contractProgress, KIND_NAME } from '../model'
import { useOffice } from '../store'
import type { ContractStatus } from '../types'
import { dateShort, daysUntil } from '../words'
import { NewContractDialog } from './NewContract'

export function ContractsPage() {
  const contracts = useOffice((s) => s.contracts)
  const papers = useOffice((s) => s.papers)
  const counterparties = useOffice((s) => s.counterparties)
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? 'all') as ContractStatus | 'all'
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [creating, setCreating] = useState(params.get('new') === '1')
  const cpName = useMemo(() => new Map(counterparties.map((c) => [c.id, c.name])), [counterparties])

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: contracts.length }
    for (const c of contracts) m[c.status] = (m[c.status] ?? 0) + 1
    return m
  }, [contracts])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return contracts
      .filter((c) => status === 'all' || c.status === status)
      .filter((c) => !kind || c.kind === kind)
      .filter((c) => !s || [c.number, c.title, c.object, cpName.get(c.counterpartyId ?? '') ?? '', ...c.tags].join(' ').toLowerCase().includes(s))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  }, [contracts, status, kind, q, cpName])

  const tab = (value: string, label: string) => (
    <button
      key={value}
      onClick={() => setParams(value === 'all' ? {} : { status: value })}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
        status === value ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900' : 'border-zinc-300 text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100'
      }`}
    >
      {label}
      {counts[value] ? <span className="text-xs opacity-70 tabular-nums">{counts[value]}</span> : null}
    </button>
  )

  return (
    <div>
      <PageHeader
        title={T('Договоры')}
        subtitle={T('Шаблоны, статусы согласования, подписи, счета и акты по каждому договору')}
        actions={<Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} /> {T('Новый договор')}</Button>}
      />
      <div className="stagger mb-4 flex flex-wrap gap-2">
        {tab('all', T('Все'))}
        {CONTRACT_FLOW.map((s) => tab(s, CONTRACT_STATUS[s].label))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
          <TextInput className="pl-9" value={q} placeholder={T('Номер, предмет, объект, контрагент…')} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-56" value={kind} onChange={setKind} options={[{ value: '', label: T('Все виды') }, ...CONTRACT_KINDS]} />
      </div>

      {contracts.length === 0 ? (
        <EmptyState
          icon={<FileSignature size={36} strokeWidth={1.5} />}
          title={T('Договоров пока нет')}
          text={T('Создайте договор из шаблона — реквизиты сторон, сумма прописью и даты подставятся сами. Договор можно сделать прямо из сметы.')}
          action={<Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} /> {T('Новый договор')}</Button>}
        />
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">{T('Ничего не найдено')}</p>
      ) : (
        <>
        <div className="stagger space-y-2 sm:hidden">
          {list.map((c) => {
            const pr = contractProgress(c, papers)
            const pct = pr.total > 0 ? Math.min(100, (pr.paid / pr.total) * 100) : 0
            return (
              <Link key={c.id} to={`/office/contracts/${c.id}`} className="lift card block p-4 active:bg-zinc-50 dark:active:bg-zinc-800/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">№ {c.number || '—'} <span className="font-normal text-zinc-500">· {dateShort(c.date)}</span></div>
                    <div className="truncate text-sm">{cpName.get(c.counterpartyId ?? '') || T('Контрагент не выбран')}</div>
                  </div>
                  <ContractStatusBadge status={c.status} />
                </div>
                {c.title && <div className="mt-1 truncate text-xs text-zinc-500">{c.title}</div>}
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div className="animate-grow h-full origin-left rounded-full bg-zinc-900 transition-[width] duration-700 dark:bg-white" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{money(pr.total)}</span>
                </div>
              </Link>
            )
          })}
        </div>
        <div className="card hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                <th className="px-4 py-2.5 font-medium">{T('№ и дата')}</th>
                <th className="px-4 py-2.5 font-medium">{T('Контрагент и предмет')}</th>
                <th className="px-4 py-2.5 font-medium">{T('Срок')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{T('Сумма')}</th>
                <th className="w-40 px-4 py-2.5 font-medium">{T('Оплачено')}</th>
                <th className="px-4 py-2.5 font-medium">{T('Статус')}</th>
              </tr>
            </thead>
            <tbody className="stagger">
              {list.map((c) => {
                const pr = contractProgress(c, papers)
                const left = c.status === 'active' ? daysUntil(c.endDate) : null
                const pct = pr.total > 0 ? Math.min(100, (pr.paid / pr.total) * 100) : 0
                return (
                  <tr key={c.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <Link to={`/office/contracts/${c.id}`} className="font-semibold hover:underline">№ {c.number || '—'}</Link>
                      <div className="text-xs text-zinc-500">{dateShort(c.date)}</div>
                    </td>
                    <td className="max-w-md px-4 py-3 align-top">
                      <Link to={`/office/contracts/${c.id}`} className="block truncate font-medium hover:underline">{cpName.get(c.counterpartyId ?? '') || T('Контрагент не выбран')}</Link>
                      <div className="truncate text-xs text-zinc-500">{[KIND_NAME[c.kind], c.title].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs whitespace-nowrap">
                      {c.endDate ? Tf('до {0}', [dateShort(c.endDate)]) : '—'}
                      {left !== null && left <= 14 && (
                        <div className={left < 0 ? 'font-medium text-red-600' : 'font-medium text-accent-700 dark:text-accent-300'}>
                          {left < 0 ? Tf('просрочен на {0} дн.', [-left]) : Tf('осталось {0} дн.', [left])}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-medium whitespace-nowrap tabular-nums">{money(pr.total)}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                        <div className="animate-grow h-full origin-left rounded-full bg-zinc-900 transition-[width] duration-700 dark:bg-white" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 tabular-nums">{money(pr.paid)}</div>
                    </td>
                    <td className="px-4 py-3 align-top"><ContractStatusBadge status={c.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
      <NewContractDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
