/**
 * RAR, 7z, bzip2, xz, cab, iso and exotic ZIPs are unpacked by 7-Zip compiled to WebAssembly.
 * The ~1.6 MB module is loaded only when such an archive is dropped.
 */
import type { SevenZipModule } from '7z-wasm'
import { T } from '@/i18n'

export async function extractWith7z(data: Uint8Array, ext: string): Promise<{ name: string; data: Uint8Array }[]> {
  const [{ default: SevenZip }, { default: wasmUrl }] = await Promise.all([
    import('7z-wasm'),
    import('7z-wasm/7zz.wasm?url'),
  ])
  const log: string[] = []
  const sz: SevenZipModule = await SevenZip({
    locateFile: () => wasmUrl,
    print: (s: string) => log.push(s),
    printErr: (s: string) => log.push(s),
  })
  const archive = `/in/archive.${ext || 'bin'}`
  sz.FS.mkdir('/in')
  sz.FS.mkdir('/out')
  const stream = sz.FS.open(archive, 'w+')
  sz.FS.write(stream, data, 0, data.length)
  sz.FS.close(stream)
  try {
    // -p…: never prompt for a password; -mcp=866: legacy Russian names in ZIP.
    sz.callMain(['x', '-y', '-pnone', '-sccUTF-8', ...(ext === 'zip' ? ['-mcp=866'] : []), '-o/out', archive])
  } catch {
    // Non-zero exit is reported through the log below.
  }
  const out: { name: string; data: Uint8Array }[] = []
  const walk = (dir: string, rel: string) => {
    for (const entry of sz.FS.readdir(dir)) {
      if (entry === '.' || entry === '..') continue
      const full = `${dir}/${entry}`
      const st = sz.FS.stat(full)
      if (sz.FS.isDir(st.mode)) walk(full, `${rel}${entry}/`)
      else out.push({ name: rel + entry, data: sz.FS.readFile(full) })
    }
  }
  walk('/out', '')
  if (out.length === 0) {
    const err = log.find((l) => /wrong password|encrypted|пароль/i.test(l))
      ? T('Архив защищён паролем')
      : log.filter((l) => /error|cannot/i.test(l)).join('; ') || T('Не удалось распаковать архив')
    throw new Error(err)
  }
  return out
}
