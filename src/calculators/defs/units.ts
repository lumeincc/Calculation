import { ArrowLeftRight } from 'lucide-react'
import { num } from '@/lib/num'
import { defineCalculator, opts, type CalcResult, type Option } from '../types'

/** Unit → factor to the base unit of its kind. */
export const UNIT_KINDS: Record<string, { name: string; units: [string, string, number][] }> = {
  length: { name: 'Длина', units: [['mm', 'мм', 0.001], ['cm', 'см', 0.01], ['m', 'м', 1], ['km', 'км', 1000], ['in', 'дюйм', 0.0254], ['ft', 'фут', 0.3048]] },
  area: { name: 'Площадь', units: [['cm2', 'см²', 1e-4], ['m2', 'м²', 1], ['sotka', 'сотка (ар)', 100], ['ha', 'га', 1e4], ['km2', 'км²', 1e6], ['ft2', 'фут²', 0.09290304]] },
  volume: { name: 'Объём', units: [['l', 'л (дм³)', 0.001], ['m3', 'м³', 1], ['cm3', 'см³', 1e-6], ['ft3', 'фут³', 0.028316846592], ['gal', 'галлон США', 0.003785411784]] },
  mass: { name: 'Масса', units: [['g', 'г', 0.001], ['kg', 'кг', 1], ['c', 'ц', 100], ['t', 'т', 1000], ['lb', 'фунт', 0.45359237]] },
  pressure: { name: 'Давление, напряжение', units: [['pa', 'Па', 1], ['kpa', 'кПа', 1e3], ['mpa', 'МПа (Н/мм²)', 1e6], ['kgfcm2', 'кгс/см² (ат)', 98066.5], ['kgfm2', 'кгс/м²', 9.80665], ['tfm2', 'тс/м²', 9806.65], ['bar', 'бар', 1e5], ['atm', 'атм', 101325], ['psi', 'psi', 6894.757]] },
  force: { name: 'Сила, нагрузка', units: [['n', 'Н', 1], ['kn', 'кН', 1000], ['kgf', 'кгс', 9.80665], ['tf', 'тс', 9806.65]] },
}

export type UnitsValues = { kind: string; value: number; from: string }

export function unitOptions(kind: string): Option[] {
  return (UNIT_KINDS[kind] ?? UNIT_KINDS.length).units.map(([value, label]) => ({ value, label }))
}

export function convert(kind: string, value: number, from: string): { id: string; label: string; value: number }[] {
  const k = UNIT_KINDS[kind] ?? UNIT_KINDS.length
  const src = k.units.find(([id]) => id === from) ?? k.units[0]
  const base = value * src[2]
  return k.units.map(([id, label, f]) => ({ id, label, value: base / f }))
}

export function computeUnits(v: UnitsValues): CalcResult {
  const rows = convert(v.kind, num(v.value), v.from)
  return {
    metrics: rows.map((r) => ({ label: r.label, value: r.value, digits: Math.abs(r.value) < 1 ? 6 : 4, primary: r.id === v.from })),
    lines: [],
  }
}

export const units = defineCalculator<UnitsValues>({
  id: 'units',
  title: 'Конвертер единиц',
  short: 'Длина, площадь, объём, масса, давление (МПа ↔ кгс/см²) и нагрузки (кН ↔ тс)',
  category: 'tools',
  icon: ArrowLeftRight,
  keywords: ['перевод', 'конвертер', 'единицы', 'мпа', 'кгс', 'кн', 'тс', 'сотка', 'гектар', 'дюйм', 'фут', 'давление', 'нагрузка'],
  defaults: { kind: 'pressure', value: 1, from: 'mpa' },
  groups: [
    {
      fields: [
        { key: 'kind', label: 'Величина', type: 'select', options: opts(Object.entries(UNIT_KINDS).map(([k, u]) => [k, u.name])) },
        { key: 'value', label: 'Значение', type: 'number', step: 1 },
        { key: 'from', label: 'Из единицы', type: 'select', options: unitOptions('length'), optionsFor: (v) => unitOptions(v.kind) },
      ],
    },
  ],
  compute: computeUnits,
  method: ['1 кгс = 9,80665 Н; 1 МПа = 10,197 кгс/см²; 1 тс = 9,80665 кН; 1 сотка = 100 м².'],
})
