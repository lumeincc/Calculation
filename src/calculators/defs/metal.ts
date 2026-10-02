import { Weight } from 'lucide-react'
import { ANGLES_EQUAL, BEAMS, CHANNELS, METAL_MATERIALS, REBAR } from '@/data/metals'
import { PROFILE_LABEL, PROFILE_PRICE_KEY, kgPerMetre, profileName, type ProfileSpec, type ProfileType } from '@/lib/metal'
import { pos, round } from '@/lib/num'
import { defineCalculator, opts, type CalcResult } from '../types'
import { T, Tf } from '@/i18n'

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
  if (k <= 0) warnings.push(T('Задайте размеры профиля.'))

  if (v.profile === 'sheet') {
    const area1 = pos(v.sheetW) * pos(v.sheetL)
    const pieceKg = k * area1
    let count = Math.round(pos(v.count))
    if (v.mode === 'mass') count = pieceKg > 0 ? Math.ceil((pos(v.targetMass) * 1000) / pieceKg - 1e-9) : 0
    const totalKg = pieceKg * count
    return {
      metrics: [
        { label: T('Общая масса'), value: totalKg / 1000, unit: T('т'), digits: 3, primary: true },
        { label: T('Масса одного листа'), value: pieceKg, unit: T('кг'), digits: 2, primary: true },
        { label: v.mode === 'mass' ? T('Листов в заданной массе') : T('Листов'), value: count, unit: T('шт'), digits: 0, primary: true },
        { label: T('Масса 1 м²'), value: k, unit: T('кг/м²'), digits: 2 },
        { label: T('Общая площадь'), value: area1 * count, unit: T('м²'), digits: 2 },
      ],
      lines: [
        {
          name: Tf('{0} {1}×{2} м{3}, {4} шт', [name, pos(v.sheetW), pos(v.sheetL), matSuffix, count]),
          unit: T('т'), qty: round(totalKg / 1000, 4), kind: 'material', priceKey: PROFILE_PRICE_KEY.sheet,
        },
        ...(v.works ? [{ name: T('Монтаж металлоконструкций'), unit: T('т'), qty: round(totalKg / 1000, 4), kind: 'work' as const, priceKey: 'work-metal' }] : []),
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
      { label: T('Общая масса'), value: totalKg / 1000, unit: T('т'), digits: 3, primary: true },
      { label: T('Масса 1 м'), value: k, unit: T('кг'), digits: 3, primary: true },
      { label: T('Общая длина'), value: totalM, unit: T('м'), digits: 2, primary: true },
      { label: T('Метров в 1 тонне'), value: k > 0 ? 1000 / k : 0, unit: T('м'), digits: 2 },
      { label: Tf('Масса одной заготовки {0} м', [length]), value: k * length, unit: T('кг'), digits: 2 },
      ...(v.mode === 'mass' ? [{ label: Tf('Заготовок по {0} м', [length]), value: count, unit: T('шт'), digits: 0 }] : []),
    ],
    lines: [
      {
        name: Tf('{0}{1}, L={2} м × {3} шт', [name, matSuffix, length, count]),
        unit: T('т'), qty: round(totalKg / 1000, 4), kind: 'material', priceKey: PROFILE_PRICE_KEY[v.profile],
      },
      ...(v.works ? [{ name: T('Монтаж металлоконструкций'), unit: T('т'), qty: round(totalKg / 1000, 4), kind: 'work' as const, priceKey: 'work-metal' }] : []),
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
    return { name: Tf('{0} {1}×{2} м', [profileName(spec), pos(v.sheetW), pos(v.sheetL)]), priceKey: PROFILE_PRICE_KEY.sheet, kgPerM: k, length: area, count: Math.round(pos(v.count)), massKg: k * area * Math.round(pos(v.count)), profile: spec, source: T('Калькулятор') }
  }
  const count = v.mode === 'mass' && k > 0 && pos(v.length) > 0 ? Math.ceil((pos(v.targetMass) * 1000) / k / pos(v.length) - 1e-9) : Math.round(pos(v.count))
  return { name: profileName(spec), priceKey: PROFILE_PRICE_KEY[v.profile], kgPerM: k, length: pos(v.length), count, massKg: k * pos(v.length) * count, profile: spec, source: T('Калькулятор') }
}

export const metal = defineCalculator<MetalValues>({
  id: 'metal',
  title: T('Металлопрокат и тоннаж'),
  short: T('Масса труб, уголка, швеллера, двутавра, листа и арматуры по ГОСТ; спецификация с итоговым тоннажем'),
  category: 'metal',
  icon: Weight,
  keywords: [T('металл'), T('тоннаж'), T('вес'), T('масса'), T('труба'), T('профильная'), T('уголок'), T('швеллер'), T('двутавр'), T('балка'), T('лист'), T('арматура'), T('круг'), T('полоса'), T('гост'), T('металлопрокат'), T('тонна')],
  sectionName: T('Металлопрокат'),
  defaults: {
    profile: 'profilePipe', material: 'steel', a: 40, b: 20, s: 2,
    sheetW: 1.25, sheetL: 2.5, angleSize: '50×5', channelSize: '№10', beamSize: '№20', rebarD: '12', kgPerM: 10,
    mode: 'length', length: 6, count: 10, targetMass: 1, works: false,
  },
  groups: [
    {
      title: T('Профиль'),
      fields: [
        { key: 'profile', label: T('Вид проката'), type: 'select', options: (Object.keys(PROFILE_LABEL) as ProfileType[]).map((p) => ({ value: p, label: PROFILE_LABEL[p] })) },
        { key: 'material', label: T('Материал'), type: 'select', options: METAL_MATERIALS.map((m) => ({ value: m.id, label: Tf('{0} — {1} кг/м³', [m.name, m.density]) })), visible: (v) => usesMaterial(v.profile) },
        { key: 's', label: T('Толщина листа'), type: 'number', unit: T('мм'), step: 0.5, span: 2, visible: is('sheet') },
        { key: 'sheetW', label: T('Ширина листа'), type: 'number', unit: T('м'), step: 0.05, span: 2, visible: is('sheet') },
        { key: 'sheetL', label: T('Длина листа'), type: 'number', unit: T('м'), step: 0.1, span: 2, visible: is('sheet') },
        { key: 'a', label: T('Диаметр'), type: 'number', unit: T('мм'), step: 1, visible: is('round') },
        { key: 'a', label: T('Сторона'), type: 'number', unit: T('мм'), step: 1, visible: is('square') },
        { key: 'a', label: T('Размер под ключ S'), type: 'number', unit: T('мм'), step: 1, visible: is('hex') },
        { key: 'a', label: T('Ширина'), type: 'number', unit: T('мм'), step: 1, visible: is('strip') },
        { key: 's', label: T('Толщина'), type: 'number', unit: T('мм'), step: 0.5, visible: is('strip') },
        { key: 'a', label: T('Наружный диаметр D'), type: 'number', unit: T('мм'), step: 0.5, visible: is('pipe') },
        { key: 's', label: T('Толщина стенки'), type: 'number', unit: T('мм'), step: 0.1, visible: is('pipe') },
        { key: 'a', label: T('Сторона A'), type: 'number', unit: T('мм'), step: 1, span: 2, visible: is('profilePipe') },
        { key: 'b', label: T('Сторона B'), type: 'number', unit: T('мм'), step: 1, span: 2, visible: is('profilePipe') },
        { key: 's', label: T('Стенка'), type: 'number', unit: T('мм'), step: 0.1, span: 2, visible: is('profilePipe') },
        { key: 'angleSize', label: T('Размер (ГОСТ 8509)'), type: 'select', options: [...ANGLES_EQUAL.map((x) => ({ value: x.size, label: Tf('{0} — {1} кг/м', [x.size, String(x.kgPerM).replace('.', ',')]) })), { value: 'custom', label: T('Свой размер (в т.ч. неравнополочный)') }], visible: is('angle') },
        { key: 'a', label: T('Полка A'), type: 'number', unit: T('мм'), step: 1, span: 2, visible: (v) => v.profile === 'angle' && v.angleSize === 'custom' },
        { key: 'b', label: T('Полка B'), type: 'number', unit: T('мм'), step: 1, span: 2, visible: (v) => v.profile === 'angle' && v.angleSize === 'custom' },
        { key: 's', label: T('Толщина'), type: 'number', unit: T('мм'), step: 0.5, span: 2, visible: (v) => v.profile === 'angle' && v.angleSize === 'custom' },
        { key: 'channelSize', label: T('Номер (ГОСТ 8240, У/П)'), type: 'select', options: CHANNELS.map((x) => ({ value: x.size, label: Tf('{0} — {1} кг/м', [x.size, String(x.kgPerM).replace('.', ',')]) })), visible: is('channel') },
        { key: 'beamSize', label: T('Номер (ГОСТ 8239 / СТО АСЧМ)'), type: 'select', options: BEAMS.map((x) => ({ value: x.size, label: Tf('{0} — {1} кг/м', [x.size, String(x.kgPerM).replace('.', ',')]) })), visible: is('beam') },
        { key: 'rebarD', label: T('Диаметр (ГОСТ 34028)'), type: 'select', options: REBAR.map((x) => ({ value: String(x.d), label: Tf('⌀{0} — {1} кг/м', [x.d, String(x.kgPerM).replace('.', ',')]) })), visible: is('rebar') },
        { key: 'kgPerM', label: T('Масса 1 м (из сертификата)'), type: 'number', unit: T('кг/м'), step: 0.1, visible: is('custom') },
      ],
    },
    {
      title: T('Количество'),
      fields: [
        { key: 'mode', label: T('Считать'), type: 'segmented', span: 6, options: opts([['length', T('Массу по длине')], ['mass', T('Длину по массе')]]) },
        { key: 'length', label: T('Длина заготовки'), type: 'number', unit: T('м'), step: 0.5, visible: (v) => v.profile !== 'sheet' },
        { key: 'count', label: T('Количество'), type: 'number', unit: T('шт'), step: 1, visible: (v) => v.mode === 'length' },
        { key: 'targetMass', label: T('Масса партии'), type: 'number', unit: T('т'), step: 0.1, visible: (v) => v.mode === 'mass' },
        { key: 'works', label: T('Добавить монтаж'), type: 'toggle' },
      ],
    },
  ],
  compute: computeMetal,
  method: [
    T('Уголок, швеллер, двутавр и арматура — масса 1 м по таблицам ГОСТ (для стали 7850 кг/м³); для других материалов пересчитывается по плотности.'),
    T('Труба круглая: m = π·(D − s)·s·ρ. Труба профильная: площадь сечения с учётом скруглений углов R = 2s по ГОСТ 30245.'),
    T('Лист: масса 1 м² = толщина (мм) × ρ / 1000; для стали 7,85 кг на каждый мм толщины.'),
    T('Фактическая масса партии может отличаться на ±3–5% из-за допусков проката.'),
  ],
})
