import { useEffect, useRef, useState } from 'react'
import { fmt } from '@/lib/format'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Number that rolls smoothly to its new value (ease-out), e.g. totals and tonnage. */
export function AnimatedNumber({ value, digits = 2, minDigits = 0, format, duration = 650 }: { value: number; digits?: number; minDigits?: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const instant = !Number.isFinite(value) || !Number.isFinite(from.current) || reduced()
    const start = performance.now()
    const a = from.current
    let raf = 0
    const step = (t: number) => {
      const k = instant ? 1 : Math.min(1, (t - start) / duration)
      const e = 1 - Math.pow(1 - k, 3)
      const v = a + (value - a) * e
      from.current = v
      setShown(k === 1 ? value : v)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <span className="tabular-nums">{format ? format(shown) : fmt(shown, digits, minDigits)}</span>
}
