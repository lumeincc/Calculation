/**
 * Mass of rolled-metal items. Shared by the metal calculator, the fence calculator and the
 * document analyser (which recognises profiles in specifications).
 */
import { ANGLES_EQUAL, BEAMS, CHANNELS, METAL_MATERIALS, STEEL_DENSITY, geo, rebarKgPerM } from '@/data/metals'
import { pos } from './num'

export type ProfileType =
  | 'sheet' | 'round' | 'square' | 'hex' | 'strip' | 'pipe' | 'profilePipe'
  | 'angle' | 'channel' | 'beam' | 'rebar' | 'custom'

export const PROFILE_LABEL: Record<ProfileType, string> = {
  sheet: 'Лист',
  round: 'Круг (пруток)',
  square: 'Квадрат',
  hex: 'Шестигранник',
  strip: 'Полоса',
  pipe: 'Труба круглая',
  profilePipe: 'Труба профильная',
  angle: 'Уголок',
  channel: 'Швеллер',
  beam: 'Двутавр',
  rebar: 'Арматура',
  custom: 'Свой профиль',
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
    case 'sheet': return `${label} ${s} мм`
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
    case 'custom': return `${label} (${fmtDim(pos(p.kgPerM))} кг/м)`
  }
}
