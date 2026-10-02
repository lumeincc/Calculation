import { describe, expect, it } from 'vitest'
import { gzipSync, zipSync, strToU8 } from 'fflate'
import { parseProfile } from '@/lib/metalParse'
import { kgPerMetre } from '@/lib/metal'
import { parseCsv } from './csv'
import { decodeName, decodeText } from './encoding'
import { cleanMtext } from './dxfText'
import { detectHeader, extractFromTable, guessKind, parseNum } from './tables'
import { readTar } from './tar'
import { unpackAll } from './unpack'
import { readZip } from './zip'
import { alignPage, itemsToLines } from './pdfLayout'
import { rtfToText } from './analyze'

/** Builds a stored (uncompressed) ZIP with raw name bytes, like Windows Explorer does. */
function rawZip(entries: { name: Uint8Array; data: Uint8Array; flags?: number }[]): Uint8Array {
  const parts: number[] = []
  const central: number[] = []
  const u16 = (a: number[], v: number) => a.push(v & 0xff, (v >> 8) & 0xff)
  const u32 = (a: number[], v: number) => a.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff)
  for (const e of entries) {
    const off = parts.length
    u32(parts, 0x04034b50); u16(parts, 20); u16(parts, e.flags ?? 0); u16(parts, 0); u16(parts, 0); u16(parts, 0)
    u32(parts, 0); u32(parts, e.data.length); u32(parts, e.data.length); u16(parts, e.name.length); u16(parts, 0)
    parts.push(...e.name, ...e.data)
    u32(central, 0x02014b50); u16(central, 20); u16(central, 20); u16(central, e.flags ?? 0); u16(central, 0); u16(central, 0); u16(central, 0)
    u32(central, 0); u32(central, e.data.length); u32(central, e.data.length); u16(central, e.name.length); u16(central, 0); u16(central, 0)
    u16(central, 0); u16(central, 0); u32(central, 0); u32(central, off)
    central.push(...e.name)
  }
  const cdOff = parts.length
  const eocd: number[] = []
  u32(eocd, 0x06054b50); u16(eocd, 0); u16(eocd, 0); u16(eocd, entries.length); u16(eocd, entries.length)
  u32(eocd, central.length); u32(eocd, cdOff); u16(eocd, 0)
  return new Uint8Array([...parts, ...central, ...eocd])
}

const cp866 = (s: string) => {
  // А-Я → 0x80-0x9F, а-п → 0xA0-0xAF, р-я → 0xE0-0xEF
  return new Uint8Array([...s].map((ch) => {
    const c = ch.charCodeAt(0)
    if (c >= 0x410 && c <= 0x42f) return c - 0x410 + 0x80
    if (c >= 0x430 && c <= 0x43f) return c - 0x430 + 0xa0
    if (c >= 0x440 && c <= 0x44f) return c - 0x440 + 0xe0
    return c
  }))
}

describe('archives', () => {
  it('reads deflated zip with UTF-8 names', () => {
    const zip = zipSync({ 'Смета/раздел 1.txt': strToU8('Бетон М300'), 'папка/': new Uint8Array(0) })
    const entries = readZip(zip)
    expect(entries.map((e) => e.name)).toEqual(['Смета/раздел 1.txt'])
    expect(new TextDecoder().decode(entries[0].read())).toBe('Бетон М300')
  })

  it('decodes CP866 names from Windows archives', () => {
    const zip = rawZip([{ name: cp866('Спецификация КМ.csv'), data: strToU8('x') }])
    expect(readZip(zip)[0].name).toBe('Спецификация КМ.csv')
    expect(decodeName(cp866('Проект'), false)).toBe('Проект')
  })

  it('reads tar and unpacks nested archives recursively', async () => {
    const inner = zipSync({ 'КМ/спец.csv': strToU8('Наименование;Кол-во;Ед.\nУголок 50х5;12;м') })
    const tarBytes = makeTar([{ name: 'docs/inner.zip', data: inner }, { name: 'docs/readme.txt', data: strToU8('hi') }])
    expect(readTar(tarBytes).map((f) => f.name)).toEqual(['docs/inner.zip', 'docs/readme.txt'])
    const outer = zipSync({ 'пакет.tar.gz': gzipSync(tarBytes), '__MACOSX/._junk': strToU8('x') })
    const { files, warnings } = await unpackAll([{ name: 'проект.zip', data: outer }])
    expect(warnings).toEqual([])
    const paths = files.map((f) => f.path)
    expect(paths).toContain('проект.zip/пакет.tar.gz/пакет.tar/docs/inner.zip/КМ/спец.csv')
    expect(paths.some((p) => p.includes('__MACOSX'))).toBe(false)
    expect(files.find((f) => f.name === 'спец.csv')!.kind).toBe('sheet')
  })

  it('enforces the file count limit', async () => {
    const many: Record<string, Uint8Array> = {}
    for (let i = 0; i < 20; i++) many[`f${i}.txt`] = strToU8(String(i))
    const { files, warnings } = await unpackAll([{ name: 'a.zip', data: zipSync(many) }], { limits: { maxFiles: 5 } })
    expect(files.length).toBe(5)
    expect(warnings.length).toBe(1)
  })
})

function makeTar(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const blocks: Uint8Array[] = []
  for (const f of files) {
    const h = new Uint8Array(512)
    h.set(strToU8(f.name), 0)
    h.set(strToU8(f.data.length.toString(8).padStart(11, '0') + '\0'), 124)
    h[156] = '0'.charCodeAt(0)
    h.set(strToU8('ustar'), 257)
    blocks.push(h, f.data, new Uint8Array((512 - (f.data.length % 512)) % 512))
  }
  blocks.push(new Uint8Array(1024))
  const out = new Uint8Array(blocks.reduce((s, b) => s + b.length, 0))
  let o = 0
  for (const b of blocks) {
    out.set(b, o)
    o += b.length
  }
  return out
}

describe('text decoding', () => {
  it('detects Windows-1251', () => {
    const bytes = new Uint8Array([0xd1, 0xec, 0xe5, 0xf2, 0xe0]) // «Смета» in cp1251
    expect(decodeText(bytes)).toBe('Смета')
  })
  it('keeps UTF-8', () => {
    expect(decodeText(strToU8('Арматура'))).toBe('Арматура')
  })
  it('parses csv with semicolons and quotes', () => {
    expect(parseCsv('a;"b;c";d\n1;2;3')).toEqual([['a', 'b;c', 'd'], ['1', '2', '3']])
  })
  it('converts rtf', () => {
    expect(rtfToText("{\\rtf1\\ansi {\\fonttbl}\\'d1\\'ec\\'e5\\'f2\\'e0\\par x}")).toContain('Смета')
  })
  it('cleans mtext', () => {
    expect(cleanMtext('{\\fArial|b0;Труба %%c57}\\PЛист')).toBe('Труба ⌀57\nЛист')
  })
})

describe('metal profile recognition', () => {
  const cases: [string, Partial<ReturnType<typeof parseProfile> & object>][] = [
    ['Труба профильная 40х20х2 ГОСТ 30245', { type: 'profilePipe', a: 40, b: 20, s: 2 }],
    ['Гн□100х4', { type: 'profilePipe', a: 100, b: 100, s: 4 }],
    ['Труба э/с 57х3,5', { type: 'pipe', a: 57, s: 3.5 }],
    ['Труба ВГП Ду20х2,8', { type: 'pipe', a: 26.8, s: 2.8 }],
    ['Уголок 50х5 ГОСТ 8509-93', { type: 'angle', size: '50×5' }],
    ['∟63х63х5', { type: 'angle', size: '63×5' }],
    ['Уголок 100х63х6', { type: 'angle', a: 100, b: 63, s: 6 }],
    ['Швеллер 10П ГОСТ 8240', { type: 'channel', size: '№10' }],
    ['Швеллер 6,5У', { type: 'channel', size: '№6,5' }],
    ['Двутавр 20Б1 СТО АСЧМ 20-93', { type: 'beam', size: '20Б1' }],
    ['Балка двутавровая 30', { type: 'beam', size: '№30' }],
    ['Арматура Ø12 А500С', { type: 'rebar', a: 12 }],
    ['12-А500С ГОСТ 34028', { type: 'rebar', a: 12 }],
    ['Арматура А240 8', { type: 'rebar', a: 8 }],
    ['Лист г/к 4х1500х6000', { type: 'sheet', s: 4 }],
    ['Лист 10 ГОСТ 19903-2015', { type: 'sheet', s: 10 }],
    ['-10х200', { type: 'strip', a: 200, s: 10 }],
    ['Полоса 40х4', { type: 'strip', a: 40, s: 4 }],
    ['Круг 20 ГОСТ 2590', { type: 'round', a: 20 }],
  ]
  for (const [text, expected] of cases) {
    it(text, () => {
      expect(parseProfile(text)).toMatchObject(expected)
    })
  }
  it('ignores non-metal text', () => {
    expect(parseProfile('Бетон В25 F150 W6')).toBeNull()
    expect(parseProfile('Кладка из кирпича 250х120х65')).toBeNull()
  })
})

describe('table extraction', () => {
  it('parses Russian numbers', () => {
    expect(parseNum('1 234,56')).toBe(1234.56)
    expect(parseNum('1,234.5')).toBe(1234.5)
    expect(parseNum('12 345 ₽')).toBe(12345)
    expect(parseNum('Ø12')).toBeNull()
    expect(parseNum(7)).toBe(7)
  })

  it('guesses item kinds', () => {
    expect(guessKind('Устройство бетонной подготовки')).toBe('work')
    expect(guessKind('Перевозка грунта')).toBe('transport')
    expect(guessKind('Экскаватор 0,65 м3')).toBe('machine')
    expect(guessKind('Бетон В15')).toBe('material')
  })

  it('finds an estimate table with a two-row header and sections', () => {
    const rows = [
      ['Локальная смета № 1'],
      ['№ п/п', 'Наименование работ и затрат', 'Ед. изм.', 'Кол-во', 'Стоимость, руб.', ''],
      ['', '', '', '', 'за единицу', 'всего'],
      ['1', '2', '3', '4', '5', '6'],
      ['Раздел 1. Земляные работы'],
      ['1', 'Разработка грунта экскаватором', 'м3', '120', '650', '78 000'],
      ['2', 'Песок строительный', 'м3', '15,5', '1 100,00', '17 050,00'],
      ['', 'Итого по разделу 1', '', '', '', '95 050'],
    ]
    const h = detectHeader(rows)!
    expect(h.map.name).toBe(1)
    expect(h.map.qty).toBe(3)
    const { positions } = extractFromTable({ title: 'Лист1', rows }, 'f')
    expect(positions).toHaveLength(2)
    expect(positions[0]).toMatchObject({ name: 'Разработка грунта экскаватором', unit: 'м3', qty: 120, kind: 'work', group: 'Раздел 1. Земляные работы' })
    expect(positions[1].price).toBe(1100)
    expect(positions[1].sum).toBe(17050)
  })

  it('computes metal tonnage from a KM specification', () => {
    const rows: (string | number)[][] = [
      ['Поз.', 'Наименование профиля', 'Кол-во', 'Ед.', 'Масса, т'],
      [1, 'Уголок 50х5', 120, 'м', ''],
      [2, 'Швеллер 10П', 2, 'т', ''],
      [3, 'Труба 40х20х2', 6, 'шт', 0.12],
    ]
    const { metal } = extractFromTable({ title: 'КМ', rows }, 'f')
    expect(metal).toHaveLength(3)
    expect(metal[0].massKg).toBeCloseTo(120 * 3.77, 6)
    expect(metal[0].massFrom).toBe('length')
    expect(metal[1].massKg).toBe(2000)
    expect(metal[2].massKg).toBe(120)
    expect(metal[2].kgPerM).toBeCloseTo(kgPerMetre({ type: 'profilePipe', a: 40, b: 20, s: 2 }), 9)
  })
})

describe('pdf layout', () => {
  it('rebuilds a table from positioned text', () => {
    const it = (str: string, x: number, y: number) => ({ str, x, y, w: str.length * 5, h: 10 })
    const lines = itemsToLines([
      it('Наименование', 10, 700), it('Ед.', 200, 700), it('Кол-во', 260, 700),
      it('Уголок 50х5', 10, 680), it('м', 202, 680), it('120', 262, 680),
      it('Лист 10', 10, 660), it('м2', 202, 660), it('5', 262, 660),
    ])
    expect(lines).toHaveLength(3)
    const { rows } = alignPage(lines)
    expect(rows[1]).toEqual(['Уголок 50х5', 'м', '120'])
    const { metal } = extractFromTable({ title: 'p', rows }, 'f')
    expect(metal[1].massKg).toBeCloseTo(5 * 78.5, 6)
  })
})

describe('metal sources', () => {
  it('counts a summary once and drops documents with the same total', async () => {
    const { metalSources } = await import('./metalSources')
    const hit = (fileId: string, kg: number) => ({ fileId, massKg: kg }) as never
    const files = [
      { id: 'reg', name: 'Реестр 2020.xlsx', kind: 'sheet' as const },
      { id: 'sum', name: 'Выборка металла 2020.xlsx', kind: 'sheet' as const },
      { id: 'card', name: 'Тех карта 2020.xlsx', kind: 'sheet' as const },
      { id: 'other', name: 'Ограждение.xlsx', kind: 'sheet' as const },
    ]
    const hits = [hit('reg', 4000), hit('reg', 3571.64), hit('sum', 7571.62), hit('card', 7571.64), hit('other', 500)]
    const { sources, selected } = metalSources(files, hits)
    // With a summary present only the summary counts; other documents become a cross-check.
    expect([...selected]).toEqual(['sum'])
    expect(sources.find((s) => s.fileId === 'reg')!.duplicateOf).toBe('sum')
    expect(sources.find((s) => s.fileId === 'other')!.covered).toBe(true)
    const noSummary = metalSources(files.filter((f) => f.id !== 'sum'), hits)
    expect([...noSummary.selected].sort()).toEqual(['card', 'other'])
  })
})

describe('assembly drawing specification', () => {
  it('multiplies detail masses by the number of marks and reconciles glued rows', async () => {
    const { extractDrawingSpec } = await import('./drawingSpec')
    const rows = [
      ['№ Кол-', 'Длина', 'Масса, кг'],
      ['Марка', 'Сечение', 'мм', 'Сталь', 'Примечание'],
      ['G-10', '1', 'Тр.кв.120X120X4.0 (ГОСТ_30245-2003)', '4640', 'C255', '66.1', '66.1'],
      ['G-17', '2', '-4 x 116', '116', 'C255', '0.4', '0.8'],
      ['G-48', '15', '-4 x 950', '243Лист ромб 4,07.7', '115.5'],
      ['5862', '8'],
      ['Вес сварных швов:', '0.7 кг', 'Вес марки:', '183.1 кг'],
      ['G-10', '10', 'Балка', 'Вес всех марок:', '1831.0 кг'],
    ]
    const r = extractDrawingSpec([{ title: 'Стр. 1', rows }], 'f')!
    expect(r.marks).toBe(10)
    expect(r.hits.map((h) => h.name)).toEqual(['Труба профильная 120×120×4', 'Полоса 116×4', 'Полоса 950×4'])
    expect(r.hits.reduce((s, h) => s + h.massKg!, 0)).toBeCloseTo((66.1 + 0.8 + 115.5) * 10, 6)
  })

  it('ignores drawings without a specification', async () => {
    const { extractDrawingSpec } = await import('./drawingSpec')
    expect(extractDrawingSpec([{ title: 'p', rows: [['План', 'Труба 57х3,5']] }], 'f')).toBeNull()
  })
})
