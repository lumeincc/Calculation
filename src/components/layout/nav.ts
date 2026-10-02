import {
  Archive, ArrowLeftToLine, Building2, Calculator, CircleUserRound, FileSignature, FileSpreadsheet, FileText, FolderOpen, Home,
  LayoutDashboard, Receipt, Settings, Tags, Weight, type LucideIcon,
} from 'lucide-react'
import { T } from '@/i18n'

export interface NavEntry {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

/** Main TONNA section. */
export const MAIN_NAV: NavEntry[] = [
  { to: '/', label: T('Главная'), icon: Home, end: true },
  { to: '/calc', label: T('Калькуляторы'), icon: Calculator, end: true },
  { to: '/docs', label: T('Документы'), icon: FolderOpen },
  { to: '/estimates', label: T('Сметы'), icon: FileSpreadsheet },
  { to: '/calc/metal', label: T('Тоннаж металла'), icon: Weight },
  { to: '/prices', label: T('Справочник цен'), icon: Tags },
]

/** Entry to the separate document-flow section. */
export const OFFICE_ENTRY: NavEntry = { to: '/office', label: T('Документооборот'), icon: FileSignature }

/** Document-flow section (contracts, invoices, archive). */
export const OFFICE_NAV: NavEntry[] = [
  { to: '/office', label: T('Обзор'), icon: LayoutDashboard, end: true },
  { to: '/office/contracts', label: T('Договоры'), icon: FileSignature },
  { to: '/office/papers', label: T('Счета и акты'), icon: Receipt },
  { to: '/office/counterparties', label: T('Контрагенты'), icon: Building2 },
  { to: '/office/files', label: T('Архив файлов'), icon: Archive },
  { to: '/office/templates', label: T('Шаблоны'), icon: FileText },
]

export const BACK_TO_MAIN: NavEntry = { to: '/', label: T('Вернуться в TONNA'), icon: ArrowLeftToLine, end: true }

export const BOTTOM_NAV: NavEntry[] = [
  { to: '/account', label: T('Аккаунт и команда'), icon: CircleUserRound },
  { to: '/settings', label: T('Настройки'), icon: Settings },
]

export const isOffice = (path: string) => path === '/office' || path.startsWith('/office/')
