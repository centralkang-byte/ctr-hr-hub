'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Talent Pool 관리
// B4: /recruitment/talent-pool
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import {
  Search, Users, Clock, CheckCircle2, Mail,
  Phone, Tag, AlertTriangle, RefreshCw, UserPlus,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

interface TalentPoolEntry {
  id: string
  poolReason: string
  tags: string[]
  notes?: string
  consentGiven: boolean
  expiresAt: string
  status: string
  createdAt: string
  applicant: {
    id: string
    name: string
    email: string
    phone?: string
    source: string
    applications: Array<{
      stage: string
      posting: { title: string; company: { name: string } }
      createdAt: string
    }>
  }
  sourcePosting?: { id: string; title: string }
}

const POOL_REASON_LABELS: Record<string, { label: string; color: string }> = {
  rejected_qualified: { label: '우수 불합격', color: 'bg-[#E0E7FF] text-[#4B6DE0]' },
  withdrawn: { label: '자진 철회', color: 'bg-[#FEF3C7] text-[#B45309]' },
  overqualified: { label: '역량 초과', color: 'bg-[#F0F9FF] text-[#0369A1]' },
  manual: { label: '수동 등록', color: 'bg-[#FAFAFA] text-[#555]' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: '활성', color: 'bg-[#D1FAE5] text-[#047857]' },
  contacted: { label: '접촉 중', color: 'bg-[#FEF3C7] text-[#B45309]' },
  expired: { label: '만료', color: 'bg-[#FAFAFA] text-[#999]' },
  hired: { label: '채용 완료', color: 'bg-[#EDF1FE] text-[#4B6DE0]' },
}

const STAGE_LABELS: Record<string, string> = {
  APPLIED: '서류접수', SCREENING: '서류심사', INTERVIEW_1: '1차 면접',
  INTERVIEW_2: '2차 면접', FINAL: '최종', OFFER: '오퍼', HIRED: '합격', REJECTED: '불합격',
}

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default function TalentPoolClient({user }: {
  user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('recruitment')
  const [items, setItems] = useState<TalentPoolEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      const res = await apiClient.getList<TalentPoolEntry>('/api/v1/recruitment/talent-pool', params)
      setItems(res.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])

  const handleStatusChange = async (id: string, status: string) => {
    setUpdatingId(id)
    try {
      await apiClient.put(`/api/v1/recruitment/talent-pool/${id}`, { status })
      setItems((prev) =>
        prev.map((item) => item.id === id ? { ...item, status } : item),
      )
    } finally {
      setUpdatingId(null)
    }
  }

  const stats = {
    total: items.length,
    active: items.filter((i) => i.status === 'active').length,
    contacted: items.filter((i) => i.status === 'contacted').length,
    expiringSoon: items.filter((i) => i.status === 'active' && daysUntil(i.expiresAt) <= 30).length,
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Talent Pool</h1>
          <p className="text-sm text-[#666] mt-0.5">{t('good_ked9b84eb_kec9db8ec_ked9280_management_gdpr_2keb8584_kebb3b4ea')}</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#555] hover:bg-[#FAFAFA]"
        >
          <RefreshCw size={14} />
          {t('kr_kec8388eb')}
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: t('all_kec9db8ec'), value: stats.total, icon: <Users size={18} />, color: 'text-[#4B6DE0]' },
          { label: t('active'), value: stats.active, icon: <CheckCircle2 size={18} />, color: 'text-[#047857]' },
          { label: t('kr_keca091ec_keca491'), value: stats.contacted, icon: <Mail size={18} />, color: 'text-[#B45309]' },
          { label: t('kr_30kec9dbc_keb82b4_keba78ceb'), value: stats.expiringSoon, icon: <Clock size={18} />, color: 'text-[#B91C1C]' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className={`${kpi.color} mb-1`}>{kpi.icon}</div>
            <p className="text-2xl font-bold text-[#1A1A1A]">{kpi.value}</p>
            <p className="text-xs text-[#666] mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* 검색 / 필터 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tCommon('searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10 focus:border-[#5E81F4]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#555] focus:ring-2 focus:ring-[#5E81F4]/10 focus:border-[#5E81F4]"
        >
          <option value="">{t('all_status')}</option>
          <option value="active">{t('active')}</option>
          <option value="contacted">{t('kr_keca091ec_keca491')}</option>
          <option value="expired">{t('kr_keba78ceb')}</option>
          <option value="hired">{t('kr_kecb184ec_complete')}</option>
        </select>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-[#999] text-sm">{tCommon('loading')}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-[#999]">
          <UserPlus size={40} className="mb-3 text-[#E8E8E8]" />
          <EmptyState />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((entry) => {
            const reasonInfo = POOL_REASON_LABELS[entry.poolReason] ?? POOL_REASON_LABELS.manual
            const statusInfo = STATUS_LABELS[entry.status] ?? STATUS_LABELS.active
            const daysLeft = daysUntil(entry.expiresAt)
            const isExpiringSoon = entry.status === 'active' && daysLeft <= 30

            return (
              <div key={entry.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* 배지 행 */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${reasonInfo.color}`}>
                        {reasonInfo.label}
                      </span>
                      {!entry.consentGiven && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C]">
                          <AlertTriangle size={10} />
                          {t('kr_keb8f99ec_kec9786ec')}
                        </span>
                      )}
                      {isExpiringSoon && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309]">
                          <Clock size={10} />
                          {daysLeft}일 후 만료
                        </span>
                      )}
                    </div>

                    {/* 후보자 정보 */}
                    <h3 className="font-semibold text-[#1A1A1A]">{entry.applicant.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-[#666] flex-wrap">
                      <span className="flex items-center gap-1">
                        <Mail size={13} />
                        {entry.applicant.email}
                      </span>
                      {entry.applicant.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={13} />
                          {entry.applicant.phone}
                        </span>
                      )}
                    </div>

                    {/* 태그 */}
                    {entry.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <Tag size={13} className="text-[#999]" />
                        {entry.tags.map((tag) => (
                          <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[#F5F5F5] text-[#555]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 과거 지원 이력 */}
                    {entry.applicant.applications.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {entry.applicant.applications.map((app, idx) => (
                          <p key={idx} className="text-xs text-[#999]">
                            {app.posting.company.name} · {app.posting.title} →{' '}
                            <span className="font-medium">{STAGE_LABELS[app.stage] ?? app.stage}</span>{' '}
                            ({new Date(app.createdAt).toLocaleDateString('ko-KR')})
                          </p>
                        ))}
                      </div>
                    )}

                    {/* 등록 출처 공고 */}
                    {entry.sourcePosting && (
                      <p className="text-xs text-[#999] mt-1">
                        출처 공고: {entry.sourcePosting.title}
                      </p>
                    )}
                  </div>

                  {/* 상태 변경 */}
                  <div className="flex-shrink-0">
                    <select
                      value={entry.status}
                      onChange={(e) => handleStatusChange(entry.id, e.target.value)}
                      disabled={updatingId === entry.id}
                      className="px-2 py-1.5 border border-[#D4D4D4] rounded-lg text-xs text-[#555] disabled:opacity-50"
                    >
                      <option value="active">{t('active')}</option>
                      <option value="contacted">{t('kr_keca091ec_keca491')}</option>
                      <option value="hired">{t('kr_kecb184ec_complete')}</option>
                      <option value="expired">{t('kr_keba78ceb')}</option>
                    </select>
                    <p className="text-xs text-[#999] mt-1 text-right">
                      만료: {new Date(entry.expiresAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
