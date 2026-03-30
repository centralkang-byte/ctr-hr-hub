'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 채용공고 상세 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ChevronLeft, Briefcase, Edit3, Globe, Lock,
  Calendar, MapPin, Users, User, Tag,
} from 'lucide-react'
import { format } from 'date-fns'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { BUTTON_VARIANTS, BUTTON_SIZES } from '@/lib/styles'
import { STATUS_VARIANT } from '@/lib/styles/status'

// ─── Label Maps ──────────────────────────────────────────

const STATUS_KEYS: Record<string, string> = {
  DRAFT: 'statusDRAFT',
  OPEN: 'statusOPEN',
  CLOSED: 'statusCLOSED',
  CANCELLED: 'statusCANCELLED',
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  DRAFT: STATUS_VARIANT.neutral,
  OPEN: STATUS_VARIANT.success,
  CLOSED: STATUS_VARIANT.warning,
  CANCELLED: STATUS_VARIANT.error,
}

const EMPLOYMENT_TYPE_KEYS: Record<string, string> = {
  FULL_TIME: 'typeFULL_TIME',
  CONTRACT: 'typeCONTRACT',
  DISPATCH: 'typeDISPATCH',
  INTERN: 'typeINTERN',
}

const WORK_MODE_KEYS: Record<string, string> = {
  OFFICE: 'modeOFFICE',
  REMOTE: 'modeREMOTE',
  HYBRID: 'modeHYBRID',
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

export default function PostingDetailClient({
 user, id }: Props) {
  const tCommon = useTranslations('common')
  const t = useTranslations('recruitment')
  const router = useRouter()
  const [data, setData] = useState<PostingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<PostingDetail>(`/api/v1/recruitment/postings/${id}`)
      setData(res.data)
    } catch (err) {
      toast({ title: '채용 공고 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
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
    } catch (err) {
      toast({ title: '채용 공고 처리 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleClose = async () => {
    setActionLoading(true)
    try {
      await apiClient.put(`/api/v1/recruitment/postings/${id}/close`)
      fetchDetail()
    } catch (err) {
      toast({ title: '채용 공고 처리 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  void user

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-[#999]">
          <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
          {t('loadingData')}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-[#999]">{t('notFound')}</p>
      </div>
    )
  }

  const formatSalary = (min: number | null, max: number | null) => {
    if (data.salaryHidden) return t('salaryHidden')
    if (!min && !max) return '-'
    const fmt = (n: number) => n.toLocaleString('ko-KR')
    if (min && max) return t('salaryRangeFormat', { min: fmt(min), max: fmt(max) })
    if (min) return t('salaryAbove', { amount: fmt(min) })
    if (max) return t('salaryBelow', { amount: fmt(max) })
    return '-'
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/recruitment')}
            className="p-2 rounded-lg border border-border hover:bg-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-[#666]" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-[-0.02em]">
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
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border text-foreground hover:bg-background rounded-lg transition-colors duration-150"
              >
                <Edit3 className="w-4 h-4" />
                {t('editButton')}
              </button>
              <button
                onClick={handlePublish}
                disabled={actionLoading}
                className={`inline-flex items-center gap-2 ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.primary} disabled:opacity-50`}
              >
                <Globe className="w-4 h-4" />
                {t('publishButton')}
              </button>
            </>
          )}
          {data.status === 'OPEN' && (
            <>
              <button
                onClick={handleClose}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors duration-150 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                {t('closePostingButton')}
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
          <div className="bg-white border border-border rounded-xl p-6">
            <h2 className="text-base font-bold text-foreground mb-4 tracking-[-0.02em]">
              {t('descriptionSection')}
            </h2>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {data.description}
            </p>
          </div>

          {/* Requirements */}
          {data.requirements && (
            <div className="bg-white border border-border rounded-xl p-6">
              <h2 className="text-base font-bold text-foreground mb-4 tracking-[-0.02em]">
                {t('requirementsSection')}
              </h2>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {data.requirements}
              </p>
            </div>
          )}

          {/* Preferred */}
          {data.preferred && (
            <div className="bg-white border border-border rounded-xl p-6">
              <h2 className="text-base font-bold text-foreground mb-4 tracking-[-0.02em]">
                {t('preferredSection')}
              </h2>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {data.preferred}
              </p>
            </div>
          )}

          {/* Application Summary */}
          <div className="bg-white border border-border rounded-xl p-6">
            <h2 className="text-base font-bold text-foreground mb-4 tracking-[-0.02em]">
              {t('applicationStatus')}
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-lg">
                <Users className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold text-blue-500">{data._count.applications}</p>
                  <p className="text-xs text-[#666]">{t('totalApplicantLabel')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right (35%) */}
        <div className="flex-[35] space-y-6">
          {/* Status Card */}
          <div className="bg-white border border-border rounded-xl p-6">
            <h3 className="text-sm font-bold text-foreground mb-4 tracking-[-0.02em]">
              {t('postingInfo')}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#999]">{t('statusLabel')}</span>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${STATUS_BADGE_STYLES[data.status] ?? STATUS_VARIANT.neutral}`}>
                  {STATUS_KEYS[data.status] ? t(STATUS_KEYS[data.status]) : data.status}
                </span>
              </div>

              <div className="border-t border-border" />

              <InfoRow
                icon={<Briefcase className="w-4 h-4 text-[#999]" />}
                label={t('department')}
                value={data.department?.name ?? '-'}
              />
              <InfoRow
                icon={<Tag className="w-4 h-4 text-[#999]" />}
                label={t('jobGrade')}
                value={data.jobGrade?.name ?? '-'}
              />
              <InfoRow
                icon={<Tag className="w-4 h-4 text-[#999]" />}
                label={t('jobCategory')}
                value={data.jobCategory?.name ?? '-'}
              />
              <InfoRow
                icon={<Briefcase className="w-4 h-4 text-[#999]" />}
                label={t('employmentType')}
                value={EMPLOYMENT_TYPE_KEYS[data.employmentType] ? t(EMPLOYMENT_TYPE_KEYS[data.employmentType]) : data.employmentType}
              />
              {data.workMode && (
                <InfoRow
                  icon={<MapPin className="w-4 h-4 text-[#999]" />}
                  label={t('workMode')}
                  value={WORK_MODE_KEYS[data.workMode] ? t(WORK_MODE_KEYS[data.workMode]) : data.workMode}
                />
              )}
              <InfoRow
                icon={<Users className="w-4 h-4 text-[#999]" />}
                label={t('headcountColumn')}
                value={t('headcountWithUnit', { count: data.headcount })}
              />
              <InfoRow
                icon={<Tag className="w-4 h-4 text-[#999]" />}
                label={t('salaryLabel')}
                value={formatSalary(data.salaryRangeMin, data.salaryRangeMax)}
              />
              {data.deadlineDate && (
                <InfoRow
                  icon={<Calendar className="w-4 h-4 text-[#999]" />}
                  label={t('deadlineDate')}
                  value={format(new Date(data.deadlineDate), 'yyyy-MM-dd')}
                />
              )}
              {data.recruiter && (
                <InfoRow
                  icon={<User className="w-4 h-4 text-[#999]" />}
                  label={t('recruiterInfo')}
                  value={data.recruiter.name}
                />
              )}
              {data.location && (
                <InfoRow
                  icon={<MapPin className="w-4 h-4 text-[#999]" />}
                  label={t('workLocation')}
                  value={data.location}
                />
              )}
            </div>
          </div>

          {/* Competencies */}
          {data.requiredCompetencies && Array.isArray(data.requiredCompetencies) && data.requiredCompetencies.length > 0 && (
            <div className="bg-white border border-border rounded-xl p-6">
              <h3 className="text-sm font-bold text-foreground mb-3 tracking-[-0.02em]">
                {t('requiredCompetencies')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.requiredCompetencies.map((comp, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-800 rounded"
                  >
                    {comp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white border border-border rounded-xl p-6">
            <h3 className="text-sm font-bold text-foreground mb-3 tracking-[-0.02em]">
              {t('timelineSection')}
            </h3>
            <div className="space-y-2">
              <TimelineItem
                label={t('createdDate')}
                date={data.createdAt}
              />
              {data.postedAt && (
                <TimelineItem
                  label={t('postedDate')}
                  date={data.postedAt}
                />
              )}
              {data.closedAt && (
                <TimelineItem
                  label={t('closedDate')}
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
        <span className="text-sm text-foreground">{value}</span>
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
