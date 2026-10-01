/**
 * Text decoding for Russian documents: UTF-8 when valid, otherwise the legacy code page that
 * yields the most Cyrillic letters (Windows-1251 for files, CP866 for old ZIP names).
 */

const CYR = /[А-Яа-яЁё]/g
const BAD = /[─-◿\u0080-\u009f�]/g

function score(s: string): number {
  return (s.match(CYR)?.length ?? 0) - 3 * (s.match(BAD)?.length ?? 0)
}

function tryDecode(bytes: Uint8Array, enc: string, fatal = false): string | null {
  try {
    return new TextDecoder(enc, { fatal }).decode(bytes)
  } catch {
    return null
  }
}

export function hasBom(bytes: Uint8Array): boolean {
  return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
}

export function decodeText(bytes: Uint8Array, candidates = ['windows-1251', 'ibm866', 'koi8-r']): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return tryDecode(bytes, 'utf-16le') ?? ''
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return tryDecode(bytes, 'utf-16be') ?? ''
  const utf8 = tryDecode(bytes, 'utf-8', true)
  if (utf8 !== null) return hasBom(bytes) ? utf8.replace(/^﻿/, '') : utf8
  let best = ''
  let bestScore = -Infinity
  for (const enc of candidates) {
    const s = tryDecode(bytes, enc)
    if (s === null) continue
    const sc = score(s.slice(0, 20000))
    if (sc > bestScore) {
      best = s
      bestScore = sc
    }
  }
  return best || new TextDecoder('utf-8').decode(bytes)
}

/** ZIP entry names: UTF-8 if flagged or valid, else CP866 (Windows «Сжатая папка») or CP1251. */
export function decodeName(bytes: Uint8Array, utf8Flag: boolean): string {
  if (utf8Flag) return new TextDecoder('utf-8').decode(bytes)
  if (bytes.every((b) => b < 0x80)) return String.fromCharCode(...bytes)
  return decodeText(bytes, ['ibm866', 'windows-1251'])
}
