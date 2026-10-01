import { Plus, Trash2 } from 'lucide-react'
import type { Field as FieldDef, FieldGroup, RowValues, RowsField, Values } from '@/calculators/types'
import { IconButton } from '@/components/ui/Button'
import { Field, NumberInput, Segmented, Select, Toggle } from '@/components/ui/Field'
import { num } from '@/lib/num'

const SPAN: Record<number, string> = { 2: 'sm:col-span-2', 3: 'sm:col-span-3', 6: 'sm:col-span-6' }

function RowsEditor({ field, rows, onChange }: { field: RowsField<Values>; rows: RowValues[]; onChange(rows: RowValues[]): void }) {
  return (
    <div>
      <div className="label">{field.label}</div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-end gap-2">
            {field.columns.map((col) => (
              <div key={col.key} className="min-w-0 flex-1">
                {i === 0 && <div className="mb-1 text-[11px] text-zinc-500">{col.label}</div>}
                {col.type === 'number' ? (
                  <NumberInput size="sm" unit={col.unit} value={num(row[col.key])} onChange={(v) => onChange(rows.map((r, j) => (j === i ? { ...r, [col.key]: v } : r)))} aria-label={col.label} />
                ) : (
                  <input className="input input-sm" value={String(row[col.key] ?? '')} onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, [col.key]: e.target.value } : r)))} aria-label={col.label} />
                )}
              </div>
            ))}
            <IconButton label="Удалить строку" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Trash2 size={16} />
            </IconButton>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...rows, { ...field.newRow }])}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/50"
      >
        <Plus size={15} /> {field.addLabel ?? 'Добавить'}
      </button>
    </div>
  )
}

function renderField(f: FieldDef<Values>, values: Values, defaults: Values, set: (k: string, v: Values[string]) => void) {
  const id = `f-${f.key}`
  const v = values[f.key]
  if (f.type === 'number') {
    return (
      <Field label={f.label} hint={f.hint} htmlFor={id}>
        <NumberInput id={id} value={num(v)} unit={f.unit} onChange={(n) => set(f.key, n)} />
      </Field>
    )
  }
  if (f.type === 'select' || f.type === 'segmented') {
    const options = f.optionsFor ? f.optionsFor(values) : f.options
    const current = options.some((o) => o.value === String(v)) ? String(v) : (options[0]?.value ?? '')
    // Keep the stored type: numeric defaults stay numbers after picking an option.
    const coerce = (s: string) => set(f.key, typeof defaults[f.key] === 'number' ? Number(s) : s)
    return (
      <Field label={f.label} hint={f.hint} htmlFor={id}>
        {f.type === 'select' ? <Select id={id} value={current} onChange={coerce} options={options} /> : <Segmented value={current} onChange={coerce} options={options} />}
      </Field>
    )
  }
  if (f.type === 'toggle') return <Toggle checked={Boolean(v)} onChange={(b) => set(f.key, b)} label={f.label} />
  return <RowsEditor field={f as RowsField<Values>} rows={(v as RowValues[]) ?? []} onChange={(rows) => set(f.key, rows)} />
}

export function CalculatorForm({ groups, values, defaults, onChange }: { groups: FieldGroup<Values>[]; values: Values; defaults: Values; onChange(v: Values): void }) {
  const set = (k: string, v: Values[string]) => onChange({ ...values, [k]: v })
  return (
    <div className="space-y-6">
      {groups
        .filter((g) => !g.visible || g.visible(values))
        .map((g, gi) => (
          <section key={gi}>
            {g.title && <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">{g.title}</h3>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
              {g.fields
                .filter((f) => !f.visible || f.visible(values))
                .map((f) => (
                  <div key={`${f.key}-${f.label}`} className={`${SPAN[f.span ?? (f.type === 'rows' ? 6 : 3)]} ${f.type === 'toggle' ? 'self-end' : ''}`}>
                    {renderField(f, values, defaults, set)}
                  </div>
                ))}
            </div>
          </section>
        ))}
    </div>
  )
}
