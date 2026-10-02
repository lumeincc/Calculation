import { ArrowLeftRight } from 'lucide-react'
import { num } from '@/lib/num'
import { defineCalculator, opts, type CalcResult, type Option } from '../types'
import { T } from '@/i18n'

/** Unit → factor to the base unit of its kind. */
export const UNIT_KINDS: Record<string, { name: string; units: [string, string, number][] }> = {
  length: { name: T('Длина'), units: [['mm', T('мм'), 0.001], ['cm', T('см'), 0.01], ['m', T('м'), 1], ['km', T('км'), 1000], ['in', T('дюйм'), 0.0254], ['ft', T('фут'), 0.3048]] },
  area: { name: T('Площадь'), units: [['cm2', T('см²'), 1e-4], ['m2', T('м²'), 1], ['sotka', T('сотка (ар)'), 100], ['ha', T('га'), 1e4], ['km2', T('км²'), 1e6], ['ft2', T('фут²'), 0.09290304]] },
  volume: { name: T('Объём'), units: [['l', T('л (дм³)'), 0.001], ['m3', T('м³'), 1], ['cm3', T('см³'), 1e-6], ['ft3', T('фут³'), 0.028316846592], ['gal', T('галлон США'), 0.003785411784]] },
  mass: { name: T('Масса'), units: [['g', T('г'), 0.001], ['kg', T('кг'), 1], ['c', T('ц'), 100], ['t', T('т'), 1000], ['lb', T('фунт'), 0.45359237]] },
  pressure: { name: T('Давление, напряжение'), units: [['pa', T('Па'), 1], ['kpa', T('кПа'), 1e3], ['mpa', T('МПа (Н/мм²)'), 1e6], ['kgfcm2', T('кгс/см² (ат)'), 98066.5], ['kgfm2', T('кгс/м²'), 9.80665], ['tfm2', T('тс/м²'), 9806.65], ['bar', T('бар'), 1e5], ['atm', T('атм'), 101325], ['psi', 'psi', 6894.757]] },
  force: { name: T('Сила, нагрузка'), units: [['n', T('Н'), 1], ['kn', T('кН'), 1000], ['kgf', T('кгс'), 9.80665], ['tf', T('тс'), 9806.65]] },
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
  title: T('Конвертер единиц'),
  short: T('Длина, площадь, объём, масса, давление (МПа ↔ кгс/см²) и нагрузки (кН ↔ тс)'),
  category: 'tools',
  icon: ArrowLeftRight,
  keywords: [T('перевод'), T('конвертер'), T('единицы'), T('мпа'), T('кгс'), T('кн'), T('тс'), T('сотка'), T('гектар'), T('дюйм'), T('фут'), T('давление'), T('нагрузка')],
  defaults: { kind: 'pressure', value: 1, from: 'mpa' },
  groups: [
    {
      fields: [
        { key: 'kind', label: T('Величина'), type: 'select', options: opts(Object.entries(UNIT_KINDS).map(([k, u]) => [k, u.name])) },
        { key: 'value', label: T('Значение'), type: 'number', step: 1 },
        { key: 'from', label: T('Из единицы'), type: 'select', options: unitOptions('length'), optionsFor: (v) => unitOptions(v.kind) },
      ],
    },
  ],
  compute: computeUnits,
  method: [T('1 кгс = 9,80665 Н; 1 МПа = 10,197 кгс/см²; 1 тс = 9,80665 кН; 1 сотка = 100 м².')],
})
