import { ArrowLeft, Printer } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router'
import { Button, ButtonLink } from '@/components/ui/Button'
import { T } from '@/i18n'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useSettings } from '@/store/settings'
import { DocBody, RequisitesBlock } from '../components/DocBody'
import {
  companyRequisites, contractContext, docMoney, EMPTY_REQUISITES, lineSum, paperContext, paperTotals, parseBody, PARTY_NAMES, sides, TEXT_PAPERS,
} from '../model'
import { useOffice } from '../store'
import type { Contract, Paper, Requisites } from '../types'
import { dateLong, dateShort, moneyWords } from '../words'

function Shell({ back, title, children }: { back: string; title: string; children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.title
    document.title = title
    return () => {
      document.title = prev
    }
  }, [title])
  return (
    <div className="min-h-dvh bg-zinc-100 py-6 print:bg-white print:py-0 dark:bg-zinc-950">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-4">
        <ButtonLink to={back} size="sm" variant="ghost"><ArrowLeft size={15} /> {T('Назад')}</ButtonLink>
        <Button size="sm" variant="primary" onClick={() => window.print()}><Printer size={15} /> {T('Печать / сохранить PDF')}</Button>
      </div>
      <article className="mx-auto max-w-[210mm] bg-white p-[15mm] text-[12px] leading-snug text-black shadow-lg print:max-w-none print:p-0 print:shadow-none">{children}</article>
    </div>
  )
}

const cell = 'border border-black px-1.5 py-1'

function LinesTable({ p, withVat }: { p: Paper; withVat: boolean }) {
  const t = paperTotals(p)
  return (
    <>
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="bg-zinc-100 text-center font-bold print:bg-transparent">
            <td className={`${cell} w-8`}>№</td>
            <td className={cell}>Наименование</td>
            <td className={`${cell} w-16`}>Кол-во</td>
            <td className={`${cell} w-16`}>Ед.</td>
            <td className={`${cell} w-24`}>Цена</td>
            <td className={`${cell} w-28`}>Сумма</td>
          </tr>
        </thead>
        <tbody>
          {p.lines.map((l, i) => (
            <tr key={l.id}>
              <td className={`${cell} text-center`}>{i + 1}</td>
              <td className={cell}>{l.name}</td>
              <td className={`${cell} text-right tabular-nums`}>{l.qty.toLocaleString('ru-RU', { maximumFractionDigits: 3 })}</td>
              <td className={`${cell} text-center whitespace-nowrap`}>{l.unit}</td>
              <td className={`${cell} text-right tabular-nums whitespace-nowrap`}>{docMoney(l.price)}</td>
              <td className={`${cell} text-right tabular-nums whitespace-nowrap`}>{docMoney(lineSum(l))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="mt-2 ml-auto">
        <tbody>
          <tr><td className="pr-3 text-right font-bold">Итого:</td><td className="text-right font-bold tabular-nums">{docMoney(p.vatMode === 'on_top' ? t.net : t.total)}</td></tr>
          {withVat && p.vatMode !== 'none' && (
            <tr><td className="pr-3 text-right">{p.vatMode === 'included' ? `В том числе НДС ${p.vatPct}%:` : `НДС ${p.vatPct}%:`}</td><td className="text-right tabular-nums">{docMoney(t.vat)}</td></tr>
          )}
          {p.vatMode === 'none' && <tr><td className="pr-3 text-right">Без НДС</td><td /></tr>}
          {p.vatMode === 'on_top' && <tr><td className="pr-3 text-right font-bold">Всего с НДС:</td><td className="text-right font-bold tabular-nums">{docMoney(t.total)}</td></tr>}
        </tbody>
      </table>
      <p className="mt-2">
        Всего наименований {p.lines.length}, на сумму {docMoney(t.total)} KZT
        <br />
        <b>Всего к оплате: {moneyWords(t.total)}</b>
      </p>
    </>
  )
}

function Invoice({ p, contract, us, them }: { p: Paper; contract?: Contract; us: Requisites; them: Requisites }) {
  const { client, contractor } = sides(p.role, us, them)
  return (
    <>
      <p className="mb-3 text-center text-[10px]">
        Внимание! Оплата данного счёта означает согласие с условиями поставки товара (выполнения работ, оказания услуг). Уведомление об оплате обязательно, в противном случае не гарантируется наличие товара на складе.
      </p>
      <div className="mb-1 font-bold">Образец платёжного поручения</div>
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className={cell}><b>Бенефициар:</b><br />{contractor.name || '________'}<br />БИН: {contractor.bin || '________'}</td>
            <td className={`${cell} w-56`}><b>ИИК</b><br />{contractor.iik || '________'}</td>
            <td className={`${cell} w-16`}><b>Кбе</b><br />{contractor.kbe || '__'}</td>
          </tr>
          <tr>
            <td className={cell}><b>Банк бенефициара:</b><br />{contractor.bank || '________'}</td>
            <td className={cell}><b>БИК</b><br />{contractor.bik || '________'}</td>
            <td className={cell}><b>КНП</b><br />&nbsp;</td>
          </tr>
        </tbody>
      </table>
      <h1 className="mt-5 mb-2 border-b-2 border-black pb-1 text-[16px] font-bold">Счёт на оплату № {p.number} от {dateLong(p.date)}</h1>
      <table className="w-full">
        <tbody>
          <tr><td className="w-28 py-0.5 align-top">Поставщик:</td><td className="py-0.5 font-bold">БИН / ИИН {contractor.bin || '________'}, {contractor.name}{contractor.address && `, ${contractor.address}`}</td></tr>
          <tr><td className="py-0.5 align-top">Покупатель:</td><td className="py-0.5 font-bold">БИН / ИИН {client.bin || '________'}, {client.name}{client.address && `, ${client.address}`}</td></tr>
          {contract && <tr><td className="py-0.5 align-top">Договор:</td><td className="py-0.5">№ {contract.number} от {dateShort(contract.date)}</td></tr>}
          {p.dueDate && <tr><td className="py-0.5 align-top">Оплатить до:</td><td className="py-0.5">{dateShort(p.dueDate)}</td></tr>}
        </tbody>
      </table>
      <LinesTable p={p} withVat />
      <div className="mt-8 flex items-end gap-3 border-t-2 border-black pt-4">
        <span className="font-bold">Исполнитель</span>
        <span className="inline-block w-40 border-b border-black" />
        <span>/{contractor.director || '________________'}/</span>
        <span className="ml-auto text-[10px]">М.П.</span>
      </div>
    </>
  )
}

function Act({ p, contract, us, them }: { p: Paper; contract?: Contract; us: Requisites; them: Requisites }) {
  const { client, contractor } = sides(p.role, us, them)
  const names = PARTY_NAMES[contract?.kind ?? 'other']
  return (
    <>
      <table className="w-full">
        <tbody>
          <tr><td className="w-36 py-0.5 align-top">Заказчик:</td><td className="py-0.5 font-bold">{client.name}, БИН/ИИН {client.bin || '________'}{client.address && `, ${client.address}`}</td></tr>
          <tr><td className="py-0.5 align-top">Исполнитель:</td><td className="py-0.5 font-bold">{contractor.name}, БИН/ИИН {contractor.bin || '________'}{contractor.address && `, ${contractor.address}`}</td></tr>
          {contract && <tr><td className="py-0.5 align-top">Договор:</td><td className="py-0.5">№ {contract.number} от {dateShort(contract.date)}</td></tr>}
        </tbody>
      </table>
      <h1 className="mt-5 text-center text-[15px] font-bold">АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ)</h1>
      <p className="mb-2 text-center">№ {p.number} от {dateLong(p.date)}{p.period && `, отчётный период: ${p.period}`}</p>
      {p.title && <p>Наименование работ: {p.title}{contract?.object && `, объект: ${contract.object}`}</p>}
      <LinesTable p={p} withVat />
      <p className="mt-3">
        Вышеперечисленные работы (услуги) выполнены полностью и в срок. Заказчик претензий по объёму, качеству и срокам оказания услуг (выполнения работ) не имеет.
      </p>
      <RequisitesBlock compact names={[`Принял (${names[0]})`, `Сдал (${names[1]})`]} client={client} contractor={contractor} />
    </>
  )
}

export function OfficePrintPage() {
  const { type, id } = useParams()
  const company = useSettings((s) => s.company)
  const contracts = useOffice((s) => s.contracts)
  const papers = useOffice((s) => s.papers)
  const counterparties = useOffice((s) => s.counterparties)
  const us = useMemo(() => companyRequisites(company), [company])

  if (type === 'contract') {
    const c = contracts.find((x) => x.id === id)
    if (!c) return <NotFoundPage />
    const them = counterparties.find((x) => x.id === c.counterpartyId) ?? EMPTY_REQUISITES
    const { client, contractor } = sides(c.role, us, them)
    const blocks = parseBody(c.body, contractContext(c, us, them, docMoney))
    return (
      <Shell back={`/office/contracts/${c.id}`} title={`Договор № ${c.number}`}>
        <DocBody blocks={blocks} names={PARTY_NAMES[c.kind]} client={client} contractor={contractor} />
      </Shell>
    )
  }

  const p = papers.find((x) => x.id === id)
  if (type !== 'paper' || !p) return <NotFoundPage />
  const contract = contracts.find((x) => x.id === p.contractId)
  const them = counterparties.find((x) => x.id === p.counterpartyId) ?? EMPTY_REQUISITES
  const title = `${p.kind === 'invoice' ? 'Счёт' : p.kind === 'act' ? 'Акт' : 'Документ'} № ${p.number}`
  let body: React.ReactNode
  if (p.kind === 'invoice') body = <Invoice p={p} contract={contract} us={us} them={them} />
  else if (p.kind === 'act') body = <Act p={p} contract={contract} us={us} them={them} />
  else if (TEXT_PAPERS.includes(p.kind)) {
    const { client, contractor } = sides(p.role, us, them)
    body = <DocBody blocks={parseBody(p.body, paperContext(p, contract, us, them, docMoney))} names={PARTY_NAMES[contract?.kind ?? 'other']} client={client} contractor={contractor} />
  }
  return <Shell back={`/office/papers/${p.id}`} title={title}>{body}</Shell>
}
