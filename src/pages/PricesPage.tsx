import { Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, NumberInput, Select, TextInput } from '@/components/ui/Field'
import { Modal, PageHeader } from '@/components/ui/misc'
import { DEFAULT_PRICES, PRICE_GROUPS } from '@/data/prices'
import { KIND_LABEL, KINDS, UNITS, type ItemKind } from '@/lib/estimate'
import { money } from '@/lib/format'
import { usePrices } from '@/store/prices'
import { T, Tf } from '@/i18n'

const MY = T('Мои позиции')

export function PricesPage() {
  const { overrides, custom, setPrice, resetPrice, resetAll, addCustom, updateCustom, removeCustom } = usePrices()
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ name: '', unit: T('шт'), price: 0, kind: 'material' as ItemKind })

  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const all = [...DEFAULT_PRICES.map((p) => ({ ...p, custom: false })), ...custom.map((p) => ({ ...p, group: MY, custom: true }))]
    const list = all.filter((p) => (!ql || p.name.toLowerCase().includes(ql)) && (!group || p.group === group))
    return [...PRICE_GROUPS, MY].map((g) => ({ g, items: list.filter((p) => p.group === g) })).filter((x) => x.items.length)
  }, [q, group, custom])
  const changed = Object.keys(overrides).length

  return (
    <div>
      <PageHeader
        title={T('Справочник цен')}
        subtitle={T('Цены в тенге используются калькуляторами и при добавлении позиций в смету. Заполните свои цены — они сохранятся в браузере.')}
        actions={
          <>
            {changed > 0 && (
              <Button size="sm" variant="ghost" onClick={() => confirm(T('Вернуть все цены к значениям по умолчанию?')) && resetAll()}>
                <RotateCcw size={15} />  {T('Сбросить изменённые (')}{changed})
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
              <Plus size={15} />  {T('Своя позиция')}
            </Button>
          </>
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
          <input className="input pl-9" placeholder={T('Поиск по названию')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="sm:w-64" value={group} onChange={setGroup} options={[{ value: '', label: T('Все группы') }, ...[...PRICE_GROUPS, MY].map((g) => ({ value: g, label: g }))]} />
      </div>
      <div className="space-y-6">
        {groups.map(({ g, items }) => (
          <section key={g}>
            <h2 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">{g}</h2>
            <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((p) => {
                const isChanged = p.key in overrides
                const value = p.custom ? p.price : (overrides[p.key] ?? p.price)
                return (
                  <div key={p.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                    <div className="min-w-0 flex-1 basis-56 text-sm">
                      {p.custom ? <input className="input input-sm" value={p.name} onChange={(e) => updateCustom(p.key, { name: e.target.value })} /> : p.name}
                      {isChanged && <span className="ml-2 text-xs text-zinc-500">{T('по умолчанию')} {money(p.price)}</span>}
                    </div>
                    <span className="w-24 text-xs text-zinc-500">{KIND_LABEL[p.kind].one}</span>
                    <div className="flex items-center gap-2">
                      <NumberInput size="sm" className="w-32" value={value} unit="₸" onChange={(v) => (p.custom ? updateCustom(p.key, { price: v }) : setPrice(p.key, v))} aria-label={Tf('Цена: {0}', [p.name])} />
                      <span className="w-14 text-sm text-zinc-500">/ {p.unit}</span>
                      {p.custom ? (
                        <IconButton label={T('Удалить')} onClick={() => removeCustom(p.key)}><Trash2 size={15} /></IconButton>
                      ) : (
                        <IconButton label={T('Вернуть цену по умолчанию')} disabled={!isChanged} onClick={() => resetPrice(p.key)}><RotateCcw size={15} /></IconButton>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={T('Своя позиция')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>{T('Отмена')}</Button>
            <Button
              variant="primary"
              disabled={!draft.name.trim()}
              onClick={() => {
                addCustom({ ...draft, name: draft.name.trim(), group: MY })
                setDraft({ name: '', unit: T('шт'), price: 0, kind: 'material' })
                setAdding(false)
              }}
            >
              
              {T('Добавить')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={T('Наименование')} className="sm:col-span-2">
            <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
          </Field>
          <Field label={T('Тип')}>
            <Select value={draft.kind} onChange={(v) => setDraft({ ...draft, kind: v as ItemKind })} options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k].one }))} />
          </Field>
          <Field label={T('Единица')}>
            <Select value={draft.unit} onChange={(v) => setDraft({ ...draft, unit: v })} options={UNITS.map((u) => ({ value: u, label: u }))} />
          </Field>
          <Field label={T('Цена за единицу')}>
            <NumberInput value={draft.price} unit="₸" onChange={(v) => setDraft({ ...draft, price: v })} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
