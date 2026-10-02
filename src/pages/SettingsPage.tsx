import { Download, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, NumberInput, Segmented, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/misc'
import type { VatMode } from '@/lib/estimate'
import { exportBackup, importBackup } from '@/lib/export'
import { useSettings, type Company, type Theme } from '@/store/settings'
import { toast } from '@/store/toast'
import { LANGS, lang, setLang, T, type Lang } from '@/i18n'

const COMPANY_FIELDS: [keyof Company, string, string][] = [
  ['name', T('Организация / ИП'), T('ООО «Строймонтаж»')],
  ['inn', T('ИНН'), '7700000000'],
  ['address', T('Адрес'), T('г. Москва, ул. Строителей, 1')],
  ['phone', T('Телефон'), '+7 900 000-00-00'],
  ['email', 'E-mail', 'info@example.ru'],
  ['signer', T('Подписант'), T('Директор Иванов И. И.')],
]

export function SettingsPage() {
  const { theme, setTheme, company, setCompany, estimateDefaults: d, setEstimateDefaults } = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="max-w-3xl">
      <PageHeader title={T('Настройки')} />
      <div className="space-y-6">
        <section className="card p-5">
          <h2 className="mb-1 font-semibold">{T('Реквизиты исполнителя')}</h2>
          <p className="mb-4 text-sm text-zinc-500">{T('Печатаются в шапке смет и коммерческих предложений.')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {COMPANY_FIELDS.map(([k, label, ph]) => (
              <Field key={k} label={label}>
                <TextInput value={company[k]} placeholder={ph} onChange={(e) => setCompany({ [k]: e.target.value })} />
              </Field>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-1 font-semibold">{T('Начисления для новых смет')}</h2>
          <p className="mb-4 text-sm text-zinc-500">{T('В каждой смете их можно изменить отдельно.')}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={T('Наценка на материалы')}><NumberInput unit="%" value={d.materialsMarkupPct} onChange={(v) => setEstimateDefaults({ materialsMarkupPct: v })} /></Field>
            <Field label={T('Накладные расходы')}><NumberInput unit="%" value={d.overheadPct} onChange={(v) => setEstimateDefaults({ overheadPct: v })} /></Field>
            <Field label={T('Сметная прибыль')}><NumberInput unit="%" value={d.profitPct} onChange={(v) => setEstimateDefaults({ profitPct: v })} /></Field>
            <Field label={T('Непредвиденные')}><NumberInput unit="%" value={d.contingencyPct} onChange={(v) => setEstimateDefaults({ contingencyPct: v })} /></Field>
            <Field label={T('Ставка НДС')}><NumberInput unit="%" value={d.vatPct} onChange={(v) => setEstimateDefaults({ vatPct: v })} /></Field>
            <Field label={T('НДС')}>
              <Segmented value={d.vatMode} onChange={(v) => setEstimateDefaults({ vatMode: v as VatMode })} options={[{ value: 'none', label: T('Нет') }, { value: 'on_top', label: T('Сверху') }, { value: 'included', label: T('В т.ч.') }]} />
            </Field>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold">{T('Оформление')}</h2>
          <Field label={T('Тема')}>
            <Segmented value={theme} onChange={(v) => setTheme(v as Theme)} options={[{ value: 'light', label: T('Светлая') }, { value: 'system', label: T('Как в системе') }, { value: 'dark', label: T('Тёмная') }]} />
          </Field>
          <Field label={T('Язык')}>
            <Segmented value={lang} onChange={(v) => v !== lang && setLang(v as Lang)} options={LANGS.map((l) => ({ value: l.value, label: l.label }))} />
          </Field>
        </section>

        <section className="card p-5">
          <h2 className="mb-1 font-semibold">{T('Данные')}</h2>
          <p className="mb-4 text-sm text-zinc-500">{T('Сметы, цены и настройки хранятся только в этом браузере. Сделайте резервную копию, чтобы перенести их на другое устройство.')}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                await importBackup(f)
              } catch (err) {
                toast(err instanceof Error ? err.message : T('Не удалось прочитать файл'), { tone: 'error' })
              }
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportBackup}><Download size={16} />  {T('Скачать резервную копию')}</Button>
            <Button onClick={() => fileRef.current?.click()}><Upload size={16} />  {T('Восстановить из копии')}</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!confirm(T('Удалить все сметы, цены и настройки из этого браузера?'))) return
                for (const k of Object.keys(localStorage)) if (k.startsWith('sr-')) localStorage.removeItem(k)
                location.reload()
              }}
            >
              <Trash2 size={16} />  {T('Очистить всё')}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
