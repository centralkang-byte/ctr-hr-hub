'use client'

// TODO: i18n — 상태 레이블을 i18n 키로 이동 시 여기서 t() 호출
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  DRAFT: { label: '초안', bg: 'bg-[#FAFAFA]', text: 'text-[#555]', border: 'border-[#E8E8E8]' },
  ATTENDANCE_CLOSED: { label: '근태 마감', bg: 'bg-[#EDF1FE]', text: 'text-[#047857]', border: 'border-[#A7F3D0]' },
  CALCULATING: { label: '계산 중', bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]', border: 'border-[#FCD34D]' },
  ADJUSTMENT: { label: '수동 조정', bg: 'bg-[#DBEAFE]', text: 'text-[#1D4ED8]', border: 'border-[#BFDBFE]' },
  REVIEW: { label: '이상 검토', bg: 'bg-[#EDE9FE]', text: 'text-[#7C3AED]', border: 'border-[#DDD6FE]' },
  PENDING_APPROVAL: { label: '결재 대기', bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]', border: 'border-[#FCD34D]' },
  APPROVED: { label: '승인 완료', bg: 'bg-[#D1FAE5]', text: 'text-[#047857]', border: 'border-[#A7F3D0]' },
  PAID: { label: '지급 완료', bg: 'bg-[#E0E7FF]', text: 'text-[#4B6DE0]', border: 'border-[#C7D2FE]' },
  PUBLISHED: { label: '확정', bg: 'bg-[#E0E7FF]', text: 'text-[#4B6DE0]', border: 'border-[#C7D2FE]' },
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
