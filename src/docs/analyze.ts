/**
 * Extracts text and tables from a document and finds estimate positions and metal profiles.
 * Heavy parsers (pdf.js, SheetJS, mammoth, dxf-parser) are loaded on demand.
 */
import { decodeText } from './encoding'
import { parseCsv } from './csv'
import { cleanMtext } from './dxfText'
import { sanitizeHtml, tablesFromHtml } from './sanitize'
import { extractDrawingSpec } from './drawingSpec'
import { extractFromTable } from './tables'
import type { Cell, DocAnalysis, DocFile, DocTable } from './types'
import { readZip } from './zip'
import { T, Tf } from '@/i18n'

const MAX_TEXT = 2_000_000

function finish(file: DocFile, base: Partial<DocAnalysis> & { tables: DocTable[] }): DocAnalysis {
  const positions = []
  const metal = []
  for (const t of base.tables) {
    const r = extractFromTable(t, file.id)
    positions.push(...r.positions)
    metal.push(...r.metal)
  }
  return { status: 'done', text: (base.text ?? '').slice(0, MAX_TEXT), ...base, positions, metal }
}

const tableText = (tables: DocTable[]) => tables.map((t) => t.rows.map((r) => r.join('\t')).join('\n')).join('\n\n')

async function analyzeSheet(file: DocFile): Promise<DocAnalysis> {
  if (file.ext === 'csv' || file.ext === 'tsv') {
    const rows = parseCsv(decodeText(file.data))
    const tables = [{ title: file.name, rows }]
    return finish(file, { tables, text: tableText(tables) })
  }
  const [XLSX, cptable] = await Promise.all([import('@e965/xlsx'), import('@e965/xlsx/dist/cpexcel.full.mjs')])
  XLSX.set_cptable(cptable)
  const wb = XLSX.read(file.data, { type: 'array', cellDates: true, codepage: 1251 })
  const tables: DocTable[] = wb.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, raw: true, defval: '', blankrows: false })
    return { title: name, rows: rows.map((r) => r.map((c) => ((c as unknown) instanceof Date ? (c as unknown as Date).toLocaleDateString('ru-RU') : (c as Cell)))) }
  })
  return finish(file, { tables, text: tableText(tables) })
}

async function analyzePdf(file: DocFile): Promise<DocAnalysis> {
  const { extractPdf } = await import('./pdf')
  const r = await extractPdf(file.data)
  const notes = r.text.trim().length < 20 ? [T('В PDF нет текстового слоя (скан). Для распознавания нужен OCR — он в плане развития.')] : undefined
  const result = finish(file, { tables: r.tables, text: r.text, pages: r.pages, notes })
  const drawing = extractDrawingSpec(r.tables, file.id)
  if (drawing) {
    // An assembly drawing: its own specification × number of marks replaces generic table rows.
    result.metal = drawing.hits
    result.notes = [...(result.notes ?? []), Tf('Сборочный чертёж: {0} {1}, вес всех марок {2} кг (с учётом сварных швов).', [drawing.marks, drawing.marks === 1 ? T('марка') : T('марок/марки'), drawing.totalKg])]
  }
  return result
}

async function analyzeDocx(file: DocFile): Promise<DocAnalysis> {
  const mammoth = (await import('mammoth')).default
  const buf = file.data.buffer.slice(file.data.byteOffset, file.data.byteOffset + file.data.byteLength) as ArrayBuffer
  const { value } = await mammoth.convertToHtml({ arrayBuffer: buf })
  const html = sanitizeHtml(value)
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const tables = tablesFromHtml(doc).map((rows, i) => ({ title: Tf('Таблица {0}', [i + 1]), rows }))
  return finish(file, { tables, text: doc.body.textContent ?? '', html })
}

function analyzeOdt(file: DocFile): DocAnalysis {
  const entry = readZip(file.data).find((e) => e.name === 'content.xml')
  if (!entry) throw new Error(T('В ODT нет content.xml'))
  const xml = new TextDecoder('utf-8').decode(entry.read())
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const tables = [...doc.getElementsByTagName('table:table')].map((t, i) => ({
    title: Tf('Таблица {0}', [i + 1]),
    rows: [...t.getElementsByTagName('table:table-row')].map((r) =>
      [...r.getElementsByTagName('table:table-cell')].map((c) => (c.textContent ?? '').trim()),
    ),
  }))
  const text = [...doc.getElementsByTagName('text:p')].map((p) => p.textContent ?? '').join('\n')
  return finish(file, { tables, text })
}

/** Very small RTF → text: decodes \'xx (Windows-1251) and drops control words and groups. */
export function rtfToText(rtf: string): string {
  const bytes: number[] = []
  let out = ''
  const flush = () => {
    if (bytes.length) {
      out += new TextDecoder('windows-1251').decode(new Uint8Array(bytes))
      bytes.length = 0
    }
  }
  const re = /\\'([0-9a-f]{2})|\\u(-?\d+)\??|\\par[d]?\b|\\([a-z]+)-?\d* ?|\\([{}\\])|([{}])|([^\\{}]+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(rtf))) {
    if (m[1]) bytes.push(Number.parseInt(m[1], 16))
    else {
      flush()
      if (m[2]) out += String.fromCharCode((Number(m[2]) + 65536) % 65536)
      else if (m[0].startsWith('\\par')) out += '\n'
      else if (m[4]) out += m[4]
      else if (m[6]) out += m[6].replace(/[\r\n]/g, '')
    }
  }
  flush()
  return out.replace(/\n{3,}/g, '\n\n').trim()
}

function analyzeText(file: DocFile): DocAnalysis {
  let text = decodeText(file.data)
  if (file.ext === 'rtf') text = rtfToText(text)
  // Tab-separated text often comes from copy-pasted tables.
  const rows = text.split(/\r?\n/).map((l) => l.split('\t'))
  const tables = rows.some((r) => r.length > 2) ? [{ title: file.name, rows }] : []
  return finish(file, { tables, text })
}

async function analyzeDxf(file: DocFile): Promise<DocAnalysis> {
  const { default: DxfParser } = await import('dxf-parser')
  const dxf = new DxfParser().parseSync(decodeText(file.data))
  const texts: string[] = []
  for (const e of dxf?.entities ?? []) {
    const t = (e as { text?: string }).text
    if ((e.type === 'TEXT' || e.type === 'MTEXT' || e.type === 'ATTRIB') && t) texts.push(cleanMtext(t))
  }
  return finish(file, {
    tables: [],
    text: texts.join('\n'),
    notes: [Tf('Объектов на чертеже: {0}, текстовых надписей: {1}', [dxf?.entities.length ?? 0, texts.length])],
  })
}

export async function analyzeDoc(file: DocFile): Promise<DocAnalysis> {
  try {
    switch (file.kind) {
      case 'sheet': return await analyzeSheet(file)
      case 'pdf': return await analyzePdf(file)
      case 'docx': return await analyzeDocx(file)
      case 'odt': return analyzeOdt(file)
      case 'text': return analyzeText(file)
      case 'dxf': return await analyzeDxf(file)
      case 'image':
      case 'archive':
        return { status: 'done', text: '', tables: [], positions: [], metal: [] }
      case 'cad':
        return {
          status: 'unsupported', text: '', tables: [], positions: [], metal: [],
          notes: [T('Формат САПР/BIM не читается в браузере. Сохраните чертёж в DXF или PDF — их сайт разбирает.')],
        }
      default:
        if (file.ext === 'doc') {
          return {
            status: 'unsupported', text: '', tables: [], positions: [], metal: [],
            notes: [T('Старый формат Word (.doc) — сохраните документ как DOCX или PDF.')],
          }
        }
        return { status: 'unsupported', text: '', tables: [], positions: [], metal: [], notes: [T('Предпросмотр этого формата не поддерживается — файл можно скачать.')] }
    }
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err), text: '', tables: [], positions: [], metal: [] }
  }
}
