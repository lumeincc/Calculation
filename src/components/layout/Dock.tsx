import { Plus, Search, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useSyncStatus } from '@/lib/sync'
import { useOffice } from '@/office/store'
import { useAuth } from '@/store/auth'
import { useDocs } from '@/store/docs'
import { useEstimates } from '@/store/estimates'
import { BACK_TO_MAIN, BOTTOM_NAV, isOffice, MAIN_NAV, OFFICE_ENTRY, OFFICE_NAV } from './nav'
import { QuickActions } from './QuickActions'
import { TonnaLogo } from './TonnaLogo'
import { T } from '@/i18n'

function Tile({ label, icon: Icon, active, badge, dot, onClick, to, end, tour, strong }: {
  label: string; icon: LucideIcon; active?: boolean; badge?: number; dot?: string; onClick?: () => void; to?: string; end?: boolean; tour?: string
  /** Filled tile for the primary «+» action. */
  strong?: boolean
}) {
  const inner = (isActive: boolean) => (
    <div className="group relative flex h-11 w-11 items-center justify-center">
      <span
        className={`flex h-full w-full items-center justify-center rounded-[14px] border ${
          isActive || strong
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
      <span className={`pointer-events-none absolute top-1/2 left-full ml-4 -translate-y-1/2 rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-white hidden shadow-lg ${strong && isActive ? '' : 'group-hover:block'} dark:bg-white dark:text-zinc-900`}>
        {label}
      </span>
    </div>
  )
  if (to)
    return (
      <NavLink to={to} end={end} aria-label={label} data-tour={tour ?? to} className="relative flex items-center">
        {({ isActive }) => (
          <>
            {isActive && <span className="absolute -left-2.5 h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-white" />}
            {inner(isActive)}
          </>
        )}
      </NavLink>
    )
  return (
    <button type="button" aria-label={label} aria-expanded={strong ? active : undefined} data-tour={tour} data-quick-toggle={strong ? '' : undefined} onClick={onClick} className="flex items-center">
      {inner(Boolean(active))}
    </button>
  )
}

export function Dock({ onSearch }: { onSearch(): void }) {
  const estimates = useEstimates((s) => s.estimates.length)
  const docs = useDocs((s) => s.files.filter((f) => f.kind !== 'archive').length)
  const contracts = useOffice((s) => s.contracts.filter((c) => c.status === 'review' || c.status === 'signing').length)
  const loggedIn = useAuth((s) => Boolean(s.token))
  const sync = useSyncStatus((s) => s.status)
  const office = isOffice(useLocation().pathname)
  const counts: Record<string, number> = { '/estimates': estimates, '/docs': docs, '/office/contracts': contracts }
  const syncDot = !loggedIn ? undefined : sync === 'error' ? 'bg-red-500' : sync === 'offline' ? 'bg-amber-500' : 'bg-emerald-500'
  const [quick, setQuick] = useState(false)
  const [quickTop, setQuickTop] = useState(0)
  const divider = <span className="my-0.5 h-px w-8 bg-zinc-200 dark:bg-zinc-700" />

  return (
    <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[84px] items-center lg:flex">
      <nav className="mx-auto flex w-[64px] flex-col items-center gap-2 rounded-[22px] border border-zinc-200/70 bg-white/60 py-3 shadow-xl shadow-zinc-900/5 backdrop-blur-xl dark:border-zinc-700/60 dark:bg-zinc-900/60 dark:shadow-black/40">
        <NavLink to={office ? '/office' : '/'} aria-label={office ? T('Документооборот') : T('TONNA — на главную')} className="mb-1 flex flex-col items-center justify-center text-zinc-900 dark:text-white">
          <TonnaLogo className="h-11 w-auto" />
          {office && <span className="mt-1 text-[9px] font-bold tracking-[0.18em]">DOCS</span>}
        </NavLink>
        <Tile
          label={T('Создать…')}
          icon={Plus}
          strong
          active={quick}
          onClick={() => {
            const el = document.querySelector('aside [data-quick-toggle]')
            setQuickTop((el?.getBoundingClientRect().top ?? 120) - 8)
            setQuick((q) => !q)
          }}
          tour="quick"
        />
        <Tile label={T('Поиск (Ctrl K)')} icon={Search} onClick={onSearch} tour="search" />
        {divider}
        {(office ? OFFICE_NAV : MAIN_NAV).map((n) => (
          <Tile key={n.to} to={n.to} end={n.end} label={n.label} icon={n.icon} badge={counts[n.to]} />
        ))}
        {divider}
        {office ? <Tile to={BACK_TO_MAIN.to} end label={BACK_TO_MAIN.label} icon={BACK_TO_MAIN.icon} /> : <Tile to={OFFICE_ENTRY.to} label={OFFICE_ENTRY.label} icon={OFFICE_ENTRY.icon} badge={contracts} />}
        {BOTTOM_NAV.map((n) => (
          <Tile key={n.to} to={n.to} label={n.label} icon={n.icon} dot={n.to === '/account' ? syncDot : undefined} />
        ))}
      </nav>
      <QuickActions open={quick} onClose={() => setQuick(false)} variant="popover" top={quickTop} />
    </aside>
  )
}
