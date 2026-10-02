import { describe, expect, it } from 'vitest'
import { createEstimate } from './estimate'
import { diffEstimates, mergeRemote } from './syncCore'

describe('sync merge', () => {
  it('detects changed and removed estimates by reference', () => {
    const a = createEstimate('A'), b = createEstimate('B'), c = createEstimate('C')
    const b2 = { ...b, name: 'B2' }
    expect(diffEstimates([a, b, c], [a, b2])).toEqual({ changed: [b.id], removed: [c.id] })
  })

  it('applies newer server versions, deletes tombstones and ignores stale records', () => {
    const a = createEstimate('A'), b = createEstimate('B')
    const r = mergeRemote([a, b], { [a.id]: 2, [b.id]: 1 }, new Set(), [
      { id: a.id, version: 2, updatedAt: 1, updatedBy: 'x', data: { ...a, name: 'old' } },
      { id: b.id, version: 3, updatedAt: 1, updatedBy: 'x', deleted: true },
      { id: 'new-estimate-id', version: 1, updatedAt: 1, updatedBy: 'x', data: { ...createEstimate('N'), id: 'whatever' } },
    ])
    expect(r.estimates.map((e) => e.name).sort()).toEqual(['A', 'N'])
    expect(r.estimates.find((e) => e.name === 'N')!.id).toBe('new-estimate-id')
    expect(r.versions).toEqual({ [a.id]: 2, [b.id]: 3, 'new-estimate-id': 1 })
  })

  it('keeps unsent local edits as a copy when the server version changed', () => {
    const a = { ...createEstimate('Мой'), name: 'Мой (правка)' }
    const r = mergeRemote([a], { [a.id]: 1 }, new Set([a.id]), [{ id: a.id, version: 2, updatedAt: 1, updatedBy: 'Коллега', data: { ...a, name: 'Коллеги' } }])
    expect(r.estimates.map((e) => e.name)).toEqual(['Мой (правка) (конфликт — ваша версия)', 'Коллеги'])
    expect(r.conflictCopies).toHaveLength(1)
    expect(r.conflictCopies[0].id).not.toBe(a.id)
  })
})
