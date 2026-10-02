import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { TonnaLogo } from '@/components/layout/TonnaLogo'
import { T, Tf } from '@/i18n'
import { finishTour } from './tourState'

interface Step {
  /** data-tour attribute of the element to highlight; none → centered card. */
  target?: string
  title: string
  text: string
}

const STEPS: Step[] = [
  { title: T('Добро пожаловать в TONNA'), text: T('Калькуляторы, тоннаж металла, сметы и документы компании — в одном месте. Покажем главное за полминуты.') },
  { target: 'quick', title: T('Кнопка «+» — всё под рукой'), text: T('Новая смета, загрузка проекта, тоннаж металла, договор, счёт или акт — в одно касание из любого места.') },
  { target: '/calc', title: T('Калькуляторы'), text: T('19 расчётов: металл, бетон, арматура, кладка, кровля, отделка, земляные работы. Результат одной кнопкой уходит в смету.') },
  { target: '/docs', title: T('Документы проекта'), text: T('Перетащите PDF, Excel, Word или целый архив ZIP/RAR — сайт найдёт сметы, спецификации и посчитает тоннаж.') },
  { target: '/estimates', title: T('Сметы'), text: T('Наценки, накладные, НДС, скидки. Выгрузка в Excel с формулами и печать в PDF.') },
  { target: '/calc/metal', title: T('Тоннаж металла'), text: T('Масса профилей по ГОСТ, спецификация и итоговый вес — чистовой и черновой.') },
  { target: '/office', title: T('Документооборот'), text: T('Отдельный раздел: договоры из шаблонов, счета и акты, подписи, контрагенты и архив файлов.') },
  { target: 'search', title: T('Поиск — Ctrl + K'), text: T('Быстро открыть калькулятор, смету, договор или файл.') },
  { target: '/settings', title: T('Настройки'), text: T('Начните с реквизитов компании — они попадут во все документы. Там же язык, тема и резервная копия.') },
]

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

function findTarget(step: Step): Rect | null {
  if (!step.target) return null
  const el = [...document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`)].find((e) => e.offsetParent !== null)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height) return null
  const pad = 6
  return { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 }
}

/** First-visit walkthrough: highlights dock items one by one with a short explanation. */
export function Tour({ onClose }: { onClose(): void }) {
  const [i, setI] = useState(0)
  const [, setTick] = useState(0)
  const step = STEPS[i]
  const last = i === STEPS.length - 1
  // Read the target position on every render; a resize just triggers a re-render.
  const rect = findTarget(step)
  useEffect(() => {
    const onResize = () => setTick((t) => t + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const close = useCallback(() => {
    finishTour()
    onClose()
  }, [onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (last) close()
        else setI(i + 1)
      } else if (e.key === 'ArrowLeft') setI(Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, i, last])

  const cardW = 340
  const narrow = window.innerWidth < 640
  const cardStyle = !rect
    ? undefined
    : narrow
      ? // Phones: the card sits above the highlighted tab of the bottom bar.
        { left: 16, width: window.innerWidth - 32, bottom: Math.max(16, window.innerHeight - rect.top + 14) }
      : {
          left: Math.min(rect.left + rect.width + 18, window.innerWidth - cardW - 16),
          top: Math.max(16, Math.min(rect.top + rect.height / 2 - 90, window.innerHeight - 260)),
          width: cardW,
        }

  // Portal: the page wrapper is animated with transforms, which would offset position: fixed.
  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal aria-label={T('Знакомство с TONNA')}>
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-white/90 transition-all duration-300 ease-out"
          style={{ ...rect, boxShadow: '0 0 0 9999px rgb(9 9 11 / 0.62), 0 0 32px 6px rgb(249 115 22 / 0.45)' }}
        />
      ) : (
        <div className="animate-fade-in absolute inset-0 bg-zinc-950/60 backdrop-blur-[2px]" />
      )}
      <div className="absolute inset-0" onClick={close} />

      <div
        key={i}
        className={`animate-pop absolute rounded-2xl border border-zinc-200 bg-white p-5 text-zinc-900 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${rect ? '' : 'top-1/2 left-1/2 w-[min(400px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2'}`}
        style={cardStyle}
      >
        {!rect && i === 0 && (
          <div className="mb-4 flex justify-center">
            <div className="relative">
              <div className="animate-halo absolute -inset-6 rounded-full bg-accent-500/25 blur-2xl" />
              <TonnaLogo className="relative h-16 w-auto" />
            </div>
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold">{step.title}</h3>
          <button onClick={close} aria-label={T('Закрыть')} className="-mt-1 -mr-1 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white">
            <X size={16} />
          </button>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{step.text}</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex flex-1 gap-1">
            {STEPS.map((_, n) => (
              <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-accent-500' : n < i ? 'w-1.5 bg-zinc-900 dark:bg-white' : 'w-1.5 bg-zinc-300 dark:bg-zinc-700'}`} />
            ))}
          </div>
          {i === 0 ? (
            <button onClick={close} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">{T('Пропустить')}</button>
          ) : (
            <button onClick={() => setI(i - 1)} aria-label={T('Назад')} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowLeft size={16} /></button>
          )}
          <button
            onClick={() => (last ? close() : setI(i + 1))}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {i === 0 ? T('Показать') : last ? T('Готово') : T('Далее')} {!last && <ArrowRight size={15} />}
          </button>
        </div>
        <div className="mt-2 text-right text-[11px] text-zinc-400">{Tf('{0} из {1}', [i + 1, STEPS.length])}</div>
      </div>
    </div>,
    document.body,
  )
}
