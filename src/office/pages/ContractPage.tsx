import { AlertTriangle, Copy, FilePlus2, Printer, RefreshCw, Save, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, NumberInput, Segmented, Select, TextInput } from '@/components/ui/Field'
import { Modal, Stat, Tabs } from '@/components/ui/misc'
import { T, Tf } from '@/i18n'
import { computeTotals, type VatMode } from '@/lib/estimate'
import { money } from '@/lib/format'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useEstimates } from '@/store/estimates'
import { useSettings } from '@/store/settings'
import { toast } from '@/store/toast'
import { createForContract, fromEstimate, type InvoicePreset } from '../actions'
import { BodyEditor } from '../components/BodyEditor'
import { Attachments, Card, History, PaperStatusBadge, SignaturePanel, StatusPicker } from '../components/parts'
import { CounterpartyPicker } from '../components/pickers'
import {
  companyRequisites, CONTRACT_FLOW, CONTRACT_KINDS, CONTRACT_STATUS, contractContext, contractProgress, docMoney, EMPTY_REQUISITES,
  PAPER_KIND, PARTY_NAMES, paperTotals, sides, VAT_OPTIONS, vatTotals,
} from '../model'
import { allTemplates, useOffice } from '../store'
import type { ContractKind, PaperKind, Role } from '../types'
import { dateShort } from '../words'

type Tab = 'terms' | 'text' | 'papers' | 'sign' | 'history'

export function ContractPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const c = useOffice((s) => s.contracts.find((x) => x.id === id))
  const papers = useOffice((s) => s.papers)
  const counterparty = useOffice((s) => s.counterparties.find((x) => x.id === c?.counterpartyId))
  const custom = useOffice((s) => s.templates)
  const { patchContract, setContractStatus, signContract, duplicateContract, removeContract, addTemplate } = useOffice.getState()
  const company = useSettings((s) => s.company)
  const estimates = useEstimates((s) => s.estimates)
  const [tab, setTab] = useState<Tab>('terms')
  const [tplOpen, setTplOpen] = useState(false)
  const [tplId, setTplId] = useState('')

  const us = useMemo(() => companyRequisites(company), [company])
  const them = counterparty ?? EMPTY_REQUISITES
  const ctx = useMemo(() => (c ? contractContext(c, us, them, docMoney) : {}), [c, us, them])
  if (!c) return <NotFoundPage />

  const set = (p: Parameters<typeof patchContract>[1]) => patchContract(c.id, p)
  const names = PARTY_NAMES[c.kind]
  const { client, contractor } = sides(c.role, us, them)
  const ourName = c.role === 'contractor' ? names[1] : names[0]
  const theirName = c.role === 'contractor' ? names[0] : names[1]
  const pr = contractProgress(c, papers)
  const mine = papers.filter((p) => p.contractId === c.id).sort((a, b) => b.date.localeCompare(a.date))
  const t = vatTotals(c.amount, c.vatMode, c.vatPct)
  const missingUs = !company.name || !company.inn

  const newPaper = (kind: PaperKind, preset?: InvoicePreset) => nav(`/office/papers/${createForContract(c, kind, preset)}`)

  return (
    <div>
      <div className="mb-1 text-sm text-zinc-500">
        <Link to="/office/contracts" className="hover:underline">{T('Договоры')}</Link> /
      </div>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{Tf('Договор № {0} от {1}', [c.number || '—', dateShort(c.date) || '—'])}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {counterparty ? <Link to={`/office/counterparties/${counterparty.id}`} className="font-medium hover:underline">{counterparty.name || T('Без названия')}</Link> : T('Контрагент не выбран')}
            {c.title && ` · ${c.title}`}
          </p>
          <div className="mt-3"><StatusPicker value={c.status} flow={CONTRACT_FLOW} labels={CONTRACT_STATUS} onChange={(s) => setContractStatus(c.id, s)} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={`/office/print/contract/${c.id}`} variant="primary"><Printer size={16} /> {T('Печать / PDF')}</ButtonLink>
          <Button onClick={() => { const nid = duplicateContract(c.id); if (nid) nav(`/office/contracts/${nid}`) }}><Copy size={16} /> {T('Дублировать')}</Button>
          <Button variant="danger" onClick={() => { if (confirm(Tf('Удалить договор № {0}? Счета, акты и файлы останутся, но потеряют связь с ним.', [c.number]))) { removeContract(c.id); nav('/office/contracts') } }}>
            <Trash2 size={16} /> {T('Удалить')}
          </Button>
        </div>
      </div>

      {missingUs && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{T('Реквизиты вашей компании не заполнены — в договоре будут пустые строки.')} <Link to="/settings" className="font-medium underline">{T('Заполнить в настройках')}</Link></span>
        </div>
      )}

      <div className="stagger mb-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Stat countUp format={money} label={T('Сумма договора')} value={(pr.total)} accent />
        <Stat countUp format={money} label={T('Выставлено счетов')} value={(pr.invoiced)} />
        <Stat countUp format={money} label={T('Оплачено')} value={(pr.paid)} hint={pr.total > 0 ? Tf('{0}% от суммы', [Math.round((pr.paid / pr.total) * 100)]) : undefined} />
        <Stat countUp format={money} label={T('Принято по актам')} value={(pr.accepted)} hint={pr.debt > 0 ? Tf('не оплачено {0}', [money(pr.debt)]) : undefined} />
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'terms', label: T('Условия') },
          { value: 'text', label: T('Текст договора') },
          { value: 'papers', label: <>{T('Счета и акты')} {mine.length ? <span className="text-xs text-zinc-400">{mine.length}</span> : null}</> },
          { value: 'sign', label: T('Подписи и файлы') },
          { value: 'history', label: T('История') },
        ]}
      />
      <div key={tab} className="animate-fade-up mt-5">
        {tab === 'terms' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title={T('Основное')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={T('Номер')} htmlFor="c-num"><TextInput id="c-num" value={c.number} onChange={(e) => set({ number: e.target.value })} /></Field>
                <Field label={T('Дата')} htmlFor="c-date"><TextInput id="c-date" type="date" value={c.date} onChange={(e) => set({ date: e.target.value })} /></Field>
                <Field label={T('Вид договора')} htmlFor="c-kind"><Select id="c-kind" value={c.kind} onChange={(v) => set({ kind: v as ContractKind })} options={CONTRACT_KINDS} /></Field>
                <Field label={T('Город')} htmlFor="c-city"><TextInput id="c-city" value={c.city} placeholder={T('г. Алматы')} onChange={(e) => set({ city: e.target.value })} /></Field>
                <Field label={T('Мы в этом договоре')} className="sm:col-span-2">
                  <Segmented value={c.role} onChange={(v) => set({ role: v as Role })} options={[{ value: 'contractor', label: names[1] }, { value: 'client', label: names[0] }]} />
                </Field>
                <Field label={Tf('Контрагент ({0})', [theirName])} htmlFor="c-cp" className="sm:col-span-2"><CounterpartyPicker id="c-cp" value={c.counterpartyId} onChange={(v) => set({ counterpartyId: v })} /></Field>
                <Field label={T('Предмет договора')} htmlFor="c-title" className="sm:col-span-2"><TextInput id="c-title" value={c.title} placeholder={T('Например: монтаж металлоконструкций склада')} onChange={(e) => set({ title: e.target.value })} /></Field>
                <Field label={T('Объект / место')} htmlFor="c-obj" className="sm:col-span-2"><TextInput id="c-obj" value={c.object} placeholder={T('Адрес или название объекта')} onChange={(e) => set({ object: e.target.value })} /></Field>
                <Field label={T('Метки')} htmlFor="c-tags" className="sm:col-span-2" hint={T('Через запятую: «склад, 2026, срочно»')}>
                  <TextInput id="c-tags" value={c.tags.join(', ')} onChange={(e) => set({ tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
                </Field>
              </div>
            </Card>
            <div className="space-y-5">
              <Card title={T('Цена и оплата')}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={T('Сумма')} htmlFor="c-amount" className="sm:col-span-2"><NumberInput id="c-amount" unit="₸" value={c.amount} onChange={(v) => set({ amount: v })} /></Field>
                  <Field label={T('НДС')}><Segmented value={c.vatMode} onChange={(v) => set({ vatMode: v as VatMode })} options={VAT_OPTIONS} /></Field>
                  <Field label={T('Ставка НДС')}><NumberInput unit="%" value={c.vatPct} onChange={(v) => set({ vatPct: v })} /></Field>
                  <Field label={T('Аванс')}><NumberInput unit="%" value={c.advancePct} onChange={(v) => set({ advancePct: v })} /></Field>
                  <Field label={T('Срок оплаты')}><NumberInput unit={T('дн.')} value={c.paymentDays} onChange={(v) => set({ paymentDays: v })} /></Field>
                </div>
                <p className="mt-3 text-sm text-zinc-500">
                  {T('К оплате:')} <b className="text-zinc-900 dark:text-zinc-100">{money(t.total)}</b>
                  {c.vatMode !== 'none' && ` · ${Tf('НДС {0}%', [c.vatPct])} ${money(t.vat)}`}
                </p>
              </Card>
              <Card title={T('Сроки и гарантия')}>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={T('Начало')}><TextInput type="date" value={c.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
                  <Field label={T('Окончание')}><TextInput type="date" value={c.endDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
                  <Field label={T('Гарантия')}><NumberInput unit={T('мес.')} value={c.warrantyMonths} onChange={(v) => set({ warrantyMonths: v })} /></Field>
                </div>
              </Card>
              <Card title={T('Смета')}>
                <div className="flex flex-wrap gap-2">
                  <Select
                    className="min-w-56 flex-1"
                    value={c.estimateId ?? ''}
                    onChange={(v) => set({ estimateId: v || null })}
                    options={[{ value: '', label: T('— без сметы —') }, ...estimates.map((e) => ({ value: e.id, label: `${e.name} · ${money(computeTotals(e).total)}` }))]}
                  />
                  {c.estimateId && (
                    <>
                      <Button onClick={() => { set(fromEstimate(c.estimateId!)); toast(T('Сумма и НДС обновлены из сметы')) }}><RefreshCw size={15} /> {T('Обновить сумму')}</Button>
                      <ButtonLink to={`/estimates/${c.estimateId}`}>{T('Открыть смету')}</ButtonLink>
                    </>
                  )}
                </div>
              </Card>
              <Card title={T('Заметки')}>
                <textarea className="input min-h-24" value={c.notes} placeholder={T('Для себя: договорённости, контакты, что проверить…')} onChange={(e) => set({ notes: e.target.value })} />
              </Card>
            </div>
          </div>
        )}

        {tab === 'text' && (
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Button onClick={() => setTplOpen(true)}><RefreshCw size={15} /> {T('Взять текст из шаблона')}</Button>
              <Button onClick={() => { const nid = addTemplate({ name: Tf('Шаблон из договора № {0}', [c.number]), kind: c.kind, body: c.body }); toast(T('Шаблон сохранён'), { action: { label: T('Открыть'), to: `/office/templates/${nid}` } }) }}>
                <Save size={15} /> {T('Сохранить как шаблон')}
              </Button>
            </div>
            <BodyEditor value={c.body} onChange={(body) => set({ body })} ctx={ctx} names={names} client={client} contractor={contractor} />
            <Modal
              open={tplOpen}
              onClose={() => setTplOpen(false)}
              title={T('Взять текст из шаблона')}
              footer={
                <>
                  <Button onClick={() => setTplOpen(false)}>{T('Отмена')}</Button>
                  <Button variant="primary" disabled={!tplId} onClick={() => { const tpl = allTemplates(custom).find((x) => x.id === tplId); if (tpl) set({ body: tpl.body, templateId: tpl.id }); setTplOpen(false) }}>
                    {T('Заменить текст')}
                  </Button>
                </>
              }
            >
              <p className="mb-3 text-sm text-zinc-500">{T('Текущий текст договора будет заменён. Поля договора (сумма, даты, реквизиты) не изменятся.')}</p>
              <Select value={tplId} onChange={setTplId} options={[{ value: '', label: T('— выберите шаблон —') }, ...allTemplates(custom).map((x) => ({ value: x.id, label: x.builtin ? T(x.name) : x.name }))]} />
            </Modal>
          </div>
        )}

        {tab === 'papers' && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => newPaper('invoice', 'advance')}><FilePlus2 size={15} /> {Tf('Счёт на аванс {0}%', [c.advancePct])}</Button>
              <Button onClick={() => newPaper('invoice', 'rest')}><FilePlus2 size={15} /> {T('Счёт на остаток')}</Button>
              <Button onClick={() => newPaper('act')}><FilePlus2 size={15} /> {T('Акт выполненных работ')}</Button>
              <Button onClick={() => newPaper('addendum')}><FilePlus2 size={15} /> {T('Доп. соглашение')}</Button>
              <Button onClick={() => newPaper('letter')}><FilePlus2 size={15} /> {T('Письмо')}</Button>
            </div>
            {mine.length === 0 ? (
              <p className="text-sm text-zinc-500">{T('По договору пока нет документов. Создайте счёт на аванс — сумма посчитается сама.')}</p>
            ) : (
              <div className="stagger card divide-y divide-zinc-100 dark:divide-zinc-800">
                {mine.map((p) => (
                  <Link key={p.id} to={`/office/papers/${p.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <span className="w-44 font-medium">{PAPER_KIND[p.kind].short} № {p.number}</span>
                    <span className="w-24 text-zinc-500">{dateShort(p.date)}</span>
                    <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-400">{p.lines[0]?.name ?? p.title}</span>
                    {p.lines.length > 0 && <span className="font-medium tabular-nums">{money(paperTotals(p).total)}</span>}
                    <PaperStatusBadge status={p.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'sign' && (
          <div className="space-y-5">
            <Card title={T('Подписи')}>
              <SignaturePanel sign={c.sign} onSign={(side, s) => signContract(c.id, side, s)} signers={[us.director, them.director]} names={[ourName, theirName]} links={{ contractId: c.id }} />
              <p className="mt-3 text-xs text-zinc-500">{T('Когда обе стороны подписали, договор автоматически получает статус «Действует». Электронная подпись (ЭЦП) появится вместе с сервером.')}</p>
            </Card>
            <Attachments links={{ contractId: c.id }} title={T('Файлы договора')} hint={T('Приложения, сканы, переписка, чертежи. Все файлы также видны в архиве.')} />
          </div>
        )}

        {tab === 'history' && (
          <Card title={T('История')}><History items={c.history} /></Card>
        )}
      </div>
    </div>
  )
}
