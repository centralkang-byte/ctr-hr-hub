'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Dashboard Widgets Client
// 대시보드 위젯: 위젯 체크박스/토글 카드 + 저장
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, LayoutDashboard } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { SessionUser } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

interface WidgetConfig {
  key: string
  enabled: boolean
  order: number
}

interface DashboardLayout {
  widgets: WidgetConfig[]
}

export function DashboardWidgetsClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [widgets, setWidgets] = useState<WidgetConfig[]>([])

  const ALL_WIDGETS = [
    { key: 'headcount_summary', label: t('widgetHeadcountSummary'), description: t('widgetHeadcountSummaryDesc') },
    { key: 'attendance_today', label: t('widgetAttendanceToday'), description: t('widgetAttendanceTodayDesc') },
    { key: 'leave_calendar', label: t('widgetLeaveCalendar'), description: t('widgetLeaveCalendarDesc') },
    { key: 'pending_approvals', label: t('widgetPendingApprovals'), description: t('widgetPendingApprovalsDesc') },
    { key: 'birthday_anniversary', label: t('widgetBirthdayAnniversary'), description: t('widgetBirthdayAnniversaryDesc') },
    { key: 'new_hires', label: t('widgetNewHires'), description: t('widgetNewHiresDesc') },
    { key: 'turnover_rate', label: t('widgetTurnoverRate'), description: t('widgetTurnoverRateDesc') },
    { key: 'performance_cycle', label: t('widgetPerformanceCycle'), description: t('widgetPerformanceCycleDesc') },
    { key: 'training_progress', label: t('widgetTrainingProgress'), description: t('widgetTrainingProgressDesc') },
    { key: 'announcements', label: t('widgetAnnouncements'), description: t('widgetAnnouncementsDesc') },
    { key: 'quick_links', label: t('widgetQuickLinks'), description: t('widgetQuickLinksDesc') },
    { key: 'ai_insights', label: t('widgetAiInsights'), description: t('widgetAiInsightsDesc') },
  ]

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ dashboardLayout: DashboardLayout | null }>('/api/v1/settings/dashboard-layout')
      const layout = res.data.dashboardLayout as DashboardLayout | null
      if (layout?.widgets) {
        setWidgets(layout.widgets)
      } else {
        setWidgets(ALL_WIDGETS.map((w, i) => ({ key: w.key, enabled: true, order: i })))
      }
    } catch {
      toast({ title: tc('error'), description: t('dashboardLoadError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleWidget = (key: string) => {
    setWidgets((prev) => {
      const existing = prev.find((w) => w.key === key)
      if (existing) {
        return prev.map((w) => w.key === key ? { ...w, enabled: !w.enabled } : w)
      }
      return [...prev, { key, enabled: true, order: prev.length }]
    })
  }

  const isEnabled = (key: string) => {
    return widgets.find((w) => w.key === key)?.enabled ?? true
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiClient.put('/api/v1/settings/dashboard-layout', {
        dashboardLayout: { widgets },
      })
      toast({ title: tc('success'), description: t('dashboardSaved') })
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
      <PageHeader
        title={t('dashboardWidgets')}
        description={t('dashboardWidgetsDesc')}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ALL_WIDGETS.map((widget) => {
          const enabled = isEnabled(widget.key)
          return (
            <Card
              key={widget.key}
              className={`transition-colors ${enabled ? 'border-blue-200 bg-blue-50/30' : ''}`}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <Switch
                  checked={enabled}
                  onCheckedChange={() => toggleWidget(widget.key)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">{widget.label}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{widget.description}</p>
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
