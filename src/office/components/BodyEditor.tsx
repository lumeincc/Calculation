import { Braces } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Segmented } from '@/components/ui/Field'
import { T, Tf } from '@/i18n'
import { parseBody, PLACEHOLDERS, unknownPlaceholders } from '../model'
import type { Requisites } from '../types'
import { DocBody } from './DocBody'

/** Text editor for contracts / templates with a placeholder palette and a live paper preview. */
export function BodyEditor({ value, onChange, ctx, names, client, contractor, readOnly }: {
  value: string
  onChange(v: string): void
  ctx: Record<string, string>
  names: [string, string]
  client: Requisites
  contractor: Requisites
  readOnly?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [view, setView] = useState<'both' | 'edit' | 'preview'>('both')
  const blocks = useMemo(() => parseBody(value, ctx), [value, ctx])
  const unknown = useMemo(() => unknownPlaceholders(value), [value])

  const insert = (key: string) => {
    const el = ref.current
    const token = `{{${key}}}`
    if (!el) return onChange(value + token)
    const { selectionStart: a, selectionEnd: b } = el
    onChange(value.slice(0, a) + token + value.slice(b))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + token.length, a + token.length)
    })
  }

  const editor = (
    <div className="flex min-w-0 flex-col gap-3">
      <textarea
        ref={ref}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        spellCheck
        aria-label={T('Текст документа')}
        className="input h-[62vh] min-h-80 resize-y font-mono text-[12.5px] leading-relaxed"
      />
      {!readOnly && (
        <details className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <summary className="flex cursor-pointer items-center gap-2 font-medium"><Braces size={15} /> {T('Поля для подстановки')}</summary>
          <p className="mt-2 text-xs text-zinc-500">
            {T('Нажмите на поле — оно вставится в текст. «# » — заголовок, «## » — раздел, «слева || справа» — строка с текстом по краям.')}
          </p>
          {PLACEHOLDERS.map((g) => (
            <div key={g.group} className="mt-3">
              <div className="mb-1 text-xs font-semibold text-zinc-500">{g.group}</div>
              <div className="flex flex-wrap gap-1">
                {g.keys.map(([k, label]) => (
                  <button key={k} type="button" title={`{{${k}}}`} onClick={() => insert(k)} className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs hover:border-zinc-500 dark:border-zinc-700">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </details>
      )}
    </div>
  )

  const preview = (
    <div className="min-w-0 overflow-auto rounded-xl bg-zinc-100 p-3 dark:bg-zinc-950">
      <div className="mx-auto max-h-[70vh] max-w-[210mm] overflow-auto bg-white p-8 text-[12px] leading-snug text-black shadow-sm">
        <DocBody blocks={blocks} names={names} client={client} contractor={contractor} />
      </div>
    </div>
  )

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="w-full max-w-sm">
          <Segmented value={view} onChange={(v) => setView(v as typeof view)} options={[{ value: 'both', label: T('Текст и просмотр') }, { value: 'edit', label: T('Текст') }, { value: 'preview', label: T('Просмотр') }]} />
        </div>
        {unknown.length > 0 && <span className="text-xs font-medium text-red-600">{Tf('Неизвестные поля: {0}', [unknown.map((k) => `{{${k}}}`).join(', ')])}</span>}
      </div>
      <div className={`grid gap-4 ${view === 'both' ? 'xl:grid-cols-2' : ''}`}>
        {view !== 'preview' && editor}
        {view !== 'edit' && preview}
      </div>
    </div>
  )
}
