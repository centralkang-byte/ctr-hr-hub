'use client'

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  DRAFT: { label: '초안', bg: 'bg-[#FAFAFA]', text: 'text-[#555]', border: 'border-[#E8E8E8]' },
  CALCULATING: { label: '계산중', bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]', border: 'border-[#FCD34D]' },
  REVIEW: { label: '검토', bg: 'bg-[#E8F5E9]', text: 'text-[#00A844]', border: 'border-[#E8F5E9]' },
  APPROVED: { label: '승인', bg: 'bg-[#D1FAE5]', text: 'text-[#047857]', border: 'border-[#A7F3D0]' },
  PAID: { label: '지급완료', bg: 'bg-[#E0E7FF]', text: 'text-[#4338CA]', border: 'border-[#C7D2FE]' },
  CANCELLED: { label: '취소', bg: 'bg-[#FEE2E2]', text: 'text-[#B91C1C]', border: 'border-[#FECACA]' },
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
