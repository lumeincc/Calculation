// Copies runtime assets of pdf.js (CMaps for Cyrillic/CJK fonts, standard fonts, image decoders)
// into public/vendor so they are served in dev and bundled into the build.
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'pdfjs-dist')
const dst = join(root, 'public', 'vendor', 'pdfjs')

if (!existsSync(src)) {
  console.warn('pdfjs-dist is not installed; skipping asset copy')
  process.exit(0)
}
mkdirSync(dst, { recursive: true })
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  if (existsSync(join(src, dir))) cpSync(join(src, dir), join(dst, dir), { recursive: true })
}
console.log('pdf.js assets copied to public/vendor/pdfjs')
