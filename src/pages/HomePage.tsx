import { ArrowRight, Calculator, FileArchive, FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { CALCULATORS, CATEGORIES } from '@/calculators/registry'
import { CalculatorCard } from '@/components/calculator/CalculatorCard'
import { Hero } from '@/components/home/Hero'
import { Recommendations } from '@/components/home/Recommendations'
import { Tour } from '@/components/home/Tour'
import { tourDone } from '@/components/home/tourState'
import { computeTotals } from '@/lib/estimate'
import { fmtDateTime, money } from '@/lib/format'
import { useEstimates } from '@/store/estimates'
import { T } from '@/i18n'

const POPULAR = ['metal', 'concrete', 'rebar', 'masonry', 'bulk', 'roof']

export function HomePage() {
  const estimates = useEstimates((s) => s.estimates)
  const [tour, setTour] = useState(() => !tourDone())
  const recent = [...estimates].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4)

  return (
    <div className="space-y-10">
      {tour && <Tour onClose={() => setTour(false)} />}
      <Hero />
      <Recommendations />

      <section className="stagger grid gap-4 md:grid-cols-3">
        {[
          { icon: <Calculator size={20} />, title: T('1. Посчитайте'), text: T('Бетон, арматура, кирпич, кровля, отделка, грунт и металл — с учётом запаса и ГОСТ.') },
          { icon: <FileArchive size={20} />, title: T('2. Загрузите документы'), text: T('PDF, Excel, Word, DXF, ZIP/RAR/7z. Позиции из таблиц и профили металла найдутся сами.') },
          { icon: <FileSpreadsheet size={20} />, title: T('3. Соберите смету'), text: T('Наценки, НР, СП, НДС 16%, скидки. Выгрузка в Excel с формулами и печать в PDF.') },
        ].map((s) => (
          <div key={s.title} className="lift card p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{s.icon}</div>
            <h3 className="font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{s.text}</p>
          </div>
        ))}
      </section>

      {recent.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{T('Последние сметы')}</h2>
            <Link to="/estimates" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">{T('Все сметы')}</Link>
          </div>
          <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {recent.map((e) => {
              const t = computeTotals(e)
              return (
                <Link key={e.id} to={`/estimates/${e.id}`} className="lift card p-4 transition hover:border-brand-300 dark:hover:border-brand-800">
                  <div className="truncate font-medium">{e.name}</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">{money(t.total)}</div>
                  <div className="mt-1 text-xs text-zinc-500">{t.itemsCount}  {T('поз. ·')} {fmtDateTime(e.updatedAt)}</div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{T('Популярные расчёты')}</h2>
          <Link to="/calc" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">
            
            {T('Все калькуляторы')} <ArrowRight size={14} />
          </Link>
        </div>
        <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {POPULAR.map((id) => CALCULATORS.find((c) => c.id === id)!).map((c) => <CalculatorCard key={c.id} calc={c} />)}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{T('Разделы')}</h2>
        <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => {
            const n = CALCULATORS.filter((x) => x.category === c.id).length
            return (
              <Link key={c.id} to={`/calc?cat=${c.id}`} className="lift card flex items-center gap-3 p-4 transition hover:border-brand-300 dark:hover:border-brand-800">
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
