import {
  ArrowUpRight, Building2, Command, DatabaseBackup, FileArchive, FileSignature, Languages, Link2, Paintbrush, RefreshCw, Scale, Sparkles, type LucideIcon,
} from 'lucide-react'
import { useMemo, useState, type MouseEvent } from 'react'
import { Link } from 'react-router'
import { T } from '@/i18n'
import { useEstimates } from '@/store/estimates'
import { useSettings } from '@/store/settings'

type Kind = 'important' | 'new' | 'tip'

interface Tip {
  id: string
  kind: Kind
  icon: LucideIcon
  title: string
  text: string
  to?: string
  /** Opens the search palette instead of navigating. */
  search?: boolean
}

const KIND: Record<Kind, { label: string; cls: string }> = {
  important: { label: T('Важно'), cls: 'bg-accent-500/15 text-accent-700 ring-accent-500/30 dark:text-accent-300' },
  new: { label: T('Новое'), cls: 'bg-zinc-900 text-white ring-zinc-900 dark:bg-white dark:text-zinc-900 dark:ring-white' },
  tip: { label: T('Совет'), cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700' },
}

const TIPS: Tip[] = [
  { id: 'office', kind: 'new', icon: FileSignature, title: T('Документооборот'), text: T('Договоры из шаблонов, счета и акты в один клик, подписи и архив файлов по папкам.'), to: '/office' },
  { id: 'search', kind: 'tip', icon: Command, title: T('Ctrl + K — поиск по всему'), text: T('Калькуляторы, сметы, договоры, контрагенты и файлы — в одном окне.'), search: true },
  { id: 'zip', kind: 'tip', icon: FileArchive, title: T('Бросьте архив проекта целиком'), text: T('ZIP или RAR с КМ и КЖ — сайт распакует, найдёт спецификации и посчитает тоннаж.'), to: '/docs' },
  { id: 'gross', kind: 'tip', icon: Scale, title: T('Чистовой и черновой вес'), text: T('Черновой — с отходами на раскрой. По нему удобно заказывать металл.'), to: '/docs' },
  { id: 'contract', kind: 'tip', icon: FileSignature, title: T('Договор прямо из сметы'), text: T('Выберите смету при создании договора — сумма, НДС и объект подставятся сами.'), to: '/office/contracts?new=1' },
  { id: 'paint', kind: 'tip', icon: Paintbrush, title: T('Окраска металлоконструкций'), text: T('Площадь окраски считается по профилям — в стоимости металлоконструкции после загрузки КМ.'), to: '/docs' },
  { id: 'share', kind: 'tip', icon: Link2, title: T('Поделитесь расчётом'), text: T('Кнопка «Поделиться» в калькуляторе даёт ссылку со всеми введёнными размерами.'), to: '/calc/metal' },
  { id: 'cp', kind: 'tip', icon: Building2, title: T('Реквизиты контрагентов'), text: T('Внесите заказчика один раз — он подставится во все договоры, счета и акты.'), to: '/office/counterparties' },
  { id: 'lang', kind: 'tip', icon: Languages, title: T('Есть английская версия'), text: T('Язык и тема переключаются в настройках.'), to: '/settings' },
]

function Card({ tip, index }: { tip: Tip; index: number }) {
  const k = KIND[tip.kind]
  const move = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className={`relative flex h-9 w-9 items-center justify-center rounded-xl ${tip.kind === 'important' ? 'bg-accent-500 text-white shadow-[0_0_18px_rgb(249_115_22/0.45)]' : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'}`}>
          <tip.icon size={18} strokeWidth={1.9} />
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${k.cls}`}>{k.label}</span>
      </div>
      <div className="mt-3 text-sm font-semibold">{tip.title}</div>
      <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{tip.text}</p>
      <ArrowUpRight size={16} className="absolute right-3 bottom-3 text-zinc-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-600 dark:group-hover:text-white" />
    </>
  )
  const cls = `spot group lift card block h-full p-4 pb-8 text-left ${tip.kind === 'important' ? 'border-accent-300 dark:border-accent-900' : ''}`
  const style = { animationDelay: `${index * 60}ms` }
  if (tip.search)
    return (
      <button type="button" className={cls} style={style} onMouseMove={move} onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}>
        {body}
      </button>
    )
  return (
    <Link to={tip.to ?? '/'} className={cls} style={style} onMouseMove={move}>
      {body}
    </Link>
  )
}

const VISIBLE = 4

export function Recommendations() {
  const company = useSettings((s) => s.company)
  const hasEstimates = useEstimates((s) => s.estimates.length > 0)
  // Start from a different tip every day so the block doesn't feel static.
  const [offset, setOffset] = useState(() => Math.floor(Date.now() / 86_400_000) % TIPS.length)

  const important = useMemo(() => {
    const out: Tip[] = []
    if (!company.name || !company.inn)
      out.push({ id: 'company', kind: 'important', icon: Sparkles, title: T('Заполните реквизиты компании'), text: T('Название, БИН и банк попадут в сметы, КП, договоры и счета.'), to: '/settings' })
    if (!hasEstimates)
      out.push({ id: 'first', kind: 'important', icon: Sparkles, title: T('Первая смета за минуту'), text: T('Посчитайте материал в калькуляторе и нажмите «В смету».'), to: '/calc' })
    else
      out.push({ id: 'backup', kind: 'tip', icon: DatabaseBackup, title: T('Сделайте резервную копию'), text: T('Сметы хранятся в браузере — сохраните копию файлом в настройках.'), to: '/settings' })
    return out
  }, [company, hasEstimates])

  const rest = VISIBLE - important.length
  const rotating = Array.from({ length: rest }, (_, i) => TIPS[(offset + i) % TIPS.length])
  const shown = [...important, ...rotating]

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{T('Рекомендации')}</h2>
        <button onClick={() => setOffset((o) => (o + rest) % TIPS.length)} className="group inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
          <RefreshCw size={14} className="transition duration-500 group-hover:rotate-180" /> {T('Ещё советы')}
        </button>
      </div>
      <div key={offset} className="stagger no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4 [&>*]:w-64 [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto">
        {shown.map((t, i) => <Card key={t.id} tip={t} index={i} />)}
      </div>
    </section>
  )
}
