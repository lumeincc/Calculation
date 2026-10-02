import {
  Archive, ChevronRight, Clock, Download, File, FileImage, FileSpreadsheet, FileText, Folder as FolderIcon, FolderInput, FolderPlus,
  FolderUp, Loader2, MoreHorizontal, Pencil, Search, Star, Tag, Trash2, Upload, X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { collectDropped, readPicked } from '@/docs/dropRead'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Select, TextInput } from '@/components/ui/Field'
import { Badge, Modal, PageHeader } from '@/components/ui/misc'
import type { InputFile } from '@/docs/unpack'
import { T, Tf } from '@/i18n'
import { fmtDateTime } from '@/lib/format'
import { toast } from '@/store/toast'
import { storageEstimate } from '../blobs'
import { FilePreview } from '../components/FilePreview'
import { fmtSize } from '../components/format'
import { ARCHIVE_EXT, deleteFiles, deleteFolder, downloadStored, exportZip, extOf, storeFiles, unpackStored } from '../files'
import { PAPER_KIND } from '../model'
import { folderSubtree, useOffice } from '../store'
import type { Folder, StoredFile } from '../types'
import { dateShort } from '../words'

const fail = (e: unknown) => toast(e instanceof Error ? e.message : String(e), { tone: 'error' })
const DRAG_TYPE = 'application/x-tonna-files'

function FileIcon({ name, size = 18 }: { name: string; size?: number }) {
  const e = extOf(name)
  if (ARCHIVE_EXT.has(e)) return <Archive size={size} />
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tif', 'tiff', 'heic'].includes(e)) return <FileImage size={size} />
  if (['xls', 'xlsx', 'ods', 'csv'].includes(e)) return <FileSpreadsheet size={size} />
  if (['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt'].includes(e)) return <FileText size={size} />
  return <File size={size} />
}

/** Folder chooser used by «Переместить». */
function FolderSelect({ value, onChange, exclude }: { value: string | null; onChange(id: string | null): void; exclude?: Set<string> }) {
  const folders = useOffice((s) => s.folders)
  const options: { value: string; label: string }[] = [{ value: '', label: T('Архив (корень)') }]
  const walk = (parent: string | null, depth: number) => {
    for (const f of folders.filter((x) => x.parentId === parent).sort((a, b) => a.name.localeCompare(b.name))) {
      if (exclude?.has(f.id)) continue
      options.push({ value: f.id, label: `${'  '.repeat(depth * 2)}${f.name}` })
      walk(f.id, depth + 1)
    }
  }
  walk(null, 0)
  return <Select value={value ?? ''} onChange={(v) => onChange(v || null)} options={options} />
}

function TreeNode({ folder, depth, current, onDropFiles }: { folder: Folder; depth: number; current: string | null; onDropFiles(ids: string[], folderId: string | null): void }) {
  const folders = useOffice((s) => s.folders)
  const children = folders.filter((f) => f.parentId === folder.id).sort((a, b) => a.name.localeCompare(b.name))
  const inPath = useMemo(() => {
    let cur = current
    while (cur) {
      if (cur === folder.id) return true
      cur = folders.find((f) => f.id === cur)?.parentId ?? null
    }
    return false
  }, [current, folder.id, folders])
  const [open, setOpen] = useState(inPath)
  const [over, setOver] = useState(false)
  const [wasInPath, setWasInPath] = useState(inPath)
  if (inPath !== wasInPath) {
    // Expand when navigation enters this branch (e.g. via breadcrumbs or a link).
    setWasInPath(inPath)
    if (inPath) setOpen(true)
  }
  return (
    <li>
      <div
        className={`group flex items-center rounded-lg pr-1 text-sm ${current === folder.id ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : over ? 'bg-zinc-200 dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/70'}`}
        style={{ paddingLeft: depth * 12 }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DRAG_TYPE)) {
            e.preventDefault()
            setOver(true)
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          setOver(false)
          const ids = e.dataTransfer.getData(DRAG_TYPE)
          if (ids) {
            e.preventDefault()
            onDropFiles(JSON.parse(ids), folder.id)
          }
        }}
      >
        <button className={`flex h-7 w-6 shrink-0 items-center justify-center ${children.length ? '' : 'invisible'}`} onClick={() => setOpen(!open)} aria-label={open ? T('Свернуть') : T('Развернуть')}>
          <ChevronRight size={14} className={`transition ${open ? 'rotate-90' : ''}`} />
        </button>
        <Link to={`/office/files?folder=${folder.id}`} className="flex min-w-0 flex-1 items-center gap-2 py-1.5">
          <FolderIcon size={15} className="shrink-0" />
          <span className="truncate">{folder.name}</span>
        </Link>
      </div>
      {open && children.length > 0 && (
        <ul>
          {children.map((c) => <TreeNode key={c.id} folder={c} depth={depth + 1} current={current} onDropFiles={onDropFiles} />)}
        </ul>
      )}
    </li>
  )
}

function PropsDialog({ file, onClose }: { file: StoredFile; onClose(): void }) {
  const { patchFile } = useOffice.getState()
  const contracts = useOffice((s) => s.contracts)
  const papers = useOffice((s) => s.papers)
  const cps = useOffice((s) => s.counterparties)
  const [name, setName] = useState(file.name)
  const [tags, setTags] = useState(file.tags.join(', '))
  const [note, setNote] = useState(file.note)
  const [folderId, setFolderId] = useState(file.folderId)
  const [contractId, setContractId] = useState(file.contractId ?? '')
  const [paperId, setPaperId] = useState(file.paperId ?? '')
  const [cpId, setCpId] = useState(file.counterpartyId ?? '')
  const save = () => {
    patchFile(file.id, {
      name: name.trim() || file.name,
      tags: tags.split(',').map((x) => x.trim()).filter(Boolean),
      note,
      folderId,
      contractId: contractId || undefined,
      paperId: paperId || undefined,
      counterpartyId: cpId || undefined,
    })
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={T('Свойства файла')}
      footer={
        <>
          <Button onClick={onClose}>{T('Отмена')}</Button>
          <Button variant="primary" onClick={save}>{T('Сохранить')}</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label={T('Имя файла')} htmlFor="fp-name"><TextInput id="fp-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={T('Папка')}><FolderSelect value={folderId} onChange={setFolderId} /></Field>
        <Field label={T('Метки')} htmlFor="fp-tags" hint={T('Через запятую: «скан, подписано, 2026»')}><TextInput id="fp-tags" value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
        <Field label={T('Описание')} htmlFor="fp-note"><textarea id="fp-note" className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={T('Договор')}>
            <Select value={contractId} onChange={setContractId} options={[{ value: '', label: '—' }, ...contracts.map((c) => ({ value: c.id, label: `№ ${c.number}` }))]} />
          </Field>
          <Field label={T('Счёт / акт')}>
            <Select value={paperId} onChange={setPaperId} options={[{ value: '', label: '—' }, ...papers.map((p) => ({ value: p.id, label: `${PAPER_KIND[p.kind].short} № ${p.number}` }))]} />
          </Field>
          <Field label={T('Контрагент')}>
            <Select value={cpId} onChange={setCpId} options={[{ value: '', label: '—' }, ...cps.map((c) => ({ value: c.id, label: c.name || T('Без названия') }))]} />
          </Field>
        </div>
        <p className="text-xs text-zinc-500">{Tf('Загружен {0} · {1}', [fmtDateTime(file.createdAt), fmtSize(file.size)])}</p>
      </div>
    </Modal>
  )
}

function RowMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <IconButton label={T('Действия')} onClick={() => setOpen(!open)}><MoreHorizontal size={16} /></IconButton>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

const MenuItem = ({ icon, children, onClick, danger }: { icon: ReactNode; children: ReactNode; onClick(): void; danger?: boolean }) => (
  <button onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${danger ? 'text-red-600 dark:text-red-400' : ''}`}>
    {icon}
    {children}
  </button>
)

export function FilesPage() {
  const files = useOffice((s) => s.files)
  const folders = useOffice((s) => s.folders)
  const contracts = useOffice((s) => s.contracts)
  const papers = useOffice((s) => s.papers)
  const cps = useOffice((s) => s.counterparties)
  const { addFolder, patchFolder, patchFile, moveFiles } = useOffice.getState()
  const [params, setParams] = useSearchParams()
  const folderId = params.get('folder')
  const view = params.get('view') as 'starred' | 'recent' | null
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState('')
  const [dropOver, setDropOver] = useState(false)
  const [preview, setPreview] = useState<StoredFile | null>(null)
  const [props, setProps] = useState<StoredFile | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveTo, setMoveTo] = useState<string | null>(null)
  const [newFolder, setNewFolder] = useState<string | null>(null)
  const [rename, setRename] = useState<Folder | null>(null)
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null)
  const filesInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    storageEstimate().then(setUsage)
  }, [files.length])
  const place = `${folderId}|${view}`
  const [selPlace, setSelPlace] = useState(place)
  if (place !== selPlace) {
    setSelPlace(place)
    setSelected(new Set())
  }

  const current = folders.find((f) => f.id === folderId) ?? null
  const crumbs = useMemo(() => {
    const out: Folder[] = []
    let cur = current
    while (cur) {
      out.unshift(cur)
      cur = folders.find((f) => f.id === cur!.parentId) ?? null
    }
    return out
  }, [current, folders])

  const allTags = useMemo(() => [...new Set(files.flatMap((f) => f.tags))].sort(), [files])
  const contractNo = useMemo(() => new Map(contracts.map((c) => [c.id, c.number])), [contracts])
  const paperName = useMemo(() => new Map(papers.map((p) => [p.id, `${PAPER_KIND[p.kind].short} № ${p.number}`])), [papers])
  const cpName = useMemo(() => new Map(cps.map((c) => [c.id, c.name])), [cps])
  const searching = q.trim() !== '' || tag !== ''

  const subfolders = searching || view ? [] : folders.filter((f) => f.parentId === (current?.id ?? null)).sort((a, b) => a.name.localeCompare(b.name))
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    let list = files
    if (searching) {
      list = list.filter(
        (f) =>
          (!tag || f.tags.includes(tag)) &&
          (!s || [f.name, f.note, ...f.tags, contractNo.get(f.contractId ?? '') ?? '', cpName.get(f.counterpartyId ?? '') ?? ''].join(' ').toLowerCase().includes(s)),
      )
    } else if (view === 'starred') list = list.filter((f) => f.starred)
    else if (view === 'recent') list = [...list].sort((a, b) => b.createdAt - a.createdAt).slice(0, 50)
    else list = list.filter((f) => f.folderId === (current?.id ?? null))
    return view === 'recent' ? list : [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [files, searching, q, tag, view, current, contractNo, cpName])

  const folderCount = (id: string) => {
    const tree = folderSubtree(folders, id)
    return files.filter((f) => f.folderId && tree.has(f.folderId)).length
  }

  const upload = async (inputs: InputFile[]) => {
    if (!inputs.length) return
    setBusy(Tf('Сохраняем {0} файлов…', [inputs.length]))
    try {
      await storeFiles(inputs, current?.id ?? null)
      toast(Tf('Загружено файлов: {0}', [inputs.length]))
    } catch (e) {
      fail(e)
    } finally {
      setBusy('')
    }
  }

  const onDrop = async (e: DragEvent) => {
    setDropOver(false)
    if (e.dataTransfer.types.includes(DRAG_TYPE)) return
    e.preventDefault()
    upload(await collectDropped(e.dataTransfer))
  }

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  const sel = [...selected].filter((id) => files.some((f) => f.id === id))

  const removeSelected = async () => {
    if (!confirm(Tf('Удалить файлы ({0})? Это нельзя отменить.', [sel.length]))) return
    await deleteFiles(sel)
    setSelected(new Set())
  }

  const unpack = async (f: StoredFile) => {
    setBusy(Tf('Распаковка {0}', [f.name]))
    try {
      const r = await unpackStored(f)
      toast(Tf('Распаковано файлов: {0}', [r.count]))
      for (const w of r.warnings.slice(0, 3)) toast(w, { tone: 'error' })
      if (r.folderId) setParams({ folder: r.folderId })
    } catch (e) {
      fail(e)
    } finally {
      setBusy('')
    }
  }

  const navItem = (to: string, active: boolean, icon: ReactNode, label: string, count?: number) => (
    <Link
      to={to}
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${active ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/70'}`}
      onDragOver={(e) => to === '/office/files' && e.dataTransfer.types.includes(DRAG_TYPE) && e.preventDefault()}
      onDrop={(e) => {
        const ids = e.dataTransfer.getData(DRAG_TYPE)
        if (ids && to === '/office/files') {
          e.preventDefault()
          moveFiles(JSON.parse(ids), null)
        }
      }}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {count ? <span className="text-xs tabular-nums opacity-60">{count}</span> : null}
    </Link>
  )

  return (
    <div>
      <PageHeader
        title={T('Архив файлов')}
        subtitle={T('Храните документы по папкам: договоры, сканы, чертежи, письма. Файлы лежат в этом браузере и доступны без интернета.')}
        actions={
          <>
            <input ref={filesInput} type="file" multiple hidden onChange={async (e) => { if (e.target.files) upload(await readPicked(e.target.files)); e.target.value = '' }} />
            <input ref={folderInput} type="file" multiple hidden {...{ webkitdirectory: '' }} onChange={async (e) => { if (e.target.files) upload(await readPicked(e.target.files)); e.target.value = '' }} />
            <Button onClick={() => setNewFolder('')}><FolderPlus size={16} /> {T('Новая папка')}</Button>
            <Button onClick={() => folderInput.current?.click()}><FolderUp size={16} /> {T('Загрузить папку')}</Button>
            <Button variant="primary" onClick={() => filesInput.current?.click()}><Upload size={16} /> {T('Загрузить файлы')}</Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="card p-2">
            {navItem('/office/files', !folderId && !view, <Archive size={15} />, T('Все папки'), files.length)}
            {navItem('/office/files?view=recent', view === 'recent', <Clock size={15} />, T('Недавние'))}
            {navItem('/office/files?view=starred', view === 'starred', <Star size={15} />, T('Избранное'), files.filter((f) => f.starred).length)}
            {folders.some((f) => !f.parentId) && <div className="my-2 h-px bg-zinc-200 dark:bg-zinc-800" />}
            <ul>
              {folders.filter((f) => !f.parentId).sort((a, b) => a.name.localeCompare(b.name)).map((f) => (
                <TreeNode key={f.id} folder={f} depth={0} current={folderId} onDropFiles={(ids, to) => { moveFiles(ids, to); toast(Tf('Перемещено: {0}', [ids.length])) }} />
              ))}
            </ul>
          </div>
          {allTags.length > 0 && (
            <div className="card p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-500"><Tag size={13} /> {T('Метки')}</div>
              <div className="flex flex-wrap gap-1">
                {allTags.map((t) => (
                  <button key={t} onClick={() => setTag(tag === t ? '' : t)} className={`rounded-md px-2 py-0.5 text-xs ${tag === t ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          {usage && (
            <div className="px-1 text-xs text-zinc-500">
              {Tf('Занято {0} из {1}', [fmtSize(usage.usage), fmtSize(usage.quota)])}
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div className="h-full bg-zinc-500" style={{ width: `${Math.min(100, (usage.usage / Math.max(1, usage.quota)) * 100)}%` }} />
              </div>
            </div>
          )}
        </aside>

        <div
          className={`min-w-0 rounded-2xl transition ${dropOver ? 'ring-2 ring-zinc-900 ring-offset-4 dark:ring-white dark:ring-offset-zinc-950' : ''}`}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(DRAG_TYPE) && e.dataTransfer.types.includes('Files')) {
              e.preventDefault()
              setDropOver(true)
            }
          }}
          onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropOver(false)}
          onDrop={onDrop}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
              <Link to="/office/files" className="font-medium hover:underline">{view === 'starred' ? T('Избранное') : view === 'recent' ? T('Недавние') : T('Архив')}</Link>
              {crumbs.map((c) => (
                <span key={c.id} className="flex items-center gap-1">
                  <ChevronRight size={14} className="text-zinc-400" />
                  <Link to={`/office/files?folder=${c.id}`} className="hover:underline">{c.name}</Link>
                </span>
              ))}
              {current && (
                <RowMenu>
                  <MenuItem icon={<Pencil size={15} />} onClick={() => setRename(current)}>{T('Переименовать папку')}</MenuItem>
                  <MenuItem icon={<Download size={15} />} onClick={() => exportZip(current.id, current.name).catch(fail)}>{T('Скачать папку (ZIP)')}</MenuItem>
                  <MenuItem
                    icon={<Trash2 size={15} />}
                    danger
                    onClick={async () => {
                      const n = folderCount(current.id)
                      if (!confirm(n ? Tf('Удалить папку «{0}» вместе с файлами ({1})?', [current.name, n]) : Tf('Удалить папку «{0}»?', [current.name]))) return
                      const parent = current.parentId
                      await deleteFolder(current.id)
                      setParams(parent ? { folder: parent } : {})
                    }}
                  >
                    {T('Удалить папку')}
                  </MenuItem>
                </RowMenu>
              )}
            </nav>
            <div className="relative w-full sm:w-72">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
              <TextInput className="pl-9" value={q} placeholder={T('Поиск по всем файлам…')} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Button onClick={() => exportZip(null).catch(fail)} disabled={!files.length} title={T('Скачать весь архив одним ZIP — резервная копия')}><Download size={16} /> ZIP</Button>
          </div>

          {busy && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <Loader2 size={16} className="animate-spin" /> {busy}
            </div>
          )}

          {sel.length > 0 && (
            <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-zinc-900 p-2 pl-4 text-sm text-white shadow-lg lg:top-2 dark:bg-white dark:text-zinc-900">
              <span className="flex-1">{Tf('Выбрано: {0}', [sel.length])}</span>
              <Button size="sm" onClick={() => { setMoveTo(current?.id ?? null); setMoveOpen(true) }}><FolderInput size={15} /> {T('Переместить')}</Button>
              <Button size="sm" onClick={() => Promise.all(files.filter((f) => selected.has(f.id)).map((f) => downloadStored(f))).catch(fail)}><Download size={15} /> {T('Скачать')}</Button>
              <Button size="sm" variant="danger" className="bg-white dark:bg-zinc-100" onClick={removeSelected}><Trash2 size={15} /> {T('Удалить')}</Button>
              <IconButton label={T('Снять выделение')} className="text-current hover:bg-white/10" onClick={() => setSelected(new Set())}><X size={16} /></IconButton>
            </div>
          )}

          {subfolders.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {subfolders.map((f) => (
                <Link
                  key={f.id}
                  to={`/office/files?folder=${f.id}`}
                  className="card lift flex items-center gap-3 p-3"
                  onDragOver={(e) => e.dataTransfer.types.includes(DRAG_TYPE) && e.preventDefault()}
                  onDrop={(e) => {
                    const ids = e.dataTransfer.getData(DRAG_TYPE)
                    if (ids) {
                      e.preventDefault()
                      moveFiles(JSON.parse(ids), f.id)
                      toast(Tf('Перемещено: {0}', [JSON.parse(ids).length]))
                    }
                  }}
                >
                  <FolderIcon size={22} className="shrink-0 text-zinc-400" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-zinc-500">{Tf('{0} файлов', [folderCount(f.id)])}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {shown.length === 0 && subfolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
              <Upload size={30} className="mb-3 text-zinc-400" />
              <h3 className="font-medium">{searching ? T('Ничего не найдено') : view === 'starred' ? T('В избранном пусто') : T('Здесь пока пусто')}</h3>
              {!searching && !view && <p className="mt-1 max-w-md text-sm text-zinc-500">{T('Перетащите сюда файлы или целую папку — структура папок сохранится. Архивы ZIP/RAR/7z можно распаковать прямо здесь.')}</p>}
            </div>
          ) : shown.length > 0 ? (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                    <th className="w-10 px-3 py-2">
                      <input type="checkbox" aria-label={T('Выбрать все')} checked={shown.length > 0 && shown.every((f) => selected.has(f.id))} onChange={(e) => setSelected(e.target.checked ? new Set(shown.map((f) => f.id)) : new Set())} />
                    </th>
                    <th className="px-2 py-2 font-medium">{T('Имя')}</th>
                    <th className="hidden px-2 py-2 font-medium md:table-cell">{T('Связи')}</th>
                    <th className="hidden w-24 px-2 py-2 text-right font-medium sm:table-cell">{T('Размер')}</th>
                    <th className="hidden w-28 px-2 py-2 font-medium lg:table-cell">{T('Добавлен')}</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((f) => {
                    const folderName = searching || view ? folders.find((x) => x.id === f.folderId)?.name : null
                    return (
                      <tr
                        key={f.id}
                        draggable
                        onDragStart={(e) => {
                          const ids = selected.has(f.id) ? sel : [f.id]
                          e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(ids))
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        className={`border-b border-zinc-100 last:border-0 dark:border-zinc-800/70 ${selected.has(f.id) ? 'bg-zinc-100 dark:bg-zinc-800/60' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'}`}
                      >
                        <td className="px-3 py-2"><input type="checkbox" aria-label={f.name} checked={selected.has(f.id)} onChange={() => toggle(f.id)} /></td>
                        <td className="max-w-0 px-2 py-2">
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 text-zinc-400"><FileIcon name={f.name} /></span>
                            <button className="min-w-0 truncate text-left font-medium hover:underline" onClick={() => setPreview(f)} title={f.name}>{f.name}</button>
                            {f.starred && <Star size={13} className="shrink-0 fill-current text-accent-600" />}
                          </div>
                          {(f.tags.length > 0 || folderName || f.note) && (
                            <div className="mt-1 flex flex-wrap items-center gap-1 pl-7 text-xs text-zinc-500">
                              {folderName && <span className="flex items-center gap-1"><FolderIcon size={11} /> {folderName}</span>}
                              {f.tags.map((t) => <Badge key={t}>{t}</Badge>)}
                              {f.note && <span className="truncate">{f.note}</span>}
                            </div>
                          )}
                        </td>
                        <td className="hidden px-2 py-2 md:table-cell">
                          <div className="flex flex-wrap gap-1 text-xs">
                            {f.contractId && contractNo.has(f.contractId) && <Link className="rounded bg-zinc-100 px-1.5 py-0.5 hover:underline dark:bg-zinc-800" to={`/office/contracts/${f.contractId}`}>{Tf('Договор № {0}', [contractNo.get(f.contractId)])}</Link>}
                            {f.paperId && paperName.has(f.paperId) && <Link className="rounded bg-zinc-100 px-1.5 py-0.5 hover:underline dark:bg-zinc-800" to={`/office/papers/${f.paperId}`}>{paperName.get(f.paperId)}</Link>}
                            {f.counterpartyId && cpName.has(f.counterpartyId) && <Link className="max-w-40 truncate rounded bg-zinc-100 px-1.5 py-0.5 hover:underline dark:bg-zinc-800" to={`/office/counterparties/${f.counterpartyId}`}>{cpName.get(f.counterpartyId)}</Link>}
                          </div>
                        </td>
                        <td className="hidden px-2 py-2 text-right text-xs text-zinc-500 tabular-nums sm:table-cell">{fmtSize(f.size)}</td>
                        <td className="hidden px-2 py-2 text-xs text-zinc-500 lg:table-cell">{dateShort(new Date(f.createdAt).toISOString())}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-end">
                            <IconButton label={f.starred ? T('Убрать из избранного') : T('В избранное')} onClick={() => patchFile(f.id, { starred: !f.starred })}>
                              <Star size={15} className={f.starred ? 'fill-current' : ''} />
                            </IconButton>
                            <RowMenu>
                              <MenuItem icon={<Pencil size={15} />} onClick={() => setProps(f)}>{T('Свойства и метки')}</MenuItem>
                              <MenuItem icon={<Download size={15} />} onClick={() => downloadStored(f).catch(fail)}>{T('Скачать')}</MenuItem>
                              <MenuItem icon={<FolderInput size={15} />} onClick={() => { setSelected(new Set([f.id])); setMoveTo(f.folderId); setMoveOpen(true) }}>{T('Переместить')}</MenuItem>
                              {ARCHIVE_EXT.has(extOf(f.name)) && <MenuItem icon={<Archive size={15} />} onClick={() => unpack(f)}>{T('Распаковать в папку')}</MenuItem>}
                              <MenuItem icon={<Trash2 size={15} />} danger onClick={() => { if (confirm(Tf('Удалить «{0}»?', [f.name]))) deleteFiles([f.id]) }}>{T('Удалить')}</MenuItem>
                            </RowMenu>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          {!busy && (shown.length > 0 || subfolders.length > 0) && <p className="mt-3 text-center text-xs text-zinc-400">{T('Перетащите файлы с компьютера в эту область, чтобы загрузить их в текущую папку. Строки можно перетаскивать на папки.')}</p>}
        </div>
      </div>

      <FilePreview file={preview} onClose={() => setPreview(null)} />
      {props && <PropsDialog file={props} onClose={() => setProps(null)} />}
      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title={T('Переместить в папку')}
        footer={
          <>
            <Button onClick={() => setMoveOpen(false)}>{T('Отмена')}</Button>
            <Button variant="primary" onClick={() => { moveFiles(sel, moveTo); setMoveOpen(false); setSelected(new Set()); toast(Tf('Перемещено: {0}', [sel.length])) }}>{T('Переместить')}</Button>
          </>
        }
      >
        <FolderSelect value={moveTo} onChange={setMoveTo} />
      </Modal>
      <Modal
        open={newFolder !== null}
        onClose={() => setNewFolder(null)}
        title={current ? Tf('Новая папка в «{0}»', [current.name]) : T('Новая папка')}
        footer={
          <>
            <Button onClick={() => setNewFolder(null)}>{T('Отмена')}</Button>
            <Button variant="primary" disabled={!newFolder?.trim()} onClick={() => { const id = addFolder(newFolder!.trim(), current?.id ?? null); setNewFolder(null); setParams({ folder: id }) }}>{T('Создать')}</Button>
          </>
        }
      >
        <TextInput autoFocus aria-label={T('Название папки')} value={newFolder ?? ''} placeholder={T('Например: Договоры 2026')} onChange={(e) => setNewFolder(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newFolder?.trim()) { const id = addFolder(newFolder.trim(), current?.id ?? null); setNewFolder(null); setParams({ folder: id }) } }} />
      </Modal>
      {rename && (
        <Modal
          open
          onClose={() => setRename(null)}
          title={T('Переименовать папку')}
          footer={
            <>
              <Button onClick={() => setRename(null)}>{T('Отмена')}</Button>
              <Button variant="primary" onClick={() => { patchFolder(rename.id, { name: rename.name.trim() || T('Папка'), parentId: rename.parentId }); setRename(null) }}>{T('Сохранить')}</Button>
            </>
          }
        >
          <div className="grid gap-4">
            <TextInput autoFocus aria-label={T('Название папки')} value={rename.name} onChange={(e) => setRename({ ...rename, name: e.target.value })} />
            <Field label={T('Внутри папки')}>
              <FolderSelect value={rename.parentId} exclude={folderSubtree(folders, rename.id)} onChange={(v) => setRename({ ...rename, parentId: v })} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
