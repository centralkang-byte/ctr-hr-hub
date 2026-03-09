import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Settings, AlertTriangle } from 'lucide-react'
import { SETTINGS_CATEGORIES } from '@/lib/settings/categories'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { SettingsSearch } from '@/components/settings/SettingsSearch'

export default async function SettingsHubPage() {
  let session
  try {
    session = await getServerSession(authOptions)
  } catch (err) {
    console.error('[settings] getServerSession failed:', err)
    redirect('/login')
  }
  if (!session?.user) redirect('/login')

  let categories = SETTINGS_CATEGORIES
  // Fallback if categories fail to load
  if (!categories || !Array.isArray(categories)) {
    categories = []
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00C853]/10">
          <Settings className="h-5 w-5 text-[#00C853]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1C1D21]">설정</h1>
          <p className="text-sm text-[#8181A5]">
            시스템 설정을 카테고리별로 관리합니다
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-8 max-w-lg">
        <SettingsSearch />
      </div>

      {/* Card grid */}
      {categories.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <SettingsCard key={category.id} category={category} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-[#8181A5]">
          <AlertTriangle className="h-10 w-10 mb-3" />
          <p>설정 카테고리를 불러올 수 없습니다.</p>
        </div>
      )}
    </div>
  )
}
