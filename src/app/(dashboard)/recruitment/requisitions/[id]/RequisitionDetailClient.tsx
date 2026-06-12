'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 채용 요청 상세 Client
// list/[id] navigation broken 해소 (Codex Gate 1 finding)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Building2,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  User,
  XCircle,
  Circle,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import { CARD_STYLES } from '@/lib/styles'
import { useToast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/format/date'
import type { SessionUser } from '@/types'
import RequisitionApproveModal from '../RequisitionApproveModal'

// ─── Types ──────────────────────────────────────────────────

interface ApprovalRecord {
  id: string
  stepOrder: number
  approverRole: string
  status: string
  comment?: string | null
  decidedAt?: string | null
  approver?: { id: string; name: string; photoUrl?: string | null } | null
}

interface JobPosting {
  id: string
  title: string
  status: string
  postedAt?: string | null
}

interface Requisition {
  id: string
  reqNumber: string
  title: string
  urgency: 'urgent' | 'normal' | 'low'
  status: string
  headcount: number
  employmentType: string
  jobLevel?: string | null
  justification?: string | null
  requirements?: string | null
  targetDate?: string | null
  currentStep: number
  createdAt: string
  company: { id: string; name: string }
  department: { id: string; name: string }
  requester: { id: string; name: string; nameEn?: string | null; photoUrl?: string | null }
  position?: { id: string; titleKo?: string | null; titleEn?: string | null; code: string } | null
  approvalRecords: ApprovalRecord[]
  jobPostings: JobPosting[]
  /**
   * Server-derived 결재 가능 hint (route.ts GET 응답).
   * SessionUser.role 단일 JWT pin 한계로 client에서 multi-role(예: HR_ADMIN base +
   * 보조 MANAGER role)을 인지하지 못하는 false-deny 차단. validator
   * (isRequisitionApproverAllowed)가 active EmployeeRoles + 관계 기반 검증으로
   * 계산해 응답에 포함.
   */
  canApprove: boolean
}

interface Props {
  id: string
  user: SessionUser
  canViewAll: boolean
}

// ─── Constants ──────────────────────────────────────────────

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

// 고용형태 → 기존 i18n 키 매핑 (form 페이지와 동일 키 재사용).
const EMPLOYMENT_TYPE_KEYS: Record<string, string> = {
  permanent: 'kr_keca095ea',
  contract: 'kr_keab384ec',
  intern: 'kr_kec9db8ed',
}

// ─── Component ──────────────────────────────────────────────

export default function RequisitionDetailClient({ id, user, canViewAll }: Props) {
  const t = useTranslations('recruitment')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = useState<Requisition | null>(null)
  const [loading, setLoading] = useState(true)
  const [showApprove, setShowApprove] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<Requisition>(`/api/v1/recruitment/requisitions/${id}`)
      setData(res.data ?? null)
    } catch (err) {
      toast({
        title: '로드 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">{tCommon('loading')}</div>
  }
  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">{tCommon('noData')}</div>
  }

  const urgency = URGENCY_LABELS[data.urgency]
  const statusInfo = STATUS_LABELS[data.status] ?? STATUS_LABELS.draft
  const totalSteps = data.approvalRecords.length
  // canApprove: server-derived (data.canApprove). validator
  // (isRequisitionApproverAllowed)가 multi-role + 관계 검증으로 계산.
  // client는 server-trusted hint만 렌더 — JWT 단일 role 한계로 인한 false-deny
  // (HR_ADMIN base + MANAGER 보조 role의 direct_manager step 등) 차단.
  const canApprove = data.canApprove

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/recruitment/requisitions')}
            className="p-2 rounded-lg hover:bg-muted motion-safe:transition-all"
            aria-label={tCommon('back')}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono tabular-nums text-muted-foreground">{data.reqNumber}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${urgency.color}`}>
                {t(urgency.labelKey)}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.icon}
                {t(statusInfo.labelKey)}
                {data.status === 'pending' && totalSteps > 0 && ` (${data.currentStep}/${totalSteps})`}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mt-1">{data.title}</h1>
          </div>
        </div>
        {canApprove && (
          <button
            onClick={() => setShowApprove(true)}
            className="flex items-center gap-2 px-4 py-2 bg-tertiary text-white text-sm font-medium rounded-lg hover:brightness-95 motion-safe:transition-all"
          >
            <CheckCircle2 size={16} />
            {t('approve')}
          </button>
        )}
      </div>

      {/* 메타 카드 */}
      <div className={CARD_STYLES.kpi}>
        <h2 className="text-sm font-semibold text-foreground mb-3">{t('basicInfo')}</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <Building2 size={14} className="text-muted-foreground mt-0.5" />
            <div>
              <dt className="text-xs text-muted-foreground">{t('company')}</dt>
              <dd className="text-foreground">{data.company.name}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Building2 size={14} className="text-muted-foreground mt-0.5" />
            <div>
              <dt className="text-xs text-muted-foreground">{t('department')}</dt>
              <dd className="text-foreground">{data.department.name}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <User size={14} className="text-muted-foreground mt-0.5" />
            <div>
              <dt className="text-xs text-muted-foreground">{t('requester')}</dt>
              <dd className="text-foreground">{data.requester.name}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Briefcase size={14} className="text-muted-foreground mt-0.5" />
            <div>
              <dt className="text-xs text-muted-foreground">{t('headcount')}</dt>
              <dd className="text-foreground">{t('headcountWithUnit', { count: data.headcount })}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FileText size={14} className="text-muted-foreground mt-0.5" />
            <div>
              <dt className="text-xs text-muted-foreground">{t('employmentType')}</dt>
              <dd className="text-foreground">
                {EMPLOYMENT_TYPE_KEYS[data.employmentType]
                  ? t(EMPLOYMENT_TYPE_KEYS[data.employmentType])
                  : data.employmentType}
              </dd>
            </div>
          </div>
          {data.position && (
            <div className="flex items-start gap-2">
              <Briefcase size={14} className="text-muted-foreground mt-0.5" />
              <div>
                <dt className="text-xs text-muted-foreground">{tCommon('position')}</dt>
                <dd className="text-foreground">{data.position.titleKo ?? data.position.code}</dd>
              </div>
            </div>
          )}
          {data.targetDate && (
            <div className="flex items-start gap-2">
              <Calendar size={14} className="text-muted-foreground mt-0.5" />
              <div>
                <dt className="text-xs text-muted-foreground">{t('targetDate')}</dt>
                <dd className="text-foreground">{formatDate(data.targetDate)}</dd>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Calendar size={14} className="text-muted-foreground mt-0.5" />
            <div>
              <dt className="text-xs text-muted-foreground">{tCommon('createdAt')}</dt>
              <dd className="text-foreground">{formatDate(data.createdAt)}</dd>
            </div>
          </div>
        </dl>
      </div>

      {/* 사유 / 요건 */}
      {(data.justification || data.requirements) && (
        <div className={CARD_STYLES.kpi}>
          <h2 className="text-sm font-semibold text-foreground mb-3">{t('justificationAndRequirements')}</h2>
          {data.justification && (
            <section className="mb-4">
              {/* 'kr_kecb184ec_kec82acec' = '채용 사유' (form 페이지와 동일 키 재사용) */}
              <h3 className="text-xs font-medium text-muted-foreground mb-1">{t('kr_kecb184ec_kec82acec')}</h3>
              <p className="text-sm text-foreground whitespace-pre-wrap">{data.justification}</p>
            </section>
          )}
          {data.requirements && (
            <section>
              <h3 className="text-xs font-medium text-muted-foreground mb-1">{t('requirements')}</h3>
              <p className="text-sm text-foreground whitespace-pre-wrap">{data.requirements}</p>
            </section>
          )}
        </div>
      )}

      {/* 결재 스테퍼 */}
      {data.approvalRecords.length > 0 && (
        <div className={CARD_STYLES.kpi}>
          <h2 className="text-sm font-semibold text-foreground mb-3">{t('approvalFlow')}</h2>
          <div className="flex items-center flex-wrap gap-2 mb-4">
            {data.approvalRecords.map((record, idx) => {
              const isActive = record.stepOrder === data.currentStep
              const isDone = record.status === 'approved'
              const isRejected = record.status === 'rejected'
              return (
                <div key={record.id} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                    isRejected ? 'bg-destructive/10 text-destructive' :
                    isDone ? 'bg-tertiary/10 text-[#006b39]' :
                    isActive ? 'bg-warning-bright/15 text-ctr-warning' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {isDone ? <CheckCircle2 size={12} aria-hidden /> : isRejected ? <XCircle size={12} aria-hidden /> : isActive ? <Clock size={12} aria-hidden /> : <Circle size={12} aria-hidden />}
                    {t(STEP_ROLE_LABELS[record.approverRole] ?? record.approverRole)}
                  </div>
                  {idx < data.approvalRecords.length - 1 && (
                    <ChevronRight size={14} className="text-border" />
                  )}
                </div>
              )
            })}
          </div>
          <ul className="space-y-2">
            {data.approvalRecords.map((record) => (
              <li key={record.id} className="flex items-start gap-3 text-sm">
                <span className="text-xs font-mono tabular-nums text-muted-foreground mt-0.5 w-8">
                  {record.stepOrder}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">
                      {t(STEP_ROLE_LABELS[record.approverRole] ?? record.approverRole)}
                    </span>
                    {record.approver && (
                      <span className="text-xs text-muted-foreground">— {record.approver.name}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {record.status === 'approved' && record.decidedAt && `${t('approvedAt')} ${formatDate(record.decidedAt)}`}
                      {record.status === 'rejected' && record.decidedAt && `${t('rejectedAt')} ${formatDate(record.decidedAt)}`}
                      {record.status === 'pending' && t('statusPending')}
                    </span>
                  </div>
                  {record.comment && (
                    <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{record.comment}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 채용 공고 (생성된 경우) */}
      {data.jobPostings.length > 0 && (
        <div className={CARD_STYLES.kpi}>
          <h2 className="text-sm font-semibold text-foreground mb-3">{t('linkedPostings')}</h2>
          <ul className="space-y-2">
            {data.jobPostings.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{p.title}</span>
                <span className="text-xs text-muted-foreground">{p.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 결재 모달 */}
      {showApprove && (
        <RequisitionApproveModal
          requisition={{
            id: data.id,
            reqNumber: data.reqNumber,
            title: data.title,
            urgency: data.urgency,
            justification: data.justification ?? undefined,
          }}
          onClose={() => setShowApprove(false)}
          onSuccess={() => {
            setShowApprove(false)
            // canViewAll=false 결재자는 결재 직후 detail GET이 더 이상 허용되지 않음
            // (Session 202 GET — 다음 step의 approver로 권한 이동, requester 아니면 notFound).
            // refetch는 stale pending state를 남기므로 list로 복귀.
            // viewer는 갱신된 step/상태를 detail에서 계속 확인 가능 → 그대로 refetch.
            if (canViewAll) {
              load()
            } else {
              router.push('/recruitment/requisitions')
            }
          }}
        />
      )}
    </div>
  )
}
