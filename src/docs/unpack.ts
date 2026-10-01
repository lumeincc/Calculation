/**
 * Turns dropped files into a flat list of documents, recursively unpacking archives
 * (archives inside archives included) with limits against zip bombs.
 */
import { gunzipSync } from 'fflate'
import { uid } from '@/lib/id'
import { archiveFormat, extOf, kindOf } from './detect'
import { readTar } from './tar'
import type { DocFile } from './types'
import { readZip, UnsupportedZip } from './zip'

export interface InputFile {
  name: string
  /** Relative path when a folder was dropped. */
  path?: string
  data: Uint8Array
}

export interface UnpackLimits {
  maxFiles: number
  maxTotalBytes: number
  maxDepth: number
}

export const DEFAULT_LIMITS: UnpackLimits = { maxFiles: 5000, maxTotalBytes: 1024 * 1024 * 1024, maxDepth: 6 }

const JUNK = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|desktop\.ini$|~\$[^/]*$|\._[^/]*$)/i

export type Extractor = (data: Uint8Array, ext: string) => Promise<{ name: string; data: Uint8Array }[]>

interface Ctx {
  limits: UnpackLimits
  files: DocFile[]
  warnings: string[]
  total: number
  limitHit?: boolean
  sevenZip?: Extractor
  onProgress?: (msg: string) => void
}

function baseName(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

async function extract(file: DocFile, ctx: Ctx): Promise<{ name: string; data: Uint8Array }[]> {
  const fmt = archiveFormat(file.data, file.ext)
  if (fmt === 'zip') {
    try {
      const entries = readZip(file.data)
      const declared = entries.reduce((s, e) => s + e.size, 0)
      if (ctx.total + declared > ctx.limits.maxTotalBytes) throw new Error('Распакованный объём превышает лимит')
      const out: { name: string; data: Uint8Array }[] = []
      for (const e of entries) {
        if (JUNK.test(e.name)) continue
        if (e.encrypted) {
          ctx.warnings.push(`${file.path}/${e.name}: файл защищён паролем`)
          continue
        }
        out.push({ name: e.name, data: e.read() })
      }
      return out
    } catch (err) {
      if (!(err instanceof UnsupportedZip) || !ctx.sevenZip) throw err
      return ctx.sevenZip(file.data, 'zip')
    }
  }
  if (fmt === 'tar') return readTar(file.data)
  if (fmt === 'gzip') {
    const inner = gunzipSync(file.data)
    const name = file.ext === 'tgz' ? file.name.replace(/\.tgz$/i, '.tar') : file.name.replace(/\.gz$/i, '')
    return [{ name: name === file.name ? `${file.name}.out` : name, data: inner }]
  }
  if (!ctx.sevenZip) throw new Error('Формат архива не поддерживается')
  return ctx.sevenZip(file.data, file.ext)
}

async function add(input: InputFile, depth: number, ctx: Ctx, parentId?: string): Promise<void> {
  const path = input.path || input.name
  if (JUNK.test(path)) return
  if (ctx.files.length >= ctx.limits.maxFiles) {
    if (!ctx.limitHit) ctx.warnings.push(`Обработаны первые ${ctx.limits.maxFiles} файлов, остальные пропущены`)
    ctx.limitHit = true
    return
  }
  ctx.total += input.data.length
  const name = baseName(path)
  const ext = extOf(name)
  const file: DocFile = {
    id: uid(),
    path,
    name,
    ext,
    size: input.data.length,
    kind: kindOf(name, input.data),
    data: input.data,
    parentId,
  }
  ctx.files.push(file)
  if (file.kind !== 'archive') return
  if (depth >= ctx.limits.maxDepth) {
    ctx.warnings.push(`${path}: слишком глубокая вложенность архивов`)
    return
  }
  ctx.onProgress?.(`Распаковка ${name}`)
  try {
    const children = await extract(file, ctx)
    // The archive itself stays in the tree as a folder; its bytes are no longer needed.
    file.data = new Uint8Array(0)
    for (const child of children) {
      await add({ name: baseName(child.name), path: `${path}/${child.name}`, data: child.data }, depth + 1, ctx, file.id)
    }
  } catch (err) {
    ctx.warnings.push(`${path}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function unpackAll(
  inputs: InputFile[],
  opts: { limits?: Partial<UnpackLimits>; sevenZip?: Extractor; onProgress?: (msg: string) => void } = {},
): Promise<{ files: DocFile[]; warnings: string[] }> {
  const ctx: Ctx = {
    limits: { ...DEFAULT_LIMITS, ...opts.limits },
    files: [],
    warnings: [],
    total: 0,
    sevenZip: opts.sevenZip,
    onProgress: opts.onProgress,
  }
  for (const input of inputs) await add(input, 0, ctx)
  if (ctx.total > ctx.limits.maxTotalBytes) ctx.warnings.push('Общий объём файлов очень большой — браузер может работать медленно')
  return { files: ctx.files, warnings: ctx.warnings }
}
