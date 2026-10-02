import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CalcResult } from '@/calculators/types'
import { T } from '@/i18n'
import { fmt } from '@/lib/format'

/**
 * Phones: the form is long and the result sits below it, so the main figures float above the
 * bottom bar while the result panel is off screen. A tap scrolls to the result and «В смету».
 */
export function MobileResultBar({ result, targetId }: { result: CalcResult; targetId: string }) {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const el = document.getElementById(targetId)
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setHidden(e.isIntersecting || e.boundingClientRect.top < 0), { threshold: 0.05 })
    io.observe(el)
    return () => io.disconnect()
  }, [targetId])
  const main = result.metrics.filter((m) => m.primary).slice(0, 2)
  if (!main.length) return null
  // Portal: the animated page wrapper would turn position: fixed into absolute.
  return createPortal(
    <button
      onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      aria-label={T('К результату')}
      className={`no-print fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-4 rounded-2xl bg-zinc-900 px-4 py-2.5 text-left text-white shadow-xl shadow-zinc-900/30 transition duration-300 lg:hidden dark:bg-white dark:text-zinc-900 ${hidden ? 'pointer-events-none translate-y-4 opacity-0' : ''}`}
    >
      {main.map((m) => (
        <span key={m.label} className="min-w-0">
          <span className="block truncate text-[11px] opacity-70">{m.label}</span>
          <span className="block text-base font-semibold tabular-nums">
            {fmt(m.value, m.digits ?? 2)} <span className="text-xs font-normal opacity-70">{m.unit}</span>
          </span>
        </span>
      ))}
      <span className="ml-auto flex shrink-0 items-center gap-1 text-xs font-medium">
        {T('Результат')} <ChevronDown size={15} />
      </span>
    </button>,
    document.body,
  )
}
