import { lazy, Suspense } from 'react'
import { createHashRouter, RouterProvider } from 'react-router'
import { Layout } from '@/components/layout/Layout'
import { CalculatorPage } from '@/pages/CalculatorPage'
import { CalculatorsPage } from '@/pages/CalculatorsPage'
import { EstimatePage } from '@/pages/EstimatePage'
import { EstimatesPage } from '@/pages/EstimatesPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PricesPage } from '@/pages/PricesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AccountPage } from '@/pages/AccountPage'
import { startSync } from '@/lib/sync'
import { useAuth } from '@/store/auth'
import { useEffect } from 'react'
import { T } from '@/i18n'

const DocumentsPage = lazy(() => import('@/pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })))
const EstimatePrintPage = lazy(() => import('@/pages/EstimatePrintPage').then((m) => ({ default: m.EstimatePrintPage })))

type OfficeModule = typeof import('@/office')
const office = (name: keyof OfficeModule) => {
  const Page = lazy(() => import('@/office').then((m) => ({ default: m[name] })))
  return <Suspense fallback={fallback}><Page /></Suspense>
}

const fallback = <div className="p-10 text-center text-sm text-zinc-500">{T('Загрузка…')}</div>

// Hash routing keeps the build deployable to any static hosting without rewrites.
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/calc', element: <CalculatorsPage /> },
      { path: '/calc/:id', element: <CalculatorPage /> },
      { path: '/docs', element: <Suspense fallback={fallback}><DocumentsPage /></Suspense> },
      { path: '/estimates', element: <EstimatesPage /> },
      { path: '/estimates/:id', element: <EstimatePage /> },
      { path: '/prices', element: <PricesPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/account', element: <AccountPage /> },
      { path: '/office', element: office('OfficeHome') },
      { path: '/office/contracts', element: office('ContractsPage') },
      { path: '/office/contracts/:id', element: office('ContractPage') },
      { path: '/office/papers', element: office('PapersPage') },
      { path: '/office/papers/:id', element: office('PaperPage') },
      { path: '/office/counterparties', element: office('CounterpartiesPage') },
      { path: '/office/counterparties/:id', element: office('CounterpartyPage') },
      { path: '/office/files', element: office('FilesPage') },
      { path: '/office/templates', element: office('TemplatesPage') },
      { path: '/office/templates/:id', element: office('TemplatePage') },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '/office/print/:type/:id', element: office('OfficePrintPage') },
  { path: '/estimates/:id/print', element: <Suspense fallback={fallback}><EstimatePrintPage /></Suspense> },
])

export function App() {
  const token = useAuth((s) => s.token)
  useEffect(() => {
    // Resume syncing when the app opens with a saved session.
    if (token) startSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <RouterProvider router={router} />
}
