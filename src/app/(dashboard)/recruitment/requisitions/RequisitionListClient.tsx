'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 채용 요청 목록 + 승인함
// B4: Requisition List & Approval Queue
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Filter, ChevronRight, Clock, CheckCircle2,
  XCircle, FileText, Building2, Circle,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import RequisitionApproveModal from './RequisitionApproveModal'
import { CARD_STYLES, BUTTON_VARIANTS } from '@/lib/styles'
import { canApproveRequisition } from '@/lib/approval/can-approve-requisition'

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

const URGENCY_LABELS: Record<string, { labelKey: string; color: string }> = {
  urgent: { labelKey: 'urgencyUrgent', color: 'bg-destructive/10 text-destructive' },
  normal: { labelKey: 'urgencyNormal', color: 'bg-warning-bright/15 text-ctr-warning' },
  low: { labelKey: 'urgencyLow', color: 'bg-wt-7/10 text-wt-7' },
}

const STATUS_LABELS: Record<string, { labelKey: string; color: string; icon: React.ReactNode }> = {
  draft: { labelKey: 'statusDraft', color: 'bg-background text-muted-foreground', icon: <FileText size={12} /> },
  pending: { labelKey: 'statusPending', color: 'bg-warning-bright/15 text-ctr-warning', icon: <Clock size={12} /> },
  approved: { labelKey: 'statusApproved', color: 'bg-tertiary/10 text-[#006b39]', icon: <CheckCircle2 size={12} /> },
  rejected: { labelKey: 'statusRejected', color: 'bg-destructive/10 text-destructive', icon: <XCircle size={12} /> },
  cancelled: { labelKey: 'statusCancelled', color: 'bg-background text-muted-foreground', icon: <XCircle size={12} /> },
  filled: { labelKey: 'statusFilled', color: 'bg-primary/10 text-primary/90', icon: <CheckCircle2 size={12} /> },
}

const STEP_ROLE_LABELS: Record<string, string> = {
  direct_manager: 'stepRoleDirectManager',
  dept_head: 'stepRoleDeptHead',
  hr_admin: 'stepRoleHrAdmin',
  ceo: 'stepRoleCeo',
  finance: 'stepRoleFinance',
}

interface Props {
  user: SessionUser
  /** recruitment:read 권한 (HR_ADMIN/SUPER_ADMIN). 'all'/'pending' 탭 + 다른 부서 결재 큐 조회 가능. */
  canViewAll: boolean
  /** recruitment:create 권한. 신규 채용 요청 작성 페이지 진입 가능. */
  canCreate: boolean
}

export default function RequisitionListClient({ user, canViewAll, canCreate }: Props) {
  const tCommon = useTranslations('common')
  const t = useTranslations('recruitment')
  const router = useRouter()
  const [items, setItems] = useState<Requisition[]>([])
  const [loading, setLoading] = useState(true)
  // canViewAll=false (dept_head/direct_manager 결재자)면 'my' 탭 강제 — 'all'/'pending'은
  // API에서 recruitment_view 권한 필요 → 403. 'my'는 myApprovals 서버 필터로 빈/매칭 결과만.
  const [tab, setTab] = useState<'all' | 'my' | 'pending'>(canViewAll ? 'all' : 'my')
  const [search, setSearch] = useState('')
  const [approveTarget, setApproveTarget] = useState<Requisition | null>(null)

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
          <h1 className="text-2xl font-bold text-foreground">{t('requisitionTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('department_kec9ea5_kecb184ec_kec9a94ec_kebb08f_keab2b0ec_management')}</p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push('/recruitment/requisitions/new')}
            className={`flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg text-sm font-medium`}
          >
            <Plus size={16} />
            {t('requisition_kec9e91ec')}
          </button>
        )}
      </div>

      {/* 탭 */}
      <div className="flex border-b border-border">
        {[
          // canViewAll=false면 'my' 탭만 — 'all'/'pending'은 API 권한 부재로 403.
          ...(canViewAll ? [{ key: 'all' as const, label: t('all_kec9a94ec') }] : []),
          ...(canViewAll ? [{ key: 'pending' as const, label: t('kr_keab2b0ec_keb8c80ea') }] : []),
          { key: 'my' as const, label: t('kr_keb8298ec_keab2b0ec') },
        ].map((t) => (
          <button
            key={t.key}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('requisitionSearchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary"
          />
        </div>
        <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-background motion-safe:transition-all">
          <Filter size={14} />
          {t('filter')}
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">{tCommon('loading')}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <FileText size={40} className="mb-3 text-border" />
          <EmptyState />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const urgency = URGENCY_LABELS[item.urgency]
            const statusInfo = STATUS_LABELS[item.status] ?? STATUS_LABELS.draft
            const totalSteps = item.approvalRecords.length
            const currentRecord = item.approvalRecords.find(
              (r) => r.stepOrder === item.currentStep && r.status === 'pending',
            )
            // 'my' 탭은 myApprovals 서버 필터(Session 200)가 user를 approver로 검증한 결과만
            // 반환하므로 server-verified gate. 정책 SSOT는 canApproveRequisition() 참조.
            const canApprove = canApproveRequisition({
              role: user.role,
              status: item.status,
              currentRecord,
              passesServerApproverGate: tab === 'my',
            })

            return (
              <div
                key={item.id}
                className={`${CARD_STYLES.kpi} hover:border-primary/40 transition-colors`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono tabular-nums text-muted-foreground">{item.reqNumber}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${urgency.color}`}>
                        {t(urgency.labelKey)}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.icon}
                        {t(statusInfo.labelKey)}
                        {item.status === 'pending' && totalSteps > 0 && ` (${item.currentStep}/${totalSteps})`}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 size={13} />
                        {item.company.name}
                      </span>
                      <span>·</span>
                      <span>{item.department.name}</span>
                      <span>·</span>
                      <span>{t('requester')}: {item.requester.name}</span>
                      <span>·</span>
                      <span>{t('headcountWithUnit', { count: item.headcount })}</span>
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
                                isRejected ? 'bg-destructive/10 text-destructive' :
                                isDone ? 'bg-tertiary/10 text-[#006b39]' :
                                isActive ? 'bg-warning-bright/15 text-ctr-warning' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {isDone ? <CheckCircle2 size={12} aria-hidden /> : isRejected ? <XCircle size={12} aria-hidden /> : isActive ? <Clock size={12} aria-hidden /> : <Circle size={12} aria-hidden />}
                                {t(STEP_ROLE_LABELS[record.approverRole] ?? record.approverRole)}
                              </div>
                              {idx < item.approvalRecords.length - 1 && (
                                <ChevronRight size={14} className="text-border" />
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
                        className="flex items-center gap-1 px-3 py-1.5 bg-tertiary text-white text-xs font-medium rounded-lg hover:brightness-95 motion-safe:transition-all"
                      >
                        <CheckCircle2 size={13} />
                        {t('approve')}
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/recruitment/requisitions/${item.id}`)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-border text-muted-foreground text-xs rounded-lg hover:bg-background motion-safe:transition-all"
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
