import type { Requisites } from '../types'
import type { Block } from '../model'

/** Parties' details with signature lines — the {{реквизиты}} block of contracts and acts. */
export function RequisitesBlock({ names, client, contractor, compact }: { names: [string, string]; client: Requisites; contractor: Requisites; compact?: boolean }) {
  const col = (title: string, r: Requisites) => (
    <div className="min-w-0 flex-1 break-inside-avoid">
      <div className="mb-1 font-bold">{title}</div>
      <div className="font-semibold">{r.name || '________________'}</div>
      {!compact && (
        <div className="space-y-0.5">
          <div>БИН/ИИН: {r.bin || '________'}</div>
          {r.address && <div>Адрес: {r.address}</div>}
          {r.bank && <div>Банк: {r.bank}</div>}
          <div>ИИК: {r.iik || '________'}</div>
          <div>
            БИК: {r.bik || '________'}
            {r.kbe ? `, КБе: ${r.kbe}` : ''}
          </div>
          {(r.phone || r.email) && <div>{[r.phone, r.email].filter(Boolean).join(', ')}</div>}
        </div>
      )}
      <div className="mt-6">{r.position || 'Руководитель'}</div>
      <div className="mt-5 flex items-end gap-2">
        <span className="inline-block w-32 border-b border-black" />
        <span>/{r.director || '________________'}/</span>
      </div>
      <div className="mt-1 text-[10px]">М.П.</div>
    </div>
  )
  return (
    <div className="mt-4 flex gap-8">
      {col(names[0], client)}
      {col(names[1], contractor)}
    </div>
  )
}

/** Renders parsed contract markup in a print-like style. */
export function DocBody({ blocks, names, client, contractor }: { blocks: Block[]; names: [string, string]; client: Requisites; contractor: Requisites }) {
  return (
    <div className="text-justify">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h1':
            return <h1 key={i} className="text-center text-[15px] font-bold">{b.text}</h1>
          case 'h2':
            return <h2 key={i} className="mt-3 mb-1 text-center font-bold break-after-avoid">{b.text}</h2>
          case 'split':
            return (
              <div key={i} className="flex justify-between gap-4">
                <span>{b.left}</span>
                <span>{b.right}</span>
              </div>
            )
          case 'requisites':
            return <RequisitesBlock key={i} names={names} client={client} contractor={contractor} />
          case 'gap':
            return <div key={i} className="h-2" />
          default:
            // The line right under the title is its subtitle.
            return blocks[i - 1]?.type === 'h1' ? <p key={i} className="text-center">{b.text}</p> : <p key={i} className="indent-6">{b.text}</p>
        }
      })}
    </div>
  )
}
