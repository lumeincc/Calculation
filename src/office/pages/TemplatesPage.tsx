import { Copy, FileText, Lock, Plus, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextInput } from '@/components/ui/Field'
import { Badge, PageHeader } from '@/components/ui/misc'
import { T, Tf } from '@/i18n'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useSettings } from '@/store/settings'
import { BodyEditor } from '../components/BodyEditor'
import { Card } from '../components/parts'
import { companyRequisites, CONTRACT_KINDS, contractContext, docMoney, KIND_NAME, PARTY_NAMES, sides } from '../model'
import { allTemplates, useOffice } from '../store'
import type { Contract, ContractKind, Requisites } from '../types'
import { todayIso } from '../words'

/** Example counterparty and terms so the preview of a template looks like a real document. */
const SAMPLE_THEM: Requisites = {
  name: 'ТОО «Пример Заказчик»', bin: '000000000000', address: 'г. Астана, пр. Мангилик Ел, 1', bank: 'АО «Народный банк Казахстана»', iik: 'KZ00 0000 0000 0000 0000',
  bik: 'HSBKKZKX', kbe: '17', director: 'Петров П. П.', position: 'Директор', represented: 'директора Петрова Петра Петровича', basis: 'Устава', phone: '', email: '',
}

function sampleContract(kind: ContractKind): Contract {
  return {
    id: 'sample', number: '1', date: todayIso(), city: 'г. Алматы', title: 'монтаж металлоконструкций склада', kind, role: 'contractor', counterpartyId: null,
    object: 'склад, г. Алматы', amount: 12_500_000, vatMode: 'included', vatPct: 16, advancePct: 30, paymentDays: 10, warrantyMonths: 24, startDate: todayIso(),
    endDate: todayIso(), estimateId: null, templateId: null, body: '', status: 'draft', sign: { us: { signed: false, date: '', signer: '' }, them: { signed: false, date: '', signer: '' } },
    notes: '', tags: [], history: [], createdAt: 0, updatedAt: 0,
  }
}

export function TemplatesPage() {
  const custom = useOffice((s) => s.templates)
  const add = useOffice((s) => s.addTemplate)
  const nav = useNavigate()
  const list = allTemplates(custom)
  return (
    <div>
      <PageHeader
        title={T('Шаблоны договоров')}
        subtitle={T('Готовые шаблоны по законодательству РК и ваши собственные. Поля в {{скобках}} заполняются из карточки договора.')}
        actions={<Button variant="primary" onClick={() => nav(`/office/templates/${add({ name: T('Новый шаблон'), body: '# ДОГОВОР № {{договор.номер}}\n\n{{договор.город}} || {{договор.дата}}\n\n\n{{реквизиты}}\n' })}`)}><Plus size={16} /> {T('Новый шаблон')}</Button>}
      />
      <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((t) => (
          <Link key={t.id} to={`/office/templates/${t.id}`} className="card lift flex items-start gap-3 p-4">
            <FileText size={20} className="mt-0.5 shrink-0 text-zinc-400" />
            <div className="min-w-0">
              <div className="font-medium">{t.builtin ? T(t.name) : t.name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                {KIND_NAME[t.kind]}
                {t.builtin ? <Badge><Lock size={10} /> {T('встроенный')}</Badge> : <Badge tone="amber">{T('свой')}</Badge>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function TemplatePage() {
  const { id } = useParams()
  const nav = useNavigate()
  const custom = useOffice((s) => s.templates)
  const { patchTemplate, removeTemplate, addTemplate } = useOffice.getState()
  const company = useSettings((s) => s.company)
  const t = allTemplates(custom).find((x) => x.id === id)
  if (!t) return <NotFoundPage />
  const us = companyRequisites(company)
  const ctx = contractContext(sampleContract(t.kind), us, SAMPLE_THEM, docMoney)
  const { client, contractor } = sides('contractor', us, SAMPLE_THEM)
  const copy = () => nav(`/office/templates/${addTemplate({ name: Tf('{0} (копия)', [t.name]), kind: t.kind, body: t.body })}`)

  return (
    <div>
      <div className="mb-1 text-sm text-zinc-500"><Link to="/office/templates" className="hover:underline">{T('Шаблоны')}</Link> /</div>
      <PageHeader
        title={t.builtin ? T(t.name) : t.name}
        subtitle={t.builtin ? T('Встроенный шаблон нельзя изменить — сделайте копию и правьте её.') : T('Предпросмотр заполнен примером; в договоре подставятся реальные данные.')}
        actions={
          <>
            <Button onClick={copy}><Copy size={16} /> {T('Сделать копию')}</Button>
            {!t.builtin && (
              <Button variant="danger" onClick={() => { if (confirm(Tf('Удалить шаблон «{0}»? Договоры, созданные по нему, не изменятся.', [t.name]))) { removeTemplate(t.id); nav('/office/templates') } }}>
                <Trash2 size={16} /> {T('Удалить')}
              </Button>
            )}
          </>
        }
      />
      {!t.builtin && (
        <Card className="mb-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={T('Название')} htmlFor="tpl-name"><TextInput id="tpl-name" value={t.name} onChange={(e) => patchTemplate(t.id, { name: e.target.value })} /></Field>
            <Field label={T('Вид договора')} htmlFor="tpl-kind"><Select id="tpl-kind" value={t.kind} onChange={(v) => patchTemplate(t.id, { kind: v as ContractKind })} options={CONTRACT_KINDS} /></Field>
          </div>
        </Card>
      )}
      <BodyEditor value={t.body} readOnly={t.builtin} onChange={(body) => patchTemplate(t.id, { body })} ctx={ctx} names={PARTY_NAMES[t.kind]} client={client} contractor={contractor} />
    </div>
  )
}
