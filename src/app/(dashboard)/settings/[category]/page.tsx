import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCategoryById } from '@/lib/settings/categories'
import { SettingsSideTabs } from '@/components/settings/SettingsSideTabs'
import { SettingsPlaceholder } from '@/components/settings/SettingsPlaceholder'

interface CategoryPageProps {
  params: { category: string }
  searchParams: { tab?: string }
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const category = getCategoryById(params.category)
  if (!category) redirect('/settings')

  const requestedTabId = searchParams.tab ?? category.items[0]?.id ?? ''
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
          ) : (
            <p className="text-sm text-gray-500">항목을 선택하세요.</p>
          )}
        </div>
      </div>
    </div>
  )
}
