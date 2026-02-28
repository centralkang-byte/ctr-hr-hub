'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Module Toggle Client
// 모듈 ON/OFF: 모듈별 토글 카드
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'

import type { SessionUser } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

const ALL_MODULES = [
  { key: 'CORE_HR', label: '인사관리', description: '사원 정보, 조직도, 직급 관리', required: true },
  { key: 'ATTENDANCE', label: '근태관리', description: '출퇴근, 초과근무, 연장근무 관리' },
  { key: 'LEAVE', label: '휴가관리', description: '연차, 특별휴가, 휴가 승인' },
  { key: 'PERFORMANCE', label: '성과관리', description: 'MBO, CFR, 역량평가, 캘리브레이션' },
  { key: 'COMPENSATION', label: '연봉/보상', description: '급여 밴드, 연봉 조정, 시뮬레이션' },
  { key: 'PAYROLL', label: '급여관리', description: '급여 정산, 급여명세서' },
  { key: 'RECRUITMENT', label: '채용관리', description: '채용공고, 지원자 추적' },
  { key: 'ONBOARDING', label: '온보딩', description: '신규 입사자 온보딩 프로세스' },
  { key: 'OFFBOARDING', label: '퇴직관리', description: '퇴직 체크리스트, 면담' },
  { key: 'TRAINING', label: '교육관리', description: '교육과정, 수강현황' },
  { key: 'BENEFITS', label: '복리후생', description: '복리후생 정책, 신청현황' },
  { key: 'DISCIPLINE', label: '징계/포상', description: '징계, 포상 관리' },
  { key: 'SUCCESSION', label: '후계자 관리', description: '핵심직책, 후계자 풀' },
  { key: 'ANALYTICS', label: 'HR 분석', description: '인력, 이직, 성과 분석' },
]

export function ModuleToggleClient({ user: _user }: { user: SessionUser }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabledModules, setEnabledModules] = useState<string[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ enabledModules: string[] }>('/api/v1/settings/modules')
      setEnabledModules(res.data.enabledModules as string[])
    } catch {
      toast({ title: '오류', description: '모듈 설정을 불러올 수 없습니다.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

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
      toast({ title: '성공', description: '모듈 설정이 저장되었습니다.' })
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
      <PageHeader title="모듈 ON/OFF" description="법인에서 사용할 모듈을 선택합니다." />

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
                    <span className="mt-1 inline-flex text-[10px] text-blue-600">필수 모듈</span>
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
          저장
        </Button>
      </div>
    </div>
  )
}
