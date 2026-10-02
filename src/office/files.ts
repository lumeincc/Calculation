/** File archive operations: upload (keeping folder structure), unpack archives, download, ZIP export. */
import { T } from '@/i18n'
import { uid } from '@/lib/id'
import { downloadBlob, safeFileName } from '@/lib/export'
import type { InputFile } from '@/docs/unpack'
import { deleteBlob, getBlob, putBlob, requestPersist } from './blobs'
import { useOffice } from './store'
import type { StoredFile } from './types'

const MIME: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  txt: 'text/plain', csv: 'text/csv', json: 'application/json', xml: 'application/xml', html: 'text/html',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed', dxf: 'image/vnd.dxf', dwg: 'image/vnd.dwg',
}

export const extOf = (name: string) => (/\.([^.\\/]+)$/.exec(name)?.[1] ?? '').toLowerCase()
export const mimeOf = (name: string) => MIME[extOf(name)] ?? 'application/octet-stream'

export const ARCHIVE_EXT = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'tgz'])

export type FileLinks = Pick<StoredFile, 'contractId' | 'paperId' | 'counterpartyId'>

/** Finds or creates the folder chain «a/b/c» under `parentId`; returns the last folder id. */
function ensurePath(parts: string[], parentId: string | null): string | null {
  let cur = parentId
  for (const name of parts) {
    const st = useOffice.getState()
    const found = st.folders.find((f) => f.parentId === cur && f.name === name)
    cur = found ? found.id : st.addFolder(name, cur)
  }
  return cur
}

/** Stores files; folder paths of a dropped folder are recreated as folders. Returns new file ids. */
export async function storeFiles(inputs: InputFile[], folderId: string | null, links: FileLinks = {}): Promise<string[]> {
  await requestPersist()
  const metas: StoredFile[] = []
  for (const f of inputs) {
    const parts = (f.path ?? f.name).split('/').filter(Boolean)
    const name = parts.pop() ?? f.name
    const target = parts.length ? ensurePath(parts, folderId) : folderId
    const id = uid()
    await putBlob(id, new Blob([f.data as BlobPart], { type: mimeOf(name) }))
    const now = Date.now()
    metas.push({ id, name, size: f.data.byteLength, type: mimeOf(name), folderId: target, tags: [], note: '', starred: false, createdAt: now, updatedAt: now, ...links })
  }
  useOffice.getState().addFiles(metas)
  return metas.map((m) => m.id)
}

export async function storeBrowserFiles(list: FileList | File[], folderId: string | null, links: FileLinks = {}): Promise<string[]> {
  const inputs = await Promise.all([...list].map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })))
  return storeFiles(inputs, folderId, links)
}

export async function deleteFiles(ids: string[]) {
  useOffice.getState().removeFiles(ids)
  await Promise.all(ids.map((id) => deleteBlob(id).catch(() => undefined)))
}

export async function deleteFolder(id: string) {
  const gone = useOffice.getState().removeFolder(id)
  await Promise.all(gone.map((fid) => deleteBlob(fid).catch(() => undefined)))
}

export async function readFile(id: string): Promise<Uint8Array> {
  const blob = await getBlob(id)
  if (!blob) throw new Error(T('Файл не найден в хранилище браузера'))
  return new Uint8Array(await blob.arrayBuffer())
}

export async function downloadStored(f: StoredFile) {
  const blob = await getBlob(f.id)
  if (!blob) throw new Error(T('Файл не найден в хранилище браузера'))
  downloadBlob(blob, f.name)
}

/** Opens a file in a new tab (PDF, images) — handy for printing a signed scan. */
export async function openStored(f: StoredFile) {
  const blob = await getBlob(f.id)
  if (!blob) throw new Error(T('Файл не найден в хранилище браузера'))
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Unpacks an archive from the storage into a new folder next to it. Returns the folder id. */
export async function unpackStored(f: StoredFile): Promise<{ folderId: string | null; count: number; warnings: string[] }> {
  const data = await readFile(f.id)
  const { unpackAll } = await import('@/docs/unpack')
  const { files, warnings } = await unpackAll([{ name: f.name, data }], {
    sevenZip: async (d, ext) => (await import('@/docs/sevenzip')).extractWith7z(d, ext),
  })
  const root = f.name.replace(/\.(tar\.gz|tgz|zip|rar|7z|tar|gz)$/i, '')
  const st = useOffice.getState()
  const folderId = st.addFolder(root, f.folderId)
  const inputs = files
    .filter((x) => x.kind !== 'archive' || x.data.byteLength > 0)
    .map((x) => ({ name: x.name, path: x.path.split('/').slice(1).join('/'), data: x.data }))
  await storeFiles(inputs, folderId)
  return { folderId, count: inputs.length, warnings }
}

/** Downloads the whole archive (or one folder) as a ZIP with the same folder structure. */
export async function exportZip(rootId: string | null = null, name = 'TONNA-archive') {
  const { zipSync } = await import('fflate')
  const { folders, files } = useOffice.getState()
  const byId = new Map(folders.map((f) => [f.id, f]))
  const pathOf = (id: string | null): string[] => {
    const out: string[] = []
    let cur = id
    while (cur && cur !== rootId) {
      const f = byId.get(cur)
      if (!f) break
      out.unshift(safeFileName(f.name))
      cur = f.parentId
    }
    return out
  }
  const inside = (id: string | null): boolean => {
    if (rootId === null) return true
    let cur = id
    while (cur) {
      if (cur === rootId) return true
      cur = byId.get(cur)?.parentId ?? null
    }
    return false
  }
  const tree: Record<string, Uint8Array> = {}
  for (const f of files) {
    if (!inside(f.folderId)) continue
    const blob = await getBlob(f.id)
    if (!blob) continue
    let path = [...pathOf(f.folderId), f.name].join('/')
    for (let i = 2; tree[path]; i++) path = [...pathOf(f.folderId), f.name.replace(/(\.[^.]+)?$/, ` (${i})$1`)].join('/')
    tree[path] = new Uint8Array(await blob.arrayBuffer())
  }
  const zip = zipSync(tree, { level: 0 })
  downloadBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), `${safeFileName(name)}.zip`)
}
