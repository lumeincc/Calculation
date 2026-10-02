/**
 * Reference data for rolled metal (металлопрокат).
 * Mass-per-metre tables follow the Russian standards named next to each table;
 * geometric profiles are computed from dimensions and density.
 */

export interface MetalMaterial {
  id: string
  name: string
  /** Density, kg/m³ */
  density: number
}

export const METAL_MATERIALS: MetalMaterial[] = [
  { id: 'steel', name: 'Сталь углеродистая (Ст3, 09Г2С)', density: 7850 },
  { id: 'stainless', name: 'Нержавеющая сталь AISI 304', density: 7900 },
  { id: 'stainless430', name: 'Нержавеющая сталь AISI 430', density: 7700 },
  { id: 'aluminum', name: 'Алюминий и сплавы (АД31, АМг)', density: 2700 },
  { id: 'copper', name: 'Медь', density: 8940 },
  { id: 'brass', name: 'Латунь', density: 8500 },
  { id: 'bronze', name: 'Бронза', density: 8800 },
  { id: 'titanium', name: 'Титан', density: 4500 },
  { id: 'castiron', name: 'Чугун', density: 7200 },
  { id: 'zinc', name: 'Цинк', density: 7130 },
  { id: 'lead', name: 'Свинец', density: 11340 },
]

export const STEEL_DENSITY = 7850

export interface TableProfile {
  /** Label shown to the user, e.g. "50×5" or "№20". */
  size: string
  /** Mass of 1 m, kg (for steel 7850 kg/m³). */
  kgPerM: number
}

/** Уголок стальной равнополочный, ГОСТ 8509-93. */
export const ANGLES_EQUAL: TableProfile[] = [
  { size: '20×3', kgPerM: 0.89 },
  { size: '20×4', kgPerM: 1.15 },
  { size: '25×3', kgPerM: 1.12 },
  { size: '25×4', kgPerM: 1.46 },
  { size: '32×3', kgPerM: 1.46 },
  { size: '32×4', kgPerM: 1.91 },
  { size: '35×3', kgPerM: 1.6 },
  { size: '35×4', kgPerM: 2.1 },
  { size: '40×3', kgPerM: 1.85 },
  { size: '40×4', kgPerM: 2.42 },
  { size: '40×5', kgPerM: 2.98 },
  { size: '45×4', kgPerM: 2.73 },
  { size: '45×5', kgPerM: 3.37 },
  { size: '50×4', kgPerM: 3.05 },
  { size: '50×5', kgPerM: 3.77 },
  { size: '50×6', kgPerM: 4.47 },
  { size: '63×5', kgPerM: 4.81 },
  { size: '63×6', kgPerM: 5.72 },
  { size: '70×6', kgPerM: 6.39 },
  { size: '70×7', kgPerM: 7.39 },
  { size: '75×6', kgPerM: 6.89 },
  { size: '75×8', kgPerM: 9.02 },
  { size: '80×6', kgPerM: 7.36 },
  { size: '80×7', kgPerM: 8.51 },
  { size: '80×8', kgPerM: 9.65 },
  { size: '90×7', kgPerM: 9.64 },
  { size: '90×8', kgPerM: 10.93 },
  { size: '100×7', kgPerM: 10.79 },
  { size: '100×8', kgPerM: 12.25 },
  { size: '100×10', kgPerM: 15.1 },
  { size: '110×8', kgPerM: 13.5 },
  { size: '125×8', kgPerM: 15.46 },
  { size: '125×9', kgPerM: 17.3 },
  { size: '125×10', kgPerM: 19.1 },
  { size: '140×10', kgPerM: 21.45 },
  { size: '160×10', kgPerM: 24.67 },
  { size: '160×12', kgPerM: 29.35 },
  { size: '180×12', kgPerM: 33.12 },
  { size: '200×12', kgPerM: 36.97 },
  { size: '200×16', kgPerM: 48.65 },
]

/** Швеллер стальной горячекатаный с уклоном (У) и параллельными (П) гранями полок, ГОСТ 8240-97. */
export const CHANNELS: TableProfile[] = [
  { size: '№5', kgPerM: 4.84 },
  { size: '№6,5', kgPerM: 5.9 },
  { size: '№8', kgPerM: 7.05 },
  { size: '№10', kgPerM: 8.59 },
  { size: '№12', kgPerM: 10.4 },
  { size: '№14', kgPerM: 12.3 },
  { size: '№16', kgPerM: 14.2 },
  { size: '№18', kgPerM: 16.3 },
  { size: '№20', kgPerM: 18.4 },
  { size: '№22', kgPerM: 21.0 },
  { size: '№24', kgPerM: 24.0 },
  { size: '№27', kgPerM: 27.7 },
  { size: '№30', kgPerM: 31.8 },
  { size: '№33', kgPerM: 36.5 },
  { size: '№36', kgPerM: 41.9 },
  { size: '№40', kgPerM: 48.3 },
]

/** Двутавр стальной горячекатаный: ГОСТ 8239-89 (№) и нормальные Б по ГОСТ Р 57837 / СТО АСЧМ 20-93. */
export const BEAMS: TableProfile[] = [
  { size: '№10', kgPerM: 9.46 },
  { size: '№12', kgPerM: 11.5 },
  { size: '№14', kgPerM: 13.7 },
  { size: '№16', kgPerM: 15.9 },
  { size: '№18', kgPerM: 18.4 },
  { size: '№20', kgPerM: 21.0 },
  { size: '№22', kgPerM: 24.0 },
  { size: '№24', kgPerM: 27.3 },
  { size: '№27', kgPerM: 31.5 },
  { size: '№30', kgPerM: 36.5 },
  { size: '№33', kgPerM: 42.2 },
  { size: '№36', kgPerM: 48.6 },
  { size: '№40', kgPerM: 57.0 },
  { size: '№45', kgPerM: 66.5 },
  { size: '№50', kgPerM: 78.5 },
  { size: '№55', kgPerM: 92.6 },
  { size: '№60', kgPerM: 108 },
  { size: '20Б1', kgPerM: 22.4 },
  { size: '26Б1', kgPerM: 28.0 },
  { size: '30Б1', kgPerM: 32.9 },
  { size: '35Б1', kgPerM: 38.9 },
  { size: '40Б1', kgPerM: 48.1 },
  { size: '50Б1', kgPerM: 73.0 },
]

/** Арматура, ГОСТ 34028-2016 (ранее ГОСТ 5781-82): номинальный диаметр → масса 1 м. */
export const REBAR: { d: number; kgPerM: number }[] = [
  { d: 6, kgPerM: 0.222 },
  { d: 8, kgPerM: 0.395 },
  { d: 10, kgPerM: 0.617 },
  { d: 12, kgPerM: 0.888 },
  { d: 14, kgPerM: 1.21 },
  { d: 16, kgPerM: 1.58 },
  { d: 18, kgPerM: 2.0 },
  { d: 20, kgPerM: 2.47 },
  { d: 22, kgPerM: 2.98 },
  { d: 25, kgPerM: 3.85 },
  { d: 28, kgPerM: 4.83 },
  { d: 32, kgPerM: 6.31 },
  { d: 36, kgPerM: 7.99 },
  { d: 40, kgPerM: 9.87 },
]

export function rebarKgPerM(d: number): number {
  const row = REBAR.find((r) => r.d === d)
  // Fallback for non-standard diameters: round bar of steel.
  return row ? row.kgPerM : (Math.PI * d * d * STEEL_DENSITY) / 4 / 1e6
}

/** Mass of 1 m of a geometric profile, kg. Dimensions in mm, density in kg/m³. */
export const geo = {
  round: (d: number, rho: number) => ((Math.PI * d * d) / 4) * rho * 1e-6,
  square: (a: number, rho: number) => a * a * rho * 1e-6,
  /** Hexagon by across-flats size S. */
  hex: (s: number, rho: number) => ((Math.sqrt(3) / 2) * s * s) * rho * 1e-6,
  strip: (w: number, t: number, rho: number) => w * t * rho * 1e-6,
  pipe: (d: number, s: number, rho: number) => {
    const wall = Math.min(s, d / 2)
    return Math.PI * (d - wall) * wall * rho * 1e-6
  },
  /**
   * Rectangular hollow section (ГОСТ 30245 / 8639 / 8645) with corner radii R = 2s, r = s —
   * matches the standard tables within ~1%.
   */
  profilePipe: (a: number, b: number, s: number, rho: number) => {
    const wall = Math.min(s, Math.min(a, b) / 2)
    const area = 2 * wall * (a + b - 2 * wall) - (4 - Math.PI) * (4 * wall * wall - wall * wall)
    return Math.max(0, area) * rho * 1e-6
  },
  /** Angle with legs b1, b2 and thickness t (fillets ignored, ~1–2% light). */
  angle: (b1: number, b2: number, t: number, rho: number) => (b1 + b2 - t) * t * rho * 1e-6,
}
