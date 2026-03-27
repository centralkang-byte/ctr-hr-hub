// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/health
// 간단한 헬스체크 (외부 모니터링 호환용)
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
}
