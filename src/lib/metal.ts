/**
 * Mass of rolled-metal items. Shared by the metal calculator, the fence calculator and the
 * document analyser (which recognises profiles in specifications).
 */
import { ANGLES_EQUAL, BEAM_HB, BEAMS, CHANNEL_B, CHANNELS, METAL_MATERIALS, STEEL_DENSITY, geo, rebarKgPerM } from '@/data/metals'
import { pos } from './num'
import { T, Tf } from '@/i18n'

export type ProfileType =
  | 'sheet' | 'round' | 'square' | 'hex' | 'strip' | 'pipe' | 'profilePipe'
  | 'angle' | 'channel' | 'beam' | 'rebar' | 'custom'

export const PROFILE_LABEL: Record<ProfileType, string> = {
  sheet: T('Лист'),
  round: T('Круг (пруток)'),
  square: T('Квадрат'),
  hex: T('Шестигранник'),
  strip: T('Полоса'),
  pipe: T('Труба круглая'),
  profilePipe: T('Труба профильная'),
  angle: T('Уголок'),
  channel: T('Швеллер'),
  beam: T('Двутавр'),
  rebar: T('Арматура'),
  custom: T('Свой профиль'),
}

export const PROFILE_PRICE_KEY: Record<ProfileType, string> = {
  sheet: 'metal-sheet',
  round: 'metal-round',
  square: 'metal-round',
  hex: 'metal-round',
  strip: 'metal-strip',
  pipe: 'metal-pipe',
  profilePipe: 'metal-profile-pipe',
  angle: 'metal-angle',
  channel: 'metal-channel',
  beam: 'metal-beam',
  rebar: 'rebar-a500',
  custom: 'metal-profile-pipe',
}

export interface ProfileSpec {
  type: ProfileType
  /** Dimensions in mm: a, b, s (meaning depends on type). */
  a?: number
  b?: number
  s?: number
  /** Table size label for angle / channel / beam. */
  size?: string
  /** For custom: kg per metre. */
  kgPerM?: number
  materialId?: string
}

export function densityOf(materialId?: string): number {
  return METAL_MATERIALS.find((m) => m.id === materialId)?.density ?? STEEL_DENSITY
}

/**
 * Linear mass, kg/m. For sheets it is kg per m² (sheets are measured by area).
 * Table profiles (angle/channel/beam) are rescaled when the material is not carbon steel.
 */
export function kgPerMetre(p: ProfileSpec): number {
  const rho = densityOf(p.materialId)
  const k = rho / STEEL_DENSITY
  const a = pos(p.a), b = pos(p.b), s = pos(p.s)
  switch (p.type) {
    case 'sheet': return s * rho * 1e-3 // kg/m² for thickness s mm
    case 'round': return geo.round(a, rho)
    case 'square': return geo.square(a, rho)
    case 'hex': return geo.hex(a, rho)
    case 'strip': return geo.strip(a, s, rho)
    case 'pipe': return geo.pipe(a, s, rho)
    case 'profilePipe': return geo.profilePipe(a, b || a, s, rho)
    case 'angle': {
      const row = p.size ? ANGLES_EQUAL.find((x) => x.size === p.size) : undefined
      return row ? row.kgPerM * k : geo.angle(a, b || a, s, rho)
    }
    case 'channel': {
      const row = CHANNELS.find((x) => x.size === p.size)
      return (row?.kgPerM ?? 0) * k
    }
    case 'beam': {
      const row = BEAMS.find((x) => x.size === p.size)
      return (row?.kgPerM ?? 0) * k
    }
    case 'rebar': return rebarKgPerM(a) * k
    case 'custom': return pos(p.kgPerM)
  }
}

const fmtDim = (n: number) => String(n).replace('.', ',')

/** Human-readable name like «Труба профильная 40×20×2». */
export function profileName(p: ProfileSpec): string {
  const a = fmtDim(pos(p.a)), b = fmtDim(pos(p.b) || pos(p.a)), s = fmtDim(pos(p.s))
  const label = PROFILE_LABEL[p.type]
  switch (p.type) {
    case 'sheet': return Tf('{0} {1} мм', [label, s])
    case 'round': return `${label} ⌀${a}`
    case 'square': return `${label} ${a}×${a}`
    case 'hex': return `${label} S${a}`
    case 'strip': return `${label} ${a}×${s}`
    case 'pipe': return `${label} ${a}×${s}`
    case 'profilePipe': return `${label} ${a}×${b}×${s}`
    case 'angle': return p.size ? `${label} ${p.size}` : `${label} ${a}×${b}×${s}`
    case 'channel': return `${label} ${p.size ?? ''}`.trim()
    case 'beam': return `${label} ${p.size ?? ''}`.trim()
    case 'rebar': return `${label} ⌀${a}`
    case 'custom': return Tf('{0} ({1} кг/м)', [label, fmtDim(pos(p.kgPerM))])
  }
}

/**
 * Painted surface per metre of profile, m²/m (outer perimeter). For sheets — m² per m² of sheet
 * (both faces). Fillets and inner pipe surfaces are ignored, as in usual painting estimates.
 */
export function paintPerMetre(p: ProfileSpec): number {
  const a = pos(p.a) / 1000, b = (pos(p.b) || pos(p.a)) / 1000, s = pos(p.s) / 1000
  switch (p.type) {
    case 'sheet': return 2
    case 'round':
    case 'rebar': return Math.PI * a
    case 'square': return 4 * a
    case 'hex': return (6 * a) / Math.sqrt(3)
    case 'strip': return 2 * (a + s)
    case 'pipe': return Math.PI * a
    case 'profilePipe': return 2 * (a + b)
    case 'angle': {
      if (p.size) {
        const [leg] = p.size.split('×').map((x) => Number(x.replace(',', '.')) / 1000)
        return 4 * leg
      }
      return 2 * (a + b)
    }
    case 'channel': {
      // №10 → h = 100 mm
      const n = Number((p.size ?? '').replace('№', '').replace(',', '.')) * 0.01
      return 2 * n + 4 * ((CHANNEL_B[p.size ?? ''] ?? 0) / 1000)
    }
    case 'beam': {
      const [h, w] = BEAM_HB[p.size ?? ''] ?? [0, 0]
      return 2 * (h / 1000) + 4 * (w / 1000)
    }
    case 'custom': return 0
  }
}

/** Painted area for a given mass of a profile, m². */
export function paintArea(p: ProfileSpec, massKg: number): number {
  const k = kgPerMetre(p)
  return k > 0 ? (massKg / k) * paintPerMetre(p) : 0
}

/** Price groups used when metal prices are entered per project. */
export type MetalPriceGroup = 'profilePipe' | 'pipe' | 'angle' | 'channel' | 'beam' | 'sheet' | 'round' | 'rebar'

export const PRICE_GROUP_LABEL: Record<MetalPriceGroup, string> = {
  profilePipe: T('Труба профильная'),
  pipe: T('Труба круглая'),
  angle: T('Уголок'),
  channel: T('Швеллер'),
  beam: T('Двутавр'),
  sheet: T('Лист и полоса'),
  round: T('Круг, квадрат, шестигранник'),
  rebar: T('Арматура'),
}

export function priceGroupOf(type: ProfileType): MetalPriceGroup {
  switch (type) {
    case 'strip': return 'sheet'
    case 'square':
    case 'hex': return 'round'
    case 'custom': return 'profilePipe'
    default: return type
  }
}
