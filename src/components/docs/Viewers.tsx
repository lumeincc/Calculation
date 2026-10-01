import { Download, Minus, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { Button, IconButton } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/misc'
import { decodeText } from '@/docs/encoding'
import type { Cell, DocAnalysis, DocFile, DocTable } from '@/docs/types'
import { downloadBytes } from '@/lib/export'
import { fmt } from '@/lib/format'
import { DxfViewer } from './DxfViewer'

function PdfPage({ doc, n, scale }: { doc: PDFDocumentProxy; n: number; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(n <= 2)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (visible || !box.current) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '600px' })
    io.observe(box.current)
    return () => io.disconnect()
  }, [visible])
  useEffect(() => {
    if (!visible) return
    let task: { cancel(): void; promise: Promise<void> } | null = null
    let alive = true
    doc.getPage(n).then((page) => {
      if (!alive || !ref.current) return
      const dpr = window.devicePixelRatio || 1
      const vp = page.getViewport({ scale: scale * dpr })
      const c = ref.current
      c.width = vp.width
      c.height = vp.height
      c.style.width = `${vp.width / dpr}px`
      task = page.render({ canvas: c, viewport: vp })
      task.promise.catch(() => {})
    })
    return () => {
      alive = false
      task?.cancel()
    }
  }, [doc, n, scale, visible])
  return (
    <div ref={box} className="mx-auto mb-4 w-fit min-w-40 bg-white shadow-md">
      <canvas ref={ref} className="block max-w-none" />
      {!visible && <div className="h-[60vh]" />}
    </div>
  )
}

function PdfViewer({ data }: { data: Uint8Array }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState('')
  const [scale, setScale] = useState(1.2)
  useEffect(() => {
    let destroy: (() => Promise<void>) | null = null
    let alive = true
    import('@/docs/pdf')
      .then(({ loadPdf }) => loadPdf(data))
      .then((x) => {
        destroy = x.destroy
        if (alive) setDoc(x.doc)
        else void x.destroy()
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
      void destroy?.()
    }
  }, [data])
  if (error) return <p className="p-6 text-sm text-red-600">Не удалось открыть PDF: {error}</p>
  if (!doc) return <p className="p-6 text-sm text-zinc-500">Открываем PDF…</p>
  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-200 bg-white/90 px-3 py-1.5 text-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <span className="text-zinc-500">{doc.numPages} стр.</span>
        <div className="ml-auto flex items-center gap-1">
          <IconButton label="Уменьшить" onClick={() => setScale((s) => Math.max(0.4, s - 0.2))}><Minus size={15} /></IconButton>
          <span className="w-12 text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <IconButton label="Увеличить" onClick={() => setScale((s) => Math.min(4, s + 0.2))}><Plus size={15} /></IconButton>
        </div>
      </div>
      <div className="max-h-[75vh] overflow-auto bg-zinc-100 p-4 dark:bg-zinc-950">
        {Array.from({ length: Math.min(doc.numPages, 500) }, (_, i) => <PdfPage key={i} doc={doc} n={i + 1} scale={scale} />)}
      </div>
    </div>
  )
}

const cellText = (c: Cell) => (typeof c === 'number' ? fmt(c, 4) : c)

export function TableView({ table, limit = 300 }: { table: DocTable; limit?: number }) {
  const [shown, setShown] = useState(limit)
  const width = Math.min(60, Math.max(0, ...table.rows.slice(0, 500).map((r) => r.length)))
  return (
    <div className="max-h-[70vh] overflow-auto">
      <table className="min-w-full border-collapse text-xs">
        <tbody>
          {table.rows.slice(0, shown).map((r, i) => (
            <tr key={i} className="odd:bg-zinc-50/70 dark:odd:bg-zinc-900/50">
              <td className="sticky left-0 border border-zinc-200 bg-zinc-100 px-1.5 py-1 text-right text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">{i + 1}</td>
              {Array.from({ length: width }, (_, j) => (
                <td key={j} className={`max-w-80 border border-zinc-200 px-1.5 py-1 align-top dark:border-zinc-800 ${typeof r[j] === 'number' ? 'text-right tabular-nums' : ''}`}>
                  {r[j] !== undefined ? cellText(r[j]) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.rows.length > shown && (
        <div className="p-3 text-center">
          <Button size="sm" onClick={() => setShown((s) => s + 1000)}>Показать ещё ({table.rows.length - shown})</Button>
        </div>
      )}
    </div>
  )
}

function SheetViewer({ tables }: { tables: DocTable[] }) {
  const [i, setI] = useState(0)
  if (!tables.length) return <p className="p-6 text-sm text-zinc-500">Таблица пуста</p>
  return (
    <div>
      {tables.length > 1 && (
        <div className="px-2">
          <Tabs value={String(i)} onChange={(v) => setI(Number(v))} tabs={tables.map((t, j) => ({ value: String(j), label: t.title }))} />
        </div>
      )}
      <TableView key={i} table={tables[Math.min(i, tables.length - 1)]} />
    </div>
  )
}

function ImageViewer({ file }: { file: DocFile }) {
  const url = useMemo(() => {
    const type = file.ext === 'svg' ? 'image/svg+xml' : `image/${file.ext === 'jpg' ? 'jpeg' : file.ext}`
    return URL.createObjectURL(new Blob([file.data as BlobPart], { type }))
  }, [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  // SVG is shown through <img>, which never executes its scripts.
  return (
    <div className="flex max-h-[75vh] items-center justify-center overflow-auto bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-4 dark:bg-zinc-950">
      <img src={url} alt={file.name} className="max-w-full" />
    </div>
  )
}

function TextViewer({ file }: { file: DocFile }) {
  const text = useMemo(() => decodeText(file.data.subarray(0, 400_000)), [file])
  return <pre className="max-h-[75vh] overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">{text}</pre>
}

export function DocViewer({ file, analysis }: { file: DocFile; analysis?: DocAnalysis }) {
  const body = (() => {
    switch (file.kind) {
      case 'pdf': return <PdfViewer data={file.data} />
      case 'sheet': return <SheetViewer tables={analysis?.tables ?? []} />
      case 'docx': return analysis?.html ? <div className="doc-html max-h-[75vh] overflow-auto p-6 text-sm">{<div dangerouslySetInnerHTML={{ __html: analysis.html }} />}</div> : <p className="p-6 text-sm text-zinc-500">Чтение документа…</p>
      case 'odt': return <pre className="max-h-[75vh] overflow-auto p-4 text-sm whitespace-pre-wrap">{analysis?.text}</pre>
      case 'image': return <ImageViewer file={file} />
      case 'text': return file.ext === 'rtf' ? <pre className="max-h-[75vh] overflow-auto p-4 text-sm whitespace-pre-wrap">{analysis?.text}</pre> : <TextViewer file={file} />
      case 'dxf': return <DxfViewer data={file.data} />
      default:
        return (
          <div className="p-8 text-center text-sm text-zinc-500">
            {analysis?.notes?.map((n) => <p key={n}>{n}</p>) ?? 'Предпросмотр недоступен'}
            <Button className="mt-4" size="sm" onClick={() => downloadBytes(file.data, file.name)}><Download size={15} /> Скачать файл</Button>
          </div>
        )
    }
  })()
  return body
}
