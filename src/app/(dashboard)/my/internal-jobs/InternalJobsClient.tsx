'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 내부 공고 (직원 자기 지원)
// B4: /my/internal-jobs
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import {
  Search, Building2, MapPin, Users, Clock,
  CheckCircle2, ArrowRight, BriefcaseBusiness,
  ChevronDown,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { BUTTON_VARIANTS } from '@/lib/styles'

interface InternalJob {
  id: string
  title: string
  description: string
  employmentType: string
  headcount: number
  location?: string
  workMode?: string
  deadlineDate?: string
  salaryRangeMin?: number
  salaryRangeMax?: number
  salaryHidden?: boolean
  urgency: string
  targetDate?: string
  company: { id: string; name: string }
  department: { id: string; name: string }
  position?: { id: string; code: string; titleKo: string }
  alreadyApplied: boolean
  myStage?: string
  createdAt: string
}

const EMP_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: '정규직',
  CONTRACT: '계약직',
  DISPATCH: '파견직',
  INTERN: '인턴',
}

const WORK_MODE_LABELS: Record<string, string> = {
  OFFICE: '사무실',
  REMOTE: '원격',
  HYBRID: '하이브리드',
}

const URGENCY_COLORS: Record<string, string> = {
  urgent: 'bg-[#FEE2E2] text-[#B91C1C]',
  normal: 'bg-[#FEF3C7] text-[#B45309]',
  low: 'bg-[#F0F9FF] text-[#0369A1]',
}

const STAGE_LABELS: Record<string, string> = {
  APPLIED: '서류접수',
  SCREENING: '서류심사',
  INTERVIEW_1: '1차 면접',
  INTERVIEW_2: '2차 면접',
  FINAL: '최종 면접',
  OFFER: '오퍼',
  HIRED: '합격',
  REJECTED: '불합격',
}

export default function InternalJobsClient({
  const tCommon = useTranslations('common')
  const t = useTranslations('mySpace')
 user }: { user: SessionUser }) {
  const [items, setItems] = useState<InternalJob[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [applying, setApplying] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (companyId) params.companyId = companyId
      const res = await apiClient.getList<InternalJob>('/api/v1/recruitment/internal-jobs', params)
      setItems(res.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [search, companyId])

  useEffect(() => { load() }, [load])

  const handleApply = async (jobId: string) => {
    if (applying) return
    setApplying(jobId)
    try {
      await apiClient.post(`/api/v1/recruitment/internal-jobs/${jobId}/apply`, {})
      await load()
    } catch (e: any) {
      alert(e?.message ?? '지원 중 오류가 발생했습니다.')
    } finally {
      setApplying(null)
    }
  }

  // 법인 목록 추출 (중복 제거)
  const companies = Array.from(
    new Map(items.map((i) => [i.company.id, i.company])).values(),
  )

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">사내 공개 채용</h1>
        <p className="text-sm text-[#666] mt-0.5">
          그룹 내 공개된 내부 채용 공고입니다. 관심 있는 포지션에 지원하세요.
        </p>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="공고명 또는 부서 검색..."
            className="w-full pl-9 pr-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 focus:border-[#00C853]"
          />
        </div>
        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#555] focus:ring-2 focus:ring-[#00C853]/10 focus:border-[#00C853]"
        >
          <option value="">전체 법인</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* 공고 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-[#999] text-sm">로딩 중...</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-[#999]">
          <BriefcaseBusiness size={40} className="mb-3 text-[#E8E8E8]" />
          <p className="text-sm">현재 공개된 내부 채용 공고가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((job) => {
            const isExpanded = expandedId === job.id
            const urgencyColor = URGENCY_COLORS[job.urgency] ?? URGENCY_COLORS.normal
            const urgencyLabel = job.urgency === 'urgent' ? '긴급' : job.urgency === 'normal' ? '보통' : '낮음'

            return (
              <div
                key={job.id}
                className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden hover:border-[#00C853]/40 transition-colors"
              >
                {/* 카드 상단 */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* 배지 */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${urgencyColor}`}>
                          {urgencyLabel}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#00A844] font-medium">
                          내부 채용
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#F5F5F5] text-[#555]">
                          {EMP_TYPE_LABELS[job.employmentType] ?? job.employmentType}
                        </span>
                      </div>

                      {/* 제목 */}
                      <h3 className="font-semibold text-[#1A1A1A] text-base">{job.title}</h3>

                      {/* 메타 */}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm text-[#666]">
                        <span className="flex items-center gap-1">
                          <Building2 size={13} />
                          {job.company.name}
                        </span>
                        <span>·</span>
                        <span>{job.department.name}</span>
                        {job.location && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <MapPin size={13} />
                              {job.location}
                            </span>
                          </>
                        )}
                        {job.workMode && (
                          <>
                            <span>·</span>
                            <span>{WORK_MODE_LABELS[job.workMode] ?? job.workMode}</span>
                          </>
                        )}
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Users size={13} />
                          {job.headcount}명
                        </span>
                      </div>

                      {/* 급여 / 마감일 */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-[#888]">
                        {!job.salaryHidden && job.salaryRangeMin && job.salaryRangeMax && (
                          <span>
                            급여: {(job.salaryRangeMin / 10000).toFixed(0)}만
                            ~ {(job.salaryRangeMax / 10000).toFixed(0)}만원
                          </span>
                        )}
                        {job.deadlineDate && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            마감: {new Date(job.deadlineDate).toLocaleDateString('ko-KR')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 지원 버튼 / 상태 */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-2">
                      {job.alreadyApplied ? (
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-[#D1FAE5] text-[#047857] rounded-lg text-sm font-medium">
                          <CheckCircle2 size={14} />
                          {STAGE_LABELS[job.myStage ?? ''] ?? '지원완료'}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleApply(job.id)}
                          disabled={applying === job.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}
                        >
                          <ArrowRight size={14} />
                          {applying === job.id ? '지원 중...' : '지원하기'}
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : job.id)}
                        className="flex items-center gap-1 text-xs text-[#999] hover:text-[#555]"
                      >
                        상세 보기
                        <ChevronDown
                          size={13}
                          className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 공고 상세 (접기/펼치기) */}
                {isExpanded && (
                  <div className="border-t border-[#F5F5F5] p-5 bg-[#FAFAFA]">
                    <p className="text-sm text-[#555] whitespace-pre-wrap leading-relaxed">
                      {job.description}
                    </p>
                    {job.position && (
                      <p className="mt-3 text-xs text-[#999]">
                        포지션: [{job.position.code}] {job.position.titleKo}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
