import { SearchX } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { T } from '@/i18n'

export function NotFoundPage() {
  return <EmptyState icon={<SearchX size={32} />} title={T('Страница не найдена')} text={T('Возможно, ссылка устарела.')} action={<ButtonLink to="/" variant="primary">{T('На главную')}</ButtonLink>} />
}
