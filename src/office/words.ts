/** Amounts in words («сумма прописью») and long dates for printed documents. */

const ONES_M = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
const ONES_F = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
const TEENS = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
const HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']

/** [one, few, many] forms and grammatical gender of each power of a thousand. */
const SCALES: { forms: [string, string, string]; female: boolean }[] = [
  { forms: ['', '', ''], female: false },
  { forms: ['тысяча', 'тысячи', 'тысяч'], female: true },
  { forms: ['миллион', 'миллиона', 'миллионов'], female: false },
  { forms: ['миллиард', 'миллиарда', 'миллиардов'], female: false },
  { forms: ['триллион', 'триллиона', 'триллионов'], female: false },
]

function ruPlural(n: number, forms: [string, string, string]): string {
  const a = n % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

function triad(n: number, female: boolean): string[] {
  const out: string[] = []
  const h = Math.floor(n / 100)
  const t = Math.floor((n % 100) / 10)
  const o = n % 10
  if (h) out.push(HUNDREDS[h])
  if (t === 1) out.push(TEENS[o])
  else {
    if (t) out.push(TENS[t])
    if (o) out.push((female ? ONES_F : ONES_M)[o])
  }
  return out
}

/** 1234 → «одна тысяча двести тридцать четыре». */
export function intToWordsRu(value: number): string {
  let n = Math.floor(Math.abs(value))
  if (n === 0) return 'ноль'
  const words: string[] = []
  for (let i = 0; n > 0 && i < SCALES.length; i++) {
    const part = n % 1000
    n = Math.floor(n / 1000)
    if (!part) continue
    const w = triad(part, SCALES[i].female)
    if (i > 0) w.push(ruPlural(part, SCALES[i].forms))
    words.unshift(...w)
  }
  return (value < 0 ? 'минус ' : '') + words.join(' ')
}

const EN_ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const EN_SCALES = ['', 'thousand', 'million', 'billion', 'trillion']

export function intToWordsEn(value: number): string {
  let n = Math.floor(Math.abs(value))
  if (n === 0) return 'zero'
  const words: string[] = []
  for (let i = 0; n > 0 && i < EN_SCALES.length; i++) {
    const part = n % 1000
    n = Math.floor(n / 1000)
    if (!part) continue
    const w: string[] = []
    const h = Math.floor(part / 100)
    const r = part % 100
    if (h) w.push(EN_ONES[h], 'hundred')
    if (r < 20) {
      if (r) w.push(EN_ONES[r])
    } else w.push(EN_TENS[Math.floor(r / 10)] + (r % 10 ? '-' + EN_ONES[r % 10] : ''))
    if (EN_SCALES[i]) w.push(EN_SCALES[i])
    words.unshift(...w)
  }
  return (value < 0 ? 'minus ' : '') + words.join(' ')
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** 1234.5 → «Одна тысяча двести тридцать четыре тенге 50 тиын». */
export function moneyWords(amount: number, en = false): string {
  const cents = Math.round(Math.abs(amount) * 100)
  const whole = Math.floor(cents / 100) * Math.sign(amount || 1)
  const tiyn = String(cents % 100).padStart(2, '0')
  return en ? `${cap(intToWordsEn(whole))} tenge ${tiyn} tiyn` : `${cap(intToWordsRu(whole))} тенге ${tiyn} тиын`
}

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Parses yyyy-mm-dd without time-zone shifts. */
export function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null
}

/** «2026-03-12» → «12» марта 2026 г. */
export function dateLong(iso: string, en = false): string {
  const p = parseIso(iso)
  if (!p) return en ? '“__” ________ 20__' : '«__» ________ 20__ г.'
  return en ? `${MONTHS_EN[p.m - 1]} ${p.d}, ${p.y}` : `«${String(p.d).padStart(2, '0')}» ${MONTHS_GEN[p.m - 1]} ${p.y} г.`
}

/** «2026-03-12» → 12.03.2026 */
export function dateShort(iso: string): string {
  const p = parseIso(iso)
  return p ? `${String(p.d).padStart(2, '0')}.${String(p.m).padStart(2, '0')}.${p.y}` : ''
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Whole days from today to the date (negative when past). */
export function daysUntil(iso: string, now = new Date()): number | null {
  const p = parseIso(iso)
  if (!p) return null
  const a = Date.UTC(p.y, p.m - 1, p.d)
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((a - b) / 86400000)
}
