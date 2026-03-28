// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PrefetchLink
// 마우스 호버 시 Next.js router.prefetch + API 데이터 프리패치
// ═══════════════════════════════════════════════════════════

'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'

// 주요 경로별 프리패치 대상 API
const PREFETCH_MAP: Record<string, string> = {
  '/home': '/api/v1/home/summary',
  '/employees': '/api/v1/employees?page=1&limit=20',
  '/payroll': '/api/v1/payroll/runs?page=1&limit=10',
  '/leave': '/api/v1/leave/requests?page=1&limit=20',
  '/analytics': '/api/v1/analytics/overview',
  '/recruitment': '/api/v1/recruitment/postings?page=1&limit=10',
  '/attendance': '/api/v1/attendance/team',
  '/performance': '/api/v1/performance/cycles',
}

type PrefetchLinkProps = ComponentProps<typeof Link>

export function PrefetchLink({ href, onMouseEnter, ...props }: PrefetchLinkProps) {
  const router = useRouter()

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Next.js 라우트 프리패치
      const path = typeof href === 'string' ? href : href.pathname ?? ''
      router.prefetch(path)

      // API 데이터 프리패치 (fetch cache에 저장)
      const apiUrl = PREFETCH_MAP[path]
      if (apiUrl) {
        fetch(apiUrl, { priority: 'low' }).catch(() => {
          // 프리패치 실패는 무시
        })
      }

      // 원본 onMouseEnter 핸들러 호출
      if (typeof onMouseEnter === 'function') {
        onMouseEnter(e)
      }
    },
    [href, router, onMouseEnter],
  )

  return <Link href={href} onMouseEnter={handleMouseEnter} {...props} />
}
