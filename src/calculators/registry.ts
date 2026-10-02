import type { LucideIcon } from 'lucide-react'
import { BrickWall, Hammer, House, Layers, Ruler, Shovel, TreePine, Weight } from 'lucide-react'
import { MetalSpecPanel } from '@/components/calculator/MetalSpecPanel'
import { concrete } from './defs/concrete'
import { drywall } from './defs/drywall'
import { bulk, earthwork } from './defs/earth'
import { fence } from './defs/fence'
import { drymix, flooring, paint, screed, tile, wallpaper } from './defs/finish'
import { masonry } from './defs/masonry'
import { metal } from './defs/metal'
import { rebar } from './defs/rebar'
import { roof } from './defs/roof'
import { units } from './defs/units'
import { insulation, lumber, stairs } from './defs/wood'
import type { CalculatorDef, CategoryId, Values } from './types'
import { T } from '@/i18n'

export const CATEGORIES: { id: CategoryId; title: string; icon: LucideIcon }[] = [
  { id: 'metal', title: T('Металл и тоннаж'), icon: Weight },
  { id: 'foundation', title: T('Фундамент и бетон'), icon: Layers },
  { id: 'walls', title: T('Стены и перегородки'), icon: BrickWall },
  { id: 'finish', title: T('Отделка и полы'), icon: Hammer },
  { id: 'roof', title: T('Кровля'), icon: House },
  { id: 'earth', title: T('Земляные и сыпучие'), icon: Shovel },
  { id: 'wood', title: T('Дерево и лестницы'), icon: TreePine },
  { id: 'tools', title: T('Инструменты'), icon: Ruler },
]

metal.Extra = MetalSpecPanel

// Each definition is typed with its own values; the registry only needs the common shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyCalculator = CalculatorDef<any>

export const CALCULATORS: AnyCalculator[] = [
  metal, fence,
  concrete, rebar,
  masonry, drywall, insulation,
  screed, drymix, paint, wallpaper, tile, flooring,
  roof,
  bulk, earthwork,
  lumber, stairs,
  units,
]

export const CALC_MAP: Record<string, AnyCalculator> = Object.fromEntries(CALCULATORS.map((c) => [c.id, c]))

export function getCalculator(id: string | undefined): CalculatorDef<Values> | undefined {
  return id ? CALC_MAP[id] : undefined
}

/** Simple ranked search over title, description and keywords. */
export function searchCalculators(query: string): AnyCalculator[] {
  const q = query.trim().toLowerCase().replace(/ё/g, 'е')
  if (!q) return CALCULATORS
  const words = q.split(/\s+/)
  const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е')
  return CALCULATORS.map((c) => {
    const title = norm(c.title)
    const hay = norm([c.title, c.short, ...c.keywords].join(' '))
    let score = 0
    for (const w of words) {
      if (title.includes(w)) score += 3
      else if (c.keywords.some((k) => norm(k).startsWith(w))) score += 2
      else if (hay.includes(w)) score += 1
      else return { c, score: -1 }
    }
    return { c, score }
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c)
}
