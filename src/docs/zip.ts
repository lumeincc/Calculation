/**
 * Minimal ZIP reader on top of fflate's inflate. Reading the central directory ourselves gives
 * the raw name bytes (for CP866 names from Windows), sizes before decompression (zip-bomb
 * limits) and encryption flags. Unsupported variants (ZIP64, deflate64, LZMA…) throw
 * `UnsupportedZip` so the caller can fall back to 7-Zip.
 */
import { inflateSync } from 'fflate'
import { decodeName } from './encoding'

export class UnsupportedZip extends Error {}

export interface ZipEntry {
  name: string
  size: number
  compressedSize: number
  encrypted: boolean
  read(): Uint8Array
}

const utf8 = new TextDecoder('utf-8')

export function readZip(data: Uint8Array): ZipEntry[] {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
  // End of central directory record: scan backwards over the max comment length.
  let eocd = -1
  for (let i = data.length - 22; i >= Math.max(0, data.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new UnsupportedZip('Не найден каталог ZIP-архива')
  const count = dv.getUint16(eocd + 10, true)
  let off = dv.getUint32(eocd + 16, true)
  if (count === 0xffff || off === 0xffffffff) throw new UnsupportedZip('ZIP64')

  const entries: ZipEntry[] = []
  for (let n = 0; n < count; n++) {
    if (off + 46 > data.length || dv.getUint32(off, true) !== 0x02014b50) throw new UnsupportedZip('Повреждён каталог ZIP')
    const flags = dv.getUint16(off + 8, true)
    const method = dv.getUint16(off + 10, true)
    const csize = dv.getUint32(off + 20, true)
    const usize = dv.getUint32(off + 24, true)
    const nlen = dv.getUint16(off + 28, true)
    const xlen = dv.getUint16(off + 30, true)
    const clen = dv.getUint16(off + 32, true)
    const local = dv.getUint32(off + 42, true)
    if (csize === 0xffffffff || usize === 0xffffffff || local === 0xffffffff) throw new UnsupportedZip('ZIP64')
    const nameBytes = data.subarray(off + 46, off + 46 + nlen)
    let name = decodeName(nameBytes, (flags & 0x800) !== 0)
    // Info-ZIP Unicode Path extra field (0x7075) carries the UTF-8 name.
    let x = off + 46 + nlen
    const xend = x + xlen
    while (x + 4 <= xend) {
      const id = dv.getUint16(x, true)
      const sz = dv.getUint16(x + 2, true)
      if (id === 0x7075 && sz > 5) name = utf8.decode(data.subarray(x + 9, x + 4 + sz))
      x += 4 + sz
    }
    off = xend + clen

    if (name.endsWith('/') || name.endsWith('\\')) continue
    if (method !== 0 && method !== 8) throw new UnsupportedZip(`метод сжатия ${method}`)
    const encrypted = (flags & 1) !== 0
    entries.push({
      name: name.replace(/\\/g, '/'),
      size: usize,
      compressedSize: csize,
      encrypted,
      read() {
        if (encrypted) throw new Error('Файл в архиве защищён паролем')
        const lnlen = dv.getUint16(local + 26, true)
        const lxlen = dv.getUint16(local + 28, true)
        const start = local + 30 + lnlen + lxlen
        const raw = data.subarray(start, start + csize)
        return method === 0 ? raw.slice() : inflateSync(raw, { out: new Uint8Array(usize) })
      },
    })
  }
  return entries
}
