'use client'

import { useEffect, useState } from 'react'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — useTimeOfDay
// Hydration-safe browser-local AM/PM bucket for greetings.
// ═══════════════════════════════════════════════════════════

/**
 * 브라우저 로컬 시각의 AM/PM 버킷을 반환.
 *
 * - SSR 및 hydration 직후까지 `null` — 서버 렌더링과 첫 클라이언트 렌더링이 동일해야
 *   하기 때문 (Vercel UTC vs 브라우저 KST 에서 getHours() 결과가 다르면 hydration
 *   mismatch 발생).
 * - mount 후 useEffect에서 `new Date().getHours()` 를 읽어 값을 주입.
 * - 60초 주기로 폴링해 정오/자정 경계를 넘는 동안 인사말이 자동 갱신.
 *
 * **디스플레이 예외**: CLAUDE.md 는 display-time 로직은 `src/lib/timezone.ts`
 * 경유를 권장하지만, 인사말은 *사용자 로케일 시각* 이 자연스러움. 회사 기준 시간
 * (Asia/Seoul 고정 등)이 필요해지면 이 hook을 확장.
 */
export function useTimeOfDay(): 'am' | 'pm' | null {
  const [bucket, setBucket] = useState<'am' | 'pm' | null>(null)

  useEffect(() => {
    const update = () => {
      setBucket(new Date().getHours() < 12 ? 'am' : 'pm')
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [])

  return bucket
}
