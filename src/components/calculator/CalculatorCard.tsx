import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import type { AnyCalculator } from '@/calculators/registry'

export function CalculatorCard({ calc }: { calc: AnyCalculator }) {
  return (
    <Link to={`/calc/${calc.id}`} className="group card flex gap-3.5 p-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:hover:border-brand-800">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-950/60 dark:text-brand-300">
        <calc.icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 font-medium">
          {calc.title}
          <ArrowRight size={14} className="text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
        </div>
        <p className="mt-0.5 text-sm leading-snug text-zinc-500 dark:text-zinc-400">{calc.short}</p>
      </div>
    </Link>
  )
}
