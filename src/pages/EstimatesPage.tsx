import { Copy, FileJson, FileSpreadsheet, Plus, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { computeTotals, type Estimate } from '@/lib/estimate'
import { downloadBlob, safeFileName } from '@/lib/export'
import { fmt, fmtDateTime, money } from '@/lib/format'
import { useEstimates } from '@/store/estimates'
import { useSettings } from '@/store/settings'
import { toast } from '@/store/toast'
import { T, Tf } from '@/i18n'

export function EstimatesPage() {
  const estimates = useEstimates((s) => s.estimates)
  const create = useEstimates((s) => s.create)
  const duplicate = useEstimates((s) => s.duplicate)
  const remove = useEstimates((s) => s.remove)
  const importEstimate = useEstimates((s) => s.importEstimate)
  const defaults = useSettings((s) => s.estimateDefaults)
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const sorted = [...estimates].sort((a, b) => b.updatedAt - a.updatedAt)

  const onImport = async (files: FileList | null) => {
    for (const f of files ?? []) {
      try {
        const data = JSON.parse(await f.text()) as Estimate
        if (!Array.isArray(data.sections)) throw new Error()
        importEstimate(data)
        toast(Tf('Смета «{0}» импортирована', [data.name]))
      } catch {
        toast(Tf('{0}: это не файл сметы', [f.name]), { tone: 'error' })
      }
    }
  }

  return (
    <div>
      <PageHeader
        title={T('Сметы')}
        subtitle={T('Сметы хранятся в браузере. Выгружайте в Excel, печатайте в PDF, делайте резервные копии в настройках.')}
        actions={
          <>
            <input ref={fileRef} type="file" accept=".json,application/json" multiple hidden onChange={(e) => onImport(e.target.files)} />
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              <Upload size={15} />  {T('Импорт JSON')}
            </Button>
            <Button size="sm" variant="primary" onClick={() => navigate(`/estimates/${create(T('Новая смета'), defaults)}`)}>
              <Plus size={15} />  {T('Новая смета')}
            </Button>
          </>
        }
      />
      {sorted.length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet size={32} />}
          title={T('Пока нет ни одной сметы')}
          text={T('Создайте смету вручную, добавьте позиции из любого калькулятора кнопкой «В смету» или импортируйте их из загруженных документов.')}
          action={<Button variant="primary" onClick={() => navigate(`/estimates/${create(T('Новая смета'), defaults)}`)}><Plus size={16} />  {T('Создать смету')}</Button>}
        />
      ) : (
        <div className="stagger card divide-y divide-zinc-100 dark:divide-zinc-800">
          {sorted.map((e) => {
            const t = computeTotals(e)
            return (
              <div key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <Link to={`/estimates/${e.id}`} className="min-w-0 flex-1 basis-60">
                  <div className="truncate font-medium hover:text-brand-700 dark:hover:text-brand-400">{e.name}</div>
                  <div className="truncate text-xs text-zinc-500">
                    {[e.object, e.client].filter(Boolean).join(' · ') || T('Без объекта')}  {T('· изменена')} {fmtDateTime(e.updatedAt)}
                  </div>
                </Link>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{money(t.total)}</div>
                  <div className="text-xs text-zinc-500">
                    {t.itemsCount}  {T('поз.')}{t.massKg > 0 ? Tf(' · {0} т', [fmt(t.massKg / 1000, 3)]) : ''}
                  </div>
                </div>
                <div className="flex">
                  <IconButton label={T('Дублировать')} onClick={() => duplicate(e.id)}>
                    <Copy size={16} />
                  </IconButton>
                  <IconButton label={T('Скачать JSON')} onClick={() => downloadBlob(new Blob([JSON.stringify(e, null, 2)], { type: 'application/json' }), `${safeFileName(e.name)}.json`)}>
                    <FileJson size={16} />
                  </IconButton>
                  <IconButton label={T('Удалить')} onClick={() => confirm(Tf('Удалить смету «{0}»?', [e.name])) && remove(e.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
