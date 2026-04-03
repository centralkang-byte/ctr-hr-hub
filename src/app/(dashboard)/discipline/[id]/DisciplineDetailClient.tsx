'use client'

import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 징계 상세 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronLeft, Gavel, User, FileText, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { apiClient } from '@/lib/api'
import { STATUS_VARIANT } from '@/lib/styles/status'
import type { SessionUser } from '@/types'

// ─── Badge Styles ────────────────────────────────────────

const STATUS_BADGE_STYLES: Record<string, string> = {
  DISCIPLINE_ACTIVE: STATUS_VARIANT.error,
  DISCIPLINE_EXPIRED: STATUS_VARIANT.neutral,
  DISCIPLINE_OVERTURNED: STATUS_VARIANT.success,
}

const APPEAL_BADGE_STYLES: Record<string, string> = {
  NONE: STATUS_VARIANT.neutral,
  FILED: STATUS_VARIANT.warning,
  UNDER_REVIEW: STATUS_VARIANT.info,
  UPHELD: STATUS_VARIANT.error,
  OVERTURNED: STATUS_VARIANT.success,
}

// ─── Types ───────────────────────────────────────────────

interface DisciplinaryDetail {
  id: string
  actionType: string
  category: string
  incidentDate: string
  description: string
  status: string
  appealStatus: string
  appealDate: string | null
  appealText: string | null
  appealResult: string | null
  evidenceKeys: string[]
  committeeDate: string | null
  committeeMembers: string[]
  decision: string | null
  decisionDate: string | null
  suspensionStart: string | null
  suspensionEnd: string | null
  validMonths: number | null
  expiresAt: string | null
  salaryReductionRate: number | null
  salaryReductionMonths: number | null
  employee: {
    id: string
    name: string
    employeeNo: string
    department: { id: string; name: string } | null
    jobGrade: { id: string; name: string } | null
  }
  issuer: { id: string; name: string } | null
  demotionGrade: { id: string; name: string } | null
}

interface Props {
  user: SessionUser
  id: string
}

// ─── Component ───────────────────────────────────────────

export default function DisciplineDetailClient({ user, id }: Props) {
  const router = useRouter()
  const t = useTranslations('disciplineDetail')
  const tPage = useTranslations('disciplinePage')
  const tCommon = useTranslations('common')

  const [data, setData] = useState<DisciplinaryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [appealText, setAppealText] = useState('')
  const [appealSubmitting, setAppealSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<DisciplinaryDetail>(`/api/v1/disciplinary/${id}`)
      setData(res.data)
    } catch (err) {
      toast({ title: '징계 상세 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAppeal = async () => {
    if (!appealText.trim()) return
    setAppealSubmitting(true)
    try {
      await apiClient.put(`/api/v1/disciplinary/${id}/appeal`, {
        appealText: appealText.trim(),
      })
      await fetchData()
      setAppealText('')
    } catch (err) {
      toast({ title: '징계 처리 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
    } finally {
      setAppealSubmitting(false)
    }
  }

  void user

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
          {tPage('loadingData')}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="text-center text-sm text-muted-foreground py-12">
          {t('notFound')}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/discipline')}
          className="p-2 border border-border rounded-lg hover:bg-background transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-destructive/5 rounded-lg flex items-center justify-center">
            <Gavel className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-[-0.02em]">
              {t('title')}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${STATUS_BADGE_STYLES[data.status] ?? STATUS_VARIANT.neutral}`}>
                {tPage(`statusLabels.${data.status}`, { defaultValue: data.status })}
              </span>
              <span className="text-xs text-muted-foreground">
                {tPage(`typeLabels.${data.actionType}`, { defaultValue: data.actionType })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 65/35 Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Left Panel: Detail */}
        <div className="space-y-6">
          {/* Info Card */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-base font-bold text-foreground mb-4 tracking-[-0.02em]">
              {t('disciplineInfo')}
            </h2>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <InfoItem label={t('targetEmployee')} value={data.employee.name} />
              <InfoItem label={tCommon('department')} value={data.employee.department?.name ?? '-'} />
              <InfoItem label={tCommon('grade')} value={data.employee.jobGrade?.name ?? '-'} />
              <InfoItem label={tPage('disciplineType')} value={tPage(`typeLabels.${data.actionType}`, { defaultValue: data.actionType })} />
              <InfoItem label={tCommon('category')} value={tPage(`categoryLabels.${data.category}`, { defaultValue: data.category })} />
              <InfoItem label={tPage('incidentDate')} value={format(new Date(data.incidentDate), 'yyyy-MM-dd')} />
              <InfoItem label={t('validPeriod')} value={data.validMonths ? t('monthsValue', { count: data.validMonths }) : '-'} />
              <InfoItem label={t('expiryDate')} value={data.expiresAt ? format(new Date(data.expiresAt), 'yyyy-MM-dd') : '-'} />
              {data.issuer && <InfoItem label={t('issuer')} value={data.issuer.name} />}
            </div>
          </div>

          {/* Description */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2 tracking-[-0.02em]">
              <FileText className="w-4 h-4 text-muted-foreground" />
              {t('reason')}
            </h2>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {data.description}
            </p>
          </div>

          {/* Evidence */}
          {data.evidenceKeys && data.evidenceKeys.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-base font-bold text-foreground mb-3 tracking-[-0.02em]">
                {t('evidence')}
              </h2>
              <div className="space-y-1.5">
                {data.evidenceKeys.map((key, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-blue-500">
                    <FileText className="w-4 h-4" />
                    <span className="truncate">{key}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Committee */}
          {(data.committeeDate || (data.committeeMembers && data.committeeMembers.length > 0)) && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-base font-bold text-foreground mb-4 tracking-[-0.02em]">
                {t('committee')}
              </h2>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                {data.committeeDate && (
                  <InfoItem label={t('committeeDate')} value={format(new Date(data.committeeDate), 'yyyy-MM-dd')} />
                )}
                {data.decisionDate && (
                  <InfoItem label={t('decisionDate')} value={format(new Date(data.decisionDate), 'yyyy-MM-dd')} />
                )}
                {data.committeeMembers && data.committeeMembers.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground">{t('committeeMembers')}</span>
                    <p className="text-sm text-foreground">{data.committeeMembers.join(', ')}</p>
                  </div>
                )}
                {data.decision && (
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground">{t('decisionContent')}</span>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{data.decision}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Conditional: Suspension */}
          {data.suspensionStart && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-base font-bold text-foreground mb-4 tracking-[-0.02em]">
                {t('suspensionPeriod')}
              </h2>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                <InfoItem label={tCommon('startDate')} value={format(new Date(data.suspensionStart), 'yyyy-MM-dd')} />
                {data.suspensionEnd && (
                  <InfoItem label={tCommon('endDate')} value={format(new Date(data.suspensionEnd), 'yyyy-MM-dd')} />
                )}
              </div>
            </div>
          )}

          {/* Conditional: Salary Reduction */}
          {data.salaryReductionRate !== null && data.salaryReductionRate !== undefined && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-base font-bold text-foreground mb-4 tracking-[-0.02em]">
                {t('salaryReductionInfo')}
              </h2>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                <InfoItem label={t('reductionRate')} value={`${Number(data.salaryReductionRate)}%`} />
                {data.salaryReductionMonths && (
                  <InfoItem label={t('reductionPeriod')} value={t('monthsValue', { count: data.salaryReductionMonths })} />
                )}
              </div>
            </div>
          )}

          {/* Conditional: Demotion */}
          {data.demotionGrade && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-base font-bold text-foreground mb-4 tracking-[-0.02em]">
                {t('demotionInfo')}
              </h2>
              <InfoItem label={t('demotionGrade')} value={data.demotionGrade.name} />
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="space-y-6">
          {/* Employee Summary */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/5 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-800" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{data.employee.name}</p>
                <p className="text-xs text-muted-foreground">{data.employee.employeeNo}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{tCommon('department')}</span>
                <span className="text-foreground">{data.employee.department?.name ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{tCommon('grade')}</span>
                <span className="text-foreground">{data.employee.jobGrade?.name ?? '-'}</span>
              </div>
            </div>
          </div>

          {/* Appeal Section */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2 tracking-[-0.02em]">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              {t('appealSection')}
            </h3>

            {data.appealStatus === 'NONE' && (
              <div className="space-y-3">
                <textarea
                  value={appealText}
                  onChange={(e) => setAppealText(e.target.value)}
                  rows={4}
                  placeholder={t('appealPlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none"
                />
                <button
                  onClick={handleAppeal}
                  disabled={!appealText.trim() || appealSubmitting}
                  className="w-full px-4 py-2 text-sm font-medium bg-orange-500/100 hover:bg-orange-600 text-white rounded-lg transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {appealSubmitting ? t('appealSubmitting') : t('submitAppeal')}
                </button>
              </div>
            )}

            {data.appealStatus === 'FILED' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${APPEAL_BADGE_STYLES.FILED}`}>
                    {tPage('appealLabels.FILED')}
                  </span>
                  {data.appealDate && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(data.appealDate), 'yyyy-MM-dd')}
                    </span>
                  )}
                </div>
                {data.appealText && (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{data.appealText}</p>
                )}
              </div>
            )}

            {data.appealStatus === 'UNDER_REVIEW' && (
              <div className="space-y-3">
                <span className={`px-2 py-1 text-xs font-medium rounded ${APPEAL_BADGE_STYLES.UNDER_REVIEW}`}>
                  {tPage('appealLabels.UNDER_REVIEW')}
                </span>
                {data.appealText && (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{data.appealText}</p>
                )}
              </div>
            )}

            {(data.appealStatus === 'UPHELD' || data.appealStatus === 'OVERTURNED') && (
              <div className="space-y-3">
                <span className={`px-2 py-1 text-xs font-medium rounded ${APPEAL_BADGE_STYLES[data.appealStatus]}`}>
                  {tPage(`appealLabels.${data.appealStatus}`)}
                </span>
                {data.appealText && (
                  <div className="mt-2">
                    <span className="text-xs text-muted-foreground">{t('appealContent')}</span>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{data.appealText}</p>
                  </div>
                )}
                {data.appealResult && (
                  <div className="mt-2">
                    <span className="text-xs text-muted-foreground">{t('appealReviewResult')}</span>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{data.appealResult}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Info Item Helper ────────────────────────────────────

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-sm text-foreground mt-0.5">{value}</p>
    </div>
  )
}
