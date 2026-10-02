/**
 * A calculator is declared, not hand-built: a list of input fields, default values and a
 * pure `compute` function. The generic UI renders the form, shows the result, prices the
 * material lines against the price catalog and sends them to an estimate.
 */
import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import type { ItemKind } from '@/lib/estimate'
import { T } from '@/i18n'

export type RowValues = Record<string, number | string>
export type FieldValue = number | string | boolean | RowValues[]
export type Values = Record<string, FieldValue>

export interface Option {
  value: string
  label: string
}

interface FieldBase<V> {
  key: keyof V & string
  label: string
  hint?: string
  /** Grid width out of 6 columns (default 3 = half). */
  span?: 2 | 3 | 6
  visible?(v: V): boolean
}

export interface NumberField<V> extends FieldBase<V> {
  type: 'number'
  unit?: string
  min?: number
  max?: number
  step?: number
}

export interface SelectField<V> extends FieldBase<V> {
  type: 'select' | 'segmented'
  options: Option[]
  /** Dynamic options (e.g. sizes that depend on the chosen profile). */
  optionsFor?(v: V): Option[]
}

export interface ToggleField<V> extends FieldBase<V> {
  type: 'toggle'
}

export interface RowsColumn {
  key: string
  label: string
  type: 'number' | 'text'
  unit?: string
  step?: number
}

export interface RowsField<V> extends FieldBase<V> {
  type: 'rows'
  columns: RowsColumn[]
  newRow: RowValues
  addLabel?: string
}

export type Field<V> = NumberField<V> | SelectField<V> | ToggleField<V> | RowsField<V>

export interface FieldGroup<V> {
  title?: string
  fields: Field<V>[]
  visible?(v: V): boolean
}

export interface Metric {
  label: string
  value: number
  unit?: string
  digits?: number
  /** Primary metrics are shown as big tiles. */
  primary?: boolean
  hint?: string
}

/** A line that can be priced and added to an estimate. */
export interface MaterialLine {
  name: string
  unit: string
  qty: number
  kind: ItemKind
  /** Catalog key; price = catalog price × priceFactor (e.g. ₸/кг × 25 кг in a bag). */
  priceKey?: string
  priceFactor?: number
  /** Fallback price when there is no catalog key. */
  price?: number
  note?: string
}

export interface CalcResult {
  metrics: Metric[]
  lines: MaterialLine[]
  warnings?: string[]
}

export type CategoryId = 'metal' | 'foundation' | 'walls' | 'finish' | 'roof' | 'earth' | 'wood' | 'tools'

export interface ExtraProps<V> {
  values: V
  result: CalcResult
}

export interface CalculatorDef<V extends Values = Values> {
  id: string
  title: string
  /** One line for the catalog card. */
  short: string
  category: CategoryId
  icon: LucideIcon
  keywords: string[]
  groups: FieldGroup<V>[]
  defaults: V
  compute(v: V): CalcResult
  /** «Как считаем» — formulas and assumptions, shown under the form. */
  method?: string[]
  /** Default name of the estimate section the lines go to. */
  sectionName?: string
  /** Optional extra block under the result (e.g. the metal specification). */
  Extra?: ComponentType<ExtraProps<V>>
}

export function defineCalculator<V extends Values>(def: CalculatorDef<V>): CalculatorDef<V> {
  return def
}

export const opts = (pairs: [string | number, string][]): Option[] =>
  pairs.map(([value, label]) => ({ value: String(value), label: T(label) }))
