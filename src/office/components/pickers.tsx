import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/misc'
import { T } from '@/i18n'
import { useOffice } from '../store'

/** Counterparty select with a quick «new» form. */
export function CounterpartyPicker({ value, onChange, id }: { value: string | null; onChange(id: string | null): void; id?: string }) {
  const list = useOffice((s) => s.counterparties)
  const add = useOffice((s) => s.addCounterparty)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [bin, setBin] = useState('')
  const options = [{ value: '', label: T('— не выбран —') }, ...[...list].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name || T('Без названия') }))]
  const create = () => {
    const cid = add({ name: name.trim(), bin: bin.trim() })
    onChange(cid)
    setOpen(false)
    setName('')
    setBin('')
  }
  return (
    <div className="flex gap-2">
      <Select id={id} className="flex-1" value={value ?? ''} onChange={(v) => onChange(v || null)} options={options} />
      <Button onClick={() => setOpen(true)} aria-label={T('Новый контрагент')} title={T('Новый контрагент')}>
        <Plus size={16} />
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={T('Новый контрагент')}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>{T('Отмена')}</Button>
            <Button variant="primary" disabled={!name.trim()} onClick={create}>{T('Добавить')}</Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label={T('Наименование')} htmlFor="cp-new-name">
            <TextInput id="cp-new-name" autoFocus value={name} placeholder={T('ТОО «Каскад»')} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && create()} />
          </Field>
          <Field label={T('БИН / ИИН')} htmlFor="cp-new-bin">
            <TextInput id="cp-new-bin" value={bin} placeholder="123456789012" onChange={(e) => setBin(e.target.value)} />
          </Field>
          <p className="text-xs text-zinc-500">{T('Остальные реквизиты можно заполнить позже в карточке контрагента.')}</p>
        </div>
      </Modal>
    </div>
  )
}
