/** Reader for POSIX ustar / GNU tar archives (names in UTF-8). */
const utf8 = new TextDecoder('utf-8')

function str(b: Uint8Array): string {
  const end = b.indexOf(0)
  return utf8.decode(end >= 0 ? b.subarray(0, end) : b)
}

export function readTar(data: Uint8Array): { name: string; data: Uint8Array }[] {
  const out: { name: string; data: Uint8Array }[] = []
  let off = 0
  let longName: string | null = null
  while (off + 512 <= data.length) {
    const h = data.subarray(off, off + 512)
    if (h.every((b) => b === 0)) break
    const size = Number.parseInt(str(h.subarray(124, 136)).trim() || '0', 8) || 0
    const type = String.fromCharCode(h[156])
    let name = str(h.subarray(0, 100))
    const prefix = str(h.subarray(345, 500))
    if (str(h.subarray(257, 262)) === 'ustar' && prefix) name = `${prefix}/${name}`
    const body = data.subarray(off + 512, off + 512 + size)
    off += 512 + Math.ceil(size / 512) * 512
    if (type === 'L') {
      longName = str(body)
      continue
    }
    if (longName) {
      name = longName
      longName = null
    }
    if (type === '0' || type === '\0' || type === '7') out.push({ name, data: body.slice() })
  }
  return out
}
