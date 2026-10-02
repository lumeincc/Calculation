import { Weight } from 'lucide-react'
import { ANGLES_EQUAL, BEAMS, CHANNELS, METAL_MATERIALS, REBAR } from '@/data/metals'
import { PROFILE_LABEL, PROFILE_PRICE_KEY, kgPerMetre, profileName, type ProfileSpec, type ProfileType } from '@/lib/metal'
import { pos, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult } from '../types'

export interface SpecRowInput {
  name: string
  priceKey: string
  kgPerM: number
  length: number
  count: number
  massKg: number
  profile?: ProfileSpec
  source?: string
}

export type MetalValues = {
  profile: ProfileType
  material: string
  a: number
  b: number
  s: number
  sheetW: number
  sheetL: number
  angleSize: string
  channelSize: string
  beamSize: string
  rebarD: string
  kgPerM: number
  mode: 'length' | 'mass'
  length: number
  count: number
  targetMass: number
  works: boolean
}

export function metalSpec(v: MetalValues): ProfileSpec {
  const base = { type: v.profile, materialId: v.material, a: pos(v.a), b: pos(v.b), s: pos(v.s) }
  switch (v.profile) {
    case 'angle': return v.angleSize === 'custom' ? base : { ...base, size: v.angleSize }
    case 'channel': return { ...base, size: v.channelSize }
    case 'beam': return { ...base, size: v.beamSize }
    case 'rebar': return { ...base, a: Number(v.rebarD) }
    case 'custom': return { ...base, kgPerM: pos(v.kgPerM) }
    default: return base
  }
}

const usesMaterial = (p: ProfileType) => !['rebar', 'custom'].includes(p)

export function computeMetal(v: MetalValues): CalcResult {
  const spec = metalSpec(v)
  const k = kgPerMetre(spec)
  const name = profileName(spec)
  const material = METAL_MATERIALS.find((m) => m.id === v.material)
  const matSuffix = usesMaterial(v.profile) && material && material.id !== 'steel' ? `, ${material.name.toLowerCase()}` : ''
  const warnings: string[] = []
  if (k <= 0) warnings.push('Задайте размеры профиля.')

  if (v.profile === 'sheet') {
    const area1 = pos(v.sheetW) * pos(v.sheetL)
    const pieceKg = k * area1
    let count = Math.round(pos(v.count))
    if (v.mode === 'mass') count = pieceKg > 0 ? Math.ceil((pos(v.targetMass) * 1000) / pieceKg - 1e-9) : 0
    const totalKg = pieceKg * count
    return {
      metrics: [
        { label: 'Общая масса', value: totalKg / 1000, unit: 'т', digits: 3, primary: true },
        { label: 'Масса одного листа', value: pieceKg, unit: 'кг', digits: 2, primary: true },
        { label: v.mode === 'mass' ? 'Листов в заданной массе' : 'Листов', value: count, unit: 'шт', digits: 0, primary: true },
        { label: 'Масса 1 м²', value: k, unit: 'кг/м²', digits: 2 },
        { label: 'Общая площадь', value: area1 * count, unit: 'м²', digits: 2 },
      ],
      lines: [
        {
          name: `${name} ${pos(v.sheetW)}×${pos(v.sheetL)} м${matSuffix}, ${count} шт`,
          unit: 'т', qty: round(totalKg / 1000, 4), kind: 'material', priceKey: PROFILE_PRICE_KEY.sheet,
        },
        ...(v.works ? [{ name: 'Монтаж металлоконструкций', unit: 'т', qty: round(totalKg / 1000, 4), kind: 'work' as const, priceKey: 'work-metal' }] : []),
      ],
      warnings,
    }
  }

  const length = pos(v.length)
  let count = Math.round(pos(v.count))
  let totalM = length * count
  if (v.mode === 'mass') {
    totalM = k > 0 ? (pos(v.targetMass) * 1000) / k : 0
    count = length > 0 ? Math.ceil(totalM / length - 1e-9) : 0
  }
  const totalKg = k * totalM
  return {
    metrics: [
      { label: 'Общая масса', value: totalKg / 1000, unit: 'т', digits: 3, primary: true },
      { label: 'Масса 1 м', value: k, unit: 'кг', digits: 3, primary: true },
      { label: 'Общая длина', value: totalM, unit: 'м', digits: 2, primary: true },
      { label: 'Метров в 1 тонне', value: k > 0 ? 1000 / k : 0, unit: 'м', digits: 2 },
      { label: `Масса одной заготовки ${length} м`, value: k * length, unit: 'кг', digits: 2 },
      ...(v.mode === 'mass' ? [{ label: `Заготовок по ${length} м`, value: count, unit: 'шт', digits: 0 }] : []),
    ],
    lines: [
      {
        name: `${name}${matSuffix}, L=${length} м × ${count} шт`,
        unit: 'т', qty: round(totalKg / 1000, 4), kind: 'material', priceKey: PROFILE_PRICE_KEY[v.profile],
      },
      ...(v.works ? [{ name: 'Монтаж металлоконструкций', unit: 'т', qty: round(totalKg / 1000, 4), kind: 'work' as const, priceKey: 'work-metal' }] : []),
    ],
    warnings,
  }
}

const is = (...types: ProfileType[]) => (v: MetalValues) => types.includes(v.profile)

/** Row for the metal specification from the current calculator inputs. */
export function specRowFromValues(v: MetalValues): SpecRowInput {
  const spec = metalSpec(v)
  const k = kgPerMetre(spec)
  if (v.profile === 'sheet') {
    const area = pos(v.sheetW) * pos(v.sheetL)
    // For sheets «length» is the area of one sheet and kg/m is kg/m².
    return { name: `${profileName(spec)} ${pos(v.sheetW)}×${pos(v.sheetL)} м`, priceKey: PROFILE_PRICE_KEY.sheet, kgPerM: k, length: area, count: Math.round(pos(v.count)), massKg: k * area * Math.round(pos(v.count)), profile: spec, source: 'Калькулятор' }
  }
  const count = v.mode === 'mass' && k > 0 && pos(v.length) > 0 ? Math.ceil((pos(v.targetMass) * 1000) / k / pos(v.length) - 1e-9) : Math.round(pos(v.count))
  return { name: profileName(spec), priceKey: PROFILE_PRICE_KEY[v.profile], kgPerM: k, length: pos(v.length), count, massKg: k * pos(v.length) * count, profile: spec, source: 'Калькулятор' }
}

export const metal = defineCalculator<MetalValues>({
  id: 'metal',
  title: 'Металлопрокат и тоннаж',
  short: 'Масса труб, уголка, швеллера, двутавра, листа и арматуры по ГОСТ; спецификация с итоговым тоннажем',
  category: 'metal',
  icon: Weight,
  keywords: ['металл', 'тоннаж', 'вес', 'масса', 'труба', 'профильная', 'уголок', 'швеллер', 'двутавр', 'балка', 'лист', 'арматура', 'круг', 'полоса', 'гост', 'металлопрокат', 'тонна'],
  sectionName: 'Металлопрокат',
  defaults: {
    profile: 'profilePipe', material: 'steel', a: 40, b: 20, s: 2,
    sheetW: 1.25, sheetL: 2.5, angleSize: '50×5', channelSize: '№10', beamSize: '№20', rebarD: '12', kgPerM: 10,
    mode: 'length', length: 6, count: 10, targetMass: 1, works: false,
  },
  groups: [
    {
      title: 'Профиль',
      fields: [
        { key: 'profile', label: 'Вид проката', type: 'select', options: (Object.keys(PROFILE_LABEL) as ProfileType[]).map((p) => ({ value: p, label: PROFILE_LABEL[p] })) },
        { key: 'material', label: 'Материал', type: 'select', options: METAL_MATERIALS.map((m) => ({ value: m.id, label: `${m.name} — ${m.density} кг/м³` })), visible: (v) => usesMaterial(v.profile) },
        { key: 's', label: 'Толщина листа', type: 'number', unit: 'мм', step: 0.5, span: 2, visible: is('sheet') },
        { key: 'sheetW', label: 'Ширина листа', type: 'number', unit: 'м', step: 0.05, span: 2, visible: is('sheet') },
        { key: 'sheetL', label: 'Длина листа', type: 'number', unit: 'м', step: 0.1, span: 2, visible: is('sheet') },
        { key: 'a', label: 'Диаметр', type: 'number', unit: 'мм', step: 1, visible: is('round') },
        { key: 'a', label: 'Сторона', type: 'number', unit: 'мм', step: 1, visible: is('square') },
        { key: 'a', label: 'Размер под ключ S', type: 'number', unit: 'мм', step: 1, visible: is('hex') },
        { key: 'a', label: 'Ширина', type: 'number', unit: 'мм', step: 1, visible: is('strip') },
        { key: 's', label: 'Толщина', type: 'number', unit: 'мм', step: 0.5, visible: is('strip') },
        { key: 'a', label: 'Наружный диаметр D', type: 'number', unit: 'мм', step: 0.5, visible: is('pipe') },
        { key: 's', label: 'Толщина стенки', type: 'number', unit: 'мм', step: 0.1, visible: is('pipe') },
        { key: 'a', label: 'Сторона A', type: 'number', unit: 'мм', step: 1, span: 2, visible: is('profilePipe') },
        { key: 'b', label: 'Сторона B', type: 'number', unit: 'мм', step: 1, span: 2, visible: is('profilePipe') },
        { key: 's', label: 'Стенка', type: 'number', unit: 'мм', step: 0.1, span: 2, visible: is('profilePipe') },
        { key: 'angleSize', label: 'Размер (ГОСТ 8509)', type: 'select', options: [...ANGLES_EQUAL.map((x) => ({ value: x.size, label: `${x.size} — ${String(x.kgPerM).replace('.', ',')} кг/м` })), { value: 'custom', label: 'Свой размер (в т.ч. неравнополочный)' }], visible: is('angle') },
        { key: 'a', label: 'Полка A', type: 'number', unit: 'мм', step: 1, span: 2, visible: (v) => v.profile === 'angle' && v.angleSize === 'custom' },
        { key: 'b', label: 'Полка B', type: 'number', unit: 'мм', step: 1, span: 2, visible: (v) => v.profile === 'angle' && v.angleSize === 'custom' },
        { key: 's', label: 'Толщина', type: 'number', unit: 'мм', step: 0.5, span: 2, visible: (v) => v.profile === 'angle' && v.angleSize === 'custom' },
        { key: 'channelSize', label: 'Номер (ГОСТ 8240, У/П)', type: 'select', options: CHANNELS.map((x) => ({ value: x.size, label: `${x.size} — ${String(x.kgPerM).replace('.', ',')} кг/м` })), visible: is('channel') },
        { key: 'beamSize', label: 'Номер (ГОСТ 8239 / СТО АСЧМ)', type: 'select', options: BEAMS.map((x) => ({ value: x.size, label: `${x.size} — ${String(x.kgPerM).replace('.', ',')} кг/м` })), visible: is('beam') },
        { key: 'rebarD', label: 'Диаметр (ГОСТ 34028)', type: 'select', options: REBAR.map((x) => ({ value: String(x.d), label: `⌀${x.d} — ${String(x.kgPerM).replace('.', ',')} кг/м` })), visible: is('rebar') },
        { key: 'kgPerM', label: 'Масса 1 м (из сертификата)', type: 'number', unit: 'кг/м', step: 0.1, visible: is('custom') },
      ],
    },
    {
      title: 'Количество',
      fields: [
        { key: 'mode', label: 'Считать', type: 'segmented', span: 6, options: opts([['length', 'Массу по длине'], ['mass', 'Длину по массе']]) },
        { key: 'length', label: 'Длина заготовки', type: 'number', unit: 'м', step: 0.5, visible: (v) => v.profile !== 'sheet' },
        { key: 'count', label: 'Количество', type: 'number', unit: 'шт', step: 1, visible: (v) => v.mode === 'length' },
        { key: 'targetMass', label: 'Масса партии', type: 'number', unit: 'т', step: 0.1, visible: (v) => v.mode === 'mass' },
        { key: 'works', label: 'Добавить монтаж', type: 'toggle' },
      ],
    },
  ],
  compute: computeMetal,
  method: [
    'Уголок, швеллер, двутавр и арматура — масса 1 м по таблицам ГОСТ (для стали 7850 кг/м³); для других материалов пересчитывается по плотности.',
    'Труба круглая: m = π·(D − s)·s·ρ. Труба профильная: площадь сечения с учётом скруглений углов R = 2s по ГОСТ 30245.',
    'Лист: масса 1 м² = толщина (мм) × ρ / 1000; для стали 7,85 кг на каждый мм толщины.',
    'Фактическая масса партии может отличаться на ±3–5% из-за допусков проката.',
  ],
})
