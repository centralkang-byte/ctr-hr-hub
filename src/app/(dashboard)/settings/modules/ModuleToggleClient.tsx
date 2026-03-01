'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Module Toggle Client
// 모듈 ON/OFF: 모듈별 토글 카드
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { SessionUser } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

export function ModuleToggleClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabledModules, setEnabledModules] = useState<string[]>([])

  const ALL_MODULES = [
    { key: 'CORE_HR', label: t('moduleCoreHr'), description: t('moduleCoreHrDesc'), required: true },
    { key: 'ATTENDANCE', label: t('moduleAttendance'), description: t('moduleAttendanceDesc') },
    { key: 'LEAVE', label: t('moduleLeave'), description: t('moduleLeaveDesc') },
    { key: 'PERFORMANCE', label: t('modulePerformance'), description: t('modulePerformanceDesc') },
    { key: 'COMPENSATION', label: t('moduleCompensation'), description: t('moduleCompensationDesc') },
    { key: 'PAYROLL', label: t('modulePayroll'), description: t('modulePayrollDesc') },
    { key: 'RECRUITMENT', label: t('moduleRecruitment'), description: t('moduleRecruitmentDesc') },
    { key: 'ONBOARDING', label: t('moduleOnboarding'), description: t('moduleOnboardingDesc') },
    { key: 'OFFBOARDING', label: t('moduleOffboarding'), description: t('moduleOffboardingDesc') },
    { key: 'TRAINING', label: t('moduleTraining'), description: t('moduleTrainingDesc') },
    { key: 'BENEFITS', label: t('moduleBenefits'), description: t('moduleBenefitsDesc') },
    { key: 'DISCIPLINE', label: t('moduleDiscipline'), description: t('moduleDisciplineDesc') },
    { key: 'SUCCESSION', label: t('moduleSuccession'), description: t('moduleSuccessionDesc') },
    { key: 'ANALYTICS', label: t('moduleAnalytics'), description: t('moduleAnalyticsDesc') },
  ]

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ enabledModules: string[] }>('/api/v1/settings/modules')
      setEnabledModules(res.data.enabledModules as string[])
    } catch {
      toast({ title: tc('error'), description: t('moduleLoadError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast, t, tc])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleModule = (key: string) => {
    setEnabledModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key],
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiClient.put('/api/v1/settings/modules', { enabledModules })
      toast({ title: tc('success'), description: t('moduleSaved') })
    } catch {
      toast({ title: tc('error'), description: t('saveError'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader title={t('moduleToggle')} description={t('moduleToggleDesc')} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ALL_MODULES.map((mod) => {
          const isEnabled = enabledModules.includes(mod.key)
          return (
            <Card
              key={mod.key}
              className={`transition-colors ${isEnabled ? 'border-blue-200 bg-blue-50/30' : ''}`}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <Switch
                  checked={isEnabled}
                  onCheckedChange={() => toggleModule(mod.key)}
                  disabled={'required' in mod && mod.required}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{mod.label}</p>
                  <p className="text-xs text-muted-foreground">{mod.description}</p>
                  {'required' in mod && mod.required && (
                    <span className="mt-1 inline-flex text-[10px] text-blue-600">{t('requiredModule')}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {tc('save')}
        </Button>
      </div>
    </div>
  )
}
