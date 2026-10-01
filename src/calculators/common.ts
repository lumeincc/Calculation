import { num, pos } from '@/lib/num'
import type { RowValues, RowsField, Values } from './types'

/** Total area of openings (windows/doors) given as rows {w, h, n}. */
export function openingsArea(rows: RowValues[] | undefined): number {
  return (rows ?? []).reduce((s, r) => s + pos(r.w) * pos(r.h) * Math.round(pos(r.n)), 0)
}

/** Total width of openings, used e.g. for plinth length. */
export function openingsWidth(rows: RowValues[] | undefined): number {
  return (rows ?? []).reduce((s, r) => s + pos(r.w) * Math.round(pos(r.n)), 0)
}

export function openingsField<V extends Values>(key: keyof V & string, label = 'Проёмы (окна, двери)'): RowsField<V> {
  return {
    key,
    label,
    type: 'rows',
    span: 6,
    columns: [
      { key: 'w', label: 'Ширина', type: 'number', unit: 'м', step: 0.1 },
      { key: 'h', label: 'Высота', type: 'number', unit: 'м', step: 0.1 },
      { key: 'n', label: 'Кол-во', type: 'number', unit: 'шт', step: 1 },
    ],
    newRow: { w: 0.9, h: 2.1, n: 1 },
    addLabel: 'Добавить проём',
  }
}

export const withWaste = (x: number, pct: unknown) => x * (1 + pos(pct) / 100)

export { num, pos }
