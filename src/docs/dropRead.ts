import type { InputFile } from './unpack'

export async function readFile(file: File, path?: string): Promise<InputFile> {
  return { name: file.name, path: path || (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name, data: new Uint8Array(await file.arrayBuffer()) }
}

/** Walks dropped folders (DataTransferItem.webkitGetAsEntry) keeping relative paths. */
export async function fromEntry(entry: FileSystemEntry, out: Promise<InputFile>[]): Promise<void> {
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

/** Reads files and folders from a drop event, keeping relative paths of dropped folders. */
export async function collectDropped(dt: DataTransfer): Promise<InputFile[]> {
  const items = [...dt.items]
  const entries = items.map((i) => i.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[]
  const reads: Promise<InputFile>[] = []
  if (entries.length) for (const en of entries) await fromEntry(en, reads)
  else for (const f of dt.files) reads.push(readFile(f))
  return Promise.all(reads)
}

/** Reads files picked in an <input type=file> (folder pick keeps webkitRelativePath). */
export function readPicked(list: FileList): Promise<InputFile[]> {
  return Promise.all([...list].map((f) => readFile(f)))
}
