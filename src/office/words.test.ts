import { describe, expect, it } from 'vitest'
import { dateLong, daysUntil, intToWordsEn, intToWordsRu, moneyWords } from './words'

describe('amount in words', () => {
  it('handles Russian genders and plurals', () => {
    expect(intToWordsRu(0)).toBe('ноль')
    expect(intToWordsRu(1)).toBe('один')
    expect(intToWordsRu(21)).toBe('двадцать один')
    expect(intToWordsRu(1000)).toBe('одна тысяча')
    expect(intToWordsRu(2512)).toBe('две тысячи пятьсот двенадцать')
    expect(intToWordsRu(11000)).toBe('одиннадцать тысяч')
    expect(intToWordsRu(1_000_001)).toBe('один миллион один')
    expect(intToWordsRu(3_245_000_000)).toBe('три миллиарда двести сорок пять миллионов')
  })
  it('formats tenge with tiyn', () => {
    expect(moneyWords(1234.5)).toBe('Одна тысяча двести тридцать четыре тенге 50 тиын')
    expect(moneyWords(7_571_630)).toBe('Семь миллионов пятьсот семьдесят одна тысяча шестьсот тридцать тенге 00 тиын')
    expect(moneyWords(0.07)).toBe('Ноль тенге 07 тиын')
  })
  it('English', () => {
    expect(intToWordsEn(1_234_567)).toBe('one million two hundred thirty-four thousand five hundred sixty-seven')
    expect(moneyWords(100, true)).toBe('One hundred tenge 00 tiyn')
  })
  it('dates', () => {
    expect(dateLong('2026-03-05')).toBe('«05» марта 2026 г.')
    expect(dateLong('')).toBe('«__» ________ 20__ г.')
    expect(daysUntil('2026-10-12', new Date(2026, 9, 2))).toBe(10)
  })
})
