import { FileDown, FilePlus2, ListPlus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { specRowFromValues, type MetalValues } from '@/calculators/defs/metal'
import type { ExtraProps } from '@/calculators/types'
import { AddToEstimateDialog } from '@/components/estimate/AddToEstimateDialog'
import { Button, IconButton } from '@/components/ui/Button'
import { NumberInput } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/misc'
import { exportTableXlsx } from '@/lib/export'
import { fmt, money } from '@/lib/format'
import { paintArea, PROFILE_LABEL, PROFILE_PRICE_KEY, priceGroupOf, type ProfileType } from '@/lib/metal'
import { MetalCostPanel } from './MetalCostPanel'
import { round } from '@/lib/num'
import { useMetalSpec, type SpecRow } from '@/store/metalSpec'
import { priceOf, usePrices } from '@/store/prices'
import { toast } from '@/store/toast'
import { T, Tf } from '@/i18n'

/** «Спецификация металла»: rows from the calculator and from documents with total tonnage. */
export function MetalSpecPanel({ values }: ExtraProps<MetalValues>) {
  const rows = useMetalSpec((s) => s.rows)
  const add = useMetalSpec((s) => s.add)
  const patch = useMetalSpec((s) => s.patch)
  const remove = useMetalSpec((s) => s.remove)
  const clear = useMetalSpec((s) => s.clear)
  const overrides = usePrices((s) => s.overrides)
  const custom = usePrices((s) => s.custom)
  const [dialog, setDialog] = useState(false)

  const totalKg = rows.reduce((s, r) => s + r.massKg, 0)
  const cost = rows.reduce((s, r) => s + (r.massKg / 1000) * priceOf(r.priceKey, overrides, custom), 0)
  const byType = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) {
      const type = Object.entries(PROFILE_PRICE_KEY).find(([, k]) => k === r.priceKey)?.[0] as keyof typeof PROFILE_LABEL | undefined
      const label = r.name.split(' ')[0] || (type ? PROFILE_LABEL[type] : T('Прочее'))
      m.set(label, (m.get(label) ?? 0) + r.massKg)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  const costItems = useMemo(
    () =>
      rows.map((r) => {
        const type = (r.profile?.type ?? Object.entries(PROFILE_PRICE_KEY).find(([, k]) => k === r.priceKey)?.[0] ?? 'profilePipe') as ProfileType
        return { group: priceGroupOf(type), massKg: r.massKg, areaM2: r.profile ? paintArea(r.profile, r.massKg) : 0 }
      }),
    [rows],
  )

  const update = (r: SpecRow, p: Partial<SpecRow>) => {
    const next = { ...r, ...p }
    patch(r.id, { ...p, massKg: next.kgPerM * next.length * next.count })
  }

  return (
    <div className="card mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <h2 className="font-semibold">{T('Спецификация металла')}</h2>
          <p className="text-xs text-zinc-500">{T('Соберите позиции из калькулятора и документов — тоннаж и стоимость считаются автоматически')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              add([specRowFromValues(values)])
              toast(T('Позиция добавлена в спецификацию'))
            }}
          >
            <ListPlus size={15} />  {T('Добавить текущий расчёт')}
          </Button>
          {rows.length > 0 && (
            <>
              <Button
                size="sm"
                onClick={() =>
                  exportTableXlsx(
                    T('Спецификация металла'),
                    T('Спецификация'),
                    ['№', T('Профиль'), T('Масса 1 м (м²), кг'), T('Длина (площадь), м'), T('Кол-во, шт'), T('Масса, кг'), T('Масса, т')],
                    [...rows.map((r, i) => [i + 1, r.name, round(r.kgPerM, 3), r.length, r.count, round(r.massKg, 2), round(r.massKg / 1000, 4)]), ['', T('Итого'), null, null, null, round(totalKg, 2), round(totalKg / 1000, 4)]],
                    [5, 40, 16, 16, 12, 14, 12],
                  )
                }
              >
                <FileDown size={15} /> Excel
              </Button>
              <Button size="sm" onClick={() => setDialog(true)}>
                <FilePlus2 size={15} />  {T('В смету')}
              </Button>
              <Button size="sm" variant="danger" onClick={() => confirm(T('Очистить спецификацию?')) && clear()}>
                <Trash2 size={15} />
              </Button>
            </>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState icon={<ListPlus size={28} />} title={T('Спецификация пуста')} text={T('Нажмите «Добавить текущий расчёт» или импортируйте профили из загруженных документов в разделе «Документы».')} />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900/60">
                <tr>
                  <th className="px-4 py-2 font-medium">{T('Профиль')}</th>
                  <th className="px-2 py-2 text-right font-medium">{T('кг/м')}</th>
                  <th className="px-2 py-2 font-medium">{T('Длина, м')}</th>
                  <th className="px-2 py-2 font-medium">{T('Кол-во')}</th>
                  <th className="px-2 py-2 text-right font-medium">{T('Масса, т')}</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">
                      <div>{r.name}</div>
                      {r.source && <div className="text-xs text-zinc-500">{r.source}</div>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmt(r.kgPerM, 3)}</td>
                    <td className="w-28 px-2 py-2">
                      <NumberInput size="sm" value={r.length} onChange={(v) => update(r, { length: v })} aria-label={T('Длина')} />
                    </td>
                    <td className="w-24 px-2 py-2">
                      <NumberInput size="sm" value={r.count} onChange={(v) => update(r, { count: v })} aria-label={T('Количество')} />
                    </td>
                    <td className="px-2 py-2 text-right font-medium tabular-nums">{fmt(r.massKg / 1000, 4)}</td>
                    <td className="pr-2">
                      <IconButton label={T('Удалить')} onClick={() => remove(r.id)}>
                        <Trash2 size={15} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 border-t border-zinc-200 bg-zinc-50 px-4 py-4 sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div>
              <div className="text-xs text-zinc-500">{T('Итоговый тоннаж')}</div>
              <div className="text-2xl font-semibold tabular-nums">{fmt(totalKg / 1000, 3)}  {T('т')}</div>
              <div className="text-xs text-zinc-500 tabular-nums">{fmt(totalKg, 1)}  {T('кг')}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">{T('Стоимость по справочнику')}</div>
              <div className="text-2xl font-semibold tabular-nums">{money(cost)}</div>
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              {byType.map(([label, kg]) => (
                <div key={label} className="flex justify-between gap-2">
                  <span>{label}</span>
                  <span className="tabular-nums">{fmt(kg / 1000, 3)}  {T('т')}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {rows.length > 0 && (
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <MetalCostPanel items={costItems} title={T('Металлоконструкции по спецификации')} />
        </div>
      )}
      {dialog && (
        <AddToEstimateDialog
          open={dialog}
          onClose={() => setDialog(false)}
          defaultSection={T('Металлопрокат')}
          items={rows.map((r) => ({
            kind: 'material' as const,
            name: r.length && r.count ? Tf('{0}, {1} × {2} шт', [r.name, fmt(r.length, 2), r.count]) : r.name,
            unit: T('т'),
            qty: round(r.massKg / 1000, 4),
            price: priceOf(r.priceKey, overrides, custom),
            source: 'metal',
          }))}
        />
      )}
    </div>
  )
}
