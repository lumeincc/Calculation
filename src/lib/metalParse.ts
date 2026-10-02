/**
 * Recognises rolled-metal profiles in free text of specifications:
 * «Труба профильная 40х20х2», «Гн□100х4», «Уголок 50х5 ГОСТ 8509-93», «Швеллер 10П», «Двутавр 20Б1»,
 * «Ø12 А500С», «Лист г/к 10 мм», «-10х200», «Круг 20».
 */
import { ANGLES_EQUAL, BEAMS, CHANNELS, REBAR } from '@/data/metals'
import type { ProfileSpec } from './metal'

const N = String.raw`(\d+(?:\.\d+)?)`

/** ВГП трубы задаются условным проходом Ду — переводим в наружный диаметр (ГОСТ 3262). */
const DN_TO_D: Record<number, number> = { 10: 17, 15: 21.3, 20: 26.8, 25: 33.5, 32: 42.3, 40: 48, 50: 60, 65: 75.5, 80: 88.5, 90: 101.3, 100: 114 }

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\s*[xх×*]\s*(?=\d)/g, 'x')
    .replace(/[ \s]+/g, ' ')
    .trim()
}

const f = (s: string) => Number.parseFloat(s)
const label = (n: number) => String(n).replace('.', ',')

export function parseProfile(text: string): ProfileSpec | null {
  const t = normalize(text)
  let m: RegExpMatchArray | null

  // Профильная труба / гнутый замкнутый профиль
  if ((m = t.match(new RegExp(String.raw`(?:труб\S*|гн\.?|тр\.?)\s*(?:проф\S*|прямоуг\S*|квадр\S*|кв\.?|пр\.?|э\/?с|эл\.?\s*св\S*|[□\[\]]|\s)*\s*${N}x${N}x${N}`))))
    return { type: 'profilePipe', a: f(m[1]), b: f(m[2]), s: f(m[3]) }
  if ((m = t.match(new RegExp(String.raw`гн\.?\s*[□\[\]]?\s*${N}x${N}(?!\s*x)`))))
    return { type: 'profilePipe', a: f(m[1]), b: f(m[1]), s: f(m[2]) }

  // Круглая труба D×s, в т.ч. ВГП по Ду
  if ((m = t.match(new RegExp(String.raw`труб\S*\s*(?:[^\d]{0,40}?)(ду|dn)?\s*${N}x${N}(?!\s*x)`)))) {
    let d = f(m[2])
    if (m[1] && DN_TO_D[d]) d = DN_TO_D[d]
    return { type: 'pipe', a: d, s: f(m[3]) }
  }

  // Уголок
  if ((m = t.match(new RegExp(String.raw`(?:уголок|угол\.?|∟|(?:^|\s)l\.?)\s*(?:г\/к\s*|равнопол\S*\s*|неравнопол\S*\s*)?${N}x${N}(?:x${N})?`)))) {
    const [a, b, c] = [f(m[1]), f(m[2]), m[3] ? f(m[3]) : NaN]
    const equal = Number.isNaN(c) || a === b
    const thick = Number.isNaN(c) ? b : c
    const size = `${label(a)}×${label(thick)}`
    if (equal && ANGLES_EQUAL.some((x) => x.size === size)) return { type: 'angle', size }
    return { type: 'angle', a, b: Number.isNaN(c) ? a : b, s: thick }
  }

  // Швеллер
  if ((m = t.match(new RegExp(String.raw`(?:швеллер\S*|шв\.?|\[)\s*(?:№\s*)?${N}\s*(а?[уп])?`)))) {
    const size = `№${label(f(m[1]))}`
    if (CHANNELS.some((x) => x.size === size)) return { type: 'channel', size }
  }

  // Двутавр
  if ((m = t.match(new RegExp(String.raw`(?:двутавр\S*|балк\S*|дв\.?|(?:^|\s)i)\s*(?:№\s*)?(\d+)\s*([бшк]\d)?`)))) {
    const n = m[1]
    if (m[2]) {
      const size = `${n}${m[2].toUpperCase()}`
      if (BEAMS.some((x) => x.size === size)) return { type: 'beam', size }
    }
    if (BEAMS.some((x) => x.size === `№${n}`)) return { type: 'beam', size: `№${n}` }
  }

  // Арматура
  const rebarClass = String.raw`[аa]\s*-?\s*(?:500|400|240|iii|ii|i)\b`
  if (/арматур|[ø⌀∅]/.test(t) || new RegExp(rebarClass).test(t)) {
    m = t.match(/[ø⌀∅]\s*(\d+)/) ??
      t.match(new RegExp(String.raw`(\d+)\s*(?:мм)?\s*-?\s*${rebarClass}`)) ??
      t.match(new RegExp(String.raw`арматур\S*\s*(?:${rebarClass}\S*\s*)?(?:d\s*=?\s*)?(\d+)`)) ??
      t.match(/\bd\s*=?\s*(\d+)/)
    if (m && REBAR.some((r) => r.d === Number(m![1]))) return { type: 'rebar', a: Number(m[1]) }
  }

  // Полоса «-10x200» (толщина × ширина) или «Полоса 40х4»
  if ((m = t.match(new RegExp(String.raw`(?:^|\s)[-–—]\s*${N}x${N}`)))) {
    const [x, y] = [f(m[1]), f(m[2])]
    return { type: 'strip', a: Math.max(x, y), s: Math.min(x, y) }
  }
  // Плита/лист в КМ-ведомостях: «-12» — только толщина
  if ((m = t.match(new RegExp(String.raw`(?:^|\s)[-–—]\s*${N}$`)))) {
    const s = f(m[1])
    if (s > 0 && s <= 160) return { type: 'sheet', s }
  }
  if ((m = t.match(new RegExp(String.raw`полос\S*\s*(?:г\/к\s*)?${N}x${N}`)))) {
    const [x, y] = [f(m[1]), f(m[2])]
    return { type: 'strip', a: Math.max(x, y), s: Math.min(x, y) }
  }

  // Лист: «Лист 10», «Лист г/к 4х1500х6000», «Лист t=8 мм»
  if ((m = t.match(new RegExp(String.raw`лист\S*\s*(?:(?:г\/к|х\/к|оцинк\S*|рифл\S*|чечевиц\S*|ромб\S*|ст\.?\s*\d+\S*|сталь\S*)\s*)*(?:[ts]\s*=?\s*|толщ\S*\s*|δ\s*=?\s*)?${N}(?:x${N}x${N})?`)))) {
    // «4х1500х6000» or «1500х6000х4» — the thickness is the smallest dimension.
    const s = Math.min(...[m[1], m[2], m[3]].filter(Boolean).map(f))
    if (s > 0 && s <= 160) return { type: 'sheet', s }
  }

  if ((m = t.match(new RegExp(String.raw`(?:круг|пруток)\S*\s*(?:г\/к\s*|калибр\S*\s*)?(?:[ø⌀∅d]\s*)?${N}`))))
    return { type: 'round', a: f(m[1]) }
  if ((m = t.match(new RegExp(String.raw`квадрат\S*\s*${N}`)))) return { type: 'square', a: f(m[1]) }
  if ((m = t.match(new RegExp(String.raw`шестигран\S*\s*(?:s\s*)?${N}`)))) return { type: 'hex', a: f(m[1]) }
  return null
}
