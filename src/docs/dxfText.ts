/** Cleans AutoCAD MTEXT formatting codes and \U+XXXX escapes into plain text. */
export function cleanMtext(s: string): string {
  return s
    .replace(/\\U\+([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(Number.parseInt(h, 16)))
    .replace(/\\P/g, '\n')
    .replace(/\\[ACFHQTWfhpqtw][^;\\]*;/g, '')
    .replace(/\\[LlOoKk]/g, '')
    .replace(/\\S([^;]*)\^([^;]*);/g, '$1/$2')
    .replace(/[{}]/g, '')
    .replace(/%%[cC]/g, '⌀')
    .replace(/%%[dD]/g, '°')
    .replace(/%%[pP]/g, '±')
    .trim()
}
