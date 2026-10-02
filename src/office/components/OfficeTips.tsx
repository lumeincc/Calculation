import {
  Archive, Building2, Command, DatabaseBackup, FileArchive, FileSignature, FileText, PenLine, Receipt, Sparkles, Star, Tags, TriangleAlert,
} from 'lucide-react'
import { TipCards, type Tip } from '@/components/home/TipCards'
import { T, Tf } from '@/i18n'
import { useSettings } from '@/store/settings'
import { useOffice } from '../store'
import { daysUntil } from '../words'

const TIPS: Tip[] = [
  { id: 'from-estimate', kind: 'tip', icon: FileSignature, title: T('Договор прямо из сметы'), text: T('Выберите смету при создании договора — сумма, НДС, объект и предмет подставятся сами.'), to: '/office/contracts?new=1' },
  { id: 'advance', kind: 'tip', icon: Receipt, title: T('Счёт на аванс в один клик'), text: T('В карточке договора, вкладка «Счета и акты»: аванс, остаток и акт по строкам сметы.'), to: '/office/contracts' },
  { id: 'sign', kind: 'tip', icon: PenLine, title: T('Подписи и сканы'), text: T('Отметьте подписи сторон и прикрепите скан — договор сам станет «Действует».'), to: '/office/contracts' },
  { id: 'template', kind: 'tip', icon: FileText, title: T('Свой шаблон договора'), text: T('Поправьте текст один раз и сохраните как шаблон — дальше договоры будут готовы за минуту.'), to: '/office/templates' },
  { id: 'folder', kind: 'tip', icon: Archive, title: T('Папка целиком в архив'), text: T('Перетащите папку с компьютера — структура подпапок сохранится как есть.'), to: '/office/files' },
  { id: 'unzip', kind: 'tip', icon: FileArchive, title: T('Распакуйте архив на месте'), text: T('ZIP, RAR или 7z в архиве: «…» → «Распаковать в папку».'), to: '/office/files' },
  { id: 'tags', kind: 'tip', icon: Tags, title: T('Метки и избранное'), text: T('Отмечайте файлы метками «подписано», «оригинал», «2026» и звёздочкой — найдутся за секунду.'), to: '/office/files' },
  { id: 'zip', kind: 'tip', icon: DatabaseBackup, title: T('Резервная копия архива'), text: T('Файлы лежат в браузере. Кнопка «ZIP» в архиве сохранит всё одним файлом.'), to: '/office/files' },
  { id: 'search', kind: 'tip', icon: Command, title: T('Ctrl + K — найти договор'), text: T('Поиск по номеру, контрагенту, предмету и файлам.'), search: true },
  { id: 'star', kind: 'new', icon: Star, title: T('Контроль оплат'), text: T('По каждому договору видно, сколько выставлено, оплачено и принято по актам.'), to: '/office/contracts' },
]

/** Overview recommendations: what needs doing now (from the data) plus rotating tips. */
export function OfficeTips() {
  const company = useSettings((s) => s.company)
  const { counterparties, contracts, papers } = useOffice()
  const important: Tip[] = []
  if (!company.name || !company.inn || !company.iik)
    important.push({ id: 'req', kind: 'important', icon: Sparkles, title: T('Заполните реквизиты компании'), text: T('БИН, банк, ИИК и подписант попадут во все договоры, счета и акты.'), to: '/settings' })
  if (!counterparties.length)
    important.push({ id: 'cp', kind: 'important', icon: Building2, title: T('Добавьте первого контрагента'), text: T('Реквизиты заказчика вводятся один раз и подставляются во все документы.'), to: '/office/counterparties' })
  const overdue = papers.filter((p) => p.kind === 'invoice' && p.status === 'sent' && (daysUntil(p.dueDate) ?? 1) < 0).length
  if (overdue)
    important.push({ id: 'overdue', kind: 'important', icon: TriangleAlert, title: Tf('Просрочено счетов: {0}', [overdue]), text: T('Напомните заказчику или отметьте оплату в счёте.'), to: '/office/papers?kind=invoice' })
  const signing = contracts.filter((c) => c.status === 'review' || c.status === 'signing').length
  if (signing)
    important.push({ id: 'signing', kind: 'important', icon: PenLine, title: Tf('Ждут подписи: {0}', [signing]), text: T('Договоры на согласовании и подписании — проверьте, что с ними.'), to: '/office/contracts?status=signing' })
  return <TipCards important={important} tips={TIPS} />
}
