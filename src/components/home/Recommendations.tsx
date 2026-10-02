import {
  Building2, Command, DatabaseBackup, FileArchive, FileSignature, Languages, Link2, Paintbrush, Scale, Sparkles,
} from 'lucide-react'
import { useMemo } from 'react'
import { T } from '@/i18n'
import { useEstimates } from '@/store/estimates'
import { useSettings } from '@/store/settings'
import { TipCards, type Tip } from './TipCards'

const TIPS: Tip[] = [
  { id: 'office', kind: 'new', icon: FileSignature, title: T('Документооборот'), text: T('Договоры из шаблонов, счета и акты в один клик, подписи и архив файлов по папкам.'), to: '/office' },
  { id: 'search', kind: 'tip', icon: Command, title: T('Ctrl + K — поиск по всему'), text: T('Калькуляторы, сметы, договоры, контрагенты и файлы — в одном окне.'), search: true },
  { id: 'zip', kind: 'tip', icon: FileArchive, title: T('Бросьте архив проекта целиком'), text: T('ZIP или RAR с КМ и КЖ — сайт распакует, найдёт спецификации и посчитает тоннаж.'), to: '/docs' },
  { id: 'gross', kind: 'tip', icon: Scale, title: T('Чистовой и черновой вес'), text: T('Черновой — с отходами на раскрой. По нему удобно заказывать металл.'), to: '/docs' },
  { id: 'contract', kind: 'tip', icon: FileSignature, title: T('Договор прямо из сметы'), text: T('Выберите смету при создании договора — сумма, НДС и объект подставятся сами.'), to: '/office/contracts?new=1' },
  { id: 'paint', kind: 'tip', icon: Paintbrush, title: T('Окраска металлоконструкций'), text: T('Площадь окраски считается по профилям — в стоимости металлоконструкции после загрузки КМ.'), to: '/docs' },
  { id: 'share', kind: 'tip', icon: Link2, title: T('Поделитесь расчётом'), text: T('Кнопка «Поделиться» в калькуляторе даёт ссылку со всеми введёнными размерами.'), to: '/calc/metal' },
  { id: 'cp', kind: 'tip', icon: Building2, title: T('Реквизиты контрагентов'), text: T('Внесите заказчика один раз — он подставится во все договоры, счета и акты.'), to: '/office/counterparties' },
  { id: 'lang', kind: 'tip', icon: Languages, title: T('Есть английская версия'), text: T('Язык и тема переключаются в настройках.'), to: '/settings' },
]

export function Recommendations() {
  const company = useSettings((s) => s.company)
  const hasEstimates = useEstimates((s) => s.estimates.length > 0)
  const important = useMemo(() => {
    const out: Tip[] = []
    if (!company.name || !company.inn)
      out.push({ id: 'company', kind: 'important', icon: Sparkles, title: T('Заполните реквизиты компании'), text: T('Название, БИН и банк попадут в сметы, КП, договоры и счета.'), to: '/settings' })
    if (!hasEstimates)
      out.push({ id: 'first', kind: 'important', icon: Sparkles, title: T('Первая смета за минуту'), text: T('Посчитайте материал в калькуляторе и нажмите «В смету».'), to: '/calc' })
    else
      out.push({ id: 'backup', kind: 'tip', icon: DatabaseBackup, title: T('Сделайте резервную копию'), text: T('Сметы хранятся в браузере — сохраните копию файлом в настройках.'), to: '/settings' })
    return out
  }, [company, hasEstimates])
  return <TipCards important={important} tips={TIPS} />
}
