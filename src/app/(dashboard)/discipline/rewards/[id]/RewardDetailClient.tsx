'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 포상 상세 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronLeft, Award, User, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Badge Styles ────────────────────────────────────────

const REWARD_TYPE_BADGE_STYLES: Record<string, string> = {
  COMMENDATION: 'bg-primary/10 text-green-700',
  BONUS_AWARD: 'bg-blue-50 text-blue-800',
  CTR_VALUE_AWARD: 'bg-purple-50 text-purple-800',
  LONG_SERVICE: 'bg-orange-50 text-orange-800',
  INNOVATION: 'bg-primary/10 text-primary',
  SAFETY_AWARD: 'bg-blue-50 text-blue-500',
  PROMOTION_RECOMMENDATION: 'bg-primary/10 text-green-700',
  OTHER: 'bg-muted text-[#999]',
}

const CTR_VALUE_BADGE_STYLES: Record<string, string> = {
  CHALLENGE: 'bg-red-50 text-red-800',
  TRUST: 'bg-blue-50 text-blue-800',
  RESPONSIBILITY: 'bg-orange-50 text-orange-800',
  RESPECT: 'bg-purple-50 text-purple-800',
}

// ─── Types ───────────────────────────────────────────────

interface RewardDetail {
  id: string
  rewardType: string
  title: string
  description: string | null
  amount: number | null
  awardedDate: string
  documentKey: string | null
  ctrValue: string | null
  serviceYears: number | null
  createdAt: string
  employee: {
    id: string
    name: string
    employeeNo: string
    department: { id: string; name: string } | null
    jobGrade: { id: string; name: string } | null
  }
  issuer: { id: string; name: string } | null
}

interface Props {
  user: SessionUser
  id: string
}

// ─── Component ───────────────────────────────────────────

export default function RewardDetailClient({ user, id }: Props) {
  const router = useRouter()
  const t = useTranslations('rewardDetail')
  const tRewards = useTranslations('rewardsPage')
  const tCommon = useTranslations('common')

  const [data, setData] = useState<RewardDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<RewardDetail>(`/api/v1/rewards/${id}`)
      setData(res.data)
    } catch (err) {
      toast({ title: '포상 상세 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  void user

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-[#999]">
          <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
          {tRewards('loadingData')}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="text-center text-sm text-[#999] py-12">
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
          onClick={() => router.push('/discipline/rewards')}
          className="p-2 border border-border rounded-lg hover:bg-background transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-[#666]" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Award className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-[-0.02em]">
              {t('title')}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${REWARD_TYPE_BADGE_STYLES[data.rewardType] ?? 'bg-muted text-[#999]'}`}>
                {tRewards(`rewardTypeLabels.${data.rewardType}`, { defaultValue: data.rewardType })}
              </span>
              {data.rewardType === 'CTR_VALUE_AWARD' && data.ctrValue && (
                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${CTR_VALUE_BADGE_STYLES[data.ctrValue] ?? 'bg-muted text-[#999]'}`}>
                  {tRewards(`ctrValueLabels.${data.ctrValue}`, { defaultValue: data.ctrValue })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 65/35 Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Left Panel */}
        <div className="space-y-6">
          {/* Reward Info */}
          <div className="bg-white border border-border rounded-xl p-6">
            <h2 className="text-base font-bold text-foreground mb-4 tracking-[-0.02em]">
              {t('rewardInfo')}
            </h2>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <InfoItem label={tRewards('rewardName')} value={data.title} />
              <InfoItem label={tRewards('rewardType')} value={tRewards(`rewardTypeLabels.${data.rewardType}`, { defaultValue: data.rewardType })} />
              <InfoItem label={t('targetEmployee')} value={data.employee.name} />
              <InfoItem label={tCommon('department')} value={data.employee.department?.name ?? '-'} />
              <InfoItem label={tCommon('grade')} value={data.employee.jobGrade?.name ?? '-'} />
              <InfoItem
                label={tRewards('awardedDate')}
                value={format(new Date(data.awardedDate), 'yyyy-MM-dd')}
              />
              <InfoItem
                label={tCommon('amount')}
                value={
                  data.amount !== null && data.amount !== undefined
                    ? tRewards('amountValue', { amount: Number(data.amount).toLocaleString() })
                    : '-'
                }
              />
              {data.issuer && <InfoItem label={t('awardedById')} value={data.issuer.name} />}
              {data.serviceYears !== null && data.serviceYears !== undefined && (
                <InfoItem label={t('serviceYears')} value={t('serviceYearsValue', { years: data.serviceYears })} />
              )}
            </div>

            {/* CTR Value */}
            {data.rewardType === 'CTR_VALUE_AWARD' && data.ctrValue && (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-purple-800">{t('ctrCoreValue')}:</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${CTR_VALUE_BADGE_STYLES[data.ctrValue] ?? ''}`}>
                    {tRewards(`ctrValueLabels.${data.ctrValue}`, { defaultValue: data.ctrValue })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {data.description && (
            <div className="bg-white border border-border rounded-xl p-6">
              <h2 className="text-base font-bold text-foreground mb-3 tracking-[-0.02em]">
                {t('reason')}
              </h2>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {data.description}
              </p>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="space-y-6">
          {/* Employee Summary */}
          <div className="bg-white border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-800" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{data.employee.name}</p>
                <p className="text-xs text-[#999]">{data.employee.employeeNo}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#999]">{tCommon('department')}</span>
                <span className="text-foreground">{data.employee.department?.name ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#999]">{tCommon('grade')}</span>
                <span className="text-foreground">{data.employee.jobGrade?.name ?? '-'}</span>
              </div>
            </div>
          </div>

          {/* Date Info */}
          <div className="bg-white border border-border rounded-xl p-6">
            <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2 tracking-[-0.02em]">
              <Calendar className="w-4 h-4 text-[#666]" />
              {t('dateInfo')}
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#999]">{tRewards('awardedDate')}</span>
                <span className="text-foreground">{format(new Date(data.awardedDate), 'yyyy-MM-dd')}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#999]">{t('registeredDate')}</span>
                <span className="text-foreground">{format(new Date(data.createdAt), 'yyyy-MM-dd')}</span>
              </div>
            </div>
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
      <span className="text-xs text-[#999]">{label}</span>
      <p className="text-sm text-foreground mt-0.5">{value}</p>
    </div>
  )
}
