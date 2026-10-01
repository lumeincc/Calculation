import { Calculator, Search } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { CALCULATORS, CATEGORIES, searchCalculators } from '@/calculators/registry'
import { CalculatorCard } from '@/components/calculator/CalculatorCard'
import { EmptyState, PageHeader } from '@/components/ui/misc'

export function CalculatorsPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const cat = params.get('cat') ?? ''
  const list = searchCalculators(q).filter((c) => !cat || c.category === cat)
  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }
  return (
    <div>
      <PageHeader icon={<Calculator size={22} />} title="Калькуляторы" subtitle={`${CALCULATORS.length} расчётов: металл, фундамент, стены, отделка, кровля, земляные работы`} />
      <div className="relative mb-4">
        <Search size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
        <input className="input h-11 pl-10" placeholder="Что посчитать? Например: швеллер, газобетон, щебень" value={q} onChange={(e) => update({ q: e.target.value })} autoFocus />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        <Chip active={!cat} onClick={() => update({ cat: '' })}>Все</Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} active={cat === c.id} onClick={() => update({ cat: c.id })}>
            <c.icon size={14} /> {c.title}
          </Chip>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Search size={28} />} title="Ничего не найдено" text="Попробуйте другой запрос или сбросьте фильтр." />
      ) : q || cat ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.map((c) => <CalculatorCard key={c.id} calc={c} />)}</div>
      ) : (
        <div className="space-y-8">
          {CATEGORIES.map((c) => {
            const items = list.filter((x) => x.category === c.id)
            if (!items.length) return null
            return (
              <section key={c.id}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                  <c.icon size={16} /> {c.title}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((x) => <CalculatorCard key={x.id} calc={x} />)}</div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700'
      }`}
    >
      {children}
    </button>
  )
}
