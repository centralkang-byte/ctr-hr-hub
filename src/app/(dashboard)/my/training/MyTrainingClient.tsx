'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'

import { useState, useEffect } from 'react'
import { BookOpen, CheckCircle2, Clock, AlertTriangle, Sparkles, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'
import { CARD_STYLES, TABLE_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────

type CourseRef = {
  id: string
  code?: string | null
  title: string
  category: string
  format?: string
  durationHours?: number | null
  provider?: string | null
}

type EnrollmentItem = {
  enrollmentId: string
  status: string
  source?: string
  expiresAt?: string | null
  enrolledAt?: string
  course: CourseRef
}

type HistoryItem = {
  enrollmentId: string
  completedAt?: string | null
  expiresAt?: string | null
  score?: number | null
  course: {
    id: string
    code?: string | null
    title: string
    category: string
    isMandatory?: boolean
  }
}

type ExpiringSoonItem = {
  enrollmentId: string
  expiresAt?: string | null
  course: { id: string; title: string; code?: string | null }
}

type RecommendedCourse = {
  id: string
  code?: string | null
  title: string
  category: string
  format?: string
  durationHours?: number | null
  provider?: string | null
}

type MyTrainingData = {
  requiredPending: EnrollmentItem[]
  jobRequired: CourseRef[]
  recommended: RecommendedCourse[]
  history: HistoryItem[]
  expiringSoon: ExpiringSoonItem[]
}

const CATEGORY_LABELS: Record<string, string> = {
  COMPLIANCE: '컴플라이언스',
  TECHNICAL: '기술',
  LEADERSHIP: '리더십',
  SAFETY_TRAINING: '안전',
  ONBOARDING_TRAINING: '온보딩',
  OTHER: '기타',
}

const FORMAT_LABELS: Record<string, string> = {
  online: '온라인',
  offline: '오프라인',
  blended: '혼합',
  self_paced: '자기주도',
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ENROLLED: { label: '수강대기', className: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]' },
  IN_PROGRESS: { label: '수강중', className: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]' },
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ─── Component ───────────────────────────────────────────

export default function MyTrainingClient({ user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('mySpace')
  const { toast } = useToast()
  const [data, setData] = useState<MyTrainingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<MyTrainingData>('/api/v1/training/my')
      setData(res.data ?? null)
    } catch {
      toast({ title: '교육 현황 로드 실패', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleEnroll = async (courseId: string) => {
    setEnrollingId(courseId)
    try {
      await apiClient.post('/api/v1/training/enrollments', {
        courseId,
        source: 'manual',
      })
      toast({ title: tCommon('created') })
      fetchData()
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' })
    } finally {
      setEnrollingId(null)
    }
  }

  const handleStartCourse = async (enrollmentId: string) => {
    try {
      await apiClient.patch(`/api/v1/training/enrollments/${enrollmentId}`, {
        status: 'IN_PROGRESS',
      })
      toast({ title: tCommon('completed') })
      fetchData()
    } catch {
      toast({ title: tCommon('saveFailed'), variant: 'destructive' })
    }
  }

  const handleComplete = async (enrollmentId: string) => {
    try {
      await apiClient.patch(`/api/v1/training/enrollments/${enrollmentId}`, {
        status: 'ENROLLMENT_COMPLETED',
        completedAt: new Date().toISOString(),
      })
      toast({ title: tCommon('completed') })
      fetchData()
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-[#F5F5F5] rounded w-48 animate-pulse" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[#F5F5F5] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const { requiredPending = [], jobRequired = [], recommended = [], history = [], expiringSoon = [] } = data ?? {}

  return (
    <div className="p-6 space-y-6">
      {/* ─── 헤더 ─── */}
      <div>
        <nav className="text-xs text-[#999] mb-1">나의 공간</nav>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">내 교육 현황</h1>
      </div>

      {/* ─── 만료 임박 경고 ─── */}
      {expiringSoon.length > 0 && (
        <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-[#C2410C]" />
            <span className="text-sm font-semibold text-[#C2410C]">이수 만료 임박 ({expiringSoon.length}건)</span>
          </div>
          <div className="space-y-1.5">
            {expiringSoon.map((item) => {
              const days = daysUntil(item.expiresAt)
              return (
                <div key={item.enrollmentId} className="flex items-center justify-between text-sm">
                  <span className="text-[#1A1A1A]">{item.course.title}</span>
                  <span className="text-[#C2410C] font-medium">
                    {days !== null ? `${days}일 후 만료` : '-'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── KPI 요약 ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`${CARD_STYLES.kpi} text-center`}>
          <p className="text-xs text-[#666] mb-1">미이수 필수</p>
          <p className="text-3xl font-bold text-[#EF4444]">{requiredPending.length}</p>
        </div>
        <div className={`${CARD_STYLES.kpi} text-center`}>
          <p className="text-xs text-[#666] mb-1">신청 필요</p>
          <p className="text-3xl font-bold text-[#B45309]">{jobRequired.length}</p>
        </div>
        <div className={`${CARD_STYLES.kpi} text-center`}>
          <p className="text-xs text-[#666] mb-1">추천 과정</p>
          <p className="text-3xl font-bold text-[#4B6DE0]">{recommended.length}</p>
        </div>
        <div className={`${CARD_STYLES.kpi} text-center`}>
          <p className="text-xs text-[#666] mb-1">이수 완료</p>
          <p className="text-3xl font-bold text-[#047857]">{history.length}</p>
        </div>
      </div>

      {/* ─── 진행 중인 필수 교육 ─── */}
      {requiredPending.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#EF4444]" />
            미이수 필수 교육
          </h2>
          <div className="space-y-3">
            {requiredPending.map((item) => {
              const statusInfo = STATUS_LABELS[item.status] ?? { label: item.status, className: 'bg-[#FAFAFA] text-[#555] border-[#E8E8E8]' }
              return (
                <div key={item.enrollmentId} className={CARD_STYLES.padded}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-[#1A1A1A] text-sm">{item.course.title}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 ${statusInfo.className}`}>{statusInfo.label}</Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">필수</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#666] flex-wrap">
                        <span>{CATEGORY_LABELS[item.course.category] ?? item.course.category}</span>
                        {item.course.durationHours && <span>{item.course.durationHours}h</span>}
                        {item.course.format && <span>{FORMAT_LABELS[item.course.format] ?? item.course.format}</span>}
                        {item.expiresAt && (
                          <span className="text-[#EF4444]">마감: {formatDate(item.expiresAt)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {item.status === 'ENROLLED' && (
                        <Button size="sm" onClick={() => handleStartCourse(item.enrollmentId)}>
                          학습 시작
                        </Button>
                      )}
                      {item.status === 'IN_PROGRESS' && (
                        <Button size="sm" className="bg-[#059669] hover:bg-[#047857]" onClick={() => handleComplete(item.enrollmentId)}>
                          이수 완료
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ─── 미등록 직무 필수 과정 ─── */}
      {jobRequired.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#B45309]" />
            신청 필요 과정
          </h2>
          <div className="space-y-3">
            {jobRequired.map((course) => (
              <div key={course.id} className={CARD_STYLES.padded}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-[#1A1A1A] text-sm">{course.title}</span>
                      <Badge className="text-[10px] px-1.5 py-0 bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]">필수</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#666] flex-wrap">
                      <span>{CATEGORY_LABELS[course.category] ?? course.category}</span>
                      {course.durationHours && <span>{course.durationHours}h</span>}
                      {course.provider && <span>{course.provider}</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={enrollingId === course.id}
                    onClick={() => handleEnroll(course.id)}
                  >
                    {enrollingId === course.id ? '신청 중...' : '수강 신청'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── AI 추천 과정 ─── */}
      {recommended.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#4B6DE0]" />
            스킬 갭 기반 추천 과정
          </h2>
          <div className="space-y-3">
            {recommended.map((course) => (
              <div key={course.id} className={CARD_STYLES.padded}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-[#1A1A1A] text-sm">{course.title}</span>
                      <Badge className="text-[10px] px-1.5 py-0 bg-[#E0E7FF] text-[#4B6DE0] border-[#C7D2FE]">추천</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#666] flex-wrap">
                      <span>{CATEGORY_LABELS[course.category] ?? course.category}</span>
                      {course.durationHours && <span>{course.durationHours}h</span>}
                      {course.format && <span>{FORMAT_LABELS[course.format] ?? course.format}</span>}
                      {course.provider && <span>{course.provider}</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={enrollingId === course.id}
                    onClick={() => handleEnroll(course.id)}
                  >
                    {enrollingId === course.id ? '신청 중...' : '신청'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── 이수 이력 ─── */}
      <section>
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-[#047857]" />
          이수 이력
          <span className="text-sm font-normal text-[#999]">(최근 20건)</span>
        </h2>
        {history.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-8 text-center text-sm text-[#999]">
            이수 이력이 없습니다.
          </div>
        ) : (
          <div className={TABLE_STYLES.wrapper}>
            <table className={TABLE_STYLES.table}>
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>과정명</th>
                  <th className={TABLE_STYLES.headerCell}>분류</th>
                  <th className={TABLE_STYLES.headerCell}>이수일</th>
                  <th className={TABLE_STYLES.headerCell}>유효기간</th>
                  <th className={TABLE_STYLES.headerCell}>점수</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.enrollmentId} className={TABLE_STYLES.row}>
                    <td className={TABLE_STYLES.cell}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#1A1A1A]">{item.course.title}</span>
                        {item.course.isMandatory && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]">필수</Badge>
                        )}
                      </div>
                    </td>
                    <td className={cn(TABLE_STYLES.cell, "text-[#666]")}>
                      {CATEGORY_LABELS[item.course.category] ?? item.course.category}
                    </td>
                    <td className={cn(TABLE_STYLES.cell, "text-[#666]")}>{formatDate(item.completedAt)}</td>
                    <td className={cn(TABLE_STYLES.cell, "text-[#666]")}>{formatDate(item.expiresAt)}</td>
                    <td className={cn(TABLE_STYLES.cell, "text-[#666]")}>
                      {item.score !== null && item.score !== undefined ? `${item.score}점` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── 빈 상태 ─── */}
      {requiredPending.length === 0 && jobRequired.length === 0 && recommended.length === 0 && history.length === 0 && (
        <div className="bg-white rounded-xl border border-[#E8E8E8] p-12 text-center">
          <Clock className="h-10 w-10 text-[#D4D4D4] mx-auto mb-3" />
          <EmptyState />
        </div>
      )}
    </div>
  )
}
