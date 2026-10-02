import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { Link } from 'react-router'
import { useToasts } from '@/store/toast'

export function Toasts() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="animate-toast pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {t.tone === 'success' ? <CheckCircle2 size={18} className="shrink-0 text-emerald-600" /> : t.tone === 'error' ? <XCircle size={18} className="shrink-0 text-red-600" /> : <Info size={18} className="shrink-0 text-sky-600" />}
          <span className="flex-1">{t.text}</span>
          {t.action && (
            <Link to={t.action.to} onClick={() => dismiss(t.id)} className="font-medium text-brand-700 hover:underline dark:text-brand-400">
              {t.action.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}
