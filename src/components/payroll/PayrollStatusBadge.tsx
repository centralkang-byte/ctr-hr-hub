'use client'

// TODO: i18n — 상태 레이블을 i18n 키로 이동 시 여기서 t() 호출
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  DRAFT: { label: '초안', bg: 'bg-background', text: 'text-[#555]', border: 'border-border' },
  ATTENDANCE_CLOSED: { label: '근태 마감', bg: 'bg-primary/10', text: 'text-emerald-700', border: 'border-emerald-200' },
  CALCULATING: { label: '계산 중', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  ADJUSTMENT: { label: '수동 조정', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  REVIEW: { label: '이상 검토', bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-200' },
  PENDING_APPROVAL: { label: '결재 대기', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  APPROVED: { label: '승인 완료', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  PAID: { label: '지급 완료', bg: 'bg-indigo-100', text: 'text-primary/90', border: 'border-indigo-200' },
  PUBLISHED: { label: '확정', bg: 'bg-indigo-100', text: 'text-primary/90', border: 'border-indigo-200' },
  CANCELLED: { label: '취소', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
}

interface PayrollStatusBadgeProps {
  status: string
}

export default function PayrollStatusBadge({ status }: PayrollStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}
    >
      {config.label}
    </span>
  )
}
