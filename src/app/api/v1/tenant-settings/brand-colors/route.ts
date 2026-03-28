// PUBLIC: no auth required — pre-login / public endpoint
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/tenant-settings/brand-colors
// 테넌트 브랜딩 컬러 반환 (없으면 기본값 반환)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { DEFAULT_BRAND_COLORS } from '@/lib/constants'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId')

  // Phase 4: DB CompanySetting에서 회사별 브랜딩 컬러 조회 예정 (현재 기본값)
  if (!companyId) {
    return apiSuccess(DEFAULT_BRAND_COLORS)
  }

  // Return default brand colors for now
  return apiSuccess({
    primary: DEFAULT_BRAND_COLORS.primary,
    secondary: DEFAULT_BRAND_COLORS.secondary,
    accent: DEFAULT_BRAND_COLORS.accent,
  })
}
