import { Download, ExternalLink, Loader2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/misc'
import { kindOf } from '@/docs/detect'
import type { DocAnalysis, DocFile } from '@/docs/types'
import { T } from '@/i18n'
import { toast } from '@/store/toast'
import { downloadStored, extOf, openStored, readFile } from '../files'
import type { StoredFile } from '../types'

const DocViewer = lazy(() => import('@/components/docs/Viewers').then((m) => ({ default: m.DocViewer })))

const NEEDS_ANALYSIS = new Set(['sheet', 'docx', 'odt'])

function Body({ file }: { file: StoredFile }) {
  const [doc, setDoc] = useState<{ file: DocFile; analysis?: DocAnalysis } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    ;(async () => {
      const data = await readFile(file.id)
      const d: DocFile = { id: file.id, path: file.name, name: file.name, ext: extOf(file.name), size: file.size, kind: kindOf(file.name, data), data }
      let analysis: DocAnalysis | undefined
      if (NEEDS_ANALYSIS.has(d.kind) || d.ext === 'rtf' || d.kind === 'cad' || d.kind === 'other') analysis = await (await import('@/docs/analyze')).analyzeDoc(d)
      if (alive) setDoc({ file: d, analysis })
    })().catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [file])
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>
  const spinner = (
    <div className="flex items-center justify-center gap-2 p-10 text-sm text-zinc-500">
      <Loader2 size={16} className="animate-spin" /> {T('Загрузка…')}
    </div>
  )
  if (!doc) return spinner
  return (
    <Suspense fallback={spinner}>
      <DocViewer file={doc.file} analysis={doc.analysis} />
    </Suspense>
  )
}

export function FilePreview({ file, onClose }: { file: StoredFile | null; onClose(): void }) {
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : String(e), { tone: 'error' })
  return (
    <Modal
      open={Boolean(file)}
      onClose={onClose}
      wide
      title={<span className="block max-w-[60vw] truncate">{file?.name}</span>}
      footer={
        file && (
          <>
            <Button size="sm" onClick={() => openStored(file).catch(fail)}><ExternalLink size={15} /> {T('Открыть в новой вкладке')}</Button>
            <Button size="sm" variant="primary" onClick={() => downloadStored(file).catch(fail)}><Download size={15} /> {T('Скачать')}</Button>
          </>
        )
      }
    >
      <div className="-mx-5 -my-4">{file && <Body key={file.id} file={file} />}</div>
    </Modal>
  )
}
