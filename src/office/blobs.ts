/**
 * File contents of the archive, kept in IndexedDB (localStorage is far too small for files).
 * Metadata (names, folders, tags) lives in the office store.
 */
const DB_NAME = 'tonna-files'
const STORE = 'blobs'

let dbPromise: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(STORE, mode)
        const req = fn(tx.objectStore(STORE))
        tx.oncomplete = () => resolve(req.result)
        tx.onerror = () => reject(tx.error ?? req.error)
        tx.onabort = () => reject(tx.error ?? new Error('aborted'))
      }),
  )
}

export function putBlob(id: string, blob: Blob): Promise<IDBValidKey> {
  return run('readwrite', (s) => s.put(blob, id))
}

export function getBlob(id: string): Promise<Blob | undefined> {
  return run<Blob | undefined>('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>)
}

export function deleteBlob(id: string): Promise<undefined> {
  return run('readwrite', (s) => s.delete(id))
}

export function blobKeys(): Promise<IDBValidKey[]> {
  return run('readonly', (s) => s.getAllKeys())
}

/** Asks the browser not to evict stored files under storage pressure. */
export async function requestPersist(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate()
    return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : null
  } catch {
    return null
  }
}
