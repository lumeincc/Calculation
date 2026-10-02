import {
  Calculator, CircleUserRound, FileSpreadsheet, FolderOpen, Home, Monitor, Moon, Search, Settings, Sun, Tags, Weight, type LucideIcon,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { useSyncStatus } from '@/lib/sync'
import { useAuth } from '@/store/auth'
import { useDocs } from '@/store/docs'
import { useEstimates } from '@/store/estimates'
import { useSettings, type Theme } from '@/store/settings'

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/calc', label: 'Калькуляторы', icon: Calculator, end: true },
  { to: '/docs', label: 'Документы', icon: FolderOpen },
  { to: '/estimates', label: 'Сметы', icon: FileSpreadsheet },
  { to: '/calc/metal', label: 'Тоннаж металла', icon: Weight },
  { to: '/prices', label: 'Справочник цен', icon: Tags },
]

const BOTTOM = [
  { to: '/account', label: 'Аккаунт и команда', icon: CircleUserRound },
  { to: '/settings', label: 'Настройки', icon: Settings },
]

const THEMES: { v: Theme; icon: LucideIcon; label: string }[] = [
  { v: 'light', icon: Sun, label: 'Тема: светлая' },
  { v: 'dark', icon: Moon, label: 'Тема: тёмная' },
  { v: 'system', icon: Monitor, label: 'Тема: как в системе' },
]

function Tile({ label, icon: Icon, active, badge, dot, onClick, to, end }: {
  label: string; icon: LucideIcon; active?: boolean; badge?: number; dot?: string; onClick?: () => void; to?: string; end?: boolean
}) {
  const inner = (isActive: boolean) => (
    <div className="group relative flex h-11 w-11 items-center justify-center">
      <span
        className={`flex h-full w-full items-center justify-center rounded-[14px] border ${
          isActive
            ? 'border-zinc-900 bg-zinc-900 text-white shadow-md dark:border-white dark:bg-white dark:text-zinc-900'
            : 'border-zinc-200/80 bg-white text-zinc-700 shadow-sm hover:text-zinc-950 dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:text-white'
        }`}
      >
        <Icon size={20} strokeWidth={1.8} />
      </span>
      {badge ? (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] font-semibold text-white tabular-nums">{badge > 99 ? '99+' : badge}</span>
      ) : null}
      {dot && <span className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-zinc-900 ${dot}`} />}
      <span className="pointer-events-none absolute top-1/2 left-full ml-4 -translate-y-1/2 rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-white hidden shadow-lg group-hover:block dark:bg-white dark:text-zinc-900">
        {label}
      </span>
    </div>
  )
  if (to)
    return (
      <NavLink to={to} end={end} aria-label={label} className="relative flex items-center">
        {({ isActive }) => (
          <>
            {isActive && <span className="absolute -left-2.5 h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-white" />}
            {inner(isActive)}
          </>
        )}
      </NavLink>
    )
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex items-center">
      {inner(Boolean(active))}
    </button>
  )
}

export function Dock({ onSearch }: { onSearch(): void }) {
  const estimates = useEstimates((s) => s.estimates.length)
  const docs = useDocs((s) => s.files.filter((f) => f.kind !== 'archive').length)
  const theme = useSettings((s) => s.theme)
  const setTheme = useSettings((s) => s.setTheme)
  const loggedIn = useAuth((s) => Boolean(s.token))
  const sync = useSyncStatus((s) => s.status)
  useLocation() // re-render on navigation so the active tile updates
  const counts: Record<string, number> = { '/estimates': estimates, '/docs': docs }
  const t = THEMES.find((x) => x.v === theme) ?? THEMES[2]
  const syncDot = !loggedIn ? undefined : sync === 'error' ? 'bg-red-500' : sync === 'offline' ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <aside
      className="no-print fixed inset-y-0 left-0 z-30 hidden w-[84px] items-start pt-6 lg:flex"
    >
      <nav className="mx-auto flex w-[64px] flex-col items-center gap-2 rounded-[22px] border border-zinc-200/70 bg-white/60 py-3 shadow-xl shadow-zinc-900/5 backdrop-blur-xl dark:border-zinc-700/60 dark:bg-zinc-900/60 dark:shadow-black/40">
        <Tile label="Поиск (Ctrl K)" icon={Search} onClick={onSearch} />
        <span className="my-0.5 h-px w-8 bg-zinc-200 dark:bg-zinc-700" />
        {NAV.map((n) => (
          <Tile key={n.to} to={n.to} end={n.end} label={n.label} icon={n.icon} badge={counts[n.to]} />
        ))}
        <span className="my-0.5 h-px w-8 bg-zinc-200 dark:bg-zinc-700" />
        {BOTTOM.map((n) => (
          <Tile key={n.to} to={n.to} label={n.label} icon={n.icon} dot={n.to === '/account' ? syncDot : undefined} />
        ))}
        <Tile
          label={t.label}
          icon={t.icon}
          onClick={() => setTheme(THEMES[(THEMES.indexOf(t) + 1) % THEMES.length].v)}
        />
      </nav>
    </aside>
  )
}
