import { ArrowLeft, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { Button, ButtonLink } from '@/components/ui/Button'
import { computeTotals, lineTotal, sectionTotal } from '@/lib/estimate'
import { fmt, fmtDate, money } from '@/lib/format'
import { useEstimates } from '@/store/estimates'
import { useSettings } from '@/store/settings'
import { NotFoundPage } from './NotFoundPage'
import { T, Tf } from '@/i18n'

/** A4 print layout of an estimate / commercial offer; «Сохранить как PDF» in the print dialog gives a PDF. */
export function EstimatePrintPage() {
  const { id } = useParams()
  const e = useEstimates((s) => s.estimates.find((x) => x.id === id))
  const company = useSettings((s) => s.company)
  const [now] = useState(() => Date.now())
  useEffect(() => {
    if (!e) return
    const prev = document.title
    document.title = e.name
    return () => {
      document.title = prev
    }
  }, [e])
  if (!e) return <NotFoundPage />
  const t = computeTotals(e)
  const s = e.settings
  const title = e.docType === 'offer' ? T('Коммерческое предложение') : T('Сметный расчёт')
  let n = 0
  const tr = (label: string, value: number, bold = false) => (
    <tr className={bold ? 'font-bold' : ''}>
      <td colSpan={5} className="py-0.5 pr-3 text-right">{label}</td>
      <td className="py-0.5 text-right tabular-nums whitespace-nowrap">{money(value, false)}</td>
    </tr>
  )

  return (
    <div className="min-h-dvh bg-zinc-100 py-6 print:bg-white print:py-0 dark:bg-zinc-950">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-4">
        <ButtonLink to={`/estimates/${e.id}`} size="sm" variant="ghost">
          <ArrowLeft size={15} />  {T('К смете')}
        </ButtonLink>
        <Button size="sm" variant="primary" onClick={() => window.print()}>
          <Printer size={15} />  {T('Печать / сохранить PDF')}
        </Button>
      </div>
      <article className="mx-auto max-w-[210mm] bg-white p-[12mm] text-[12px] leading-snug text-black shadow-lg print:max-w-none print:p-0 print:shadow-none">
        <header className="mb-5 flex justify-between gap-6 border-b border-black pb-3">
          <div>
            <div className="text-[15px] font-bold">{company.name || T('Исполнитель')}</div>
            {company.inn && <div>{T('БИН')} {company.inn}</div>}
            {company.address && <div>{company.address}</div>}
            {(company.phone || company.email) && <div>{[company.phone, company.email].filter(Boolean).join(' · ')}</div>}
          </div>
          <div className="text-right">
            <div>{T('Дата:')} {fmtDate(now)}</div>
          </div>
        </header>
        <h1 className="mb-1 text-center text-[17px] font-bold uppercase">{title}</h1>
        <h2 className="mb-4 text-center text-[14px]">{e.name}</h2>
        {(e.object || e.client) && (
          <div className="mb-4 space-y-0.5">
            {e.client && <div><b>{T('Заказчик:')}</b> {e.client}</div>}
            {e.object && <div><b>{T('Объект:')}</b> {e.object}</div>}
          </div>
        )}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-black text-left">
              <th className="w-8 py-1 pr-1">№</th>
              <th className="py-1 pr-2">{T('Наименование')}</th>
              <th className="w-14 py-1 pr-2">{T('Ед.')}</th>
              <th className="w-20 py-1 pr-2 text-right">{T('Кол-во')}</th>
              <th className="w-24 py-1 pr-2 text-right">{T('Цена, ₸')}</th>
              <th className="w-28 py-1 text-right">{T('Сумма, ₸')}</th>
            </tr>
          </thead>
          {e.sections.map((sec) => (
            <tbody key={sec.id} className="break-inside-auto">
              <tr>
                <td colSpan={6} className="pt-3 pb-1 font-bold">{sec.name}</td>
              </tr>
              {sec.items.map((it) => (
                <tr key={it.id} className="border-b border-zinc-300 align-top break-inside-avoid">
                  <td className="py-1 pr-1">{++n}</td>
                  <td className="py-1 pr-2">{it.name}</td>
                  <td className="py-1 pr-2">{it.unit}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{fmt(it.qty, 4)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums whitespace-nowrap">{money(it.price, false)}</td>
                  <td className="py-1 text-right tabular-nums whitespace-nowrap">{money(lineTotal(it), false)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} className="py-1 pr-3 text-right italic">{T('Итого по разделу')}</td>
                <td className="py-1 text-right font-semibold tabular-nums whitespace-nowrap">{money(sectionTotal(sec), false)}</td>
              </tr>
            </tbody>
          ))}
          <tbody className="break-inside-avoid border-t border-black">
            <tr><td colSpan={6} className="pt-2" /></tr>
            {tr(T('Прямые затраты'), t.direct)}
            {t.materialsMarkup > 0 && tr(Tf('Наценка на материалы {0}%', [s.materialsMarkupPct]), t.materialsMarkup)}
            {t.overhead > 0 && tr(Tf('Накладные расходы {0}%', [s.overheadPct]), t.overhead)}
            {t.profit > 0 && tr(Tf('Сметная прибыль {0}%', [s.profitPct]), t.profit)}
            {t.contingency > 0 && tr(Tf('Непредвиденные затраты {0}%', [s.contingencyPct]), t.contingency)}
            {t.discount > 0 && tr(Tf('Скидка {0}%', [s.discountPct]), -t.discount)}
            {s.vatMode === 'on_top' && tr(T('Итого без НДС'), t.net)}
            {s.vatMode === 'on_top' && tr(Tf('НДС {0}%', [s.vatPct]), t.vat)}
            {tr(s.vatMode === 'none' ? T('ИТОГО (НДС не облагается)') : T('ИТОГО с НДС'), t.total, true)}
            {s.vatMode === 'included' && tr(Tf('в т.ч. НДС {0}%', [s.vatPct]), t.vat)}
          </tbody>
        </table>
        {e.notes && <p className="mt-5 whitespace-pre-wrap">{e.notes}</p>}
        <footer className="mt-10 grid grid-cols-2 gap-10 break-inside-avoid">
          <div>
            <div className="mb-6">{T('Исполнитель')}</div>
            <div className="border-b border-black" />
            <div className="mt-1 text-[10px] text-zinc-600">{company.signer || T('подпись, ФИО')}</div>
          </div>
          <div>
            <div className="mb-6">{T('Заказчик')}</div>
            <div className="border-b border-black" />
            <div className="mt-1 text-[10px] text-zinc-600">{T('подпись, ФИО')}</div>
          </div>
        </footer>
      </article>
    </div>
  )
}
