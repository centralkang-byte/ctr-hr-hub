import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { authOptions } from '@/lib/auth'
import { Settings } from 'lucide-react'
import { SETTINGS_CATEGORIES } from '@/components/settings/settings-config'
import { SettingsHubClient } from './SettingsHubClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations('settings')
  return { title: t('pageTitle') }
}

export default async function SettingsHubPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const t = await getTranslations('settings')
  const totalTabs = SETTINGS_CATEGORIES.reduce((s, c) => s + c.tabs.length, 0)

  return (
    <div className="min-h-screen bg-muted">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('pageDescription', { count: totalTabs })}
            </p>
          </div>
        </div>

        {/* Client part: search + cards */}
        <Suspense fallback={<ListPageSkeleton />}>
          <SettingsHubClient />
        </Suspense>
      </div>
    </div>
  )
}
