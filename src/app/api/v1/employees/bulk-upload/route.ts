// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bulk Assignment Upload API (DEPRECATED)
// 새 API: /api/v1/bulk-movements/{templates,validate,execute}
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'DEPRECATED',
        message:
          '이 API는 더 이상 사용되지 않습니다. /api/v1/bulk-movements/validate 를 사용해 주세요.',
      },
    },
    {
      status: 410, // Gone
      headers: {
        'X-Deprecated': 'true',
        'X-Replacement': '/api/v1/bulk-movements/validate',
      },
    },
  )
}
