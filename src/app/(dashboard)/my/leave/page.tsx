// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /my/leave → /leave redirect-only (Phase 3a Stage4 PR-3, WS-C)
// IA 이중화 해소: 정본 = /leave (사이드바 nav.mySpace.leave). 본 라우트는
// 북마크·구 딥링크 보호용 redirect 만. 기능 상위집합은 /leave (LeaveClient).
// MyLeaveClient 폐기 (외부 import 0 — 본 page.tsx 한정).
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'

export default function MyLeaveRedirect() {
  redirect('/leave')
}
