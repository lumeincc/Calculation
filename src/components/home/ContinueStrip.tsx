import { ArrowRight, FileSignature, FileSpreadsheet, FolderOpen, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { T, Tf } from '@/i18n'
import { computeTotals } from '@/lib/estimate'
import { fmtDateTime, money } from '@/lib/format'
import { useOffice } from '@/office/store'
import { useDocs } from '@/store/docs'
import { useEstimates } from '@/store/estimates'

interface Entry {
  key: string
  to: string
  icon: LucideIcon
  kicker: string
  title: string
  sub: string
}

/** «Pick up where you left off»: the last estimate, contract and loaded documents. */
export function ContinueStrip() {
  const estimates = useEstimates((s) => s.estimates)
  const contracts = useOffice((s) => s.contracts)
  const cps = useOffice((s) => s.counterparties)
  const docs = useDocs((s) => s.files.filter((f) => f.kind !== 'archive').length)
  const entries: Entry[] = []
  const e = [...estimates].sort((a, b) => b.updatedAt - a.updatedAt)[0]
  if (e) entries.push({ key: 'e', to: `/estimates/${e.id}`, icon: FileSpreadsheet, kicker: T('Смета'), title: e.name, sub: `${money(computeTotals(e).total)} · ${fmtDateTime(e.updatedAt)}` })
  const c = [...contracts].sort((a, b) => b.updatedAt - a.updatedAt)[0]
  if (c)
    entries.push({
      key: 'c', to: `/office/contracts/${c.id}`, icon: FileSignature, kicker: T('Договор'),
      title: Tf('№ {0} · {1}', [c.number, cps.find((x) => x.id === c.counterpartyId)?.name ?? T('без контрагента')]), sub: fmtDateTime(c.updatedAt),
    })
  if (docs) entries.push({ key: 'd', to: '/docs', icon: FolderOpen, kicker: T('Документы'), title: Tf('Загружено файлов: {0}', [docs]), sub: T('тоннаж и позиции уже посчитаны') })
  if (!entries.length) return null
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{T('Продолжить работу')}</h2>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {entries.map((x) => (
          <Link key={x.key} to={x.to} className="group lift card flex w-72 shrink-0 items-center gap-3 p-3 sm:w-auto">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"><x.icon size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">{x.kicker}</span>
              <span className="block truncate text-sm font-semibold">{x.title}</span>
              <span className="block truncate text-xs text-zinc-500">{x.sub}</span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-600 dark:group-hover:text-white" />
          </Link>
        ))}
      </div>
    </section>
  )
}
