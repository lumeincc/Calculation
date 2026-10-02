import { Calculator, FilePlus2 } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Button } from '@/components/ui/Button'
import { Field, NumberInput, Segmented } from '@/components/ui/Field'
import { createItem, createSection } from '@/lib/estimate'
import { fmt, money } from '@/lib/format'
import { PRICE_GROUP_LABEL } from '@/lib/metal'
import { computeMetalCost, costGroups, type CostItem } from '@/lib/metalCost'
import { useEstimates } from '@/store/estimates'
import { useMetalCost } from '@/store/metalCost'
import { useSettings } from '@/store/settings'
import { toast } from '@/store/toast'

/**
 * «Стоимость металлоконструкции»: prices are typed per project (they differ every time),
 * the last ones are remembered as a starting point.
 */
export function MetalCostPanel({ items, extraKg = 0, title }: { items: CostItem[]; extraKg?: number; title: string }) {
  const s = useMetalCost((x) => x.settings)
  const set = useMetalCost((x) => x.set)
  const defaults = useSettings((x) => x.estimateDefaults)
  const navigate = useNavigate()
  const groups = useMemo(() => costGroups(items), [items])
  const r = useMemo(() => computeMetalCost(items, extraKg, s), [items, extraKg, s])

  const toEstimate = () => {
    const store = useEstimates.getState()
    const id = store.create(title, defaults)
    const sections = (['Металл', 'Работы', 'Доставка и прочее'] as const)
      .map((name) => createSection(name, r.lines.filter((l) => l.section === name).map((l) => createItem({ kind: l.kind, name: l.name, unit: l.unit, qty: l.qty, price: l.price, source: 'metal-cost' }))))
      .filter((sec) => sec.items.length)
    useEstimates.setState((st) => ({ estimates: st.estimates.map((e) => (e.id === id ? { ...e, docType: 'offer', sections } : e)) }))
    toast('Смета по металлоконструкции создана')
    navigate(`/estimates/${id}`)
  }

  if (!groups.length && !extraKg) return null
  const price = (label: string, value: number, onChange: (v: number) => void, unit = '₸/т', hint?: string) => (
    <Field label={label} hint={hint}>
      <NumberInput value={value} unit={unit} onChange={onChange} />
    </Field>
  )

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Calculator size={18} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Стоимость металлоконструкции</h3>
          <p className="text-xs text-zinc-500">Введите цены этого проекта — последние введённые запоминаются. Площадь окраски считается по профилям.</p>
        </div>
      </div>
      <div className="grid gap-6 p-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label="Цена металла">
            <Segmented value={s.singlePrice ? 'one' : 'groups'} onChange={(v) => set({ singlePrice: v === 'one' })} options={[{ value: 'groups', label: 'По видам профиля' }, { value: 'one', label: 'Одна на всё' }]} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            {s.singlePrice
              ? price('Металл', s.metalPrice, (v) => set({ metalPrice: v }))
              : groups.map((g) => (
                  <div key={g.group}>
                    {price(`${PRICE_GROUP_LABEL[g.group]} · ${fmt(g.massKg / 1000, 3)} т`, s.groupPrices[g.group] ?? 0, (v) => set({ groupPrices: { ...s.groupPrices, [g.group]: v } }))}
                  </div>
                ))}
            {extraKg > 0 && price(`Настил, метизы · ${fmt(extraKg / 1000, 3)} т`, s.extraPrice, (v) => set({ extraPrice: v }))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {price('Изготовление', s.fabrication, (v) => set({ fabrication: v }))}
            {price('Окраска', s.paint, (v) => set({ paint: v }), '₸/м²', `Площадь: ${fmt(r.areaM2, 1)} м²`)}
            {price('Монтаж', s.montage, (v) => set({ montage: v }))}
            {price('Доставка', s.delivery, (v) => set({ delivery: v }), '₸', 'Сумма за всё')}
            {price('Наценка', s.markupPct, (v) => set({ markupPct: v }), '%')}
          </div>
        </div>
        <div className="flex flex-col">
          <div className="stagger divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {r.lines.map((l) => (
              <div key={l.name} className="flex items-baseline gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">{l.name}</span>
                <span className="text-xs text-zinc-500 tabular-nums">
                  {fmt(l.qty, 3)} {l.unit} × {fmt(l.price, 0)}
                </span>
                <span className="w-32 text-right font-medium tabular-nums">{money(l.sum)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-accent-200 bg-accent-50 p-4 dark:border-accent-900 dark:bg-accent-950/40">
            <div className="text-xs text-zinc-600 dark:text-zinc-400">Итого за конструкцию · {fmt(r.tonnes, 3)} т</div>
            <div className="text-2xl font-semibold text-accent-700 dark:text-accent-300">
              <AnimatedNumber value={r.total} format={money} />
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              за 1 т: <span className="tabular-nums">{money(r.perTonne)}</span>
            </div>
          </div>
          <Button variant="primary" className="mt-3 self-start" disabled={r.total <= 0} onClick={toEstimate}>
            <FilePlus2 size={16} /> Создать КП / смету
          </Button>
        </div>
      </div>
    </div>
  )
}
