import { ArrowRight, Calculator, FileArchive, FileSpreadsheet, FolderOpen, Plus, Weight } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { CALCULATORS, CATEGORIES } from '@/calculators/registry'
import { CalculatorCard } from '@/components/calculator/CalculatorCard'
import { Button, ButtonLink } from '@/components/ui/Button'
import { computeTotals } from '@/lib/estimate'
import { fmtDateTime, money } from '@/lib/format'
import { useEstimates } from '@/store/estimates'
import { useSettings } from '@/store/settings'

const POPULAR = ['metal', 'concrete', 'rebar', 'masonry', 'bulk', 'roof']

export function HomePage() {
  const estimates = useEstimates((s) => s.estimates)
  const create = useEstimates((s) => s.create)
  const defaults = useSettings((s) => s.estimateDefaults)
  const navigate = useNavigate()
  const recent = [...estimates].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4)

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white px-6 py-8 sm:px-10 sm:py-10 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Расчёты материалов, тоннаж и сметы — в одном месте</h1>
          <p className="mt-3 text-base text-zinc-600 sm:text-lg dark:text-zinc-400">
            {CALCULATORS.length} строительных калькуляторов, спецификация металла по ГОСТ, сметы с НДС, накладными и выгрузкой в Excel. Загрузите архив с проектной документацией — сайт распакует его и найдёт сметы и спецификации.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink to="/docs" variant="primary">
              <FolderOpen size={17} /> Загрузить документы
            </ButtonLink>
            <Button onClick={() => navigate(`/estimates/${create('Новая смета', defaults)}`)}>
              <Plus size={17} /> Новая смета
            </Button>
            <ButtonLink to="/calc/metal">
              <Weight size={17} /> Тоннаж металла
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: <Calculator size={20} />, title: '1. Посчитайте', text: 'Бетон, арматура, кирпич, кровля, отделка, грунт и металл — с учётом запаса и ГОСТ.' },
          { icon: <FileArchive size={20} />, title: '2. Загрузите документы', text: 'PDF, Excel, Word, DXF, ZIP/RAR/7z. Позиции из таблиц и профили металла найдутся сами.' },
          { icon: <FileSpreadsheet size={20} />, title: '3. Соберите смету', text: 'Наценки, НР, СП, НДС 16%, скидки. Выгрузка в Excel с формулами и печать в PDF.' },
        ].map((s) => (
          <div key={s.title} className="card p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{s.icon}</div>
            <h3 className="font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{s.text}</p>
          </div>
        ))}
      </section>

      {recent.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Последние сметы</h2>
            <Link to="/estimates" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">Все сметы</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {recent.map((e) => {
              const t = computeTotals(e)
              return (
                <Link key={e.id} to={`/estimates/${e.id}`} className="card p-4 transition hover:border-brand-300 dark:hover:border-brand-800">
                  <div className="truncate font-medium">{e.name}</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">{money(t.total)}</div>
                  <div className="mt-1 text-xs text-zinc-500">{t.itemsCount} поз. · {fmtDateTime(e.updatedAt)}</div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Популярные расчёты</h2>
          <Link to="/calc" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">
            Все калькуляторы <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {POPULAR.map((id) => CALCULATORS.find((c) => c.id === id)!).map((c) => <CalculatorCard key={c.id} calc={c} />)}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Разделы</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => {
            const n = CALCULATORS.filter((x) => x.category === c.id).length
            return (
              <Link key={c.id} to={`/calc?cat=${c.id}`} className="card flex items-center gap-3 p-4 transition hover:border-brand-300 dark:hover:border-brand-800">
                <c.icon size={20} className="text-brand-600" />
                <span className="flex-1 text-sm font-medium">{c.title}</span>
                <span className="text-xs text-zinc-500 tabular-nums">{n}</span>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
