import {
  Monitor, Moon, Search, Sun, X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { applyTheme, useSettings, type Theme } from '@/store/settings'
import { useEstimates } from '@/store/estimates'
import { useDocs } from '@/store/docs'
import { CommandPalette } from './CommandPalette'
import { Dock } from './Dock'
import { BOTTOM_NAV, isOffice, MAIN_NAV, OFFICE_NAV, type NavEntry } from './nav'
import { BottomBar } from './BottomBar'
import { QuickActions } from './QuickActions'
import { TonnaLogo } from './TonnaLogo'
import { Toasts } from './Toasts'
import { LANGS, lang, setLang, T } from '@/i18n'

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const estimates = useEstimates((s) => s.estimates.length)
  const docs = useDocs((s) => s.files.filter((f) => f.kind !== 'archive').length)
  const count: Record<string, number> = { '/estimates': estimates, '/docs': docs }
  const link = ({ to, label, icon: Icon, end }: NavEntry) => (
    <NavLink
      key={to}
      to={to}
      end={end}
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
  )
  const heading = (t: string) => <div className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">{t}</div>
  // Both sections at once, so everything is one tap away on a phone.
  return (
    <nav className="flex flex-col gap-0.5">
      {heading(T('Расчёты и сметы'))}
      {MAIN_NAV.map(link)}
      {heading(T('Документооборот'))}
      {OFFICE_NAV.map(link)}
      {heading(T('Компания'))}
      {BOTTOM_NAV.map(link)}
    </nav>
  )
}

function ThemeSwitch() {
  const theme = useSettings((s) => s.theme)
  const setTheme = useSettings((s) => s.setTheme)
  const items: { v: Theme; icon: ReactNode; label: string }[] = [
    { v: 'light', icon: <Sun size={15} />, label: T('Светлая') },
    { v: 'system', icon: <Monitor size={15} />, label: T('Как в системе') },
    { v: 'dark', icon: <Moon size={15} />, label: T('Тёмная') },
  ]
  return (
    <div className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800/70" role="radiogroup" aria-label={T('Тема')}>
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

function LangSwitch() {
  return (
    <div className="mt-2 flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800/70" role="radiogroup" aria-label={T('Язык')}>
      {LANGS.map((l) => (
        <button
          key={l.value}
          aria-label={l.label}
          aria-checked={lang === l.value}
          role="radio"
          onClick={() => l.value !== lang && setLang(l.value)}
          className={`flex h-7 flex-1 items-center justify-center rounded-md text-xs font-semibold transition ${lang === l.value ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
        >
          {l.short}
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
  const office = isOffice(location.pathname)
  const [quick, setQuick] = useState(false)
  const [path, setPath] = useState(location.pathname)
  if (path !== location.pathname) {
    // Close phone overlays on any navigation (links, back button, search).
    setPath(location.pathname)
    setMenu(false)
    setQuick(false)
  }

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
        <Link to={office ? '/office' : '/'} aria-label={T('TONNA — на главную')} className="flex shrink-0 items-center gap-1.5 text-zinc-900 dark:text-white">
          <TonnaLogo className="h-8 w-auto" />
          {office && <span className="text-[10px] font-bold tracking-[0.16em]">DOCS</span>}
        </Link>
        <button onClick={() => setPalette(true)} data-tour="search" className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-zinc-100 px-3 text-sm text-zinc-500 dark:bg-zinc-800/80">
          <Search size={16} className="shrink-0" />
          <span className="truncate">{T('Поиск: калькулятор, смета, договор…')}</span>
        </button>
      </header>

      {menu && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-zinc-950/40" onClick={() => setMenu(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-white px-3 py-4 shadow-xl dark:bg-zinc-950">
            <div className="mb-5 flex items-center justify-between px-2">
              <TonnaLogo className="h-9 w-auto text-zinc-900 dark:text-white" />
              <button onClick={() => setMenu(false)} aria-label={T('Закрыть меню')} className="rounded-md p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X size={18} />
              </button>
            </div>
            <NavItems onNavigate={() => setMenu(false)} />
            <div className="mt-auto px-1 pt-4">
              <ThemeSwitch />
              <LangSwitch />
            </div>
          </div>
        </div>
      )}

      <main className="pb-24 lg:pb-0 lg:pl-[84px]">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div key={location.pathname} className="animate-page">
            <Outlet />
          </div>
        </div>
      </main>

      <BottomBar onPlus={() => setQuick(true)} onMenu={() => setMenu(true)} />
      <QuickActions open={quick} onClose={() => setQuick(false)} variant="sheet" />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <Toasts />
    </div>
  )
}
