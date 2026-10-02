/**
 * Finds estimate/specification tables in spreadsheets, PDFs and Word documents and turns their
 * rows into positions (name, unit, qty, price, sum, mass), recognising metal profiles on the way.
 */
import { kgPerMetre, PROFILE_PRICE_KEY, profileName } from '@/lib/metal'
import { parseProfile } from '@/lib/metalParse'
import { uid } from '@/lib/id'
import type { ItemKind } from '@/lib/estimate'
import type { Cell, DocTable, MetalHit, Position } from './types'

const norm = (c: Cell | undefined) => String(c ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()

/** «1 234,56» / «1234.56» / «1,234.56» → number; null when the cell is not a number. */
export function parseNum(c: Cell | undefined): number | null {
  if (typeof c === 'number') return Number.isFinite(c) ? c : null
  let s = String(c ?? '').replace(/[\s  ]/g, '').replace(/(руб\.?|₽|р\.|₸|тг\.?|тенге)$/i, '')
  if (!s || !/^[-+]?[\d.,]+$/.test(s)) return null
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf('.') > s.lastIndexOf(',') ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.')
  else if ((s.match(/,/g)?.length ?? 0) === 1) s = s.replace(',', '.')
  else s = s.replace(/,/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export interface ColumnMap {
  name: number
  unit?: number
  qty?: number
  price?: number
  sum?: number
  mass?: number
  massUnitT?: boolean
  unitMass?: number
  unitMassT?: boolean
  length?: number
}

type Role = Exclude<keyof ColumnMap, 'massUnitT' | 'unitMassT'>

const ROLE_TESTS: [Role, RegExp, RegExp?][] = [
  ['unit', /(^|\s)ед\.?(\s|$)|ед\.\s*изм|единиц|изм\./],
  ['price', /цена|стоимость\s*(за\s*)?ед|за\s*ед|расценк|(руб|тг|тенге)\.?\s*\/\s*(ед|шт|м|т)/],
  ['sum', /сумм|стоимость|(^|\s)всего|итого/],
  ['qty', /кол-?\s*во|количеств|^кол\.?$|^к-?во|объем(?!.*масс)|^кол /],
  ['length', /длин/],
  ['mass', /масс|вес(?!ь)/],
  ['name', /наименован|наим\.|описание|материал|профил|сортамент|вид работ|работ[ыа]? и затрат|^позиция$/],
]

function rolesOf(text: string): Role[] {
  const roles: Role[] = []
  for (const [role, re] of ROLE_TESTS) if (re.test(text)) roles.push(role)
  return roles
}

/** Detects the header row (single or two-row header) and maps columns to roles. */
function mapRows(rows: Cell[][], r: number, span: number): ColumnMap | null {
  const width = Math.max(...rows.slice(r, r + span).map((x) => x.length))
  const map: Partial<ColumnMap> = {}
  for (let c = 0; c < width; c++) {
    const t = rows.slice(r, r + span).map((row) => norm(row[c])).filter(Boolean).join(' ')
    if (!t || t.length > 120) continue
    const roles = rolesOf(t)
    if (roles.includes('mass')) {
      const isUnit = /(ед|1\s*(шт|м|п\.?\s*м)|одного|един)/.test(t) && !/(общ|всего|итого)/.test(t)
      const isT = /(,|\s|\()\s*т\.?(\s|\)|$)|тонн/.test(t)
      if (isUnit) {
        if (map.unitMass === undefined) Object.assign(map, { unitMass: c, unitMassT: isT })
      } else if (map.mass === undefined) Object.assign(map, { mass: c, massUnitT: isT })
      continue
    }
    if (roles.includes('price') && map.price === undefined) map.price = c
    else if (roles.includes('sum') && map.sum === undefined) map.sum = c
    else if (roles.includes('qty') && map.qty === undefined) map.qty = c
    else if (roles.includes('unit') && map.unit === undefined) map.unit = c
    else if (roles.includes('length') && map.length === undefined) map.length = c
    else if (roles.includes('name') && map.name === undefined) map.name = c
  }
  if (map.name === undefined || (map.qty === undefined && map.sum === undefined && map.mass === undefined)) return null
  return map as ColumnMap
}

const roleCount = (m: ColumnMap) => Object.keys(m).filter((k) => !k.endsWith('T')).length

/** Detects the header row (single or two-row header) and maps columns to roles. */
export function detectHeader(rows: Cell[][]): { headerRow: number; dataStart: number; map: ColumnMap } | null {
  const limit = Math.min(rows.length, 40)
  for (let r = 0; r < limit; r++) {
    const one = mapRows(rows, r, 1)
    if (!one) continue
    // A second header row («за единицу | всего») is taken when it identifies more columns.
    const two = r + 1 < rows.length ? mapRows(rows, r, 2) : null
    const useTwo = two !== null && roleCount(two) > roleCount(one)
    const map = useTwo ? two : one
    let dataStart = r + (useTwo ? 2 : 1)
    // Skip the row of column numbers («1 2 3 4…») that usually follows the header.
    const next = rows[dataStart]
    const filled = next?.filter((c) => norm(c) !== '') ?? []
    if (filled.length > 2 && filled.every((c) => parseNum(c) !== null)) dataStart++
    return { headerRow: r, dataStart, map }
  }
  return null
}

const TOTAL_RE = /^(итого|всего|в том числе|в т\.\s*ч\.|ндс|накладн|сметн\w* прибыль|прибыль|итог)/
const WORK_RE = /(^|\s)(монтаж|демонтаж|устройство|укладка|кладка|разработка|установка|окраска|облицовка|прокладка|бетонирование|армирование|штукатурка поверхн|грунтование|засыпка|обратная засыпка|планировка|погрузка|сварка|сборка|вязка|пробивка|сверление|оштукатуривание|шпатлевание|окрашивание|изготовление)/
const TRANSPORT_RE = /(перевозка|доставка|вывоз|транспортировка)/
const MACHINE_RE = /(эксплуатация|аренда|машин|кран|экскаватор|бульдозер|автокран|автобетононасос|погрузчик|маш\.-ч|маш-ч)/

export function guessKind(name: string, unit = ''): ItemKind {
  const n = name.toLowerCase().replace(/ё/g, 'е')
  // «Разработка грунта экскаватором» is work that uses a machine: work verbs win.
  if (WORK_RE.test(n)) return 'work'
  if (TRANSPORT_RE.test(n)) return 'transport'
  if (MACHINE_RE.test(n) || /маш/.test(unit.toLowerCase())) return 'machine'
  return 'material'
}

function massToKg(v: number | null, isT?: boolean): number | undefined {
  if (v === null) return undefined
  return isT ? v * 1000 : v
}

export interface TableExtract {
  positions: Position[]
  metal: MetalHit[]
}

export function extractFromTable(table: DocTable, fileId: string): TableExtract {
  const header = detectHeader(table.rows)
  if (!header) return { positions: [], metal: [] }
  const { map, dataStart } = header
  const positions: Position[] = []
  const metal: MetalHit[] = []
  let group: string | undefined
  for (let r = dataStart; r < table.rows.length; r++) {
    const row = table.rows[r]
    const name = String(row[map.name] ?? '').replace(/\s+/g, ' ').trim()
    const nonEmpty = row.filter((c) => norm(c) !== '')
    if (nonEmpty.length === 0) continue
    const numbers = nonEmpty.filter((c) => parseNum(c) !== null)
    // A row with text only and no numbers is a section heading.
    if (numbers.length === 0 || (nonEmpty.length === 1 && numbers.length === 0)) {
      const heading = nonEmpty.map((c) => String(c).trim()).join(' ')
      if (heading.length < 160 && !rolesOf(norm(heading)).includes('name')) group = heading
      continue
    }
    if (!name || parseNum(name) !== null || TOTAL_RE.test(norm(name))) continue

    const unit = map.unit !== undefined ? String(row[map.unit] ?? '').trim() : ''
    let qty = map.qty !== undefined ? parseNum(row[map.qty]) : null
    let price = map.price !== undefined ? parseNum(row[map.price]) : null
    const sum = map.sum !== undefined ? parseNum(row[map.sum]) : null
    if (qty === null && sum !== null && price) qty = sum / price
    if (price === null && sum !== null && qty) price = sum / qty
    let massKg = map.mass !== undefined ? massToKg(parseNum(row[map.mass]), map.massUnitT) : undefined
    const unitMassKg = map.unitMass !== undefined ? massToKg(parseNum(row[map.unitMass]), map.unitMassT) : undefined
    if (massKg === undefined && unitMassKg !== undefined && qty !== null) massKg = unitMassKg * qty
    if (qty === null && sum === null && massKg === undefined) continue

    const pos: Position = {
      id: uid(),
      fileId,
      source: table.title,
      group,
      name,
      unit,
      qty: qty ?? (massKg !== undefined ? massKg / 1000 : 0),
      price: price ?? 0,
      sum: sum ?? (qty ?? 0) * (price ?? 0),
      massKg,
      kind: guessKind(name, unit),
    }
    if (qty === null && massKg !== undefined && !unit) pos.unit = 'т'
    positions.push(pos)

    // Metal recognition: profile from the name (or the whole row for «Профиль» + «Наименование» layouts).
    const profile = parseProfile(name) ?? parseProfile(nonEmpty.filter((c) => typeof c === 'string').join(' '))
    if (profile) {
      const k = kgPerMetre(profile)
      const u = unit.toLowerCase().replace(/\.$/, '')
      const lengthM = map.length !== undefined ? parseNum(row[map.length]) : null
      let m: number | null = massKg ?? null
      let from: MetalHit['massFrom'] = m !== null ? 'column' : 'none'
      const q = qty ?? 0
      if (m === null && (u === 'т' || u === 'тн' || u === 'тонн')) [m, from] = [q * 1000, 'unit']
      else if (m === null && u === 'кг') [m, from] = [q, 'unit']
      else if (m === null && /^(м|п\.?\s?м|пог\.?\s?м|м\.?\s?п)$/.test(u)) [m, from] = [q * k, 'length']
      else if (m === null && profile.type === 'sheet' && /м2|м²|кв\.?\s?м/.test(u)) [m, from] = [q * k, 'length']
      else if (m === null && lengthM !== null) {
        const len = lengthM > 100 ? lengthM / 1000 : lengthM // mm → m
        ;[m, from] = [q * len * k, 'length']
      }
      metal.push({
        id: uid(), fileId, source: table.title, raw: name, profile, name: profileName(profile),
        kgPerM: k, qty: q, unit, massKg: m, massFrom: from,
      })
      if (m !== null) {
        if (pos.massKg === undefined) pos.massKg = m
        pos.metalPriceKey = PROFILE_PRICE_KEY[profile.type]
      }
    }
  }
  return { positions, metal }
}
