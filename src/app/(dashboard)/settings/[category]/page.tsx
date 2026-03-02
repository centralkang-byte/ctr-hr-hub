import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCategoryById } from '@/lib/settings/categories'
import { SettingsSideTabs } from '@/components/settings/SettingsSideTabs'
import { SettingsPlaceholder } from '@/components/settings/SettingsPlaceholder'
import { EvaluationSettingsClient } from '@/components/settings/EvaluationSettingsClient'
import { PromotionSettingsClient } from '@/components/settings/PromotionSettingsClient'
import { CompensationSettingsClient } from '@/components/settings/CompensationSettingsClient'
import { ApprovalFlowManagerClient } from '@/components/settings/ApprovalFlowManagerClient'

// B1 tabs that have real UI — for these, client components render their own header
const B1_TABS: Record<string, Set<string>> = {
  evaluation: new Set(['methodology', 'grade-system', 'forced-distribution']),
  promotion: new Set(['job-levels', 'promotion-rules', 'approval-chain']),
  compensation: new Set(['pay-components', 'salary-band', 'raise-matrix', 'bonus-rules']),
  system: new Set(['workflow-engine']),
}

interface CategoryPageProps {
  params: Promise<{ category: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { category: categoryId } = await params
  const { tab } = await searchParams

  const category = getCategoryById(categoryId)
  if (!category) redirect('/settings')

  const requestedTabId = tab ?? category.items[0]?.id ?? ''
  const activeItem = category.items.find((i) => i.id === requestedTabId) ?? category.items[0]
  const activeTabId = activeItem?.id ?? ''

  const Icon = category.icon

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/settings" className="hover:text-gray-600">설정</Link>
        <span>/</span>
        <span className="text-gray-600">{category.label}</span>
        {activeItem && (
          <>
            <span>/</span>
            <span className="text-gray-600">{activeItem.label}</span>
          </>
        )}
      </div>

      {/* Back link */}
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft className="h-4 w-4" />
        설정으로 돌아가기
      </Link>

      {/* Category header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 p-2">
          <Icon className="h-6 w-6 text-gray-600" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">{category.label}</h1>
      </div>

      {/* Side-tab layout */}
      <div className="flex gap-8">
        <SettingsSideTabs
          categoryHref={category.href}
          items={category.items}
          activeTab={activeTabId}
        />

        {/* Content area */}
        <div className="min-w-0 flex-1">
          {activeItem ? (
            (() => {
              const isB1 = B1_TABS[categoryId]?.has(activeTabId)

              if (isB1) {
                // B1 client components render their own SettingsPageLayout (with title + company selector)
                if (categoryId === 'evaluation') return <EvaluationSettingsClient activeTab={activeTabId} />
                if (categoryId === 'promotion') return <PromotionSettingsClient activeTab={activeTabId} />
                if (categoryId === 'compensation') return <CompensationSettingsClient activeTab={activeTabId} />
                if (categoryId === 'system' && activeTabId === 'workflow-engine') {
                  return (
                    <>
                      <div className="mb-6 border-b border-gray-200 pb-4">
                        <h2 className="text-xl font-semibold text-gray-900">{activeItem.label}</h2>
                        <p className="mt-1 text-sm text-gray-500">{activeItem.description}</p>
                      </div>
                      <ApprovalFlowManagerClient />
                    </>
                  )
                }
              }

              return (
                <>
                  {/* Item header */}
                  <div className="mb-6 border-b border-gray-200 pb-4">
                    <h2 className="text-xl font-semibold text-gray-900">{activeItem.label}</h2>
                    <p className="mt-1 text-sm text-gray-500">{activeItem.description}</p>
                  </div>

                  {/* Placeholder */}
                  <SettingsPlaceholder
                    label={`${activeItem.label} 설정 폼 준비 중`}
                    description={activeItem.description}
                  />
                </>
              )
            })()
          ) : (
            <p className="text-sm text-gray-500">항목을 선택하세요.</p>
          )}
        </div>
      </div>
    </div>
  )
}
