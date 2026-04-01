// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Company Timezone Lookup (Recruitment)
// src/lib/recruitment/timezone-lookup.ts
//
// Maps company codes to IANA timezones.
// Source of truth: src/lib/timezone.ts comments
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

const COMPANY_TIMEZONE_MAP: Record<string, string> = {
  'CTR':      'Asia/Seoul',
  'CTR-HOLD': 'Asia/Seoul',
  'CTR-MOB':  'Asia/Seoul',
  'CTR-ECO':  'Asia/Seoul',
  'CTR-ROB':  'Asia/Seoul',
  'CTR-ENR':  'Asia/Seoul',
  'CTR-FML':  'Asia/Seoul',
  'CTR-CN':   'Asia/Shanghai',
  'CTR-RU':   'Europe/Moscow',
  'CTR-US':   'America/Chicago',
  'CTR-VN':   'Asia/Ho_Chi_Minh',
  'CTR-EU':   'Europe/Warsaw',
}

const DEFAULT_TIMEZONE = 'Asia/Seoul'

/**
 * Resolve IANA timezone for a company by ID.
 * Looks up company code, then maps to timezone.
 */
export async function getCompanyTimezone(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { code: true },
  })

  if (!company) return DEFAULT_TIMEZONE
  return COMPANY_TIMEZONE_MAP[company.code] ?? DEFAULT_TIMEZONE
}
