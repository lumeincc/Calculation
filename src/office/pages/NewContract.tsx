import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Field, Segmented, Select, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/misc'
import { T } from '@/i18n'
import { computeTotals } from '@/lib/estimate'
import { fromEstimate } from '../actions'
import { money } from '@/lib/format'
import { useEstimates } from '@/store/estimates'
import { useSettings } from '@/store/settings'
import { CounterpartyPicker } from '../components/pickers'
import { CONTRACT_KINDS } from '../model'
import { allTemplates, useOffice } from '../store'
import { defaultTemplateFor } from '../templates'
import type { Contract, ContractKind, Role } from '../types'

export function NewContractDialog({ open, onClose, preset = {} }: { open: boolean; onClose(): void; preset?: Partial<Contract> }) {
  const nav = useNavigate()
  const custom = useOffice((s) => s.templates)
  const create = useOffice((s) => s.createContract)
  const estimates = useEstimates((s) => s.estimates)
  const company = useSettings((s) => s.company)
  const [kind, setKind] = useState<ContractKind>(preset.kind ?? 'construction')
  const [templateId, setTemplateId] = useState(preset.templateId ?? defaultTemplateFor(preset.kind ?? 'construction').id)
  const [role, setRole] = useState<Role>(preset.role ?? 'contractor')
  const [cp, setCp] = useState<string | null>(preset.counterpartyId ?? null)
  const [estimateId, setEstimateId] = useState(preset.estimateId ?? '')
  const [title, setTitle] = useState(preset.title ?? '')
  const templates = allTemplates(custom)
  const tplOptions = [...templates.filter((t) => t.kind === kind), ...templates.filter((t) => t.kind !== kind)].map((t) => ({ value: t.id, label: t.builtin ? T(t.name) : t.name }))

  const submit = () => {
    const fromEst = estimateId ? fromEstimate(estimateId) : {}
    const id = create({
      ...preset,
      ...fromEst,
      kind,
      templateId,
      role,
      city: company.city ?? '',
      counterpartyId: cp ?? fromEst.counterpartyId ?? null,
      title: title.trim() || fromEst.title || '',
    })
    onClose()
    nav(`/office/contracts/${id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={T('Новый договор')}
      footer={
        <>
          <Button onClick={onClose}>{T('Отмена')}</Button>
          <Button variant="primary" onClick={submit}>{T('Создать договор')}</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label={T('Вид договора')} htmlFor="nc-kind">
          <Select
            id="nc-kind"
            value={kind}
            onChange={(v) => {
              setKind(v as ContractKind)
              setTemplateId(defaultTemplateFor(v as ContractKind).id)
            }}
            options={CONTRACT_KINDS}
          />
        </Field>
        <Field label={T('Шаблон текста')} htmlFor="nc-tpl">
          <Select id="nc-tpl" value={templateId} onChange={setTemplateId} options={tplOptions} />
        </Field>
        <Field label={T('Мы в этом договоре')}>
          <Segmented value={role} onChange={(v) => setRole(v as Role)} options={[{ value: 'contractor', label: T('Исполнитель / поставщик') }, { value: 'client', label: T('Заказчик / покупатель') }]} />
        </Field>
        <Field label={T('Контрагент')} htmlFor="nc-cp">
          <CounterpartyPicker id="nc-cp" value={cp} onChange={setCp} />
        </Field>
        <Field label={T('Предмет договора')} htmlFor="nc-title">
          <TextInput id="nc-title" value={title} placeholder={T('Например: монтаж металлоконструкций склада')} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        {estimates.length > 0 && (
          <Field label={T('На основании сметы')} htmlFor="nc-est" hint={T('Сумма, НДС, объект и предмет подставятся из сметы.')}>
            <Select
              id="nc-est"
              value={estimateId}
              onChange={setEstimateId}
              options={[{ value: '', label: T('— без сметы —') }, ...estimates.map((e) => ({ value: e.id, label: `${e.name} · ${money(computeTotals(e).total)}` }))]}
            />
          </Field>
        )}
      </div>
    </Modal>
  )
}
