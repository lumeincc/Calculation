/** Насыпная плотность сыпучих материалов (т/м³) и связь с ключами справочника цен. */
export interface BulkMaterial {
  id: string
  name: string
  /** Bulk density, t/m³ */
  density: number
  /** Typical compaction coefficient (коэффициент уплотнения) for bedding layers. */
  compaction: number
  priceKey?: string
}

export const BULK_MATERIALS: BulkMaterial[] = [
  { id: 'sand', name: 'Песок строительный (карьерный)', density: 1.5, compaction: 1.15, priceKey: 'bulk-sand' },
  { id: 'sand-river', name: 'Песок речной мытый', density: 1.6, compaction: 1.15, priceKey: 'bulk-sand-river' },
  { id: 'granite-5-20', name: 'Щебень гранитный 5–20', density: 1.37, compaction: 1.3, priceKey: 'bulk-gravel-granite' },
  { id: 'granite-20-40', name: 'Щебень гранитный 20–40', density: 1.37, compaction: 1.3, priceKey: 'bulk-gravel-granite-40' },
  { id: 'gravel', name: 'Щебень гравийный', density: 1.43, compaction: 1.25, priceKey: 'bulk-gravel' },
  { id: 'limestone', name: 'Щебень известняковый', density: 1.3, compaction: 1.3, priceKey: 'bulk-gravel-lime' },
  { id: 'asg', name: 'ПГС (песчано-гравийная смесь)', density: 1.65, compaction: 1.2, priceKey: 'bulk-asg' },
  { id: 'screening', name: 'Отсев гранитный', density: 1.5, compaction: 1.2, priceKey: 'bulk-screening' },
  { id: 'claydite', name: 'Керамзит 10–20', density: 0.4, compaction: 1.15, priceKey: 'bulk-expanded-clay' },
  { id: 'soil', name: 'Грунт растительный (чернозём)', density: 1.2, compaction: 1.25, priceKey: 'bulk-soil' },
  { id: 'loam', name: 'Суглинок', density: 1.6, compaction: 1.25, priceKey: 'bulk-loam' },
  { id: 'clay', name: 'Глина', density: 1.5, compaction: 1.3 },
  { id: 'asphalt-crumb', name: 'Асфальтовая крошка', density: 1.3, compaction: 1.3, priceKey: 'bulk-asphalt-crumb' },
  { id: 'cement', name: 'Цемент (навалом)', density: 1.3, compaction: 1 },
  { id: 'slag', name: 'Шлак котельный', density: 0.8, compaction: 1.2 },
  { id: 'debris', name: 'Строительный мусор (смешанный)', density: 0.6, compaction: 1 },
]

export interface Soil {
  id: string
  name: string
  /** Density in natural state, t/m³ */
  density: number
  /** Коэффициент первоначального разрыхления (СП 45.13330, прил.) */
  loosening: number
  /** Recommended slope m (1:m) for depth up to 3 m without fastening (СНиП 12-04-2002, табл. 1). */
  slope: number
}

export const SOILS: Soil[] = [
  { id: 'sand', name: 'Песок', density: 1.6, loosening: 1.12, slope: 1 },
  { id: 'sandy-loam', name: 'Супесь', density: 1.65, loosening: 1.15, slope: 0.67 },
  { id: 'loam', name: 'Суглинок', density: 1.75, loosening: 1.22, slope: 0.5 },
  { id: 'clay', name: 'Глина', density: 1.8, loosening: 1.28, slope: 0.25 },
  { id: 'gravel', name: 'Гравийно-галечный', density: 1.85, loosening: 1.18, slope: 1 },
  { id: 'topsoil', name: 'Растительный грунт', density: 1.25, loosening: 1.22, slope: 1 },
  { id: 'rock', name: 'Скальный (разрыхлённый)', density: 2.4, loosening: 1.45, slope: 0 },
]

export interface Truck {
  id: string
  name: string
  /** Payload, t */
  tons: number
  /** Body volume, m³ */
  m3: number
}

export const TRUCKS: Truck[] = [
  { id: 'gazel', name: 'ГАЗель-самосвал (1,5 т / 2 м³)', tons: 1.5, m3: 2 },
  { id: 'small', name: 'Самосвал 5 т / 5 м³', tons: 5, m3: 5 },
  { id: 'kamaz10', name: 'КамАЗ 15 т / 10 м³', tons: 15, m3: 10 },
  { id: 'kamaz15', name: 'Самосвал 20 т / 15 м³', tons: 20, m3: 15 },
  { id: 'heavy', name: 'Самосвал 25 т / 20 м³ (Shacman, Volvo)', tons: 25, m3: 20 },
  { id: 'trailer', name: 'Полуприцеп-самосвал 30 т / 30 м³', tons: 30, m3: 30 },
]
