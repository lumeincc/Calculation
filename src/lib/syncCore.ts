/** Pure merge logic of the estimate sync (kept separate from I/O so it can be tested). */
import { cloneEstimate, type Estimate } from './estimate'
import type { ApiRecord } from './api'

/** Ids of estimates that were created/changed or removed between two store snapshots. */
export function diffEstimates(prev: Estimate[], next: Estimate[]): { changed: string[]; removed: string[] } {
  const before = new Map(prev.map((e) => [e.id, e]))
  const after = new Set(next.map((e) => e.id))
  const changed = next.filter((e) => before.get(e.id) !== e).map((e) => e.id)
  const removed = prev.filter((e) => !after.has(e.id)).map((e) => e.id)
  return { changed, removed }
}

export interface MergeResult {
  estimates: Estimate[]
  versions: Record<string, number>
  /** Local copies created because both sides edited the same estimate. */
  conflictCopies: Estimate[]
}

export function conflictCopy(local: Estimate): Estimate {
  return cloneEstimate(local, `${local.name} (конфликт — ваша версия)`)
}

/**
 * Applies server records to local estimates. A record newer than the known version replaces the
 * local estimate; if the local one has unsent edits, those are kept as a separate copy.
 */
export function mergeRemote(local: Estimate[], versions: Record<string, number>, dirty: Set<string>, items: ApiRecord<Estimate>[]): MergeResult {
  const byId = new Map(local.map((e) => [e.id, e]))
  const v = { ...versions }
  const conflictCopies: Estimate[] = []
  for (const it of items) {
    const known = v[it.id] ?? 0
    if (it.version <= known) continue
    const mine = byId.get(it.id)
    if (mine && dirty.has(it.id)) conflictCopies.push(conflictCopy(mine))
    if (it.deleted) byId.delete(it.id)
    else if (it.data) byId.set(it.id, { ...it.data, id: it.id })
    v[it.id] = it.version
  }
  // Keep local order for existing estimates, new ones first.
  const ordered = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
  return { estimates: [...conflictCopies, ...ordered], versions: v, conflictCopies }
}
