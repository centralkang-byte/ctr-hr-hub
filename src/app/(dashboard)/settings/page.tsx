import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Settings, Search } from 'lucide-react'
import { SETTINGS_CATEGORIES } from '@/components/settings/settings-config'
import { SettingsHubClient } from './SettingsHubClient'

export const dynamic = 'force-dynamic'

export default async function SettingsHubPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  return (
    <div className="min-h-screen bg-[#F5F5FA]">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5E81F4]/10">
            <Settings className="h-5 w-5 text-[#5E81F4]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1C1D21]">설정</h1>
            <p className="text-sm text-[#8181A5]">
              시스템 설정을 카테고리별로 관리합니다 · {SETTINGS_CATEGORIES.reduce((s, c) => s + c.tabs.length, 0)}개 항목
            </p>
          </div>
        </div>

        {/* Client part: search + cards */}
        <SettingsHubClient />
      </div>
    </div>
  )
}
