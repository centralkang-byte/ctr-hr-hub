'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 채용 요청 목록 + 승인함
// B4: Requisition List & Approval Queue
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Filter, ChevronRight, Clock, CheckCircle2,
  XCircle, AlertTriangle, FileText, Building2,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import RequisitionApproveModal from './RequisitionApproveModal'
import { CARD_STYLES, BUTTON_VARIANTS } from '@/lib/styles'

interface Requisition {
  id: string
  reqNumber: string
  title: string
  urgency: 'urgent' | 'normal' | 'low'
  status: string
  headcount: number
  employmentType: string
  currentStep: number
  createdAt: string
  company: { id: string; name: string }
  department: { id: string; name: string }
  requester: { id: string; name: string }
  approvalRecords: Array<{
    id: string
    stepOrder: number
    approverRole: string
    status: string
    comment?: string
  }>
}

const URGENCY_LABELS: Record<string, { label: string; color: string }> = {
  urgent: { label: '긴급도', color: 'bg-[#FEE2E2] text-[#B91C1C]' },
  normal: { label: '평균', color: 'bg-[#FEF3C7] text-[#B45309]' },
  low: { label: '낮음', color: 'bg-[#F0F9FF] text-[#0369A1]' },
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: '임시저장', color: 'bg-[#FAFAFA] text-[#555]', icon: <FileText size={12} /> },
  pending: { label: '결재중', color: 'bg-[#FEF3C7] text-[#B45309]', icon: <Clock size={12} /> },
  approved: { label: '승인', color: 'bg-[#D1FAE5] text-[#047857]', icon: <CheckCircle2 size={12} /> },
  rejected: { label: '반려', color: 'bg-[#FEE2E2] text-[#B91C1C]', icon: <XCircle size={12} /> },
  cancelled: { label: '취소', color: 'bg-[#FAFAFA] text-[#999]', icon: <XCircle size={12} /> },
  filled: { label: '충원완료', color: 'bg-[#EDF1FE] text-[#4B6DE0]', icon: <CheckCircle2 size={12} /> },
}

const STEP_ROLE_LABELS: Record<string, string> = {
  direct_manager: '팀장',
  dept_head: '부서장',
  hr_admin: 'HR',
  ceo: '대표',
  finance: '경영관리',
}

export default function RequisitionListClient({user }: {
  user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('recruitment')
  const router = useRouter()
  const [items, setItems] = useState<Requisition[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'my' | 'pending'>('all')
  const [search, setSearch] = useState('')
  const [approveTarget, setApproveTarget] = useState<Requisition | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isHR = [ROLE.HR_ADMIN, ROLE.SUPER_ADMIN].includes(user.role as any)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (tab === 'pending') params.status = 'pending'
      if (tab === 'my') params.myApprovals = 'true'
      if (search) params.search = search
      const res = await apiClient.getList<Requisition>('/api/v1/recruitment/requisitions', params)
      setItems(res.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [tab, search])

  useEffect(() => { load() }, [load])

  const handleApproveSuccess = () => {
    setApproveTarget(null)
    load()
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('requisitionTitle')}</h1>
          <p className="text-sm text-[#666] mt-0.5">{t('department_kec9ea5_kecb184ec_kec9a94ec_kebb08f_keab2b0ec_management')}</p>
        </div>
        <button
          onClick={() => router.push('/recruitment/requisitions/new')}
          className={`flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg text-sm font-medium`}
        >
          <Plus size={16} />
          {t('requisition_kec9e91ec')}
        </button>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-[#E8E8E8]">
        {[
          { key: 'all', label: t('all_kec9a94ec') },
          { key: 'pending', label: t('kr_keab2b0ec_keb8c80ea') },
          ...(isHR ? [{ key: 'my', label: t('kr_keb8298ec_keab2b0ec') }] : []),
        ].map((t) => (
          <button
            key={t.key}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
              tab === t.key
                ? 'border-[#5E81F4] text-[#5E81F4]'
                : 'border-transparent text-[#666] hover:text-[#333]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="직무명, 부서, 요청자 검색..."
            className="w-full pl-9 pr-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10 focus:border-[#5E81F4]"
          />
        </div>
        <button className="flex items-center gap-2 px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#555] hover:bg-[#FAFAFA]">
          <Filter size={14} />
          {t('filter')}
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-[#999] text-sm">{tCommon('loading')}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-[#999]">
          <FileText size={40} className="mb-3 text-[#E8E8E8]" />
          <EmptyState title="데이터가 없습니다" description="조건을 변경하거나 새로운 데이터를 추가해보세요." />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const urgency = URGENCY_LABELS[item.urgency]
            const statusInfo = STATUS_LABELS[item.status] ?? STATUS_LABELS.draft
            const totalSteps = item.approvalRecords.length
            const canApprove =
              isHR && item.status === 'pending' &&
              item.approvalRecords.some(
                (r) => r.stepOrder === item.currentStep && r.status === 'pending',
              )

            return (
              <div
                key={item.id}
                className={`${CARD_STYLES.kpi} hover:border-[#5E81F4]/40 transition-colors`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-[#999]">{item.reqNumber}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${urgency.color}`}>
                        {urgency.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.icon}
                        {statusInfo.label}
                        {item.status === 'pending' && totalSteps > 0 && ` (${item.currentStep}/${totalSteps})`}
                      </span>
                    </div>
                    <h3 className="font-semibold text-[#1A1A1A]">{item.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-[#666]">
                      <span className="flex items-center gap-1">
                        <Building2 size={13} />
                        {item.company.name}
                      </span>
                      <span>·</span>
                      <span>{item.department.name}</span>
                      <span>·</span>
                      <span>요청자: {item.requester.name}</span>
                      <span>·</span>
                      <span>{item.headcount}명</span>
                    </div>

                    {/* 결재 스테퍼 */}
                    {item.approvalRecords.length > 0 && (
                      <div className="flex items-center gap-1 mt-3">
                        {item.approvalRecords.map((record, idx) => {
                          const isActive = record.stepOrder === item.currentStep
                          const isDone = record.status === 'approved'
                          const isRejected = record.status === 'rejected'
                          return (
                            <div key={record.id} className="flex items-center gap-1">
                              <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                isRejected ? 'bg-[#FEE2E2] text-[#B91C1C]' :
                                isDone ? 'bg-[#D1FAE5] text-[#047857]' :
                                isActive ? 'bg-[#FEF3C7] text-[#B45309]' :
                                'bg-[#F5F5F5] text-[#999]'
                              }`}>
                                {isDone ? '✅' : isRejected ? '❌' : isActive ? '⏳' : '⬜'}
                                {STEP_ROLE_LABELS[record.approverRole] ?? record.approverRole}
                              </div>
                              {idx < item.approvalRecords.length - 1 && (
                                <ChevronRight size={14} className="text-[#D4D4D4]" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {canApprove && (
                      <button
                        onClick={() => setApproveTarget(item)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#059669] text-white text-xs font-medium rounded-lg hover:bg-[#047857]"
                      >
                        <CheckCircle2 size={13} />
                        결재
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/recruitment/requisitions/${item.id}`)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-[#D4D4D4] text-[#555] text-xs rounded-lg hover:bg-[#FAFAFA]"
                    >
                      {t('kr_kec8381ec')}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 결재 모달 */}
      {approveTarget && (
        <RequisitionApproveModal
          requisition={approveTarget}
          onClose={() => setApproveTarget(null)}
          onSuccess={handleApproveSuccess}
        />
      )}
    </div>
  )
}
