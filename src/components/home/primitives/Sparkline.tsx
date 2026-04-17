'use client'

import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface SparklineProps {
  /** 7-14 data points (더 많아도 렌더링은 되나 노이즈 증가) */
  data: number[]
  /** 선 색상 — `currentColor` 기본. 부모에서 text-success 등으로 제어. */
  color?: string
  /** px 단위 width. 기본 60 */
  width?: number
  /** px 단위 height. 기본 20 */
  height?: number
  className?: string
  /** 접근성 — 스크린 리더에 읽힐 설명 */
  ariaLabel?: string
}

// ─── Component ──────────────────────────────────────────────

/**
 * 60×20 inline SVG sparkline — Recharts 의존 없음.
 * StatCard의 시각적 trend 보조용.
 * Accessibility: role="img" + aria-label. 숫자 변화는 StatCard의 trend prop으로 스크린 리더 노출.
 */
export function Sparkline({
  data,
  color = 'currentColor',
  width = 60,
  height = 20,
  className,
  ariaLabel,
}: SparklineProps) {
  if (!data.length) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const step = data.length > 1 ? width / (data.length - 1) : 0

  const points = data
    .map((v, i) => {
      const x = i * step
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  const lastX = (data.length - 1) * step
  const lastY = height - ((data[data.length - 1] - min) / range) * height

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel || undefined}
      className={cn('overflow-visible', className)}
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  )
}
