import { FolderUp, Loader2, UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'
import { SUPPORTED_HINT } from '@/docs/detect'
import type { InputFile } from '@/docs/unpack'

async function readFile(file: File, path?: string): Promise<InputFile> {
  return { name: file.name, path: path || (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name, data: new Uint8Array(await file.arrayBuffer()) }
}

/** Walks dropped folders (DataTransferItem.webkitGetAsEntry) keeping relative paths. */
async function fromEntry(entry: FileSystemEntry, out: Promise<InputFile>[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej))
    out.push(readFile(file, entry.fullPath.replace(/^\//, '')))
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    // readEntries returns results in batches until an empty batch.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej))
      if (!batch.length) break
      for (const e of batch) await fromEntry(e, out)
    }
  }
}

export function Dropzone({ onFiles, busy, progress, compact }: { onFiles(files: InputFile[]): void; busy: boolean; progress?: { done: number; total: number; label: string }; compact?: boolean }) {
  const [over, setOver] = useState(false)
  const files = useRef<HTMLInputElement>(null)
  const folder = useRef<HTMLInputElement>(null)

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setOver(false)
    const items = [...e.dataTransfer.items]
    const entries = items.map((i) => i.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[]
    const reads: Promise<InputFile>[] = []
    if (entries.length) for (const en of entries) await fromEntry(en, reads)
    else for (const f of e.dataTransfer.files) reads.push(readFile(f))
    onFiles(await Promise.all(reads))
  }
  const onPick = async (list: FileList | null) => {
    if (!list?.length) return
    onFiles(await Promise.all([...list].map((f) => readFile(f))))
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`relative rounded-2xl border-2 border-dashed transition ${over ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30' : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900'} ${compact ? 'px-4 py-3' : 'px-6 py-12'}`}
    >
      <input ref={files} type="file" multiple hidden onChange={(e) => onPick(e.target.files)} />
      <input ref={folder} type="file" multiple hidden onChange={(e) => onPick(e.target.files)} {...{ webkitdirectory: '' }} />
      {busy ? (
        <div className={`flex items-center gap-3 ${compact ? '' : 'flex-col text-center'}`}>
          <Loader2 className="animate-spin text-brand-600" size={compact ? 20 : 32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{progress?.label || 'Обработка…'}</div>
            {progress && progress.total > 0 && (
              <div className={`mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 ${compact ? '' : 'mx-auto w-64'}`}>
                <div className="h-full bg-brand-600 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            )}
          </div>
        </div>
      ) : compact ? (
        <div className="flex flex-wrap items-center gap-3">
          <UploadCloud size={20} className="text-zinc-400" />
          <span className="flex-1 text-sm text-zinc-600 dark:text-zinc-400">Перетащите ещё файлы, папки или архивы</span>
          <button onClick={() => files.current?.click()} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">Выбрать файлы</button>
          <button onClick={() => folder.current?.click()} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">Папку</button>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            <UploadCloud size={28} />
          </div>
          <h2 className="text-lg font-semibold">Перетащите сюда файлы, папку или архив</h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">{SUPPORTED_HINT}.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button onClick={() => files.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
              <UploadCloud size={17} /> Выбрать файлы
            </button>
            <button onClick={() => folder.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">
              <FolderUp size={17} /> Выбрать папку
            </button>
          </div>
          <p className="mt-4 text-xs text-zinc-400">Файлы обрабатываются прямо в браузере и никуда не загружаются.</p>
        </div>
      )}
    </div>
  )
}
