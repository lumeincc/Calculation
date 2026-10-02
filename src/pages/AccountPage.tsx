import { Check, Cloud, CloudOff, Copy, LogOut, RefreshCw, Server, Trash2, UserRound, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { Badge, PageHeader, Tabs } from '@/components/ui/misc'
import { apiFetch, ApiError } from '@/lib/api'
import { fmtDateTime } from '@/lib/format'
import { resetSyncData, startSync, stopSync, syncNow, useSyncStatus } from '@/lib/sync'
import { useAuth } from '@/store/auth'
import { toast } from '@/store/toast'

type Mode = 'login' | 'register' | 'join'

function ServerField() {
  const apiUrl = useAuth((s) => s.apiUrl)
  const setApiUrl = useAuth((s) => s.setApiUrl)
  const [state, setState] = useState<'unknown' | 'ok' | 'fail'>('unknown')
  useEffect(() => {
    let alive = true
    apiFetch(apiUrl, '/api/health')
      .then(() => alive && setState('ok'))
      .catch(() => alive && setState('fail'))
    return () => {
      alive = false
    }
  }, [apiUrl])
  return (
    <Field
      label="Адрес сервера"
      hint={state === 'ok' ? 'Сервер доступен' : state === 'fail' ? 'Сервер не отвечает — проверьте адрес' : apiUrl ? '' : 'Пусто — сервер на этом же сайте'}
    >
      <div className="relative">
        <Server size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
        <TextInput className="pl-9" placeholder="https://api.example.kz" defaultValue={apiUrl} onBlur={(e) => setApiUrl(e.target.value)} />
      </div>
    </Field>
  )
}

function AuthForm() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [f, setF] = useState({ email: '', password: '', name: '', company: '', invite: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'login') await login(f.email, f.password)
      else await register({ email: f.email, password: f.password, name: f.name, company: mode === 'register' ? f.company : undefined, invite: mode === 'join' ? f.invite : undefined })
      startSync()
      toast('Вы вошли. Сметы и справочники синхронизируются с сервером.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6">
        <Tabs<Mode> value={mode} onChange={(m) => { setMode(m); setError('') }} tabs={[{ value: 'login', label: 'Вход' }, { value: 'register', label: 'Новая компания' }, { value: 'join', label: 'По приглашению' }]} />
        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === 'join' && (
            <Field htmlFor="acc-invite" label="Код приглашения" hint="Его выдаёт владелец компании на этой странице">
              <TextInput id="acc-invite" value={f.invite} onChange={set('invite')} placeholder="ABCD-1234" required className="uppercase" />
            </Field>
          )}
          {mode === 'register' && (
            <Field htmlFor="acc-company" label="Название компании">
              <TextInput id="acc-company" value={f.company} onChange={set('company')} placeholder="ТОО «Каскад»" required />
            </Field>
          )}
          {mode !== 'login' && (
            <Field htmlFor="acc-name" label="Ваше имя">
              <TextInput id="acc-name" value={f.name} onChange={set('name')} placeholder="Имя Фамилия" required />
            </Field>
          )}
          <Field htmlFor="acc-email" label="E-mail">
            <TextInput id="acc-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} required />
          </Field>
          <Field htmlFor="acc-password" label="Пароль" hint={mode !== 'login' ? 'Не короче 8 символов' : undefined}>
            <TextInput id="acc-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} minLength={mode === 'login' ? undefined : 8} required />
          </Field>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <Button type="submit" variant="primary" className="w-full" disabled={busy}>
            {mode === 'login' ? 'Войти' : mode === 'register' ? 'Создать компанию' : 'Присоединиться'}
          </Button>
        </form>
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-zinc-500">Настройки подключения</summary>
        <div className="mt-3">
          <ServerField />
        </div>
      </details>
      <p className="mt-6 text-center text-xs text-zinc-500">Без входа сайт работает как раньше — данные хранятся только в этом браузере.</p>
    </div>
  )
}

function SyncBadge() {
  const { status, lastSync, error } = useSyncStatus()
  const map = {
    off: <Badge>выключена</Badge>,
    idle: <Badge tone="green"><Check size={12} /> синхронизировано{lastSync ? ` · ${fmtDateTime(lastSync)}` : ''}</Badge>,
    syncing: <Badge tone="blue"><RefreshCw size={12} className="animate-spin" /> синхронизация…</Badge>,
    offline: <Badge tone="amber"><CloudOff size={12} /> нет связи — изменения сохранятся и отправятся позже</Badge>,
    error: <Badge tone="red">ошибка: {error}</Badge>,
  }
  return map[status]
}

function Workspace() {
  const { user, workspace, members, apiUrl, token, refresh, logout } = useAuth()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    void refresh().catch(() => {})
  }, [refresh])
  if (!user || !workspace) return null
  const owner = user.role === 'owner'
  const call = (path: string, method: string, body?: unknown) => apiFetch(apiUrl, path, { method, token, body })

  return (
    <div className="max-w-3xl space-y-5">
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800"><UserRound size={22} /></div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{user.name}</div>
          <div className="text-sm text-zinc-500">{user.email} · {owner ? 'владелец' : 'сотрудник'} компании «{workspace.name}»</div>
          <div className="mt-2"><SyncBadge /></div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void syncNow()}><RefreshCw size={15} /> Синхронизировать</Button>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              if (!confirm('Выйти? Сметы останутся на сервере и удалятся с этого устройства.')) return
              stopSync()
              await logout()
              resetSyncData()
            }}
          >
            <LogOut size={15} /> Выйти
          </Button>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold"><Users size={18} /> Сотрудники</h2>
        <p className="mb-4 text-sm text-zinc-500">Все сотрудники компании видят общие сметы, справочник цен и реквизиты.</p>
        {owner && workspace.inviteCode && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-zinc-500">Код приглашения — передайте сотруднику</div>
              <div className="font-mono text-xl font-semibold tracking-widest">{workspace.inviteCode}</div>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(workspace.inviteCode!)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />} Копировать
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                if (!confirm('Выпустить новый код? Старый перестанет работать.')) return
                await call('/api/workspace/invite', 'POST')
                await refresh()
              }}
            >
              Новый код
            </Button>
          </div>
        )}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="flex-1">{m.name} <span className="text-zinc-500">· {m.email}</span></span>
              {m.role === 'owner' && <Badge>владелец</Badge>}
              {owner && m.role !== 'owner' && (
                <IconButton
                  label="Удалить сотрудника"
                  onClick={async () => {
                    if (!confirm(`Удалить ${m.name} из компании?`)) return
                    await call(`/api/workspace/members/${m.id}`, 'DELETE')
                    await refresh()
                  }}
                >
                  <Trash2 size={15} />
                </IconButton>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AccountPage() {
  const token = useAuth((s) => s.token)
  return (
    <div>
      <PageHeader icon={<Cloud size={22} />} title="Аккаунт и команда" subtitle="Общие сметы и справочники для всей компании, доступ с любого устройства." />
      {token ? <Workspace /> : <AuthForm />}
    </div>
  )
}
