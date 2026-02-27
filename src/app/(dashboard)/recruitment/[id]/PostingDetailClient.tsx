'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 채용공고 상세 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Briefcase, Edit3, Globe, Lock,
  Calendar, MapPin, Users, User, Tag,
} from 'lucide-react'
import { format } from 'date-fns'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Label Maps ──────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '초안',
  OPEN: '진행중',
  CLOSED: '마감',
  CANCELLED: '취소',
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  DRAFT: 'bg-[#F5F5F5] text-[#999]',
  OPEN: 'bg-[#E8F5E9] text-[#2E7D32]',
  CLOSED: 'bg-[#FFF3E0] text-[#E65100]',
  CANCELLED: 'bg-[#FFEBEE] text-[#C62828]',
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: '정규직',
  CONTRACT: '계약직',
  DISPATCH: '파견직',
  INTERN: '인턴',
}

const WORK_MODE_LABELS: Record<string, string> = {
  OFFICE: '사무실',
  REMOTE: '재택',
  HYBRID: '혼합',
}

// ─── Types ───────────────────────────────────────────────

interface PostingDetail {
  id: string
  title: string
  description: string
  requirements: string | null
  preferred: string | null
  status: string
  employmentType: string
  headcount: number
  location: string | null
  salaryRangeMin: number | null
  salaryRangeMax: number | null
  salaryHidden: boolean
  workMode: string | null
  deadlineDate: string | null
  postedAt: string | null
  closedAt: string | null
  createdAt: string
  requiredCompetencies: string[] | null
  department: { id: string; name: string } | null
  jobGrade: { id: string; name: string } | null
  jobCategory: { id: string; name: string } | null
  creator: { id: string; name: string } | null
  recruiter: { id: string; name: string } | null
  _count: { applications: number }
}

interface Props {
  user: SessionUser
  id: string
}

// ─── Component ───────────────────────────────────────────

export default function PostingDetailClient({ user, id }: Props) {
  const router = useRouter()
  const [data, setData] = useState<PostingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<PostingDetail>(`/api/v1/recruitment/postings/${id}`)
      setData(res.data)
    } catch {
      /* silently handle */
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  const handlePublish = async () => {
    setActionLoading(true)
    try {
      await apiClient.put(`/api/v1/recruitment/postings/${id}/publish`)
      fetchDetail()
    } catch {
      /* silently handle */
    } finally {
      setActionLoading(false)
    }
  }

  const handleClose = async () => {
    setActionLoading(true)
    try {
      await apiClient.put(`/api/v1/recruitment/postings/${id}/close`)
      fetchDetail()
    } catch {
      /* silently handle */
    } finally {
      setActionLoading(false)
    }
  }

  void user

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-[#999]">
          <div className="w-4 h-4 border-2 border-[#E8E8E8] border-t-[#00C853] rounded-full animate-spin" />
          데이터를 불러오는 중...
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <p className="text-sm text-[#999]">채용 공고를 찾을 수 없습니다.</p>
      </div>
    )
  }

  const formatSalary = (min: number | null, max: number | null) => {
    if (data.salaryHidden) return '비공개'
    if (!min && !max) return '-'
    const fmt = (n: number) => n.toLocaleString('ko-KR')
    if (min && max) return `${fmt(min)} ~ ${fmt(max)} 원`
    if (min) return `${fmt(min)} 원 이상`
    if (max) return `${fmt(max)} 원 이하`
    return '-'
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/recruitment')}
            className="p-2 rounded-lg border border-[#E8E8E8] hover:bg-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-[#666]" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E3F2FD] rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-[#2196F3]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#333]" style={{ letterSpacing: '-0.02em' }}>
                {data.title}
              </h1>
              <p className="text-sm text-[#999]">
                {data.creator?.name ?? '-'} | {format(new Date(data.createdAt), 'yyyy-MM-dd')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.status === 'DRAFT' && (
            <>
              <button
                onClick={() => router.push(`/recruitment/${id}/edit`)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-[#E8E8E8] text-[#333] hover:bg-[#FAFAFA] rounded-lg transition-colors duration-150"
              >
                <Edit3 className="w-4 h-4" />
                수정
              </button>
              <button
                onClick={handlePublish}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg transition-colors duration-150 disabled:opacity-50"
              >
                <Globe className="w-4 h-4" />
                게시하기
              </button>
            </>
          )}
          {data.status === 'OPEN' && (
            <>
              <button
                onClick={handleClose}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#FF9800] hover:bg-[#F57C00] text-white rounded-lg transition-colors duration-150 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                마감하기
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content: 65/35 layout */}
      <div className="flex gap-6">
        {/* Left (65%) */}
        <div className="flex-[65] space-y-6">
          {/* Description */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
            <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
              직무 설명
            </h2>
            <p className="text-sm text-[#333] leading-relaxed whitespace-pre-wrap">
              {data.description}
            </p>
          </div>

          {/* Requirements */}
          {data.requirements && (
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
              <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
                자격 요건
              </h2>
              <p className="text-sm text-[#333] leading-relaxed whitespace-pre-wrap">
                {data.requirements}
              </p>
            </div>
          )}

          {/* Preferred */}
          {data.preferred && (
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
              <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
                우대 사항
              </h2>
              <p className="text-sm text-[#333] leading-relaxed whitespace-pre-wrap">
                {data.preferred}
              </p>
            </div>
          )}

          {/* Application Summary */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
            <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
              지원 현황
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-3 bg-[#E3F2FD] rounded-lg">
                <Users className="w-5 h-5 text-[#2196F3]" />
                <div>
                  <p className="text-2xl font-bold text-[#2196F3]">{data._count.applications}</p>
                  <p className="text-xs text-[#666]">총 지원자</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right (35%) */}
        <div className="flex-[35] space-y-6">
          {/* Status Card */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
            <h3 className="text-sm font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
              공고 정보
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#999]">상태</span>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${STATUS_BADGE_STYLES[data.status] ?? 'bg-[#F5F5F5] text-[#999]'}`}>
                  {STATUS_LABELS[data.status] ?? data.status}
                </span>
              </div>

              <div className="border-t border-[#F5F5F5]" />

              <InfoRow
                icon={<Briefcase className="w-4 h-4 text-[#999]" />}
                label="부서"
                value={data.department?.name ?? '-'}
              />
              <InfoRow
                icon={<Tag className="w-4 h-4 text-[#999]" />}
                label="직급"
                value={data.jobGrade?.name ?? '-'}
              />
              <InfoRow
                icon={<Tag className="w-4 h-4 text-[#999]" />}
                label="직군"
                value={data.jobCategory?.name ?? '-'}
              />
              <InfoRow
                icon={<Briefcase className="w-4 h-4 text-[#999]" />}
                label="고용형태"
                value={EMPLOYMENT_TYPE_LABELS[data.employmentType] ?? data.employmentType}
              />
              {data.workMode && (
                <InfoRow
                  icon={<MapPin className="w-4 h-4 text-[#999]" />}
                  label="근무형태"
                  value={WORK_MODE_LABELS[data.workMode] ?? data.workMode}
                />
              )}
              <InfoRow
                icon={<Users className="w-4 h-4 text-[#999]" />}
                label="채용인원"
                value={`${data.headcount}명`}
              />
              <InfoRow
                icon={<Tag className="w-4 h-4 text-[#999]" />}
                label="급여"
                value={formatSalary(data.salaryRangeMin, data.salaryRangeMax)}
              />
              {data.deadlineDate && (
                <InfoRow
                  icon={<Calendar className="w-4 h-4 text-[#999]" />}
                  label="마감일"
                  value={format(new Date(data.deadlineDate), 'yyyy-MM-dd')}
                />
              )}
              {data.recruiter && (
                <InfoRow
                  icon={<User className="w-4 h-4 text-[#999]" />}
                  label="채용담당자"
                  value={data.recruiter.name}
                />
              )}
              {data.location && (
                <InfoRow
                  icon={<MapPin className="w-4 h-4 text-[#999]" />}
                  label="근무지"
                  value={data.location}
                />
              )}
            </div>
          </div>

          {/* Competencies */}
          {data.requiredCompetencies && Array.isArray(data.requiredCompetencies) && data.requiredCompetencies.length > 0 && (
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
              <h3 className="text-sm font-bold text-[#333] mb-3" style={{ letterSpacing: '-0.02em' }}>
                필요 역량
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.requiredCompetencies.map((comp, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 text-xs font-medium bg-[#E3F2FD] text-[#1565C0] rounded"
                  >
                    {comp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
            <h3 className="text-sm font-bold text-[#333] mb-3" style={{ letterSpacing: '-0.02em' }}>
              타임라인
            </h3>
            <div className="space-y-2">
              <TimelineItem
                label="등록일"
                date={data.createdAt}
              />
              {data.postedAt && (
                <TimelineItem
                  label="게시일"
                  date={data.postedAt}
                />
              )}
              {data.closedAt && (
                <TimelineItem
                  label="마감일"
                  date={data.closedAt}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub Components ──────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div className="flex-1 flex items-center justify-between">
        <span className="text-xs text-[#999]">{label}</span>
        <span className="text-sm text-[#333]">{value}</span>
      </div>
    </div>
  )
}

function TimelineItem({ label, date }: { label: string; date: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#999]">{label}</span>
      <span className="text-sm text-[#666]">{format(new Date(date), 'yyyy-MM-dd HH:mm')}</span>
    </div>
  )
}
