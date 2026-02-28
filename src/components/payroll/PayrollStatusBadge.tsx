'use client'

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  DRAFT: { label: '초안', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  CALCULATING: { label: '계산중', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  REVIEW: { label: '검토', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  APPROVED: { label: '승인', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  PAID: { label: '지급완료', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  CANCELLED: { label: '취소', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
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
