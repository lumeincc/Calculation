/** Minimal client for the СтройРасчёт server API. */
export class ApiError extends Error {
  status: number
  body: Record<string, unknown>
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === 'string' ? body.error : `Ошибка сервера (${status})`)
    this.status = status
    this.body = body
  }
}

export interface ApiUser {
  id: string
  email: string
  name: string
  workspaceId: string
  role: 'owner' | 'member'
}

export interface ApiWorkspace {
  id: string
  name: string
  inviteCode?: string
}

export interface ApiRecord<T = unknown> {
  id: string
  version: number
  updatedAt: number
  updatedBy: string
  deleted?: boolean
  data?: T
}

/** Server address: build-time VITE_API_URL, otherwise the same origin (site served by the server). */
export const DEFAULT_API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export async function apiFetch<T>(base: string, path: string, opts: { method?: string; token?: string | null; body?: unknown } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${base}${path}`, {
      method: opts.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
  } catch {
    throw new ApiError(0, { error: 'Нет связи с сервером' })
  }
  const text = await res.text()
  let body: Record<string, unknown> = {}
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { error: res.ok ? undefined : 'Сервер недоступен по этому адресу' }
  }
  if (!res.ok) throw new ApiError(res.status, body)
  return body as T
}
