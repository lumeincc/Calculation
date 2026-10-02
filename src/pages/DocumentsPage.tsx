import {
  AlertTriangle, Archive, CheckCircle2, ChevronRight, Download, File, FileImage, FileSpreadsheet, FileText, FileType2,
  FilePlus2, FolderOpen, Layers, ListPlus, Loader2, PenTool, Search, Trash2, Weight, XCircle,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Dropzone } from '@/components/docs/Dropzone'
import { DocViewer, TableView } from '@/components/docs/Viewers'
import { AddToEstimateDialog } from '@/components/estimate/AddToEstimateDialog'
import { Button, IconButton } from '@/components/ui/Button'
import { Badge, EmptyState, PageHeader, Stat, Tabs } from '@/components/ui/misc'
import { KIND_LABEL as DOC_KIND } from '@/docs/detect'
import type { DocFile, DocKind, MetalHit, Position } from '@/docs/types'
import { createItem, createSection, KIND_LABEL, type EstimateItem } from '@/lib/estimate'
import { downloadBytes, exportTableXlsx } from '@/lib/export'
import { fmt, money, plural } from '@/lib/format'
import { PROFILE_PRICE_KEY } from '@/lib/metal'
import { round } from '@/lib/num'
import { useDocs } from '@/store/docs'
import { useEstimates } from '@/store/estimates'
import { useMetalSpec } from '@/store/metalSpec'
import { priceOf, usePrices } from '@/store/prices'
import { useSettings } from '@/store/settings'
import { toast } from '@/store/toast'

type Tab = 'summary' | 'files' | 'positions' | 'metal' | 'search'

const ICON: Record<DocKind, ReactNode> = {
  pdf: <FileText size={16} className="text-red-600" />,
  sheet: <FileSpreadsheet size={16} className="text-emerald-600" />,
  docx: <FileType2 size={16} className="text-sky-600" />,
  odt: <FileType2 size={16} className="text-sky-600" />,
  image: <FileImage size={16} className="text-violet-600" />,
  text: <FileText size={16} className="text-zinc-500" />,
  dxf: <PenTool size={16} className="text-amber-600" />,
  archive: <Archive size={16} className="text-brand-600" />,
  cad: <PenTool size={16} className="text-zinc-400" />,
  other: <File size={16} className="text-zinc-400" />,
}

function sizeLabel(n: number) {
  if (n < 1024) return `${n} Б`
  if (n < 1024 * 1024) return `${fmt(n / 1024, 0)} КБ`
  return `${fmt(n / 1024 / 1024, 1)} МБ`
}

function Status({ status }: { status?: string }) {
  if (status === 'pending' || status === 'processing') return <Loader2 size={14} className="animate-spin text-zinc-400" />
  if (status === 'error') return <XCircle size={14} className="text-red-500" />
  if (status === 'unsupported') return <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
  return <CheckCircle2 size={14} className="text-emerald-500" />
}

function FileTree({ files, selected, onSelect }: { files: DocFile[]; selected: string | null; onSelect(id: string): void }) {
  const analyses = useDocs((s) => s.analyses)
  const children = useMemo(() => {
    const m = new Map<string | undefined, DocFile[]>()
    for (const f of files) m.set(f.parentId, [...(m.get(f.parentId) ?? []), f])
    for (const list of m.values()) list.sort((a, b) => a.path.localeCompare(b.path, 'ru'))
    return m
  }, [files])
  const render = (parent: string | undefined, depth: number): ReactNode =>
    (children.get(parent) ?? []).map((f) => {
      const a = analyses[f.id]
      const inner = f.parentId ? f.path.slice(files.find((p) => p.id === f.parentId)!.path.length + 1) : f.path
      return (
        <div key={f.id}>
          <button
            onClick={() => f.kind !== 'archive' && onSelect(f.id)}
            className={`flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm ${f.id === selected ? 'bg-brand-50 text-brand-900 dark:bg-brand-950/60 dark:text-brand-100' : f.kind === 'archive' ? 'cursor-default' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/70'}`}
            style={{ paddingLeft: 8 + depth * 14 }}
            title={f.path}
          >
            {ICON[f.kind]}
            <span className={`min-w-0 flex-1 truncate ${f.kind === 'archive' ? 'font-medium' : ''}`}>{inner}</span>
            {a && a.positions.length > 0 && <Badge tone="blue">{a.positions.length}</Badge>}
            {a && a.metal.length > 0 && <Badge tone="amber"><Weight size={11} /></Badge>}
            {f.kind !== 'archive' && <Status status={a?.status} />}
          </button>
          {f.kind === 'archive' && render(f.id, depth + 1)}
        </div>
      )
    })
  return <div className="space-y-0.5">{render(undefined, 0)}</div>
}

interface MetalGroup {
  name: string
  priceKey: string
  kgPerM: number
  massKg: number
  qtyM: number
  hits: MetalHit[]
}

function groupMetal(hits: MetalHit[]): MetalGroup[] {
  const m = new Map<string, MetalGroup>()
  for (const h of hits) {
    const g = m.get(h.name) ?? { name: h.name, priceKey: PROFILE_PRICE_KEY[h.profile.type], kgPerM: h.kgPerM, massKg: 0, qtyM: 0, hits: [] }
    g.massKg += h.massKg ?? 0
    if (/^(м|п\.?\s?м)$/i.test(h.unit.trim())) g.qtyM += h.qty
    g.hits.push(h)
    m.set(h.name, g)
  }
  return [...m.values()].sort((a, b) => b.massKg - a.massKg)
}

export function DocumentsPage() {
  const { files, analyses, warnings, busy, progress, selectedId, ingest, select, remove, clear } = useDocs()
  const [tab, setTab] = useState<Tab>('summary')
  const [query, setQuery] = useState('')
  const [checked, setChecked] = useState<Set<string> | null>(null)
  const [dialog, setDialog] = useState<Partial<EstimateItem>[] | null>(null)
  const overrides = usePrices((s) => s.overrides)
  const custom = usePrices((s) => s.custom)
  const addSpec = useMetalSpec((s) => s.add)
  const defaults = useSettings((s) => s.estimateDefaults)
  const navigate = useNavigate()

  const docs = files.filter((f) => f.kind !== 'archive')
  const byId = useMemo(() => new Map(files.map((f) => [f.id, f])), [files])
  const positions = useMemo(() => docs.flatMap((f) => analyses[f.id]?.positions ?? []), [docs, analyses])
  const metal = useMemo(() => docs.flatMap((f) => analyses[f.id]?.metal ?? []), [docs, analyses])
  const metalGroups = useMemo(() => groupMetal(metal), [metal])
  const metalKg = metalGroups.reduce((s, g) => s + g.massKg, 0)
  const unknownMass = metal.filter((h) => h.massKg === null).length
  const selectedPositions = checked ?? new Set(positions.map((p) => p.id))
  const selected = selectedId ? byId.get(selectedId) : undefined
  const counts = useMemo(() => {
    const c: Partial<Record<DocKind, number>> = {}
    for (const f of docs) c[f.kind] = (c[f.kind] ?? 0) + 1
    return c
  }, [docs])
  const errors = docs.filter((f) => analyses[f.id]?.status === 'error')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const out: { file: DocFile; snippet: string; count: number }[] = []
    for (const f of docs) {
      const text = analyses[f.id]?.text ?? ''
      const lower = text.toLowerCase()
      let i = lower.indexOf(q)
      if (i < 0) continue
      let count = 0
      const first = i
      while (i >= 0 && count < 999) {
        count++
        i = lower.indexOf(q, i + q.length)
      }
      out.push({ file: f, snippet: text.slice(Math.max(0, first - 80), first + q.length + 120).replace(/\s+/g, ' '), count })
    }
    return out
  }, [query, docs, analyses])

  const toItems = (list: Position[]): Partial<EstimateItem>[] =>
    list.map((p) =>
      // Unpriced metal rows are converted to tonnes and priced from the catalog (₸/т).
      p.metalPriceKey && p.massKg && !p.price
        ? { kind: p.kind, name: `${p.name} (${fmt(p.qty, 3)} ${p.unit})`, unit: 'т', qty: round(p.massKg / 1000, 4), price: priceOf(p.metalPriceKey, overrides, custom), source: 'docs' }
        : { kind: p.kind, name: p.name, unit: p.unit || 'шт', qty: round(p.qty, 4), price: round(p.price, 2), source: 'docs' },
    )

  /** New estimate with one section per document section (or per file). */
  const importAsNewEstimate = () => {
    const list = positions.filter((p) => selectedPositions.has(p.id))
    // One section per document section; files with the same name stay separate.
    const sections = new Map<string, { name: string; items: Position[] }>()
    for (const p of list) {
      const key = `${p.fileId}|${p.group ?? ''}`
      const s = sections.get(key) ?? { name: p.group ?? byId.get(p.fileId)?.name ?? 'Позиции', items: [] }
      s.items.push(p)
      sections.set(key, s)
    }
    const store = useEstimates.getState()
    const id = store.create(`Импорт: ${docs[0]?.name ?? 'документы'}`, defaults)
    useEstimates.setState((s) => ({
      estimates: s.estimates.map((e) => (e.id === id ? { ...e, sections: [...sections.values()].map((s) => createSection(s.name, toItems(s.items).map((it) => createItem(it)))) } : e)),
    }))
    toast(`Создана смета: ${list.length} ${plural(list.length, ['позиция', 'позиции', 'позиций'])}`)
    navigate(`/estimates/${id}`)
  }

  const metalToSpec = () => {
    addSpec(
      metal
        .filter((h) => h.massKg !== null)
        .map((h) => ({
          name: h.name,
          priceKey: PROFILE_PRICE_KEY[h.profile.type],
          kgPerM: h.kgPerM,
          length: h.kgPerM > 0 ? round(h.massKg! / h.kgPerM, 3) : 0,
          count: 1,
          massKg: h.massKg!,
          source: byId.get(h.fileId)?.name,
        })),
    )
    toast('Профили добавлены в спецификацию металла', { action: { label: 'Открыть', to: '/calc/metal' } })
  }

  if (files.length === 0 && !busy) {
    return (
      <div>
        <PageHeader icon={<FolderOpen size={22} />} title="Документы" subtitle="Загрузите проектную документацию: сметы, спецификации, ведомости, чертежи. Архивы распаковываются автоматически." />
        <Dropzone onFiles={(f) => void ingest(f)} busy={busy} progress={progress} />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { icon: <Archive size={18} />, title: 'Архивы любой вложенности', text: 'ZIP, RAR, 7Z, TAR, GZ. Русские имена из архивов Windows (CP866) читаются корректно.' },
            { icon: <Layers size={18} />, title: 'Таблицы и позиции', text: 'Сайт находит в Excel, PDF и Word таблицы смет и спецификаций: наименование, ед., количество, цену, сумму.' },
            { icon: <Weight size={18} />, title: 'Тоннаж металла', text: 'Профили «Уголок 50×5», «Швеллер 10П», «Ø12 А500С», «Труба 40×20×2» распознаются, масса считается по ГОСТ.' },
          ].map((c) => (
            <div key={c.title} className="card p-5">
              <div className="mb-2 text-brand-600">{c.icon}</div>
              <h3 className="font-medium">{c.title}</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{c.text}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        icon={<FolderOpen size={22} />}
        title="Документы"
        subtitle={`${docs.length} ${plural(docs.length, ['файл', 'файла', 'файлов'])} · обработка в браузере, без загрузки на сервер`}
        actions={<Button size="sm" variant="danger" onClick={() => confirm('Убрать все документы из списка?') && clear()}><Trash2 size={15} /> Очистить</Button>}
      />
      <Dropzone compact onFiles={(f) => void ingest(f)} busy={busy} progress={progress} />

      {warnings.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          {warnings.map((w) => <div key={w} className="flex gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> {w}</div>)}
        </div>
      )}

      <div className="mt-5">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'summary', label: 'Сводка' },
            { value: 'files', label: <>Файлы <Badge>{docs.length}</Badge></> },
            { value: 'positions', label: <>Позиции <Badge tone="blue">{positions.length}</Badge></> },
            { value: 'metal', label: <>Металл <Badge tone="amber">{fmt(metalKg / 1000, 2)} т</Badge></> },
            { value: 'search', label: <><Search size={14} /> Поиск</> },
          ]}
        />
      </div>

      <div className="mt-5">
        {tab === 'summary' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Документов" value={docs.length} hint={Object.entries(counts).map(([k, n]) => `${DOC_KIND[k as DocKind]}: ${n}`).join(' · ')} />
              <Stat label="Найдено позиций" value={positions.length} hint={`на ${money(positions.reduce((s, p) => s + p.sum, 0))}`} />
              <Stat label="Металл" value={fmt(metalKg / 1000, 3)} unit="т" accent hint={`${metal.length} строк${unknownMass ? `, у ${unknownMass} нет массы` : ''}`} />
              <Stat label="Таблиц" value={docs.reduce((s, f) => s + (analyses[f.id]?.tables.length ?? 0), 0)} hint={`${docs.reduce((s, f) => s + (analyses[f.id]?.pages ?? 0), 0)} стр. PDF`} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={!positions.length} onClick={importAsNewEstimate}><FilePlus2 size={16} /> Создать смету из позиций</Button>
              <Button disabled={!metal.length} onClick={metalToSpec}><ListPlus size={16} /> Металл → спецификация</Button>
              <Button onClick={() => setTab('files')}><FolderOpen size={16} /> Открыть файлы</Button>
            </div>
            {errors.length > 0 && (
              <div className="card p-4">
                <h3 className="mb-2 text-sm font-semibold">Не удалось прочитать</h3>
                {errors.map((f) => <div key={f.id} className="text-sm"><b>{f.path}</b>: <span className="text-red-600">{analyses[f.id]?.error}</span></div>)}
              </div>
            )}
            <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">
              {docs.map((f) => {
                const a = analyses[f.id]
                return (
                  <button key={f.id} onClick={() => { select(f.id); setTab('files') }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    {ICON[f.kind]}
                    <span className="min-w-0 flex-1 truncate" title={f.path}>{f.path}</span>
                    {a?.positions.length ? <Badge tone="blue">{a.positions.length} поз.</Badge> : null}
                    {a?.metal.length ? <Badge tone="amber">{a.metal.length} проф.</Badge> : null}
                    {a?.pages ? <span className="text-xs text-zinc-500">{a.pages} стр.</span> : null}
                    <span className="w-16 text-right text-xs text-zinc-500">{sizeLabel(f.size)}</span>
                    <Status status={a?.status} />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'files' && (
          <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="card max-h-[80vh] overflow-auto p-2">
              <FileTree files={files} selected={selectedId} onSelect={select} />
            </div>
            <div className="card min-w-0 overflow-hidden">
              {selected ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
                    {ICON[selected.kind]}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium" title={selected.path}>{selected.name}</div>
                      <div className="truncate text-xs text-zinc-500">{DOC_KIND[selected.kind]} · {sizeLabel(selected.size)}{analyses[selected.id]?.positions.length ? ` · ${analyses[selected.id].positions.length} позиций` : ''}</div>
                    </div>
                    <IconButton label="Скачать" onClick={() => downloadBytes(selected.data, selected.name)}><Download size={16} /></IconButton>
                    <IconButton label="Убрать из списка" onClick={() => remove(selected.id)}><Trash2 size={16} /></IconButton>
                  </div>
                  {analyses[selected.id]?.notes?.length && selected.kind !== 'cad' && selected.kind !== 'other' ? (
                    <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">{analyses[selected.id]!.notes!.join(' ')}</div>
                  ) : null}
                  {analyses[selected.id]?.status === 'error' && <div className="px-4 py-2 text-sm text-red-600">Ошибка: {analyses[selected.id]?.error}</div>}
                  <DocViewer key={selected.id} file={selected} analysis={analyses[selected.id]} />
                  {selected.kind === 'pdf' && (analyses[selected.id]?.positions.length ?? 0) > 0 && (
                    <details className="border-t border-zinc-200 dark:border-zinc-800">
                      <summary className="cursor-pointer px-4 py-2 text-sm font-medium">Извлечённые таблицы</summary>
                      {analyses[selected.id]!.tables.map((t) => (
                        <div key={t.title}>
                          <div className="px-4 py-1 text-xs text-zinc-500">{t.title}</div>
                          <TableView table={t} limit={100} />
                        </div>
                      ))}
                    </details>
                  )}
                </>
              ) : (
                <p className="p-10 text-center text-sm text-zinc-500">Выберите файл слева</p>
              )}
            </div>
          </div>
        )}

        {tab === 'positions' && (
          positions.length === 0 ? (
            <EmptyState icon={<Layers size={28} />} title="Позиции не найдены" text="Сайт ищет таблицы с колонками «Наименование» и «Количество», «Сумма» или «Масса». Проверьте, что в документе есть такой заголовок." />
          ) : (
            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Выбрано {selectedPositions.size} из {positions.length}</span>
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => exportTableXlsx('Позиции из документов', 'Позиции', ['Файл', 'Источник', 'Раздел', 'Наименование', 'Тип', 'Ед.', 'Кол-во', 'Цена', 'Сумма', 'Масса, кг'], positions.map((p) => [byId.get(p.fileId)?.name ?? '', p.source, p.group ?? '', p.name, KIND_LABEL[p.kind].one, p.unit, p.qty, p.price, p.sum, p.massKg ?? null]), [24, 12, 24, 60, 12, 8, 10, 12, 14, 12])}>
                    <Download size={15} /> Excel
                  </Button>
                  <Button size="sm" disabled={!selectedPositions.size} onClick={() => setDialog(toItems(positions.filter((p) => selectedPositions.has(p.id))))}>
                    <FilePlus2 size={15} /> В существующую смету
                  </Button>
                  <Button size="sm" variant="primary" disabled={!selectedPositions.size} onClick={importAsNewEstimate}>
                    <FilePlus2 size={15} /> Новая смета
                  </Button>
                </div>
              </div>
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="sticky top-0 bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900">
                    <tr>
                      <th className="w-10 px-3 py-2">
                        <input type="checkbox" className="accent-brand-600" checked={selectedPositions.size === positions.length} onChange={(e) => setChecked(e.target.checked ? null : new Set())} aria-label="Выбрать все" />
                      </th>
                      <th className="px-2 py-2 font-medium">Наименование</th>
                      <th className="px-2 py-2 font-medium">Тип</th>
                      <th className="px-2 py-2 font-medium">Ед.</th>
                      <th className="px-2 py-2 text-right font-medium">Кол-во</th>
                      <th className="px-2 py-2 text-right font-medium">Цена</th>
                      <th className="px-2 py-2 text-right font-medium">Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {positions.map((p, i) => {
                      const showGroup = p.group && p.group !== positions[i - 1]?.group
                      return [
                        showGroup ? (
                          <tr key={`${p.id}-g`} className="bg-zinc-50/60 dark:bg-zinc-900/40">
                            <td />
                            <td colSpan={6} className="px-2 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                              {p.group} <span className="font-normal text-zinc-400">· {byId.get(p.fileId)?.name}</span>
                            </td>
                          </tr>
                        ) : null,
                        <tr key={p.id} className="align-top">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              className="accent-brand-600"
                              checked={selectedPositions.has(p.id)}
                              onChange={() => {
                                const n = new Set(selectedPositions)
                                if (n.has(p.id)) n.delete(p.id)
                                else n.add(p.id)
                                setChecked(n)
                              }}
                              aria-label="Выбрать"
                            />
                          </td>
                          <td className="px-2 py-2">
                            {p.name}
                            {!p.group && <div className="text-xs text-zinc-400">{byId.get(p.fileId)?.name} · {p.source}</div>}
                          </td>
                          <td className="px-2 py-2"><Badge tone={p.kind === 'work' ? 'blue' : p.kind === 'machine' ? 'amber' : p.kind === 'transport' ? 'green' : 'zinc'}>{KIND_LABEL[p.kind].short}</Badge></td>
                          <td className="px-2 py-2">{p.unit}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{fmt(p.qty, 4)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{p.price ? fmt(p.price, 2) : '—'}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{p.sum ? fmt(p.sum, 2) : '—'}</td>
                        </tr>,
                      ]
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {tab === 'metal' && (
          metal.length === 0 ? (
            <EmptyState icon={<Weight size={28} />} title="Металлопрокат не найден" text="Загрузите спецификацию металла (КМ, КЖ) в Excel, PDF или Word — профили и масса будут собраны здесь." />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Общий тоннаж" value={fmt(metalKg / 1000, 3)} unit="т" accent />
                <Stat label="Профилей" value={metalGroups.length} />
                <Stat label="Строк спецификаций" value={metal.length} hint={unknownMass ? `без массы: ${unknownMass}` : undefined} />
                <Stat label="Стоимость по справочнику" value={money(metalGroups.reduce((s, g) => s + (g.massKg / 1000) * priceOf(g.priceKey, overrides, custom), 0))} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={metalToSpec}><ListPlus size={16} /> В спецификацию металла</Button>
                <Button onClick={() => setDialog(metalGroups.filter((g) => g.massKg > 0).map((g) => ({ kind: 'material', name: g.name, unit: 'т', qty: round(g.massKg / 1000, 4), price: priceOf(g.priceKey, overrides, custom), source: 'docs' })))}>
                  <FilePlus2 size={16} /> В смету (по профилям)
                </Button>
                <Button onClick={() => exportTableXlsx('Металл из документов', 'Металл', ['Профиль', 'Масса 1 м, кг', 'Длина, м', 'Масса, кг', 'Масса, т', 'Строк'], metalGroups.map((g) => [g.name, round(g.kgPerM, 3), round(g.qtyM, 2), round(g.massKg, 2), round(g.massKg / 1000, 4), g.hits.length]), [36, 14, 12, 14, 12, 8])}>
                  <Download size={16} /> Excel
                </Button>
              </div>
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900/60">
                    <tr>
                      <th className="px-4 py-2 font-medium">Профиль</th>
                      <th className="px-2 py-2 text-right font-medium">кг/м</th>
                      <th className="px-2 py-2 text-right font-medium">Длина, м</th>
                      <th className="px-2 py-2 text-right font-medium">Масса, т</th>
                      <th className="px-4 py-2 font-medium">Источники</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {metalGroups.map((g) => (
                      <tr key={g.name} className="align-top">
                        <td className="px-4 py-2 font-medium">{g.name}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmt(g.kgPerM, 3)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{g.qtyM ? fmt(g.qtyM, 2) : '—'}</td>
                        <td className="px-2 py-2 text-right font-medium tabular-nums">{fmt(g.massKg / 1000, 4)}</td>
                        <td className="px-4 py-2 text-xs text-zinc-500">
                          {g.hits.slice(0, 3).map((h) => (
                            <div key={h.id} className="truncate" title={h.raw}>
                              {byId.get(h.fileId)?.name}: «{h.raw}» — {h.qty} {h.unit}
                              {h.massKg === null && <span className="ml-1 text-amber-600">масса не определена</span>}
                            </div>
                          ))}
                          {g.hits.length > 3 && <div>и ещё {g.hits.length - 3}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {tab === 'search' && (
          <div>
            <div className="relative mb-4">
              <Search size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
              <input className="input h-11 pl-10" placeholder="Поиск по тексту всех документов: «В25», «арматура», «итого»…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
            </div>
            {query.trim().length >= 2 && results.length === 0 && <p className="text-sm text-zinc-500">Ничего не найдено</p>}
            <div className="space-y-2">
              {results.map((r) => (
                <button key={r.file.id} onClick={() => { select(r.file.id); setTab('files') }} className="card block w-full p-3 text-left hover:border-brand-300 dark:hover:border-brand-800">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {ICON[r.file.kind]} <span className="truncate">{r.file.path}</span>
                    <Badge className="ml-auto">{r.count} совп.</Badge>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    …<Highlight text={r.snippet} q={query.trim()} />…
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {dialog && <AddToEstimateDialog open onClose={() => setDialog(null)} items={dialog} defaultSection="Из документов" />}
      <p className="mt-6 flex items-center gap-1 text-xs text-zinc-400">
        <ChevronRight size={12} /> Позиции и профили распознаются автоматически по заголовкам таблиц — проверьте результат перед отправкой сметы.
      </p>
    </div>
  )
}

function Highlight({ text, q }: { text: string; q: string }) {
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return <>{parts.map((p, i) => (p.toLowerCase() === q.toLowerCase() ? <mark key={i} className="rounded bg-brand-200 px-0.5 text-zinc-900">{p}</mark> : p))}</>
}
