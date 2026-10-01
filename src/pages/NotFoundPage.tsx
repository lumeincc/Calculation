import { SearchX } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'

export function NotFoundPage() {
  return <EmptyState icon={<SearchX size={32} />} title="Страница не найдена" text="Возможно, ссылка устарела." action={<ButtonLink to="/" variant="primary">На главную</ButtonLink>} />
}
