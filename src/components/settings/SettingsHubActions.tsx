'use client'

// ═══════════════════════════════════════════════════════════
// Settings Hub — 헤더 액션 (변경 이력 / 설정 백업)
// 프로토 page-settings.jsx 헤더 우측 버튼 2종 adopt (Wave 1)
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FileClock, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

export function SettingsHubActions() {
  const router = useRouter()
  const t = useTranslations('settings')
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await apiClient.get<{ companyCode: string | null }>('/api/v1/settings/export')
      const data = res.data
      const code = data?.companyCode ?? 'company'
      const filename = `settings-backup-${code}-${new Date().toISOString().slice(0, 10)}.json`
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: t('hubActions.exportDone') })
    } catch (err) {
      toast({
        title: t('hubActions.exportFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => router.push('/settings/system?tab=audit')}
        className="gap-1.5"
      >
        <FileClock className="h-4 w-4" />
        {t('hubActions.changeHistory')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={exporting}
        className="gap-1.5"
      >
        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {t('hubActions.backup')}
      </Button>
    </div>
  )
}
