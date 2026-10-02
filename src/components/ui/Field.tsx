import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { locale } from '@/i18n'
import { parseDecimal } from '@/lib/num'

export function Field({ label, hint, children, htmlFor, className = '' }: { label?: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{hint}</p>}
    </div>
  )
}

const plain = new Intl.NumberFormat(locale, { maximumFractionDigits: 6, useGrouping: false })
const toText = (v: number) => (Number.isFinite(v) ? plain.format(v) : '')

/**
 * Numeric input that keeps what the user types («2,5», «2.», «») and reports a parsed number.
 * Accepts both comma and dot as the decimal separator.
 */
export function NumberInput({
  value,
  onChange,
  unit,
  className = '',
  size = 'md',
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size'> & {
  value: number
  onChange(v: number): void
  unit?: string
  size?: 'sm' | 'md'
}) {
  const [text, setText] = useState(() => toText(value))
  const [prev, setPrev] = useState(value)
  if (value !== prev) {
    // Sync when the value is changed from outside (reset, shared link), not while typing.
    setPrev(value)
    if (parseDecimal(text) !== value) setText(toText(value))
  }
  return (
    <div className={`relative ${className}`}>
      <input
        {...rest}
        inputMode="decimal"
        autoComplete="off"
        className={`input ${size === 'sm' ? 'input-sm' : ''} tabular-nums ${unit ? 'pr-12' : ''}`}
        value={text}
        onChange={(e) => {
          const t = e.target.value
          if (!/^-?[\d\s.,]*$/.test(t)) return
          setText(t)
          const n = parseDecimal(t)
          onChange(n ?? 0)
        }}
        onBlur={() => setText(toText(parseDecimal(text) ?? 0))}
        onFocus={(e) => e.target.select()}
      />
      {unit && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-zinc-400 dark:text-zinc-500">
          {unit}
        </span>
      )}
    </div>
  )
}

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...props} />
}

export function Select({
  value,
  onChange,
  options,
  className = '',
  size = 'md',
  id,
}: {
  value: string
  onChange(v: string): void
  options: { value: string; label: string }[]
  className?: string
  size?: 'sm' | 'md'
  id?: string
}) {
  return (
    <select id={id} className={`input ${size === 'sm' ? 'input-sm' : ''} cursor-pointer pr-8 ${className}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Segmented({ value, onChange, options }: { value: string; onChange(v: string): void; options: { value: string; label: string }[] }) {
  return (
    <div role="radiogroup" className="flex w-full flex-wrap gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800/70">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-8 flex-1 rounded-md px-3 py-1 text-sm font-medium transition ${
              active
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: ReactNode }) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex min-h-10 cursor-pointer items-center gap-3 select-none">
      <span className="relative inline-flex shrink-0">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-10 rounded-full bg-zinc-300 transition peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/40 dark:bg-zinc-700" />
        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition duration-300 ease-[cubic-bezier(.3,1.5,.6,1)] peer-checked:translate-x-4" />
      </span>
      <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
    </label>
  )
}
