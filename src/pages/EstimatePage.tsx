import {
  ArrowDown, ArrowUp, Calculator, Copy, FileDown, FileJson, FileText, MoreHorizontal, Plus, Printer, Tags, Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CatalogPicker } from '@/components/estimate/CatalogPicker'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { Field, NumberInput, Segmented, TextInput } from '@/components/ui/Field'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Badge } from '@/components/ui/misc'
import {
  computeTotals, KIND_LABEL, KINDS, lineTotal, sectionTotal, UNITS,
  type Estimate, type EstimateItem, type EstimateSection, type ItemKind, type VatMode,
} from '@/lib/estimate'
import { downloadBlob, exportEstimateCsv, exportEstimateXlsx, safeFileName } from '@/lib/export'
import { fmt, money } from '@/lib/format'
import { useEstimates } from '@/store/estimates'
import { useSettings } from '@/store/settings'
import { NotFoundPage } from './NotFoundPage'

const KIND_TONE: Record<ItemKind, 'zinc' | 'blue' | 'amber' | 'green'> = { material: 'zinc', work: 'blue', machine: 'amber', transport: 'green', other: 'zinc' }

function ItemRow({ e, sec, it, index }: { e: Estimate; sec: EstimateSection; it: EstimateItem; index: number }) {
  const patchItem = useEstimates((s) => s.patchItem)
  const removeItem = useEstimates((s) => s.removeItem)
  const duplicateItem = useEstimates((s) => s.duplicateItem)
  const moveItem = useEstimates((s) => s.moveItem)
  const [menu, setMenu] = useState(false)
  const p = (patch: Partial<EstimateItem>) => patchItem(e.id, sec.id, it.id, patch)
  return (
    <tr className="group align-top">
      <td className="py-2 pr-1 pl-3 text-xs text-zinc-400 tabular-nums">{index}</td>
      <td className="px-1 py-1.5">
        <textarea
          rows={1}
          value={it.name}
          placeholder="Наименование"
          onChange={(ev) => p({ name: ev.target.value })}
          className="input input-sm field-sizing-content h-auto min-h-8 resize-none py-1.5 leading-snug"
        />
      </td>
      <td className="px-1 py-1.5">
        <select value={it.kind} onChange={(ev) => p({ kind: ev.target.value as ItemKind })} className="input input-sm w-full cursor-pointer pr-5 pl-2 text-xs" aria-label="Тип">
          {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k].one}</option>)}
        </select>
      </td>
      <td className="px-1 py-1.5">
        <input list="units" value={it.unit} onChange={(ev) => p({ unit: ev.target.value })} className="input input-sm" aria-label="Единица" />
      </td>
      <td className="px-1 py-1.5">
        <NumberInput size="sm" value={it.qty} onChange={(v) => p({ qty: v })} aria-label="Количество" />
      </td>
      <td className="px-1 py-1.5">
        <NumberInput size="sm" value={it.price} onChange={(v) => p({ price: v })} aria-label="Цена" />
      </td>
      <td className="px-2 py-2 text-right text-sm font-medium whitespace-nowrap tabular-nums">{fmt(lineTotal(it), 2, 2)}</td>
      <td className="relative py-1.5 pr-2">
        <IconButton label="Действия" onClick={() => setMenu((m) => !m)}>
          <MoreHorizontal size={16} />
        </IconButton>
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <div className="absolute right-2 z-20 mt-1 w-44 rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900" onClick={() => setMenu(false)}>
              <MenuItem icon={<ArrowUp size={15} />} onClick={() => moveItem(e.id, sec.id, it.id, -1)}>Выше</MenuItem>
              <MenuItem icon={<ArrowDown size={15} />} onClick={() => moveItem(e.id, sec.id, it.id, 1)}>Ниже</MenuItem>
              <MenuItem icon={<Copy size={15} />} onClick={() => duplicateItem(e.id, sec.id, it.id)}>Дублировать</MenuItem>
              <MenuItem icon={<Trash2 size={15} />} danger onClick={() => removeItem(e.id, sec.id, it.id)}>Удалить</MenuItem>
            </div>
          </>
        )}
      </td>
    </tr>
  )
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick(): void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 ${danger ? 'text-red-600 dark:text-red-400' : ''}`}>
      {icon}
      {children}
    </button>
  )
}

function SectionBlock({ e, sec, start, first, last }: { e: Estimate; sec: EstimateSection; start: number; first: boolean; last: boolean }) {
  const patchSection = useEstimates((s) => s.patchSection)
  const removeSection = useEstimates((s) => s.removeSection)
  const moveSection = useEstimates((s) => s.moveSection)
  const addItems = useEstimates((s) => s.addItems)
  const [picker, setPicker] = useState(false)
  return (
    <section className="card animate-fade-up overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
        <input
          value={sec.name}
          onChange={(ev) => patchSection(e.id, sec.id, { name: ev.target.value })}
          className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-2 font-semibold outline-none hover:bg-white focus:bg-white focus:ring-2 focus:ring-brand-500/30 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
          aria-label="Название раздела"
        />
        <span className="text-sm font-semibold whitespace-nowrap tabular-nums">{money(sectionTotal(sec))}</span>
        <div className="flex">
          <IconButton label="Раздел выше" disabled={first} onClick={() => moveSection(e.id, sec.id, -1)}><ArrowUp size={15} /></IconButton>
          <IconButton label="Раздел ниже" disabled={last} onClick={() => moveSection(e.id, sec.id, 1)}><ArrowDown size={15} /></IconButton>
          <IconButton label="Удалить раздел" onClick={() => (sec.items.length === 0 || confirm(`Удалить раздел «${sec.name}» со всеми позициями?`)) && removeSection(e.id, sec.id)}>
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>
      {sec.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed">
            <thead>
              <tr className="text-left text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                <th className="w-9 py-2 pl-3 font-medium">№</th>
                <th className="px-1 py-2 font-medium">Наименование</th>
                <th className="w-28 px-1 py-2 font-medium">Тип</th>
                <th className="w-16 px-1 py-2 font-medium">Ед.</th>
                <th className="w-24 px-1 py-2 font-medium">Кол-во</th>
                <th className="w-24 px-1 py-2 font-medium">Цена, ₸</th>
                <th className="w-28 px-2 py-2 text-right font-medium">Сумма, ₸</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {sec.items.map((it, i) => <ItemRow key={it.id} e={e} sec={sec} it={it} index={start + i} />)}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-1 px-2 py-2">
        <Button size="sm" variant="ghost" onClick={() => addItems(e.id, sec.id, [{ name: '', qty: 1 }])}>
          <Plus size={15} /> Строка
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPicker(true)}>
          <Tags size={15} /> Из справочника
        </Button>
        <ButtonLink size="sm" variant="ghost" to="/calc">
          <Calculator size={15} /> Из калькулятора
        </ButtonLink>
      </div>
      {picker && (
        <CatalogPicker
          open={picker}
          onClose={() => setPicker(false)}
          onPick={(entry, price) => addItems(e.id, sec.id, [{ name: entry.name, unit: entry.unit, kind: entry.kind, price, qty: 1 }])}
        />
      )}
    </section>
  )
}

function Row({ label, value, strong, muted }: { label: React.ReactNode; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${strong ? 'text-base font-semibold text-accent-700 dark:text-accent-300' : 'text-sm'} ${muted ? 'text-zinc-500' : ''}`}>
      <span>{label}</span>
      <AnimatedNumber value={value} format={money} />
    </div>
  )
}

function PctInput({ label, value, onChange }: { label: string; value: number; onChange(v: number): void }) {
  return (
    <Field label={label}>
      <NumberInput size="sm" value={value} unit="%" onChange={onChange} />
    </Field>
  )
}

export function EstimatePage() {
  const { id } = useParams()
  const e = useEstimates((s) => s.estimates.find((x) => x.id === id))
  const patch = useEstimates((s) => s.patch)
  const setSettings = useEstimates((s) => s.setSettings)
  const addSection = useEstimates((s) => s.addSection)
  const duplicate = useEstimates((s) => s.duplicate)
  const remove = useEstimates((s) => s.remove)
  const setLast = useEstimates((s) => s.setLast)
  const company = useSettings((s) => s.company)
  const navigate = useNavigate()

  useEffect(() => {
    if (e) setLast(e.id)
  }, [e?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!e) return <NotFoundPage />
  const t = computeTotals(e)
  const s = e.settings
  // Running item number at the start of each section.
  const starts = e.sections.reduce<number[]>((acc, _sec, i) => [...acc, i === 0 ? 1 : acc[i - 1] + e.sections[i - 1].items.length], [])

  return (
    <div>
      <datalist id="units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
      <div className="mb-2 text-sm text-zinc-500">
        <Link to="/estimates" className="hover:text-zinc-800 dark:hover:text-zinc-200">Сметы</Link>
      </div>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <input
          value={e.name}
          onChange={(ev) => patch(e.id, { name: ev.target.value })}
          className="-ml-2 min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-2xl font-semibold tracking-tight outline-none hover:bg-white focus:bg-white focus:ring-2 focus:ring-brand-500/30 dark:hover:bg-zinc-900 dark:focus:bg-zinc-900"
          aria-label="Название сметы"
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => exportEstimateXlsx(e, company)}>
            <FileDown size={15} /> Excel
          </Button>
          <Button size="sm" onClick={() => exportEstimateCsv(e)}>
            <FileText size={15} /> CSV
          </Button>
          <ButtonLink size="sm" to={`/estimates/${e.id}/print`}>
            <Printer size={15} /> Печать / PDF
          </ButtonLink>
          <IconButton label="Скачать JSON" onClick={() => downloadBlob(new Blob([JSON.stringify(e, null, 2)], { type: 'application/json' }), `${safeFileName(e.name)}.json`)}>
            <FileJson size={16} />
          </IconButton>
          <IconButton label="Дублировать" onClick={() => { const c = duplicate(e.id); if (c) navigate(`/estimates/${c}`) }}>
            <Copy size={16} />
          </IconButton>
          <IconButton label="Удалить смету" onClick={() => { if (confirm(`Удалить смету «${e.name}»?`)) { remove(e.id); navigate('/estimates') } }}>
            <Trash2 size={16} />
          </IconButton>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <div className="card grid gap-4 p-4 sm:grid-cols-3">
            <Field label="Объект">
              <TextInput value={e.object} placeholder="Адрес или название объекта" onChange={(ev) => patch(e.id, { object: ev.target.value })} />
            </Field>
            <Field label="Заказчик">
              <TextInput value={e.client} placeholder="ФИО или организация" onChange={(ev) => patch(e.id, { client: ev.target.value })} />
            </Field>
            <Field label="Вид документа">
              <Segmented value={e.docType} onChange={(v) => patch(e.id, { docType: v as Estimate['docType'] })} options={[{ value: 'estimate', label: 'Смета' }, { value: 'offer', label: 'КП' }]} />
            </Field>
          </div>

          {e.sections.map((sec, i) => (
            <SectionBlock key={sec.id} e={e} sec={sec} start={starts[i]} first={i === 0} last={i === e.sections.length - 1} />
          ))}
          <Button onClick={() => addSection(e.id, `Раздел ${e.sections.length + 1}`)}>
            <Plus size={16} /> Добавить раздел
          </Button>

          <Field label="Примечания (выводятся при печати)">
            <textarea className="input field-sizing-content min-h-20 py-2" value={e.notes} onChange={(ev) => patch(e.id, { notes: ev.target.value })} placeholder="Условия оплаты, сроки, гарантии…" />
          </Field>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">Итоги</h3>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              <div className="pb-2">
                {KINDS.filter((k) => t.byKind[k] > 0).map((k) => (
                  <Row key={k} label={<span className="flex items-center gap-2"><Badge tone={KIND_TONE[k]}>{KIND_LABEL[k].short}</Badge>{KIND_LABEL[k].many}</span>} value={t.byKind[k]} />
                ))}
                <Row label="Прямые затраты" value={t.direct} strong={false} />
              </div>
              {(t.materialsMarkup || t.overhead || t.profit || t.contingency || t.discount) > 0 && (
                <div className="py-2">
                  {t.materialsMarkup > 0 && <Row label={`Наценка на материалы ${s.materialsMarkupPct}%`} value={t.materialsMarkup} />}
                  {t.overhead > 0 && <Row label={`Накладные расходы ${s.overheadPct}%`} value={t.overhead} />}
                  {t.profit > 0 && <Row label={`Сметная прибыль ${s.profitPct}%`} value={t.profit} />}
                  {t.contingency > 0 && <Row label={`Непредвиденные ${s.contingencyPct}%`} value={t.contingency} />}
                  {t.discount > 0 && <Row label={`Скидка ${s.discountPct}%`} value={-t.discount} />}
                </div>
              )}
              <div className="pt-2">
                {s.vatMode === 'on_top' && <Row label="Итого без НДС" value={t.net} muted />}
                {s.vatMode === 'on_top' && <Row label={`НДС ${s.vatPct}%`} value={t.vat} muted />}
                <Row label={s.vatMode === 'none' ? 'Итого (без НДС)' : 'Итого с НДС'} value={t.total} strong />
                {s.vatMode === 'included' && <Row label={`в т.ч. НДС ${s.vatPct}%`} value={t.vat} muted />}
              </div>
            </div>
            {t.massKg > 0 && (
              <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/60">
                Масса позиций в т/кг: <b className="tabular-nums">{fmt(t.massKg / 1000, 3)} т</b>
              </div>
            )}
          </div>

          <div className="card space-y-3 p-4">
            <h3 className="text-sm font-semibold">Начисления</h3>
            <div className="grid grid-cols-2 gap-3">
              <PctInput label="Наценка на материалы" value={s.materialsMarkupPct} onChange={(v) => setSettings(e.id, { materialsMarkupPct: v })} />
              <PctInput label="Накладные (от работ)" value={s.overheadPct} onChange={(v) => setSettings(e.id, { overheadPct: v })} />
              <PctInput label="Прибыль (от работ)" value={s.profitPct} onChange={(v) => setSettings(e.id, { profitPct: v })} />
              <PctInput label="Непредвиденные" value={s.contingencyPct} onChange={(v) => setSettings(e.id, { contingencyPct: v })} />
              <PctInput label="Скидка" value={s.discountPct} onChange={(v) => setSettings(e.id, { discountPct: v })} />
              <PctInput label="Ставка НДС" value={s.vatPct} onChange={(v) => setSettings(e.id, { vatPct: v })} />
            </div>
            <Field label="НДС">
              <Segmented
                value={s.vatMode}
                onChange={(v) => setSettings(e.id, { vatMode: v as VatMode })}
                options={[{ value: 'none', label: 'Без НДС' }, { value: 'on_top', label: 'Сверху' }, { value: 'included', label: 'В т.ч.' }]}
              />
            </Field>
          </div>
        </aside>
      </div>
    </div>
  )
}
