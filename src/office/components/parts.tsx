import { Download, ExternalLink, Eye, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, NumberInput, Select, TextInput, Toggle } from '@/components/ui/Field'
import { Badge } from '@/components/ui/misc'
import { T, Tf } from '@/i18n'
import { fmtDateTime } from '@/lib/format'
import { uid } from '@/lib/id'
import { toast } from '@/store/toast'
import { deleteFiles, downloadStored, openStored, storeBrowserFiles, type FileLinks } from '../files'
import { CONTRACT_STATUS, lineSum, PAPER_STATUS, type VatTotals } from '../model'
import { useOffice } from '../store'
import type { ContractStatus, HistoryEntry, PaperLine, PaperStatus, Requisites, Signature, StoredFile } from '../types'
import { fmtSize } from './format'
import { FilePreview } from './FilePreview'
import { money } from '@/lib/format'
import { UNITS } from '@/lib/estimate'

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const s = CONTRACT_STATUS[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function PaperStatusBadge({ status }: { status: PaperStatus }) {
  const s = PAPER_STATUS[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}

/** Row of status chips: the current one is filled, a click switches. */
export function StatusPicker<S extends string>({ value, flow, labels, onChange }: { value: S; flow: S[]; labels: Record<S, { label: string }>; onChange(s: S): void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={T('Статус')}>
      {flow.map((s) => (
        <button
          key={s}
          role="radio"
          aria-checked={s === value}
          onClick={() => onChange(s)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            s === value
              ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
              : 'border-zinc-300 text-zinc-600 hover:border-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          {labels[s].label}
        </button>
      ))}
    </div>
  )
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-semibold">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

const REQ_FIELDS: [keyof Requisites, string, string, number?][] = [
  ['name', T('Наименование'), T('ТОО «Каскад»'), 2],
  ['bin', T('БИН / ИИН'), '123456789012'],
  ['address', T('Адрес'), T('г. Алматы, ул. Строителей, 1')],
  ['phone', T('Телефон'), '+7 700 000-00-00'],
  ['email', 'E-mail', 'info@example.kz'],
  ['bank', T('Банк'), T('АО «Kaspi Bank»')],
  ['iik', T('ИИК (IBAN)'), 'KZ00 0000 0000 0000 0000'],
  ['bik', T('БИК'), 'CASPKZKA'],
  ['kbe', T('КБе'), '17'],
  ['position', T('Должность подписанта'), T('Директор')],
  ['director', T('Подписант (Фамилия И. О.)'), T('Иванов И. И.')],
  ['represented', T('В лице (родительный падеж)'), T('директора Иванова Ивана Ивановича'), 2],
  ['basis', T('Действует на основании'), T('Устава')],
]

export function RequisitesForm({ value, onChange }: { value: Requisites; onChange(p: Partial<Requisites>): void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {REQ_FIELDS.map(([k, label, ph, span]) => (
        <Field key={k} label={label} className={span === 2 ? 'sm:col-span-2' : ''}>
          <TextInput value={value[k]} placeholder={ph} onChange={(e) => onChange({ [k]: e.target.value })} />
        </Field>
      ))}
    </div>
  )
}

/** Files linked to a contract / paper / counterparty, with upload, preview and unlink. */
export function Attachments({ links, title = T('Файлы'), hint }: { links: FileLinks; title?: ReactNode; hint?: ReactNode }) {
  const files = useOffice((s) => s.files)
  const patchFile = useOffice((s) => s.patchFile)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<StoredFile | null>(null)
  const mine = files.filter(
    (f) => (links.contractId && f.contractId === links.contractId) || (links.paperId && f.paperId === links.paperId) || (links.counterpartyId && f.counterpartyId === links.counterpartyId),
  )
  const upload = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy(true)
    try {
      await storeBrowserFiles(list, null, links)
      toast(Tf('Загружено файлов: {0}', [list.length]))
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  const unlink = (f: StoredFile) => {
    const p: Partial<StoredFile> = {}
    if (links.contractId && f.contractId === links.contractId) p.contractId = undefined
    if (links.paperId && f.paperId === links.paperId) p.paperId = undefined
    if (links.counterpartyId && f.counterpartyId === links.counterpartyId) p.counterpartyId = undefined
    patchFile(f.id, p)
  }
  return (
    <Card
      title={title}
      actions={
        <>
          <input ref={input} type="file" multiple hidden onChange={(e) => (upload(e.target.files), (e.target.value = ''))} />
          <Button size="sm" onClick={() => input.current?.click()} disabled={busy}>
            <Upload size={15} /> {T('Прикрепить')}
          </Button>
        </>
      }
    >
      {hint && <p className="-mt-2 mb-3 text-sm text-zinc-500">{hint}</p>}
      {mine.length === 0 ? (
        <p className="text-sm text-zinc-500">{T('Файлов пока нет. Прикрепите скан, письмо, чертёж — они попадут и в архив.')}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {mine.map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-2 text-sm">
              <Paperclip size={15} className="shrink-0 text-zinc-400" />
              <button className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => setPreview(f)}>
                {f.name}
              </button>
              <span className="text-xs text-zinc-500 tabular-nums">{fmtSize(f.size)}</span>
              <IconButton label={T('Просмотр')} onClick={() => setPreview(f)}><Eye size={15} /></IconButton>
              <IconButton label={T('Скачать')} onClick={() => downloadStored(f).catch((e) => toast(String(e.message ?? e), { tone: 'error' }))}><Download size={15} /></IconButton>
              <IconButton label={T('Открепить (файл останется в архиве)')} onClick={() => unlink(f)}><X size={15} /></IconButton>
            </li>
          ))}
        </ul>
      )}
      <FilePreview file={preview} onClose={() => setPreview(null)} />
    </Card>
  )
}

/** Signatures of both sides: mark as signed, date, signer, signed scan. */
export function SignaturePanel({ sign, onSign, names, links, signers = ['', ''] }: {
  sign: { us: Signature; them: Signature }
  onSign(side: 'us' | 'them', s: Partial<Signature>): void
  names: [string, string]
  links: FileLinks
  /** Default signer names of [our side, counterparty] — filled in when marked as signed. */
  signers?: [string, string]
}) {
  const files = useOffice((s) => s.files)
  const [preview, setPreview] = useState<StoredFile | null>(null)
  const side = (key: 'us' | 'them', title: string) => {
    const s = sign[key]
    const scan = s.fileId ? files.find((f) => f.id === s.fileId) : undefined
    const attach = async (list: FileList | null) => {
      if (!list?.length) return
      try {
        const [id] = await storeBrowserFiles([list[0]], null, links)
        onSign(key, { fileId: id, signed: true, date: s.date || new Date().toISOString().slice(0, 10), signer: s.signer || signers[key === 'us' ? 0 : 1] })
        toast(T('Скан подписанного документа сохранён'))
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e), { tone: 'error' })
      }
    }
    return (
      <div className={`rounded-xl border p-4 ${s.signed ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-zinc-200 dark:border-zinc-800'}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">{title}</div>
          {s.signed ? <Badge tone="green">{T('Подписано')}</Badge> : <Badge>{T('Не подписано')}</Badge>}
        </div>
        <Toggle
          checked={s.signed}
          onChange={(v) => onSign(key, { signed: v, date: v && !s.date ? new Date().toISOString().slice(0, 10) : s.date, signer: v && !s.signer ? signers[key === 'us' ? 0 : 1] : s.signer })}
          label={T('Подписано')}
        />
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field label={T('Дата подписания')}>
            <TextInput type="date" value={s.date} onChange={(e) => onSign(key, { date: e.target.value })} />
          </Field>
          <Field label={T('Кто подписал')}>
            <TextInput value={s.signer} placeholder={T('Иванов И. И.')} onChange={(e) => onSign(key, { signer: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {scan ? (
            <>
              <Paperclip size={14} className="text-zinc-400" />
              <button className="min-w-0 max-w-[14rem] truncate hover:underline" onClick={() => setPreview(scan)}>{scan.name}</button>
              <IconButton label={T('Открыть в новой вкладке')} onClick={() => openStored(scan)}><ExternalLink size={14} /></IconButton>
              <IconButton label={T('Удалить скан')} onClick={async () => { onSign(key, { fileId: undefined }); await deleteFiles([scan.id]) }}><Trash2 size={14} /></IconButton>
            </>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              <Upload size={14} /> {T('Прикрепить скан с подписью')}
              <input type="file" hidden accept=".pdf,image/*" onChange={(e) => (attach(e.target.files), (e.target.value = ''))} />
            </label>
          )}
        </div>
      </div>
    )
  }
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {side('us', Tf('Наша сторона ({0})', [names[0]]))}
        {side('them', Tf('Контрагент ({0})', [names[1]]))}
      </div>
      <FilePreview file={preview} onClose={() => setPreview(null)} />
    </>
  )
}

export function History({ items }: { items: HistoryEntry[] }) {
  return (
    <ol className="space-y-2 text-sm">
      {[...items].reverse().map((h, i) => (
        <li key={i} className="flex gap-3">
          <span className="w-36 shrink-0 text-xs text-zinc-500 tabular-nums">{fmtDateTime(h.at)}</span>
          <span>{h.text}</span>
        </li>
      ))}
    </ol>
  )
}

/** Editable table of invoice / act lines. */
export function LinesEditor({ lines, onChange, totals }: { lines: PaperLine[]; onChange(lines: PaperLine[]): void; totals: VatTotals & { mode: string; pct: number } }) {
  const patch = (id: string, p: Partial<PaperLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...p } : l)))
  const unitOptions = [...new Set([...UNITS, ...lines.map((l) => l.unit)])].map((u) => ({ value: u, label: u }))
  return (
    <div>
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="w-8 px-2 py-2 font-medium">№</th>
              <th className="px-2 py-2 font-medium">{T('Наименование')}</th>
              <th className="w-24 px-2 py-2 font-medium">{T('Ед.')}</th>
              <th className="w-24 px-2 py-2 font-medium">{T('Кол-во')}</th>
              <th className="w-32 px-2 py-2 font-medium">{T('Цена, ₸')}</th>
              <th className="w-32 px-2 py-2 text-right font-medium">{T('Сумма, ₸')}</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id} className="border-t border-zinc-100 align-top dark:border-zinc-800">
                <td className="px-2 py-1.5 text-zinc-500 tabular-nums">{i + 1}</td>
                <td className="px-2 py-1.5"><TextInput className="input-sm" value={l.name} placeholder={T('Наименование работ, услуг, товара')} onChange={(e) => patch(l.id, { name: e.target.value })} /></td>
                <td className="px-2 py-1.5"><Select size="sm" value={l.unit} onChange={(v) => patch(l.id, { unit: v })} options={unitOptions} /></td>
                <td className="px-2 py-1.5"><NumberInput size="sm" value={l.qty} onChange={(v) => patch(l.id, { qty: v })} /></td>
                <td className="px-2 py-1.5"><NumberInput size="sm" value={l.price} onChange={(v) => patch(l.id, { price: v })} /></td>
                <td className="px-2 py-1.5 pt-3 text-right tabular-nums">{money(lineSum(l), false)}</td>
                <td className="px-1 py-1.5"><IconButton label={T('Удалить строку')} onClick={() => onChange(lines.filter((x) => x.id !== l.id))}><Trash2 size={15} /></IconButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <Button size="sm" onClick={() => onChange([...lines, { id: uid(), name: '', unit: T('усл. ед.'), qty: 1, price: 0 }])}>
          <Plus size={15} /> {T('Добавить строку')}
        </Button>
        <dl className="min-w-56 space-y-1 text-sm">
          <div className="flex justify-between gap-6"><dt className="text-zinc-500">{T('Итого')}</dt><dd className="tabular-nums">{money(totals.net)}</dd></div>
          {totals.mode !== 'none' && (
            <div className="flex justify-between gap-6"><dt className="text-zinc-500">{Tf('НДС {0}%', [totals.pct])}{totals.mode === 'included' ? ` (${T('в т.ч.')})` : ''}</dt><dd className="tabular-nums">{money(totals.vat)}</dd></div>
          )}
          <div className="flex justify-between gap-6 text-base font-semibold"><dt>{T('Всего к оплате')}</dt><dd className="text-accent-700 tabular-nums dark:text-accent-300">{money(totals.total)}</dd></div>
        </dl>
      </div>
    </div>
  )
}
