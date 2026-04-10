import { type StatusCategory, resolveStatusCategory } from '@/lib/styles/status'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface StatusBadgeProps {
  /** DB enum 값 (e.g. "APPROVED", "PENDING"). 자동으로 StatusCategory로 매핑됨 */
  status?: string
  /** 직접 variant 지정 (collision override 또는 기존 API 호환). status보다 우선 */
  variant?: StatusCategory
  /** 라벨 override. 미지정 시 status 문자열 그대로 표시 */
  children?: React.ReactNode
  className?: string
}

/** @deprecated StatusCategory 사용. 기존 import 호환용 */
export type BadgeVariant = StatusCategory

// ─── Component ──────────────────────────────────────────────

export function StatusBadge({ status, variant, children, className }: StatusBadgeProps) {
  const resolved: StatusCategory = variant ?? (status ? resolveStatusCategory(status) : 'neutral')

  return (
    <Badge variant={resolved} className={cn(className)}>
      {children ?? status ?? ''}
    </Badge>
  )
}
