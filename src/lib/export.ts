/** File exports: estimates and specs to XLSX (with live formulas) and CSV, full JSON backups. */
import type { SheetData } from 'write-excel-file/browser'
import { computeTotals, KIND_LABEL, lineTotal, type Estimate } from './estimate'
import { fmtDate } from './format'
import type { Company } from '@/store/settings'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function downloadBytes(data: Uint8Array, filename: string) {
  downloadBlob(new Blob([data as BlobPart]), filename)
}

export function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 120) || 'file'
}

const head = { fontWeight: 'bold' as const, backgroundColor: '#F4F4F5', borderStyle: 'thin' as const, borderColor: '#D4D4D8', wrap: true, alignVertical: 'center' as const }
const cellB = { borderStyle: 'thin' as const, borderColor: '#D4D4D8' }
const MONEY = '#,##0.00'
const QTY = '#,##0.####'

export async function exportEstimateXlsx(e: Estimate, company: Company) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const t = computeTotals(e)
  const s = e.settings
  const data: SheetData = []
  const title = e.docType === 'offer' ? 'Коммерческое предложение' : 'Сметный расчёт'
  data.push([{ value: `${title}: ${e.name}`, fontWeight: 'bold', fontSize: 14, columnSpan: 7 }])
  if (company.name) data.push([{ value: `Исполнитель: ${company.name}${company.inn ? `, ИНН ${company.inn}` : ''}`, columnSpan: 7 }])
  if (e.client) data.push([{ value: `Заказчик: ${e.client}`, columnSpan: 7 }])
  if (e.object) data.push([{ value: `Объект: ${e.object}`, columnSpan: 7 }])
  data.push([{ value: `Дата: ${fmtDate(Date.now())}`, columnSpan: 7 }])
  data.push([])
  data.push(['№', 'Наименование', 'Тип', 'Ед. изм.', 'Кол-во', 'Цена, ₸', 'Сумма, ₸'].map((v) => ({ value: v, ...head })))

  const sumCells: string[] = []
  let n = 0
  for (const sec of e.sections) {
    data.push([{ value: sec.name, fontWeight: 'bold', backgroundColor: '#FFF7ED', columnSpan: 7, ...cellB }])
    const first = data.length + 1
    for (const it of sec.items) {
      n++
      const row = data.length + 1
      data.push([
        { value: n, ...cellB },
        { value: it.name, wrap: true, ...cellB },
        { value: KIND_LABEL[it.kind].one, ...cellB },
        { value: it.unit, ...cellB },
        { value: it.qty, type: Number, format: QTY, ...cellB },
        { value: it.price, type: Number, format: MONEY, ...cellB },
        { value: `=ROUND(E${row}*F${row},2)`, type: 'Formula', format: MONEY, ...cellB },
      ])
    }
    const last = data.length
    const row = data.length + 1
    data.push([
      { value: `Итого по разделу «${sec.name}»`, columnSpan: 6, fontWeight: 'bold', align: 'right' },
      null, null, null, null, null,
      { value: sec.items.length ? `=SUM(G${first}:G${last})` : '=0', type: 'Formula', format: MONEY, fontWeight: 'bold' },
    ])
    sumCells.push(`G${row}`)
  }
  data.push([])
  const total = (label: string, value: number, bold = false) =>
    data.push([{ value: label, columnSpan: 6, align: 'right', fontWeight: bold ? 'bold' : undefined }, null, null, null, null, null, { value, type: Number, format: MONEY, fontWeight: bold ? 'bold' : undefined }])
  total('Прямые затраты', t.direct)
  if (t.materialsMarkup) total(`Наценка на материалы ${s.materialsMarkupPct}%`, t.materialsMarkup)
  if (t.overhead) total(`Накладные расходы ${s.overheadPct}%`, t.overhead)
  if (t.profit) total(`Сметная прибыль ${s.profitPct}%`, t.profit)
  if (t.contingency) total(`Непредвиденные затраты ${s.contingencyPct}%`, t.contingency)
  if (t.discount) total(`Скидка ${s.discountPct}%`, -t.discount)
  if (s.vatMode === 'on_top') {
    total('Итого без НДС', t.net)
    total(`НДС ${s.vatPct}%`, t.vat)
  }
  total(s.vatMode === 'included' ? `Итого, в т.ч. НДС ${s.vatPct}%` : 'Итого к оплате', t.total, true)
  if (s.vatMode === 'included') total(`в т.ч. НДС ${s.vatPct}%`, t.vat)
  if (t.massKg > 0) data.push([{ value: `Общая масса позиций в т/кг: ${(t.massKg / 1000).toFixed(3)} т`, columnSpan: 7, fontStyle: 'italic' }])

  const blob = await writeXlsxFile(data, {
    sheet: 'Смета',
    columns: [{ width: 5 }, { width: 60 }, { width: 12 }, { width: 9 }, { width: 11 }, { width: 14 }, { width: 16 }],
    stickyRowsCount: 0,
  }).toBlob()
  downloadBlob(blob, `${safeFileName(e.name)}.xlsx`)
}

function csvCell(v: string | number) {
  const s = typeof v === 'number' ? String(v).replace('.', ',') : v
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV for Russian Excel: «;» separator, comma decimals, UTF-8 BOM. */
export function toCsv(rows: (string | number)[][]): Blob {
  return new Blob(['﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
}

export function exportEstimateCsv(e: Estimate) {
  const rows: (string | number)[][] = [['Раздел', 'Наименование', 'Тип', 'Ед.', 'Кол-во', 'Цена', 'Сумма']]
  for (const sec of e.sections) for (const it of sec.items) rows.push([sec.name, it.name, KIND_LABEL[it.kind].one, it.unit, it.qty, it.price, lineTotal(it)])
  downloadBlob(toCsv(rows), `${safeFileName(e.name)}.csv`)
}

/** Generic table → XLSX with a bold header row. */
export async function exportTableXlsx(filename: string, sheet: string, header: string[], rows: (string | number | null)[][], widths?: number[]) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const data: SheetData = [
    header.map((v) => ({ value: v, ...head })),
    ...rows.map((r) => r.map((v) => (typeof v === 'number' ? { value: v, type: Number, format: QTY } : { value: v ?? '' }))),
  ]
  const blob = await writeXlsxFile(data, { sheet, columns: (widths ?? header.map(() => 16)).map((width) => ({ width })) }).toBlob()
  downloadBlob(blob, `${safeFileName(filename)}.xlsx`)
}

const BACKUP_KEYS = ['sr-estimates', 'sr-prices', 'sr-settings', 'sr-calc', 'sr-metal-spec']

export function exportBackup() {
  const data: Record<string, unknown> = { app: 'stroyraschet', version: 1, exportedAt: new Date().toISOString() }
  for (const k of BACKUP_KEYS) {
    const v = localStorage.getItem(k)
    if (v) data[k] = JSON.parse(v)
  }
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `tonna-backup-${new Date().toISOString().slice(0, 10)}.json`)
}

export async function importBackup(file: File) {
  const data = JSON.parse(await file.text())
  if (data?.app !== 'stroyraschet') throw new Error('Это не файл резервной копии TONNA')
  for (const k of BACKUP_KEYS) if (data[k]) localStorage.setItem(k, JSON.stringify(data[k]))
  location.reload()
}
