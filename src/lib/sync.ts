/**
 * Sync engine: keeps the local stores (which stay the source of truth for the UI and work offline)
 * in step with the company workspace on the server.
 */
import { create } from 'zustand'
import { apiFetch, ApiError, type ApiRecord } from './api'
import type { Estimate } from './estimate'
import { conflictCopy, diffEstimates, mergeRemote } from './syncCore'
import { useAuth } from '@/store/auth'
import { useEstimates } from '@/store/estimates'
import { useMetalCost } from '@/store/metalCost'
import { usePrices } from '@/store/prices'
import { useSettings } from '@/store/settings'
import { toast } from '@/store/toast'

interface SyncMeta {
  workspaceId: string | null
  since: number
  versions: Record<string, number>
  dirty: string[]
  deleted: string[]
  docVersions: Record<string, number>
  dirtyDocs: string[]
}

const EMPTY: SyncMeta = { workspaceId: null, since: 0, versions: {}, dirty: [], deleted: [], docVersions: {}, dirtyDocs: [] }
const META_KEY = 'sr-sync'

function loadMeta(): SyncMeta {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(META_KEY) ?? '{}') }
  } catch {
    return { ...EMPTY }
  }
}

let meta = loadMeta()
const saveMeta = () => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    /* storage full or disabled: sync still works for this session */
  }
}

type Status = 'off' | 'idle' | 'syncing' | 'offline' | 'error'
export const useSyncStatus = create<{ status: Status; lastSync: number | null; error: string | null }>(() => ({ status: 'off', lastSync: null, error: null }))

/** Shared workspace documents and how they map onto local stores. */
const DOCS = {
  prices: {
    get: () => ({ overrides: usePrices.getState().overrides, custom: usePrices.getState().custom }),
    set: (d: unknown) => usePrices.setState(d as object),
    subscribe: (fn: () => void) => usePrices.subscribe((s, p) => (s.overrides !== p.overrides || s.custom !== p.custom) && fn()),
  },
  company: {
    get: () => useSettings.getState().company,
    set: (d: unknown) => useSettings.setState({ company: d as never }),
    subscribe: (fn: () => void) => useSettings.subscribe((s, p) => s.company !== p.company && fn()),
  },
  estimateDefaults: {
    get: () => useSettings.getState().estimateDefaults,
    set: (d: unknown) => useSettings.setState({ estimateDefaults: d as never }),
    subscribe: (fn: () => void) => useSettings.subscribe((s, p) => s.estimateDefaults !== p.estimateDefaults && fn()),
  },
  metalCost: {
    get: () => useMetalCost.getState().settings,
    set: (d: unknown) => useMetalCost.setState({ settings: d as never }),
    subscribe: (fn: () => void) => useMetalCost.subscribe((s, p) => s.settings !== p.settings && fn()),
  },
} as const
type DocKey = keyof typeof DOCS

let applying = false
let running = false
let pending = false
let pushTimer: ReturnType<typeof setTimeout> | undefined
let pollTimer: ReturnType<typeof setInterval> | undefined
let unsubs: (() => void)[] = []

const auth = () => useAuth.getState()
const call = <T>(path: string, method = 'GET', body?: unknown) => apiFetch<T>(auth().apiUrl, path, { method, token: auth().token, body })

function applyLocal(fn: () => void) {
  applying = true
  try {
    fn()
  } finally {
    applying = false
  }
}

function schedulePush() {
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void syncNow(), 1200)
}

async function pushEstimates() {
  for (const id of [...meta.deleted]) {
    await call(`/api/estimates/${id}`, 'DELETE')
    delete meta.versions[id]
    meta.deleted = meta.deleted.filter((x) => x !== id)
    saveMeta()
  }
  for (const id of [...meta.dirty]) {
    const e = useEstimates.getState().estimates.find((x) => x.id === id)
    if (!e) {
      meta.dirty = meta.dirty.filter((x) => x !== id)
      continue
    }
    try {
      const r = await call<ApiRecord>(`/api/estimates/${id}`, 'PUT', { version: meta.versions[id] ?? 0, data: e })
      meta.versions[id] = r.version
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 409) throw err
      const current = err.body.current as ApiRecord<Estimate>
      // Someone else saved first: their version takes the slot, ours becomes a copy.
      const copy = conflictCopy(e)
      applyLocal(() =>
        useEstimates.setState((s) => ({
          estimates: [copy, ...s.estimates.filter((x) => x.id !== id || !current.deleted).map((x) => (x.id === id && current.data ? { ...current.data, id } : x))],
        })),
      )
      meta.versions[id] = current.version
      meta.dirty.push(copy.id)
      toast(`Смету «${e.name}» одновременно изменил ${current.updatedBy}. Ваша версия сохранена копией.`, { tone: 'info' })
    }
    meta.dirty = meta.dirty.filter((x) => x !== id)
    saveMeta()
  }
}

async function pullEstimates() {
  const r = await call<{ items: ApiRecord<Estimate>[]; now: number }>(`/api/estimates?since=${meta.since}`)
  if (r.items.length) {
    const merged = mergeRemote(useEstimates.getState().estimates, meta.versions, new Set(meta.dirty), r.items)
    applyLocal(() => useEstimates.setState({ estimates: merged.estimates }))
    meta.versions = merged.versions
    for (const c of merged.conflictCopies) meta.dirty.push(c.id)
    if (merged.conflictCopies.length) toast('Коллеги изменили смету, которую вы правили. Ваша версия сохранена копией.', { tone: 'info' })
  }
  meta.since = r.now
  saveMeta()
}

async function syncDocs() {
  for (const key of Object.keys(DOCS) as DocKey[]) {
    const doc = DOCS[key]
    if (meta.dirtyDocs.includes(key)) {
      try {
        const r = await call<ApiRecord>(`/api/docs/${key}`, 'PUT', { version: meta.docVersions[key] ?? 0, data: doc.get() })
        meta.docVersions[key] = r.version
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 409) throw err
        const current = err.body.current as ApiRecord
        applyLocal(() => doc.set(current.data))
        meta.docVersions[key] = current.version
      }
      meta.dirtyDocs = meta.dirtyDocs.filter((k) => k !== key)
      saveMeta()
      continue
    }
    const r = await call<ApiRecord>(`/api/docs/${key}`)
    if (r.version === 0 && (meta.docVersions[key] ?? 0) === 0) {
      // Empty workspace document: seed it from this device.
      meta.dirtyDocs.push(key)
      pending = true
    } else if (r.version > (meta.docVersions[key] ?? 0) && r.data !== undefined) {
      applyLocal(() => doc.set(r.data))
      meta.docVersions[key] = r.version
    }
    saveMeta()
  }
}

export async function syncNow(): Promise<void> {
  if (!auth().token) return
  if (running) {
    pending = true
    return
  }
  running = true
  useSyncStatus.setState({ status: 'syncing' })
  try {
    await pushEstimates()
    await syncDocs()
    await pullEstimates()
    useSyncStatus.setState({ status: 'idle', lastSync: Date.now(), error: null })
  } catch (err) {
    const e = err instanceof ApiError ? err : new ApiError(0, { error: String(err) })
    if (e.status === 401) {
      await auth().logout()
      stopSync()
      toast('Сессия истекла — войдите снова', { tone: 'error', action: { label: 'Войти', to: '/account' } })
    }
    useSyncStatus.setState({ status: e.status === 0 ? 'offline' : 'error', error: e.message })
  } finally {
    running = false
    if (pending) {
      pending = false
      schedulePush()
    }
  }
}

const onFocus = () => void syncNow()

export function startSync() {
  stopSync()
  const ws = auth().workspace
  if (!auth().token || !ws) return
  if (meta.workspaceId !== ws.id) {
    // First sync with this company: upload what is already on this device.
    meta = { ...EMPTY, workspaceId: ws.id, dirty: useEstimates.getState().estimates.map((e) => e.id) }
    saveMeta()
  }
  unsubs.push(
    useEstimates.subscribe((s, p) => {
      if (applying || s.estimates === p.estimates) return
      const { changed, removed } = diffEstimates(p.estimates, s.estimates)
      meta.dirty = [...new Set([...meta.dirty, ...changed])]
      meta.deleted = [...new Set([...meta.deleted, ...removed.filter((id) => meta.versions[id])])]
      meta.dirty = meta.dirty.filter((id) => !removed.includes(id))
      saveMeta()
      schedulePush()
    }),
  )
  for (const key of Object.keys(DOCS) as DocKey[]) {
    unsubs.push(
      DOCS[key].subscribe(() => {
        if (applying) return
        if (!meta.dirtyDocs.includes(key)) meta.dirtyDocs.push(key)
        saveMeta()
        schedulePush()
      }),
    )
  }
  pollTimer = setInterval(() => void syncNow(), 15000)
  window.addEventListener('focus', onFocus)
  window.addEventListener('online', onFocus)
  useSyncStatus.setState({ status: 'idle' })
  void syncNow()
}

export function stopSync() {
  unsubs.forEach((u) => u())
  unsubs = []
  clearInterval(pollTimer)
  clearTimeout(pushTimer)
  window.removeEventListener('focus', onFocus)
  window.removeEventListener('online', onFocus)
  useSyncStatus.setState({ status: 'off' })
}

/** Logout: estimates live on the server, so the device copy and sync state are cleared. */
export function resetSyncData() {
  meta = { ...EMPTY }
  saveMeta()
  useEstimates.setState({ estimates: [], lastId: null })
}
