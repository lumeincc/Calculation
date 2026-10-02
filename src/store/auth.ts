import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiFetch, DEFAULT_API_URL, type ApiUser, type ApiWorkspace } from '@/lib/api'

interface AuthResponse {
  token: string
  user: ApiUser
  workspace: ApiWorkspace
}

interface AuthState {
  apiUrl: string
  token: string | null
  user: ApiUser | null
  workspace: ApiWorkspace | null
  members: ApiUser[]
  setApiUrl(url: string): void
  login(email: string, password: string): Promise<void>
  register(p: { email: string; password: string; name: string; company?: string; invite?: string }): Promise<void>
  refresh(): Promise<void>
  logout(): Promise<void>
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      apiUrl: DEFAULT_API_URL,
      token: null,
      user: null,
      workspace: null,
      members: [],
      setApiUrl: (url) => set({ apiUrl: url.trim().replace(/\/$/, '') }),
      async login(email, password) {
        const r = await apiFetch<AuthResponse>(get().apiUrl, '/api/auth/login', { method: 'POST', body: { email, password } })
        set({ token: r.token, user: r.user, workspace: r.workspace })
        await get().refresh()
      },
      async register(p) {
        const r = await apiFetch<AuthResponse>(get().apiUrl, '/api/auth/register', { method: 'POST', body: p })
        set({ token: r.token, user: r.user, workspace: r.workspace })
        await get().refresh()
      },
      async refresh() {
        const { apiUrl, token } = get()
        if (!token) return
        const r = await apiFetch<{ user: ApiUser; workspace: ApiWorkspace; members: ApiUser[] }>(apiUrl, '/api/me', { token })
        set({ user: r.user, workspace: r.workspace, members: r.members })
      },
      async logout() {
        const { apiUrl, token } = get()
        if (token) await apiFetch(apiUrl, '/api/auth/logout', { method: 'POST', token }).catch(() => {})
        set({ token: null, user: null, workspace: null, members: [] })
      },
    }),
    { name: 'sr-auth', version: 1, partialize: (s) => ({ apiUrl: s.apiUrl, token: s.token, user: s.user, workspace: s.workspace }) },
  ),
)
