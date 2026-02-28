'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Dashboard Widgets Client
// 대시보드 위젯: 위젯 체크박스/토글 카드 + 저장
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, LayoutDashboard } from 'lucide-react'

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

const ALL_WIDGETS = [
  { key: 'headcount_summary', label: '인원 현황', description: '전체/부서별 인원 요약' },
  { key: 'attendance_today', label: '오늘의 근태', description: '출근/결근/지각 현황' },
  { key: 'leave_calendar', label: '휴가 캘린더', description: '팀 휴가 일정' },
  { key: 'pending_approvals', label: '대기 중 승인', description: '미처리 승인 건수' },
  { key: 'birthday_anniversary', label: '생일/기념일', description: '이번 주 생일/입사 기념일' },
  { key: 'new_hires', label: '신규 입사자', description: '최근 입사자 목록' },
  { key: 'turnover_rate', label: '이직률', description: '월별 이직률 추이' },
  { key: 'performance_cycle', label: '평가 현황', description: '현재 평가 사이클 진행률' },
  { key: 'training_progress', label: '교육 현황', description: '교육 참여율, 이수율' },
  { key: 'announcements', label: '공지사항', description: '최근 공지 및 알림' },
  { key: 'quick_links', label: '빠른 링크', description: '자주 사용하는 메뉴 바로가기' },
  { key: 'ai_insights', label: 'AI 인사이트', description: 'AI 기반 HR 인사이트' },
]

export function DashboardWidgetsClient({ user: _user }: { user: SessionUser }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [widgets, setWidgets] = useState<WidgetConfig[]>([])

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
      toast({ title: '오류', description: '대시보드 설정을 불러올 수 없습니다.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
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
      toast({ title: '성공', description: '대시보드 설정이 저장되었습니다.' })
    } catch {
      toast({ title: '오류', description: '저장 중 오류가 발생했습니다.', variant: 'destructive' })
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
        title="대시보드 위젯"
        description="대시보드에 표시할 위젯을 선택합니다."
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
          저장
        </Button>
      </div>
    </div>
  )
}
