import {
  ArrowRight, Building2, Check, ChevronDown, CircleAlert, CloudOff, Copy, Eye, EyeOff, FileSpreadsheet, KeyRound, Loader2, Lock,
  LogOut, Mail, RefreshCw, Server, ShieldCheck, Tags, Trash2, UserRound, Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { Badge, PageHeader } from '@/components/ui/misc'
import { apiFetch, ApiError } from '@/lib/api'
import { fmtDateTime } from '@/lib/format'
import { resetSyncData, startSync, stopSync, syncNow, useSyncStatus } from '@/lib/sync'
import { useAuth } from '@/store/auth'
import { toast } from '@/store/toast'
import { T, Tf } from '@/i18n'

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
      label={T('Адрес сервера')}
      hint={state === 'ok' ? T('Сервер доступен') : state === 'fail' ? T('Сервер не отвечает — проверьте адрес') : apiUrl ? '' : T('Пусто — сервер на этом же сайте')}
    >
      <div className="relative">
        <Server size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
        <TextInput className="pl-9" placeholder="https://api.example.kz" defaultValue={apiUrl} onBlur={(e) => setApiUrl(e.target.value)} />
      </div>
    </Field>
  )
}

const MODES: { value: Mode; label: string; title: string; text: string; button: string }[] = [
  { value: 'login', label: T('Вход'), title: T('С возвращением'), text: T('Войдите, чтобы открыть сметы и справочники компании.'), button: T('Войти') },
  { value: 'register', label: T('Регистрация'), title: T('Регистрация компании'), text: T('Создайте пространство компании и пригласите сотрудников.'), button: T('Создать компанию') },
  { value: 'join', label: T('По коду'), title: T('Присоединиться к компании'), text: T('Введите код, который выдал владелец компании.'), button: T('Присоединиться') },
]

function IconInput({ icon: Icon, id, type = 'text', right, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { icon: typeof Mail; id: string; right?: React.ReactNode }) {
  return (
    <div className="group relative">
      <Icon size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-400 transition group-focus-within:text-zinc-900 dark:group-focus-within:text-white" />
      <input id={id} type={type} className={`input h-11 rounded-xl pl-10 ${right ? 'pr-11' : ''}`} {...rest} />
      {right && <div className="absolute inset-y-0 right-1.5 flex items-center">{right}</div>}
    </div>
  )
}

function AuthForm() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [f, setF] = useState({ email: '', password: '', name: '', company: '', invite: '' })
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const m = MODES.find((x) => x.value === mode)!
  const switchTo = (v: Mode) => {
    setMode(v)
    setError('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'login') await login(f.email, f.password)
      else await register({ email: f.email, password: f.password, name: f.name, company: mode === 'register' ? f.company : undefined, invite: mode === 'join' ? f.invite : undefined })
      startSync()
      toast(T('Вы вошли. Сметы и справочники синхронизируются с сервером.'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const label = (id: string, text: string) => (
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{text}</label>
  )

  return (
    <div className="mx-auto grid max-w-5xl items-center gap-10 py-4 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1fr_440px] lg:py-0">
      <div className="stagger hidden lg:block">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">{T('Работайте над сметами всей командой')}</h1>
        <p className="mt-3 max-w-md text-zinc-600 dark:text-zinc-400">{T('Один аккаунт компании — общие сметы, цены и реквизиты на любом компьютере и телефоне.')}</p>
        <ul className="mt-8 space-y-4">
          {[
            { icon: FileSpreadsheet, title: T('Общие сметы'), text: T('Сотрудники видят и правят одни и те же сметы, изменения приходят за секунды.') },
            { icon: Tags, title: T('Единый справочник цен'), text: T('Цены и реквизиты компании задаются один раз и подставляются у всех.') },
            { icon: ShieldCheck, title: T('Ничего не теряется'), text: T('Если двое правили одну смету, вторая версия сохраняется копией.') },
          ].map((b) => (
            <li key={b.title} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"><b.icon size={18} /></span>
              <span>
                <span className="block font-medium">{b.title}</span>
                <span className="block text-sm text-zinc-600 dark:text-zinc-400">{b.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="animate-fade-up relative">
        <div className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-xl shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/30">
          <div className="mb-6 flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/80" role="tablist">
            {MODES.map((x) => (
              <button
                key={x.value}
                type="button"
                role="tab"
                aria-selected={mode === x.value}
                onClick={() => switchTo(x.value)}
                className={`flex-1 rounded-lg px-2 py-2 text-[13px] font-medium transition ${mode === x.value ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
              >
                {x.label}
              </button>
            ))}
          </div>

          <div key={mode} className="animate-fade-up">
            <h2 className="text-2xl font-semibold tracking-tight">{m.title}</h2>
            <p className="mt-1 mb-6 text-sm text-zinc-500">{m.text}</p>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'join' && (
                <div>
                  {label('acc-invite', T('Код приглашения'))}
                  <IconInput icon={KeyRound} id="acc-invite" value={f.invite} onChange={set('invite')} placeholder="ABCD-1234" required className="input h-11 rounded-xl pl-10 font-mono tracking-widest uppercase" />
                </div>
              )}
              {mode === 'register' && (
                <div>
                  {label('acc-company', T('Название компании'))}
                  <IconInput icon={Building2} id="acc-company" value={f.company} onChange={set('company')} placeholder={T('ТОО «Каскад»')} required />
                </div>
              )}
              {mode !== 'login' && (
                <div>
                  {label('acc-name', T('Ваше имя'))}
                  <IconInput icon={UserRound} id="acc-name" value={f.name} onChange={set('name')} placeholder={T('Имя Фамилия')} autoComplete="name" required />
                </div>
              )}
              <div>
                {label('acc-email', 'E-mail')}
                <IconInput icon={Mail} id="acc-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} placeholder="name@company.kz" required />
              </div>
              <div>
                {label('acc-password', T('Пароль'))}
                <IconInput
                  icon={Lock}
                  id="acc-password"
                  type={show ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={f.password}
                  onChange={set('password')}
                  minLength={mode === 'login' ? undefined : 8}
                  placeholder={mode === 'login' ? '••••••••' : T('Не короче 8 символов')}
                  required
                  right={
                    <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? T('Скрыть пароль') : T('Показать пароль')} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
              </div>
              {error && (
                <p className="animate-fade-up flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  <CircleAlert size={16} className="mt-0.5 shrink-0" /> {error}
                </p>
              )}
              <Button type="submit" variant="primary" className="h-11 w-full rounded-xl text-[15px]" disabled={busy}>
                {busy ? <Loader2 size={17} className="animate-spin" /> : <>{m.button} <ArrowRight size={16} /></>}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-zinc-500">
              {mode === 'login' ? (
                <>{T('Нет аккаунта?')} <button type="button" onClick={() => switchTo('register')} className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-white">{T('Создать компанию')}</button></>
              ) : (
                <>{T('Уже есть аккаунт?')} <button type="button" onClick={() => switchTo('login')} className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-white">{T('Войти')}</button></>
              )}
            </p>
          </div>
        </div>

        <div className="lg:absolute lg:inset-x-0 lg:top-full">
        <details className="group mt-4 px-2 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            <Server size={14} />  {T('Настройки подключения')}
            <ChevronDown size={14} className="transition group-open:rotate-180" />
          </summary>
          <div className="mt-3">
            <ServerField />
          </div>
        </details>
        <p className="mt-4 px-2 text-xs text-zinc-400">{T('Без входа сайт тоже работает — данные хранятся только в этом браузере.')}</p>
        </div>
      </div>
    </div>
  )
}

function SyncBadge() {
  const { status, lastSync, error } = useSyncStatus()
  const map = {
    off: <Badge>{T('выключена')}</Badge>,
    idle: <Badge tone="green"><Check size={12} />  {T('синхронизировано')}{lastSync ? ` · ${fmtDateTime(lastSync)}` : ''}</Badge>,
    syncing: <Badge tone="blue"><RefreshCw size={12} className="animate-spin" />  {T('синхронизация…')}</Badge>,
    offline: <Badge tone="amber"><CloudOff size={12} />  {T('нет связи — изменения сохранятся и отправятся позже')}</Badge>,
    error: <Badge tone="red">{T('ошибка:')} {error}</Badge>,
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
          <div className="text-sm text-zinc-500">{user.email} · {owner ? T('владелец') : T('сотрудник')}  {T('компании «')}{workspace.name}»</div>
          <div className="mt-2"><SyncBadge /></div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void syncNow()}><RefreshCw size={15} />  {T('Синхронизировать')}</Button>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              if (!confirm(T('Выйти? Сметы останутся на сервере и удалятся с этого устройства.'))) return
              stopSync()
              await logout()
              resetSyncData()
            }}
          >
            <LogOut size={15} />  {T('Выйти')}
          </Button>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold"><Users size={18} />  {T('Сотрудники')}</h2>
        <p className="mb-4 text-sm text-zinc-500">{T('Все сотрудники компании видят общие сметы, справочник цен и реквизиты.')}</p>
        {owner && workspace.inviteCode && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-zinc-500">{T('Код приглашения — передайте сотруднику')}</div>
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
              {copied ? <Check size={15} /> : <Copy size={15} />}  {T('Копировать')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                if (!confirm(T('Выпустить новый код? Старый перестанет работать.'))) return
                await call('/api/workspace/invite', 'POST')
                await refresh()
              }}
            >
              
              {T('Новый код')}
            </Button>
          </div>
        )}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="flex-1">{m.name} <span className="text-zinc-500">· {m.email}</span></span>
              {m.role === 'owner' && <Badge>{T('владелец')}</Badge>}
              {owner && m.role !== 'owner' && (
                <IconButton
                  label={T('Удалить сотрудника')}
                  onClick={async () => {
                    if (!confirm(Tf('Удалить {0} из компании?', [m.name]))) return
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
  if (!token) return <AuthForm />
  return (
    <div>
      <PageHeader title={T('Аккаунт и команда')} subtitle={T('Общие сметы и справочники для всей компании, доступ с любого устройства.')} />
      <Workspace />
    </div>
  )
}
