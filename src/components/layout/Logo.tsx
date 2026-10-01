import { Link } from 'react-router'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-brand-600" />
        <path d="M7 23h18M9 23V12l7-5 7 5v11" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M13 23v-6h6v6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight">СтройРасчёт</span>
        <span className="block text-[11px] text-zinc-500">расчёты · сметы · тоннаж</span>
      </span>
    </Link>
  )
}
