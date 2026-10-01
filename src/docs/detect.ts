import type { DocKind } from './types'

const BY_EXT: Record<string, DocKind> = {
  pdf: 'pdf',
  xlsx: 'sheet', xlsm: 'sheet', xlsb: 'sheet', xls: 'sheet', ods: 'sheet', csv: 'sheet', tsv: 'sheet',
  docx: 'docx', docm: 'docx',
  odt: 'odt',
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image', svg: 'image', avif: 'image', ico: 'image',
  txt: 'text', md: 'text', json: 'text', xml: 'text', html: 'text', htm: 'text', log: 'text', ini: 'text',
  yml: 'text', yaml: 'text', arp: 'text', gsfx: 'text', rtf: 'text', sql: 'text',
  dxf: 'dxf',
  dwg: 'cad', rvt: 'cad', ifc: 'cad', skp: 'cad', pln: 'cad', step: 'cad', stp: 'cad', frw: 'cad', cdw: 'cad', spw: 'cad',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive', tgz: 'archive',
  bz2: 'archive', tbz2: 'archive', xz: 'archive', txz: 'archive', cab: 'archive', iso: 'archive', arj: 'archive', lzh: 'archive',
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}

export type ArchiveFormat = 'zip' | 'gzip' | 'tar' | 'sevenzip' | 'rar' | 'other'

/** Archive format by magic bytes (falls back to the extension). */
export function archiveFormat(data: Uint8Array, ext: string): ArchiveFormat | null {
  const b = data
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05)) return 'zip'
  if (b[0] === 0x1f && b[1] === 0x8b) return 'gzip'
  if (b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf) return 'sevenzip'
  if (b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21) return 'rar'
  if (b.length > 262 && String.fromCharCode(...b.subarray(257, 262)) === 'ustar') return 'tar'
  if (BY_EXT[ext] === 'archive') return ext === 'tar' ? 'tar' : 'other'
  return null
}

export function kindOf(name: string, data?: Uint8Array): DocKind {
  const ext = extOf(name)
  const k = BY_EXT[ext]
  // Office files are zip containers — never treat them as archives to unpack.
  if (k) return k
  if (data) {
    if (data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46) return 'pdf'
    if (archiveFormat(data, ext)) return 'archive'
  }
  return 'other'
}

export const KIND_LABEL: Record<DocKind, string> = {
  pdf: 'PDF',
  sheet: 'Таблица',
  docx: 'Word',
  odt: 'Документ ODT',
  image: 'Изображение',
  text: 'Текст',
  dxf: 'Чертёж DXF',
  archive: 'Архив',
  cad: 'CAD/BIM',
  other: 'Файл',
}

export const SUPPORTED_HINT =
  'PDF, Excel (XLSX, XLS, ODS, CSV), Word (DOCX), ODT, изображения, TXT/XML/JSON, чертежи DXF; архивы ZIP, RAR, 7Z, TAR, GZ — в том числе вложенные'
