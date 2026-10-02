/** pdf.js wrapper: loading with Cyrillic CMaps, text extraction and page rendering. */
// The legacy build ships polyfills (e.g. Math.sumPrecise) for browsers that lag behind —
// Yandex Browser, older Safari and Chromium releases.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { alignPage, itemsToLines, type PdfItem } from './pdfLayout'
import type { DocTable } from './types'
import { Tf } from '@/i18n'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const asset = (p: string) => new URL(`vendor/pdfjs/${p}/`, document.baseURI).href

export interface LoadedPdf {
  doc: PDFDocumentProxy
  destroy(): Promise<void>
}

export async function loadPdf(data: Uint8Array): Promise<LoadedPdf> {
  const task = pdfjs.getDocument({
    // pdf.js transfers the buffer to its worker — pass a copy to keep ours intact.
    data: data.slice(),
    cMapUrl: asset('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: asset('standard_fonts'),
    wasmUrl: asset('wasm'),
    iccUrl: asset('iccs'),
  })
  return { doc: await task.promise, destroy: () => task.destroy() }
}

export async function extractPdf(data: Uint8Array, maxPages = 300): Promise<{ text: string; pages: number; tables: DocTable[] }> {
  const { doc, destroy } = await loadPdf(data)
  const tables: DocTable[] = []
  const texts: string[] = []
  let carry: ReturnType<typeof alignPage>['carry']
  try {
    for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      const items: PdfItem[] = []
      for (const it of content.items) {
        if (!('str' in it)) continue
        items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]) })
      }
      const lines = itemsToLines(items)
      texts.push(lines.map((l) => l.map((c) => c.text).join('  ')).join('\n'))
      const aligned = alignPage(lines, carry)
      carry = aligned.carry
      if (aligned.rows.length) tables.push({ title: Tf('Стр. {0}', [p]), rows: aligned.rows })
      page.cleanup()
    }
    return { text: texts.join('\n\n'), pages: doc.numPages, tables }
  } finally {
    void destroy()
  }
}
