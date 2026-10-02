import { AlertCircle, Archive, Building2, CalendarClock, FilePlus2, FileSignature, PenLine, Receipt, Upload } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button, ButtonLink } from '@/components/ui/Button'
import { PageHeader, Stat } from '@/components/ui/misc'
import { T, Tf } from '@/i18n'
import { fmtDateTime, money } from '@/lib/format'
import { useSettings } from '@/store/settings'
import { fmtSize } from '../components/format'
import { contractProgress, PAPER_KIND, paperTotals } from '../model'
import { useOffice } from '../store'
import { daysUntil } from '../words'
import { NewContractDialog } from './NewContract'
import { NewPaperDialog } from './PapersPage'

interface Alert {
  key: string
  to: string
  icon: ReactNode
  title: string
  text: string
  urgent?: boolean
}

export function OfficeHome() {
  const contracts = useOffice((s) => s.contracts)
  const papers = useOffice((s) => s.papers)
  const files = useOffice((s) => s.files)
  const cps = useOffice((s) => s.counterparties)
  const company = useSettings((s) => s.company)
  const [newContract, setNewContract] = useState(false)
  const [newPaper, setNewPaper] = useState(false)
  const cpName = useMemo(() => new Map(cps.map((c) => [c.id, c.name])), [cps])

  const stats = useMemo(() => {
    const active = contracts.filter((c) => c.status === 'active')
    let portfolio = 0
    let debt = 0
    for (const c of active) {
      const pr = contractProgress(c, papers)
      portfolio += pr.total - pr.paid
      debt += pr.debt
    }
    const waiting = papers.filter((p) => p.kind === 'invoice' && p.status === 'sent').reduce((s, p) => s + paperTotals(p).total, 0)
    return { active: active.length, portfolio, debt, waiting }
  }, [contracts, papers])

  const alerts = useMemo(() => {
    const out: Alert[] = []
    for (const c of contracts) {
      const who = cpName.get(c.counterpartyId ?? '') || T('контрагент не выбран')
      if (c.status === 'review' || c.status === 'signing')
        out.push({ key: `s${c.id}`, to: `/office/contracts/${c.id}`, icon: <PenLine size={16} />, title: Tf('Договор № {0} — {1}', [c.number, c.status === 'review' ? T('на согласовании') : T('ждёт подписи')]), text: who })
      const left = daysUntil(c.endDate)
      if (c.status === 'active' && left !== null && left <= 14)
        out.push({
          key: `e${c.id}`, to: `/office/contracts/${c.id}`, icon: <CalendarClock size={16} />, urgent: left < 0,
          title: left < 0 ? Tf('Договор № {0}: срок истёк {1} дн. назад', [c.number, -left]) : Tf('Договор № {0}: до окончания {1} дн.', [c.number, left]),
          text: who,
        })
    }
    for (const p of papers) {
      const who = cpName.get(p.counterpartyId ?? '') || ''
      const due = daysUntil(p.dueDate)
      if (p.kind === 'invoice' && p.status === 'sent' && due !== null && due < 0)
        out.push({ key: `i${p.id}`, to: `/office/papers/${p.id}`, icon: <AlertCircle size={16} />, urgent: true, title: Tf('Счёт № {0} просрочен на {1} дн. — {2}', [p.number, -due, money(paperTotals(p).total)]), text: who })
      if (p.kind === 'act' && p.status === 'sent')
        out.push({ key: `a${p.id}`, to: `/office/papers/${p.id}`, icon: <PenLine size={16} />, title: Tf('Акт № {0} ждёт подписи заказчика', [p.number]), text: who })
    }
    return out.sort((a, b) => Number(Boolean(b.urgent)) - Number(Boolean(a.urgent)))
  }, [contracts, papers, cpName])

  const recentFiles = [...files].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6)
  const recentDocs = [
    ...contracts.map((c) => ({ id: c.id, at: c.updatedAt, to: `/office/contracts/${c.id}`, title: Tf('Договор № {0}', [c.number]), sub: cpName.get(c.counterpartyId ?? '') ?? '' })),
    ...papers.map((p) => ({ id: p.id, at: p.updatedAt, to: `/office/papers/${p.id}`, title: `${PAPER_KIND[p.kind].short} № ${p.number}`, sub: cpName.get(p.counterpartyId ?? '') ?? '' })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 6)

  const empty = !contracts.length && !papers.length && !files.length && !cps.length

  return (
    <div>
      <PageHeader
        title={T('Документооборот')}
        subtitle={T('Договоры, счета, акты, подписи и архив документов компании — всё по порядку и в одном месте')}
        actions={
          <>
            <ButtonLink to="/office/files"><Upload size={16} /> {T('Загрузить файлы')}</ButtonLink>
            <Button onClick={() => setNewPaper(true)}><FilePlus2 size={16} /> {T('Счёт или акт')}</Button>
            <Button variant="primary" onClick={() => setNewContract(true)}><FileSignature size={16} /> {T('Новый договор')}</Button>
          </>
        }
      />

      {(!company.name || !company.inn) && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <b>{T('Начните с реквизитов компании.')}</b> {T('Название, БИН, банк и подписант подставляются во все договоры, счета и акты.')}{' '}
          <Link to="/settings" className="font-medium underline">{T('Заполнить')}</Link>
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={T('Действующих договоров')} value={stats.active} />
        <Stat label={T('Осталось получить по ним')} value={money(stats.portfolio)} />
        <Stat label={T('Счета ждут оплаты')} value={money(stats.waiting)} />
        <Stat label={T('Работы приняты, не оплачены')} value={money(stats.debt)} accent={stats.debt > 0} />
      </div>

      {empty ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: <Building2 size={22} />, title: T('1. Добавьте контрагентов'), text: T('Реквизиты заказчиков и поставщиков вводятся один раз.'), to: '/office/counterparties' },
            { icon: <FileSignature size={22} />, title: T('2. Сделайте договор'), text: T('Из шаблона или прямо из сметы: сумма прописью, даты и реквизиты подставятся сами.'), to: '/office/contracts?new=1' },
            { icon: <Archive size={22} />, title: T('3. Сложите документы в архив'), text: T('Сканы, письма, чертежи — по папкам и с метками, с поиском.'), to: '/office/files' },
          ].map((s) => (
            <Link key={s.title} to={s.to} className="card lift block p-5">
              <div className="mb-3 text-zinc-500">{s.icon}</div>
              <div className="font-semibold">{s.title}</div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{s.text}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <section className="card p-5 lg:col-span-2">
            <h2 className="mb-3 font-semibold">{T('Требует внимания')}</h2>
            {alerts.length === 0 ? (
              <p className="text-sm text-zinc-500">{T('Всё в порядке: нет просроченных счетов, документов на подписи и истекающих договоров.')}</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {alerts.slice(0, 12).map((a) => (
                  <li key={a.key}>
                    <Link to={a.to} className="flex items-start gap-3 py-2.5 hover:underline">
                      <span className={`mt-0.5 ${a.urgent ? 'text-red-600' : 'text-zinc-400'}`}>{a.icon}</span>
                      <span className="min-w-0">
                        <span className={`block text-sm font-medium ${a.urgent ? 'text-red-700 dark:text-red-400' : ''}`}>{a.title}</span>
                        {a.text && <span className="block truncate text-xs text-zinc-500">{a.text}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">{T('Недавно изменённые')}</h2>
            {recentDocs.length === 0 ? (
              <p className="text-sm text-zinc-500">{T('Документов пока нет.')}</p>
            ) : (
              <ul className="space-y-2">
                {recentDocs.map((d) => (
                  <li key={d.id}>
                    <Link to={d.to} className="flex items-center gap-2 text-sm hover:underline">
                      <Receipt size={14} className="shrink-0 text-zinc-400" />
                      <span className="font-medium">{d.title}</span>
                      <span className="min-w-0 flex-1 truncate text-zinc-500">{d.sub}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card p-5 lg:col-span-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{T('Последние файлы')}</h2>
              <Link to="/office/files" className="text-sm text-zinc-500 hover:underline">{T('Весь архив')}</Link>
            </div>
            {recentFiles.length === 0 ? (
              <p className="text-sm text-zinc-500">{T('Архив пуст. Загрузите сканы договоров, письма и чертежи — они будут под рукой.')}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {recentFiles.map((f) => (
                  <Link key={f.id} to={f.folderId ? `/office/files?folder=${f.folderId}` : '/office/files'} className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 text-sm hover:border-zinc-400 dark:border-zinc-800">
                    <Archive size={16} className="shrink-0 text-zinc-400" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{f.name}</div>
                      <div className="text-xs text-zinc-500">{fmtSize(f.size)} · {fmtDateTime(f.createdAt)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      {newContract && <NewContractDialog open onClose={() => setNewContract(false)} />}
      {newPaper && <NewPaperDialog open onClose={() => setNewPaper(false)} />}
    </div>
  )
}
