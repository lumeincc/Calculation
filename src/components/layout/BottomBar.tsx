import { Archive, Calculator, FileSignature, FileSpreadsheet, Home, LayoutDashboard, Menu, Plus, type LucideIcon } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { T } from '@/i18n'
import { useEstimates } from '@/store/estimates'
import { isOffice } from './nav'

interface Item {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const MAIN: Item[] = [
  { to: '/', label: T('Главная'), icon: Home, end: true },
  { to: '/calc', label: T('Расчёты'), icon: Calculator },
]
const MAIN_RIGHT: Item[] = [{ to: '/estimates', label: T('Сметы'), icon: FileSpreadsheet }]

const OFFICE: Item[] = [
  { to: '/office', label: T('Обзор'), icon: LayoutDashboard, end: true },
  { to: '/office/contracts', label: T('Договоры'), icon: FileSignature },
]
const OFFICE_RIGHT: Item[] = [{ to: '/office/files', label: T('Архив'), icon: Archive }]

function Tab({ item, badge }: { item: Item; badge?: number }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      data-tour={item.to}
      className={({ isActive }) => `relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium ${isActive ? 'text-zinc-950 dark:text-white' : 'text-zinc-500'}`}
    >
      {({ isActive }) => (
        <>
          <span className={`flex h-7 w-12 items-center justify-center rounded-full transition ${isActive ? 'bg-zinc-200/80 dark:bg-zinc-800' : ''}`}>
            <item.icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
          </span>
          {item.label}
          {badge ? <span className="absolute top-1 left-1/2 ml-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] font-semibold text-white">{badge > 99 ? '99+' : badge}</span> : null}
        </>
      )}
    </NavLink>
  )
}

/** Phone navigation: the main sections at the thumb, «+» for quick actions, «Меню» for everything else. */
export function BottomBar({ onPlus, onMenu }: { onPlus(): void; onMenu(): void }) {
  const office = isOffice(useLocation().pathname)
  const estimates = useEstimates((s) => s.estimates.length)
  const left = office ? OFFICE : MAIN
  const right = office ? OFFICE_RIGHT : MAIN_RIGHT
  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden dark:border-zinc-800 dark:bg-zinc-950/90"
      aria-label={T('Навигация')}
    >
      <div className="mx-auto flex max-w-md items-stretch px-1">
        {left.map((i) => <Tab key={i.to} item={i} />)}
        <div className="flex flex-1 items-start justify-center">
          <button
            onClick={onPlus}
            data-tour="quick"
            aria-label={T('Быстрые действия')}
            className="-mt-4 flex h-13 w-13 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-lg shadow-zinc-900/30 ring-4 ring-zinc-50 active:scale-95 dark:bg-white dark:text-zinc-900 dark:ring-zinc-950"
          >
            <Plus size={26} strokeWidth={2.2} />
          </button>
        </div>
        {right.map((i) => <Tab key={i.to} item={i} badge={i.to === '/estimates' ? estimates : undefined} />)}
        <button onClick={onMenu} data-tour="menu" className="flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium text-zinc-500">
          <span className="flex h-7 w-12 items-center justify-center"><Menu size={20} strokeWidth={1.8} /></span>
          {T('Меню')}
        </button>
      </div>
    </nav>
  )
}
