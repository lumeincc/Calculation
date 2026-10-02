import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/misc'
import type { EstimateItem } from '@/lib/estimate'
import { fmtDate, money, plural } from '@/lib/format'
import { lineTotal } from '@/lib/estimate'
import { useEstimates } from '@/store/estimates'
import { useSettings } from '@/store/settings'
import { toast } from '@/store/toast'
import { T, Tf } from '@/i18n'

const NEW = '__new__'

/** Sends prepared lines to an existing or a new estimate, into an existing or a new section. */
export function AddToEstimateDialog({
  open, onClose, items, defaultSection,
}: { open: boolean; onClose(): void; items: Partial<EstimateItem>[]; defaultSection: string }) {
  const estimates = useEstimates((s) => s.estimates)
  const lastId = useEstimates((s) => s.lastId)
  const create = useEstimates((s) => s.create)
  const addItems = useEstimates((s) => s.addItems)
  const defaults = useSettings((s) => s.estimateDefaults)

  const initial = estimates.find((e) => e.id === lastId)?.id ?? estimates[0]?.id ?? NEW
  const [estimateId, setEstimateId] = useState(initial)
  const [newName, setNewName] = useState(() => Tf('Смета от {0}', [fmtDate(Date.now())]))
  const [sectionId, setSectionId] = useState(NEW)
  const [sectionName, setSectionName] = useState(defaultSection)

  const estimate = estimates.find((e) => e.id === estimateId)
  const sections = useMemo(() => estimate?.sections ?? [], [estimate])
  const total = items.reduce((s, it) => s + lineTotal({ qty: it.qty ?? 0, price: it.price ?? 0 }), 0)

  const submit = () => {
    const id = estimateId === NEW || !estimate ? create(newName.trim() || T('Новая смета'), defaults) : estimateId
    const existing = sectionId !== NEW && sections.some((s) => s.id === sectionId) ? sectionId : null
    addItems(id, existing, items, sectionName.trim() || defaultSection)
    toast(Tf('Добавлено {0} {1} в смету', [items.length, plural(items.length, [T('позиция'), T('позиции'), T('позиций')])]), { action: { label: T('Открыть'), to: `/estimates/${id}` } })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={T('Добавить в смету')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{T('Отмена')}</Button>
          <Button variant="primary" onClick={submit} disabled={items.length === 0}>
            
            {T('Добавить')} {items.length} {plural(items.length, [T('позицию'), T('позиции'), T('позиций')])}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={T('Смета')}>
          <Select
            value={estimateId}
            onChange={(v) => {
              setEstimateId(v)
              setSectionId(NEW)
            }}
            options={[...estimates.map((e) => ({ value: e.id, label: e.name })), { value: NEW, label: T('＋ Новая смета') }]}
          />
        </Field>
        {estimateId === NEW && (
          <Field label={T('Название новой сметы')}>
            <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} />
          </Field>
        )}
        <Field label={T('Раздел')}>
          <Select value={sectionId} onChange={setSectionId} options={[{ value: NEW, label: T('＋ Новый раздел') }, ...sections.map((s) => ({ value: s.id, label: s.name }))]} />
        </Field>
        {sectionId === NEW && (
          <Field label={T('Название раздела')}>
            <TextInput value={sectionName} onChange={(e) => setSectionName(e.target.value)} />
          </Field>
        )}
        <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
          {items.length} {plural(items.length, [T('позиция'), T('позиции'), T('позиций')])}  {T('на сумму')} <b className="text-zinc-900 dark:text-zinc-100">{money(total)}</b>{T('. Цены и количество можно будет изменить в смете.')}
        </p>
      </div>
    </Modal>
  )
}
