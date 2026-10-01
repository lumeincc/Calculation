import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Modal } from '@/components/ui/misc'
import { PRICE_GROUPS, type PriceEntry } from '@/data/prices'
import { money } from '@/lib/format'
import { catalogEntries, priceOf, usePrices } from '@/store/prices'

/** Picks an entry from the price catalog to add to an estimate section. */
export function CatalogPicker({ open, onClose, onPick }: { open: boolean; onClose(): void; onPick(e: PriceEntry, price: number): void }) {
  const overrides = usePrices((s) => s.overrides)
  const custom = usePrices((s) => s.custom)
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const list = catalogEntries(custom).filter((e) => !ql || e.name.toLowerCase().includes(ql) || e.group.toLowerCase().includes(ql))
    const names = [...PRICE_GROUPS, 'Мои позиции']
    return names.map((g) => ({ g, items: list.filter((e) => (e.key.startsWith('custom-') ? 'Мои позиции' : e.group) === g) })).filter((x) => x.items.length)
  }, [q, custom])

  return (
    <Modal open={open} onClose={onClose} title="Добавить из справочника" wide>
      <div className="relative mb-3">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
        <input className="input pl-9" placeholder="Поиск: бетон, ГКЛ, монтаж…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <div className="space-y-4">
        {groups.map(({ g, items }) => (
          <div key={g}>
            <div className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">{g}</div>
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {items.map((e) => {
                const price = priceOf(e.key, overrides, custom)
                return (
                  <li key={e.key}>
                    <button onClick={() => onPick(e, price)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                      <span className="flex-1">{e.name}</span>
                      <span className="shrink-0 text-zinc-500 tabular-nums">
                        {money(price)} / {e.unit}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {groups.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">Ничего не найдено</p>}
      </div>
    </Modal>
  )
}
