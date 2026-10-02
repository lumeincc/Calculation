import { Tf } from '@/i18n'
import { fmt } from '@/lib/format'

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return Tf('{0} Б', [bytes])
  if (bytes < 1024 * 1024) return Tf('{0} КБ', [fmt(bytes / 1024, 0)])
  if (bytes < 1024 ** 3) return Tf('{0} МБ', [fmt(bytes / 1024 / 1024, 1)])
  return Tf('{0} ГБ', [fmt(bytes / 1024 ** 3, 2)])
}

