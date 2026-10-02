import { AlertTriangle, ClipboardCopy, FilePlus2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CalcResult, MaterialLine } from '@/calculators/types'
import { AddToEstimateDialog } from '@/components/estimate/AddToEstimateDialog'
import { Button } from '@/components/ui/Button'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { NumberInput } from '@/components/ui/Field'
import { Badge } from '@/components/ui/misc'
import { KIND_LABEL, lineTotal } from '@/lib/estimate'
import { fmt, money } from '@/lib/format'
import { round } from '@/lib/num'
import { linePrice, usePrices } from '@/store/prices'
import { toast } from '@/store/toast'

const kindTone = { material: 'zinc', work: 'blue', machine: 'amber', transport: 'green', other: 'zinc' } as const

export function MetricValue({ value, digits = 2, unit }: { value: number; digits?: number; unit?: string }) {
  return (
    <>
      <AnimatedNumber value={value} digits={digits} />
      {unit && <span className="ml-1 text-zinc-500">{unit}</span>}
    </>
  )
}

export function ResultPanel({ result, sectionName, source }: { result: CalcResult; sectionName: string; source: string }) {
  const overrides = usePrices((s) => s.overrides)
  const custom = usePrices((s) => s.custom)
  const setPrice = usePrices((s) => s.setPrice)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [localPrices, setLocalPrices] = useState<Record<string, number>>({})
  const [dialog, setDialog] = useState(false)

  const keyOf = (l: MaterialLine, i: number) => `${i}:${l.name}`
  const priced = useMemo(
    () =>
      result.lines.map((l, i) => {
        const key = keyOf(l, i)
        const price = !l.priceKey && key in localPrices ? localPrices[key] : linePrice(l, overrides, custom)
        return { line: l, key, price, total: lineTotal({ qty: l.qty, price }), on: !excluded.has(key) }
      }),
    [result.lines, overrides, custom, localPrices, excluded],
  )
  const active = priced.filter((p) => p.on)
  const total = active.reduce((s, p) => s + p.total, 0)
  const primary = result.metrics.filter((m) => m.primary)
  const secondary = result.metrics.filter((m) => !m.primary)

  const changePrice = (p: (typeof priced)[number], price: number) => {
    // Catalog-backed prices are remembered in the price catalog for all calculators.
    if (p.line.priceKey) setPrice(p.line.priceKey, round(price / (p.line.priceFactor ?? 1), 4))
    else setLocalPrices((s) => ({ ...s, [p.key]: price }))
  }

  const copy = async () => {
    const rows = [
      ['Наименование', 'Ед.', 'Кол-во', 'Цена', 'Сумма'],
      ...active.map((p) => [p.line.name, p.line.unit, fmt(p.line.qty, 4), fmt(p.price, 2), fmt(p.total, 2)]),
      ['Итого', '', '', '', fmt(total, 2)],
    ]
    await navigator.clipboard.writeText(rows.map((r) => r.join('\t')).join('\n'))
    toast('Таблица скопирована — её можно вставить в Excel')
  }

  return (
    <div className="space-y-4">
      {primary.length > 0 && (
        <div className="stagger grid grid-cols-2 gap-3 xl:grid-cols-3">
          {primary.map((m, i) => (
            <div key={m.label} className={`lift rounded-xl border p-3.5 ${i === 0 ? 'border-accent-200 bg-accent-50 dark:border-accent-900 dark:bg-accent-950/40' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'}`}>
              <div className="text-xs leading-snug font-medium text-zinc-500 dark:text-zinc-400">{m.label}</div>
              <div className={`mt-1 text-xl font-semibold tracking-tight ${i === 0 ? 'text-accent-700 dark:text-accent-300' : ''}`}>
                <MetricValue value={m.value} digits={m.digits} unit={m.unit} />
              </div>
              {m.hint && <div className="mt-0.5 text-xs text-zinc-500">{m.hint}</div>}
            </div>
          ))}
        </div>
      )}

      {result.warnings && result.warnings.length > 0 && (
        <div className="space-y-2">
          {result.warnings.map((w) => (
            <div key={w} className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {secondary.length > 0 && (
        <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">
          {secondary.map((m) => (
            <div key={m.label} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">{m.label}</span>
              <span className="text-right font-medium">
                <MetricValue value={m.value} digits={m.digits} unit={m.unit} />
                {m.hint && <span className="block text-xs font-normal text-zinc-500">{m.hint}</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {priced.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold">Материалы и работы</h3>
            <span className="text-xs text-zinc-500">цены — из справочника, можно изменить</span>
          </div>
          <ul className="stagger divide-y divide-zinc-100 dark:divide-zinc-800">
            {priced.map((p) => (
              <li key={p.key} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${p.on ? '' : 'opacity-45'}`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={p.on}
                  aria-label="Включить в расчёт"
                  onChange={() =>
                    setExcluded((s) => {
                      const n = new Set(s)
                      if (n.has(p.key)) n.delete(p.key)
                      else n.add(p.key)
                      return n
                    })
                  }
                />
                <div className="min-w-0 flex-1 basis-48">
                  <div className="text-sm leading-snug">{p.line.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                    <Badge tone={kindTone[p.line.kind]}>{KIND_LABEL[p.line.kind].one}</Badge>
                    <span className="tabular-nums">
                      {fmt(p.line.qty, 4)} {p.line.unit}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <NumberInput size="sm" className="w-28" value={p.price} unit="₸" onChange={(v) => changePrice(p, v)} aria-label="Цена за единицу" />
                  <div className="w-28 text-right text-sm font-medium tabular-nums">{money(p.total)}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div>
              <div className="text-xs text-zinc-500">Итого по расчёту</div>
              <div className="text-xl font-semibold tabular-nums"><AnimatedNumber value={total} format={money} /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={copy}>
                <ClipboardCopy size={15} /> Копировать
              </Button>
              <Button size="sm" variant="primary" onClick={() => setDialog(true)} disabled={active.length === 0}>
                <FilePlus2 size={15} /> В смету
              </Button>
            </div>
          </div>
        </div>
      )}

      {dialog && (
        <AddToEstimateDialog
          open={dialog}
          onClose={() => setDialog(false)}
          defaultSection={sectionName}
          items={active.map((p) => ({ kind: p.line.kind, name: p.line.name, unit: p.line.unit, qty: p.line.qty, price: p.price, source }))}
        />
      )}
    </div>
  )
}
