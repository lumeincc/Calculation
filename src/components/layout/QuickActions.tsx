import { Archive, Calculator, FilePlus2, FileSignature, FolderUp, Receipt, Weight, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { T } from '@/i18n'
import { useEstimates } from '@/store/estimates'
import { useSettings } from '@/store/settings'

interface Action {
  id: string
  label: string
  hint: string
  icon: LucideIcon
  /** A route, or a function returning one (to create something first). */
  to: string | (() => string)
}

function useActions(): { group: string; items: Action[] }[] {
  const create = useEstimates((s) => s.create)
  const defaults = useSettings((s) => s.estimateDefaults)
  return [
    {
      group: T('Расчёты'),
      items: [
        { id: 'estimate', label: T('Новая смета'), hint: T('пустая смета с вашими начислениями'), icon: FilePlus2, to: () => `/estimates/${create(T('Новая смета'), defaults)}` },
        { id: 'docs', label: T('Загрузить проект'), hint: T('PDF, Excel, ZIP — найдём тоннаж'), icon: FolderUp, to: '/docs' },
        { id: 'metal', label: T('Тоннаж металла'), hint: T('масса профилей по ГОСТ'), icon: Weight, to: '/calc/metal' },
        { id: 'calc', label: T('Калькуляторы'), hint: T('бетон, кладка, кровля…'), icon: Calculator, to: '/calc' },
      ],
    },
    {
      group: T('Документооборот'),
      items: [
        { id: 'contract', label: T('Новый договор'), hint: T('из шаблона или сметы'), icon: FileSignature, to: '/office/contracts?new=1' },
        { id: 'paper', label: T('Счёт или акт'), hint: T('по договору в один клик'), icon: Receipt, to: '/office/papers?new=1' },
        { id: 'archive', label: T('Файл в архив'), hint: T('сканы, письма, чертежи'), icon: Archive, to: '/office/files' },
      ],
    },
  ]
}

/** «+» menu: the things people start most often, one tap away. Popover on desktop, bottom sheet on phones. */
export function QuickActions({ open, onClose, variant, top }: { open: boolean; onClose(): void; variant: 'popover' | 'sheet'; /** Popover: y of the «+» button. */ top?: number }) {
  const groups = useActions()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: MouseEvent) =>
      variant === 'popover' && !ref.current?.contains(e.target as Node) && !(e.target as Element).closest?.('[data-quick-toggle]') && onClose()
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, onClose, variant])

  if (!open) return null
  const run = (a: Action) => {
    onClose()
    navigate(typeof a.to === 'function' ? a.to() : a.to)
  }
  const list = (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.group}>
          <div className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">{g.group}</div>
          <div className={variant === 'sheet' ? 'grid grid-cols-2 gap-2' : 'space-y-0.5'}>
            {g.items.map((a) =>
              variant === 'sheet' ? (
                <button key={a.id} onClick={() => run(a)} className="flex flex-col items-start gap-2 rounded-2xl border border-zinc-200 bg-white p-3 text-left active:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"><a.icon size={18} /></span>
                  <span className="text-sm leading-tight font-semibold">{a.label}</span>
                  <span className="text-[11px] leading-tight text-zinc-500">{a.hint}</span>
                </button>
              ) : (
                <button key={a.id} onClick={() => run(a)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"><a.icon size={16} /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{a.label}</span>
                    <span className="block truncate text-xs text-zinc-500">{a.hint}</span>
                  </span>
                </button>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  )

  if (variant === 'popover')
    return (
      <div ref={ref} style={{ top: Math.max(12, Math.min(top ?? 120, window.innerHeight - 460)) }} className="animate-pop fixed left-[96px] z-40 w-72 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-2xl backdrop-blur-xl dark:border-zinc-700 dark:bg-zinc-900/95" role="menu" aria-label={T('Быстрые действия')}>
        {list}
      </div>
    )
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal aria-label={T('Быстрые действия')}>
      <div className="animate-fade-in absolute inset-0 bg-zinc-950/50" onClick={onClose} />
      <div className="animate-sheet absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-zinc-50 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-zinc-950">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{T('Что делаем?')}</h2>
          <button onClick={onClose} aria-label={T('Закрыть')} className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"><X size={18} /></button>
        </div>
        {list}
      </div>
    </div>
  )
}
