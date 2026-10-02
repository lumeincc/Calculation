import {
  Calculator, CircleUserRound, FileSpreadsheet, FolderOpen, Home, Menu, Monitor, Moon, Search, Settings, Sun, Tags, Weight, X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { applyTheme, useSettings, type Theme } from '@/store/settings'
import { useEstimates } from '@/store/estimates'
import { useDocs } from '@/store/docs'
import { CommandPalette } from './CommandPalette'
import { Dock } from './Dock'
import { TonnaLogo } from './TonnaLogo'
import { Toasts } from './Toasts'

const NAV_FULL = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/calc', label: 'Калькуляторы', icon: Calculator },
  { to: '/docs', label: 'Документы', icon: FolderOpen },
  { to: '/estimates', label: 'Сметы', icon: FileSpreadsheet },
  { to: '/calc/metal', label: 'Тоннаж металла', icon: Weight },
  { to: '/prices', label: 'Справочник цен', icon: Tags },
  { to: '/account', label: 'Аккаунт и команда', icon: CircleUserRound },
  { to: '/settings', label: 'Настройки', icon: Settings },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const estimates = useEstimates((s) => s.estimates.length)
  const docs = useDocs((s) => s.files.filter((f) => f.kind !== 'archive').length)
  const count: Record<string, number> = { '/estimates': estimates, '/docs': docs }
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_FULL.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end ?? to === '/calc'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-brand-50 text-brand-800 dark:bg-brand-950/60 dark:text-white'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100'
            }`
          }
        >
          <Icon size={18} strokeWidth={1.9} />
          <span className="flex-1">{label}</span>
          {count[to] ? <span className="rounded-md bg-zinc-200/70 px-1.5 text-xs tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{count[to]}</span> : null}
        </NavLink>
      ))}
    </nav>
  )
}

function ThemeSwitch() {
  const theme = useSettings((s) => s.theme)
  const setTheme = useSettings((s) => s.setTheme)
  const items: { v: Theme; icon: ReactNode; label: string }[] = [
    { v: 'light', icon: <Sun size={15} />, label: 'Светлая' },
    { v: 'system', icon: <Monitor size={15} />, label: 'Как в системе' },
    { v: 'dark', icon: <Moon size={15} />, label: 'Тёмная' },
  ]
  return (
    <div className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800/70" role="radiogroup" aria-label="Тема">
      {items.map((i) => (
        <button
          key={i.v}
          title={i.label}
          aria-label={i.label}
          aria-checked={theme === i.v}
          role="radio"
          onClick={() => setTheme(i.v)}
          className={`flex h-7 flex-1 items-center justify-center rounded-md transition ${theme === i.v ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
        >
          {i.icon}
        </button>
      ))}
    </div>
  )
}

export function Layout() {
  const [menu, setMenu] = useState(false)
  const [palette, setPalette] = useState(false)
  const theme = useSettings((s) => s.theme)
  const location = useLocation()

  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => applyTheme('system')
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [theme])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="min-h-dvh">
      <Dock onSearch={() => setPalette(true)} />

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-950/90">
        <button onClick={() => setMenu(true)} aria-label="Меню" className="-ml-1 rounded-md p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <Menu size={20} />
        </button>
        <Link to="/" aria-label="TONNA — на главную" className="flex items-center gap-2 text-zinc-900 dark:text-white">
          <TonnaLogo className="h-8 w-auto" />
        </Link>
        <button onClick={() => setPalette(true)} aria-label="Поиск" className="ml-auto rounded-md p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <Search size={19} />
        </button>
      </header>

      {menu && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-zinc-950/40" onClick={() => setMenu(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white px-3 py-4 shadow-xl dark:bg-zinc-950">
            <div className="mb-5 flex items-center justify-between px-2">
              <TonnaLogo className="h-9 w-auto text-zinc-900 dark:text-white" />
              <button onClick={() => setMenu(false)} aria-label="Закрыть меню" className="rounded-md p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X size={18} />
              </button>
            </div>
            <NavItems onNavigate={() => setMenu(false)} />
            <div className="mt-auto px-1">
              <ThemeSwitch />
            </div>
          </div>
        </div>
      )}

      <main className="lg:pl-[84px]">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div key={location.pathname} className="animate-page">
            <Outlet />
          </div>
        </div>
      </main>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <Toasts />
    </div>
  )
}
