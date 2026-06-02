// ═══════════════════════════════════════════════════════════
// CTR HR Hub — DEV 전용 컴포넌트 픽스처 라우트 (Phase 3a Stage4 PR-1)
// WdGroupedStatCard / WdLeaveBalanceCard 컴포넌트 N2 시각 검증 하네스.
//
// ⚠️ Next App Router private 폴더(`_`) 는 라우팅 제외되므로 경로는
//    `/dev/components` (사용자 명세 `/dev/_components` 불가, diff 검토 보고).
//
// 가드 1 (page-level): production 빌드에서 notFound() → 라우트 비노출.
// 가드 2 (next.config): production redirect `/dev/:path*` → `/`.
// CI webServer=`npm run start`(prod) 이므로 CI 에서는 본 라우트 404 →
// 컴포넌트 N2 시각 검증은 로컬 dev 전용, CI 는 가드(404)만 검증.
// ═══════════════════════════════════════════════════════════

import { notFound } from 'next/navigation'
import { DevComponentFixtures } from './Fixtures'

export const metadata = { robots: { index: false, follow: false } }

export default function DevComponentsPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }
  return <DevComponentFixtures />
}
