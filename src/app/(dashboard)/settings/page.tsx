import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Settings } from 'lucide-react'
import { SETTINGS_CATEGORIES } from '@/lib/settings/categories'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { SettingsSearch } from '@/components/settings/SettingsSearch'

export default async function SettingsHubPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00C853]/10">
          <Settings className="h-5 w-5 text-[#00C853]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">설정</h1>
          <p className="text-sm text-gray-500">
            시스템 설정을 카테고리별로 관리합니다
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-8 max-w-lg">
        <SettingsSearch />
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {SETTINGS_CATEGORIES.map((category) => (
          <SettingsCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  )
}
