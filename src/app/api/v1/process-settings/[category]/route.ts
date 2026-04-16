// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Unified Process Settings API (H-2c + H-3 Audit)
// GET/PUT/DELETE for CompanyProcessSetting by category+key
// Auth: GET — authenticated users; PUT/DELETE — HR_ADMIN+
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import { generateChangeDescription } from '@/lib/settings/audit-helpers'
import { ROLE } from '@/lib/constants'
import { resolveCompanyId } from '@/lib/api/companyFilter'

export const dynamic = 'force-dynamic'

const VALID_CATEGORIES = [
  'EVALUATION', 'PROMOTION', 'COMPENSATION', 'ATTENDANCE', 'LEAVE',
  'ONBOARDING', 'RECRUITMENT', 'BENEFITS', 'PAYROLL', 'SYSTEM', 'PERFORMANCE',
  'ORGANIZATION',
]

export const GET = withAuth(async (
  req: NextRequest,
  context,
  user,
) => {
  const { category } = await context.params
  const upperCategory = category.toUpperCase()
  if (!VALID_CATEGORIES.includes(upperCategory)) {
    return apiError(badRequest(`Invalid category: ${category}`))
  }

  const { searchParams } = new URL(req.url)
  const requestedCompanyId = searchParams.get('companyId')
  const companyId = resolveCompanyId(user, requestedCompanyId)
  const key = searchParams.get('key')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { settingType: upperCategory } // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma where clause dynamic type
  if (key) where.settingKey = key

  // Get global defaults
  const globalSettings = await prisma.companyProcessSetting.findMany({
    where: { ...where, companyId: null },
    orderBy: { settingKey: 'asc' },
  })

  // Get company overrides
  const companySettings = await prisma.companyProcessSetting.findMany({
    where: { ...where, companyId },
    orderBy: { settingKey: 'asc' },
  })

  // Merge: company overrides global
  const companyMap = new Map(companySettings.map((s) => [s.settingKey, s]))
  const merged = globalSettings.map((g) => {
    const override = companyMap.get(g.settingKey)
    return {
      id: override?.id ?? g.id,
      settingType: g.settingType,
      settingKey: g.settingKey,
      settingValue: override ? override.settingValue : g.settingValue,
      description: override?.description ?? g.description,
      isOverridden: !!override,
      companyId: override?.companyId ?? null,
      updatedAt: override?.updatedAt ?? g.updatedAt,
    }
  })

  for (const cs of companySettings) {
    if (!globalSettings.some((g) => g.settingKey === cs.settingKey)) {
      merged.push({
        id: cs.id,
        settingType: cs.settingType,
        settingKey: cs.settingKey,
        settingValue: cs.settingValue,
        description: cs.description,
        isOverridden: true,
        companyId: cs.companyId,
        updatedAt: cs.updatedAt,
      })
    }
  }

  return apiSuccess(merged)
})

export const PUT = withAuth(async (
  req: NextRequest,
  context,
  user,
) => {
  if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
    return apiError(forbidden('Modifying process settings requires HR_ADMIN role'))
  }

  const { category } = await context.params
  const upperCategory = category.toUpperCase()
  if (!VALID_CATEGORIES.includes(upperCategory)) {
    return apiError(badRequest(`Invalid category: ${category}`))
  }

  const body = await req.json()
  const { key, value, companyId: requestedCompanyId, description } = body

  if (!key || value === undefined) {
    return apiError(badRequest('key and value are required'))
  }

  // Codex F2: tenant boundary — HR_ADMIN 타 법인 변경 차단
  // Codex G2: companyId 미전송 시 SUPER_ADMIN은 global(null) 유지, HR_ADMIN은 자기 법인
  const companyId = requestedCompanyId
    ? resolveCompanyId(user, requestedCompanyId)
    : (user.role === ROLE.SUPER_ADMIN ? null : user.companyId)

  const existing = await prisma.companyProcessSetting.findFirst({
    where: { settingType: upperCategory, settingKey: key, companyId: companyId ?? null },
  })

  const effectiveCompanyId = companyId ?? null
  const setting = await prisma.companyProcessSetting.upsert({
    where: {
      companyId_settingType_settingKey: {
        companyId: effectiveCompanyId as string, // nullable compound unique — runtime null OK
        settingType: upperCategory,
        settingKey: key,
      },
    },
    update: { settingValue: value, description: description ?? undefined },
    create: {
      companyId: effectiveCompanyId,
      settingType: upperCategory,
      settingKey: key,
      settingValue: value,
      description: description ?? null,
    },
  })

  // Audit log (fire-and-forget) — now with real actorId
  prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: existing ? 'SETTINGS_UPDATE' : 'SETTINGS_CREATE',
      resourceType: 'CompanyProcessSetting',
      resourceId: setting.id,
      companyId: companyId ?? null,
      changes: {
        category: upperCategory,
        key,
        companyId: companyId ?? 'global',
        oldValue: existing?.settingValue ?? null,
        newValue: value,
        description: generateChangeDescription(
          existing?.settingValue as Record<string, unknown> | null,
          value as Record<string, unknown>,
        ),
      },
    },
  }).catch((err) => console.error('[Audit Log]', err))

  return apiSuccess(setting)
})

export const DELETE = withAuth(async (
  req: NextRequest,
  context,
  user,
) => {
  if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
    return apiError(forbidden('Deleting process settings requires HR_ADMIN role'))
  }

  const { category } = await context.params
  const upperCategory = category.toUpperCase()

  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  const requestedCompanyId = searchParams.get('companyId')

  if (!key || !requestedCompanyId) {
    return apiError(badRequest('key and companyId are required to delete an override'))
  }

  // Codex F2: tenant boundary — resolveCompanyId로 회사 격리 보장
  const companyId = resolveCompanyId(user, requestedCompanyId)

  const existing = await prisma.companyProcessSetting.findFirst({
    where: { settingType: upperCategory, settingKey: key, companyId },
  })

  await prisma.companyProcessSetting.deleteMany({
    where: { settingType: upperCategory, settingKey: key, companyId },
  })

  if (existing) {
    prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'SETTINGS_REVERT',
        resourceType: 'CompanyProcessSetting',
        resourceId: existing.id,
        companyId,
        changes: {
          category: upperCategory,
          key,
          companyId,
          oldValue: existing.settingValue,
          newValue: null,
          description: '법인별 오버라이드 삭제 → 글로벌 기본값 복원',
        },
      },
    }).catch((err) => console.error('[Audit Log]', err))
  }

  return apiSuccess({ deleted: true })
})
