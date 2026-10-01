import { FileSpreadsheet, FolderOpen, Search, Settings, Tags } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { searchCalculators } from '@/calculators/registry'
import { useEstimates } from '@/store/estimates'

interface Item {
  id: string
  title: string
  subtitle?: string
  icon: ReactNode
  to: string
}

const PAGES: Item[] = [
  { id: 'p-docs', title: 'Документы', subtitle: 'Загрузить файлы и архивы', icon: <FolderOpen size={18} />, to: '/docs' },
  { id: 'p-est', title: 'Сметы', subtitle: 'Список смет', icon: <FileSpreadsheet size={18} />, to: '/estimates' },
  { id: 'p-prices', title: 'Справочник цен', icon: <Tags size={18} />, to: '/prices' },
  { id: 'p-settings', title: 'Настройки', icon: <Settings size={18} />, to: '/settings' },
]

export function CommandPalette({ open, onClose }: { open: boolean; onClose(): void }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const estimates = useEstimates((s) => s.estimates)
  const ref = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      setQ('')
      setActive(0)
      setTimeout(() => input.current?.focus(), 0)
    }
    if (!open && d.open) d.close()
  }, [open])

  const items = useMemo<Item[]>(() => {
    const calcs = searchCalculators(q).map((c) => ({ id: c.id, title: c.title, subtitle: c.short, icon: <c.icon size={18} />, to: `/calc/${c.id}` }))
    const ql = q.trim().toLowerCase()
    const est = estimates
      .filter((e) => ql && e.name.toLowerCase().includes(ql))
      .slice(0, 5)
      .map((e) => ({ id: e.id, title: e.name, subtitle: 'Смета', icon: <FileSpreadsheet size={18} />, to: `/estimates/${e.id}` }))
    const pages = PAGES.filter((p) => !ql || p.title.toLowerCase().includes(ql))
    return [...calcs, ...est, ...pages].slice(0, 30)
  }, [q, estimates])

  const go = (it: Item | undefined) => {
    if (!it) return
    navigate(it.to)
    onClose()
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="no-print mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-zinc-950/50 backdrop:backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <div className="flex items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
        <Search size={18} className="text-zinc-400" />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((a) => Math.min(items.length - 1, a + 1))
            else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1))
            else if (e.key === 'Enter') go(items[active])
            else return
            e.preventDefault()
          }}
          placeholder="Калькулятор, смета, раздел… например «швеллер» или «щебень»"
          className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-zinc-400"
        />
      </div>
      <ul className="max-h-[50vh] overflow-y-auto p-2">
        {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-zinc-500">Ничего не найдено</li>}
        {items.map((it, i) => (
          <li key={it.id}>
            <button
              onMouseMove={() => setActive(i)}
              onClick={() => go(it)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === active ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
            >
              <span className="text-zinc-500">{it.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{it.title}</span>
                {it.subtitle && <span className="block truncate text-xs text-zinc-500">{it.subtitle}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  )
}
