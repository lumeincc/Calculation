import { BookOpen, Link2, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { CALCULATORS, CATEGORIES, getCalculator } from '@/calculators/registry'
import type { Values } from '@/calculators/types'
import { CalculatorForm } from '@/components/calculator/CalculatorForm'
import { ResultPanel } from '@/components/calculator/ResultPanel'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/misc'
import { decodeState, encodeState } from '@/lib/share'
import { useCalcInputs } from '@/store/calcInputs'
import { toast } from '@/store/toast'
import { NotFoundPage } from './NotFoundPage'

function merge(defaults: Values, saved: unknown): Values {
  if (!saved || typeof saved !== 'object') return defaults
  const out: Values = { ...defaults }
  for (const k of Object.keys(defaults)) {
    const v = (saved as Values)[k]
    if (v !== undefined && typeof v === typeof defaults[k]) out[k] = v
  }
  return out
}

export function CalculatorPage() {
  const { id } = useParams()
  const def = getCalculator(id)
  if (!def) return <NotFoundPage />
  return <CalculatorView key={def.id} id={def.id} />
}

function CalculatorView({ id }: { id: string }) {
  const def = getCalculator(id)!
  const [params, setParams] = useSearchParams()
  const stored = useCalcInputs((s) => s.inputs[id])
  const save = useCalcInputs((s) => s.set)
  const reset = useCalcInputs((s) => s.reset)
  const [values, setValues] = useState<Values>(() => {
    const fromUrl = params.get('v')
    return merge(def.defaults, fromUrl ? decodeState(fromUrl) : stored)
  })
  const [showMethod, setShowMethod] = useState(false)
  const result = useMemo(() => def.compute(values), [def, values])
  const category = CATEGORIES.find((c) => c.id === def.category)
  const related = CALCULATORS.filter((c) => c.category === def.category && c.id !== def.id)

  const change = (v: Values) => {
    setValues(v)
    save(id, v)
    if (params.has('v')) setParams({}, { replace: true })
  }

  const share = async () => {
    const url = new URL(window.location.href)
    url.hash = `#/calc/${id}?v=${encodeState(values)}`
    await navigator.clipboard.writeText(url.toString())
    toast('Ссылка с параметрами расчёта скопирована')
  }

  const Extra = def.Extra
  return (
    <div>
      <div className="mb-2 text-sm text-zinc-500">
        <Link to="/calc" className="hover:text-zinc-800 dark:hover:text-zinc-200">Калькуляторы</Link>
        <span className="mx-1.5">/</span>
        <Link to={`/calc?cat=${def.category}`} className="hover:text-zinc-800 dark:hover:text-zinc-200">{category?.title}</Link>
      </div>
      <PageHeader
        title={def.title}
        subtitle={def.short}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => { reset(id); setValues(def.defaults) }}>
              <RotateCcw size={15} /> Сбросить
            </Button>
            <Button size="sm" onClick={share}>
              <Link2 size={15} /> Поделиться
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="space-y-4">
          <div className="card p-5">
            <CalculatorForm groups={def.groups} values={values} defaults={def.defaults} onChange={change} />
          </div>
          {def.method && (
            <div className="card">
              <button onClick={() => setShowMethod((s) => !s)} className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-medium">
                <BookOpen size={16} className="text-zinc-500" /> Как считаем
                <span className="ml-auto text-xs text-zinc-500">{showMethod ? 'Скрыть' : 'Показать'}</span>
              </button>
              {showMethod && (
                <ul className="list-disc space-y-1.5 border-t border-zinc-100 px-5 py-4 pl-9 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  {def.method.map((m) => <li key={m}>{m}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="lg:sticky lg:top-6">
          <ResultPanel result={result} sectionName={def.sectionName ?? def.title} source={def.id} />
        </div>
      </div>

      {Extra && <Extra values={values} result={result} />}

      {related.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-zinc-500">Ещё в разделе «{category?.title}»</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((c) => (
              <Link key={c.id} to={`/calc/${c.id}`} className="card flex items-center gap-3 p-3 transition hover:border-brand-300 dark:hover:border-brand-800">
                <c.icon size={18} className="text-brand-600" />
                <span className="text-sm font-medium">{c.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
