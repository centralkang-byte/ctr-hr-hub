'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 법정 의무교육 관리 탭 (B9-1 LMS Lite)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Play, BarChart3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

// ─── Types ───────────────────────────────────────────────

type CourseOption = { id: string; title: string; code?: string | null }

type MandatoryConfig = {
  id: string
  courseId: string
  companyId?: string | null
  targetGroup: string
  frequency: string
  deadlineMonth?: number | null
  isActive: boolean
  course: { id: string; code?: string | null; title: string; durationHours?: number | null }
  company?: { id: string; code: string; name: string } | null
}

type MandatoryStatus = {
  courseId: string
  title: string
  targetGroup: string
  frequency: string
  deadlineMonth?: number | null
  completionRate: number
  completed: number
  enrolled: number
  pending: number
  expiringSoon: number
}

const TARGET_GROUP_LABELS: Record<string, string> = {
  all: '전 직원',
  manager: '관리자',
  new_hire: '신규 입사자',
  production: '생산직',
}

const FREQUENCY_LABELS: Record<string, string> = {
  annual: '연 1회',
  biennial: '격년',
  once: '1회성',
}

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

// ─── Component ───────────────────────────────────────────

export default function MandatoryConfigTab() {
  const { toast } = useToast()

  // ─ 설정 목록
  const [configs, setConfigs] = useState<MandatoryConfig[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(false)

  // ─ 이수 현황
  const [statuses, setStatuses] = useState<MandatoryStatus[]>([])
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [statusYear, setStatusYear] = useState(new Date().getFullYear())

  // ─ 과정 선택 옵션
  const [courseOptions, setCourseOptions] = useState<CourseOption[]>([])

  // ─ 다이얼로그
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<MandatoryConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [enrolling, setEnrolling] = useState(false)

  const [form, setForm] = useState({
    courseId: '',
    targetGroup: 'all',
    frequency: 'annual',
    deadlineMonth: '',
    isActive: true,
  })

  const fetchConfigs = useCallback(async () => {
    setLoadingConfigs(true)
    try {
      const res = await apiClient.get<MandatoryConfig[]>('/api/v1/training/mandatory-config')
      setConfigs((res.data as unknown as MandatoryConfig[]) ?? [])
    } catch {
      toast({ title: '설정 로드 실패', variant: 'destructive' })
    } finally {
      setLoadingConfigs(false)
    }
  }, [toast])

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const res = await apiClient.get<{ courses: MandatoryStatus[] }>('/api/v1/training/mandatory-status', { year: String(statusYear) })
      setStatuses(res.data?.courses ?? [])
    } catch {
      toast({ title: '이수현황 로드 실패', variant: 'destructive' })
    } finally {
      setLoadingStatus(false)
    }
  }, [toast, statusYear])

  const fetchCourseOptions = useCallback(async () => {
  const { confirm, dialogProps } = useConfirmDialog()
    try {
      const res = await apiClient.getList<CourseOption>('/api/v1/training/courses', { limit: '100', isActive: 'true', isMandatory: 'true' })
      setCourseOptions(res.data ?? [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchConfigs()
    fetchStatus()
    fetchCourseOptions()
  }, [fetchConfigs, fetchStatus, fetchCourseOptions])

  const openCreate = () => {
    setEditingConfig(null)
    setForm({ courseId: courseOptions[0]?.id ?? '', targetGroup: 'all', frequency: 'annual', deadlineMonth: '', isActive: true })
    setDialogOpen(true)
  }

  const openEdit = (config: MandatoryConfig) => {
    setEditingConfig(config)
    setForm({
      courseId: config.courseId,
      targetGroup: config.targetGroup,
      frequency: config.frequency,
      deadlineMonth: config.deadlineMonth?.toString() ?? '',
      isActive: config.isActive,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.courseId) {
      toast({ title: '교육과정을 선택해주세요.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        courseId: form.courseId,
        targetGroup: form.targetGroup,
        frequency: form.frequency,
        isActive: form.isActive,
        ...(form.deadlineMonth ? { deadlineMonth: Number(form.deadlineMonth) } : {}),
      }
      if (editingConfig) {
        await apiClient.patch(`/api/v1/training/mandatory-config/${editingConfig.id}`, payload)
        toast({ title: '설정이 수정되었습니다.' })
      } else {
        await apiClient.post('/api/v1/training/mandatory-config', payload)
        toast({ title: '설정이 등록되었습니다.' })
      }
      setDialogOpen(false)
      fetchConfigs()
    } catch {
      toast({ title: '저장 실패', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (config: MandatoryConfig) => {
    confirm({ variant: 'destructive', title: `"${config.course.title}" 의무교육 설정을 삭제하시겠습니까?`, onConfirm: async () => {
      try {
        await apiClient.delete(`/api/v1/training/mandatory-config/${config.id}`)
        toast({ title: '설정이 삭제되었습니다.' })
        fetchConfigs()
      } catch {
        toast({ title: '삭제 실패', variant: 'destructive' })
      }
    }})
  }

  const handleAutoEnroll = async () => {
    confirm({ title: '현재 활성화된 모든 의무교육 설정으로 자동 수강 신청하시겠습니까?', onConfirm: async () => {
      setEnrolling(true)
      try {
        const res = await apiClient.post<{ totalEnrolled: number; totalSkipped: number; configsProcessed: number }>('/api/v1/training/mandatory-config/enroll', {})
        const d = res.data
        toast({ title: `자동 등록 완료: ${d?.totalEnrolled ?? 0}명 신규 등록, ${d?.totalSkipped ?? 0}명 스킵` })
        fetchStatus()
      } catch {
        toast({ title: '자동 등록 실패', variant: 'destructive' })
      } finally {
        setEnrolling(false)
      }
    }})
  }

  return (
    <>
    <div className="space-y-8">
      {/* ─── 이수 현황 대시보드 ─── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#5E81F4]" />
            <h2 className="text-base font-semibold text-[#1A1A1A]">법정 의무교육 이수현황</h2>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="px-3 py-1.5 border border-[#D4D4D4] rounded-lg text-sm"
              value={statusYear}
              onChange={(e) => setStatusYear(Number(e.target.value))}
            >
              {[2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <Button size="sm" onClick={handleAutoEnroll} disabled={enrolling}>
              <Play className="mr-1.5 h-3 w-3" />
              {enrolling ? '실행 중...' : '자동 수강 신청'}
            </Button>
          </div>
        </div>

        {loadingStatus ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-[#F5F5F5] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : statuses.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-8 text-center text-sm text-[#999]">
            {statusYear}년 의무교육 현황이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {statuses.map((s) => (
              <div key={s.courseId} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-semibold text-[#1A1A1A] text-sm">{s.title}</span>
                    <span className="text-xs text-[#999] ml-2">
                      {TARGET_GROUP_LABELS[s.targetGroup] ?? s.targetGroup}
                      {s.deadlineMonth ? ` · 마감: ${MONTH_LABELS[s.deadlineMonth - 1]}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#666]">
                    <span>이수 <strong className="text-[#047857]">{s.completed}</strong></span>
                    <span>수강중 <strong className="text-[#B45309]">{s.enrolled}</strong></span>
                    <span>미이수 <strong className="text-[#EF4444]">{s.pending}</strong></span>
                    {s.expiringSoon > 0 && (
                      <Badge className="text-[10px] bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]">
                        만료 임박 {s.expiringSoon}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="w-full h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#5E81F4] rounded-full transition-all"
                    style={{ width: `${s.completionRate}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-[#999]">이수율</span>
                  <span className="text-xs font-semibold text-[#5E81F4]">{s.completionRate}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── 의무교육 설정 목록 ─── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#1A1A1A]">의무교육 설정</h2>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3 w-3" />
            설정 추가
          </Button>
        </div>

        {loadingConfigs ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-16 bg-[#F5F5F5] rounded-xl animate-pulse" />)}
          </div>
        ) : configs.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-8 text-center text-sm text-[#999]">
            등록된 의무교육 설정이 없습니다.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#F5F5F5]">
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">교육과정</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">대상</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">주기</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">마감월</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">상태</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {configs.map((config) => (
                  <tr key={config.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-[#1A1A1A]">{config.course.title}</span>
                        {config.course.code && (
                          <span className="text-xs text-[#999] ml-1.5">{config.course.code}</span>
                        )}
                      </div>
                      {config.company && (
                        <span className="text-xs text-[#999]">{config.company.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#666]">
                      {TARGET_GROUP_LABELS[config.targetGroup] ?? config.targetGroup}
                    </td>
                    <td className="px-4 py-3 text-[#666]">
                      {FREQUENCY_LABELS[config.frequency] ?? config.frequency}
                    </td>
                    <td className="px-4 py-3 text-[#666]">
                      {config.deadlineMonth ? MONTH_LABELS[config.deadlineMonth - 1] : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {config.isActive ? (
                        <Badge className="text-[10px] bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]">활성</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-[#FAFAFA] text-[#555] border-[#E8E8E8]">비활성</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(config)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(config)}>
                          <Trash2 className="h-3.5 w-3.5 text-[#EF4444]" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── 설정 다이얼로그 ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingConfig ? '의무교육 설정 수정' : '의무교육 설정 추가'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-[#333] mb-1 block">교육과정 *</label>
              <select
                className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
                value={form.courseId}
                onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}
              >
                <option value="">선택...</option>
                {courseOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">대상 *</label>
                <select
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
                  value={form.targetGroup}
                  onChange={(e) => setForm((f) => ({ ...f, targetGroup: e.target.value }))}
                >
                  {Object.entries(TARGET_GROUP_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#333] mb-1 block">주기 *</label>
                <select
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
                  value={form.frequency}
                  onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                >
                  {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[#333] mb-1 block">마감월</label>
              <select
                className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
                value={form.deadlineMonth}
                onChange={(e) => setForm((f) => ({ ...f, deadlineMonth: e.target.value }))}
              >
                <option value="">없음</option>
                {MONTH_LABELS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActiveConfig"
                className="w-4 h-4 rounded border-[#D4D4D4] text-[#5E81F4]"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              <label htmlFor="isActiveConfig" className="text-sm text-[#333]">활성화</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving || !form.courseId}>
              {saving ? '저장 중...' : editingConfig ? '수정' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
      <ConfirmDialog {...dialogProps} />
      </>
  )
}
