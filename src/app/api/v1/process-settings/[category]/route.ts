// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Unified Process Settings API (H-2c + H-3 Audit)
// GET/PUT/DELETE for CompanyProcessSetting by category+key
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { generateChangeDescription } from '@/lib/settings/audit-helpers'

export const dynamic = 'force-dynamic'

const VALID_CATEGORIES = [
  'EVALUATION', 'PROMOTION', 'COMPENSATION', 'ATTENDANCE', 'LEAVE',
  'ONBOARDING', 'RECRUITMENT', 'BENEFITS', 'PAYROLL', 'SYSTEM', 'PERFORMANCE',
  'ORGANIZATION',
]

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params
    const upperCategory = category.toUpperCase()
    if (!VALID_CATEGORIES.includes(upperCategory)) {
      return apiError(badRequest(`Invalid category: ${category}`))
    }

    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId')
    const key = searchParams.get('key')

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { settingType: upperCategory }
    if (key) where.settingKey = key

    // Get global defaults
    const globalSettings = await prisma.companyProcessSetting.findMany({
      where: { ...where, companyId: null },
      orderBy: { settingKey: 'asc' },
    })

    // Get company overrides if companyId provided
    let companySettings: typeof globalSettings = []
    if (companyId) {
      companySettings = await prisma.companyProcessSetting.findMany({
        where: { ...where, companyId },
        orderBy: { settingKey: 'asc' },
      })
    }

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

    // Add any company-only settings that have no global counterpart
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
  } catch (err) {
    console.error('[Process Settings GET]', err)
    return apiError(err)
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params
    const upperCategory = category.toUpperCase()
    if (!VALID_CATEGORIES.includes(upperCategory)) {
      return apiError(badRequest(`Invalid category: ${category}`))
    }

    const body = await req.json()
    const { key, value, companyId, description } = body

    if (!key || value === undefined) {
      return apiError(badRequest('key and value are required'))
    }

    // Fetch existing record for audit diff
    const existing = await prisma.companyProcessSetting.findFirst({
      where: {
        settingType: upperCategory,
        settingKey: key,
        companyId: companyId ?? null,
      },
    })

    const setting = await prisma.companyProcessSetting.upsert({
      where: {
        companyId_settingType_settingKey: {
          companyId: companyId ?? null,
          settingType: upperCategory,
          settingKey: key,
        },
      },
      update: {
        settingValue: value,
        description: description ?? undefined,
      },
      create: {
        companyId: companyId ?? null,
        settingType: upperCategory,
        settingKey: key,
        settingValue: value,
        description: description ?? null,
      },
    })

    // Audit log (fire-and-forget)
    prisma.auditLog.create({
      data: {
        actorId: 'system', // TODO: extract from session when auth is wired
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
  } catch (err) {
    console.error('[Process Settings PUT]', err)
    return apiError(err)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params
    const upperCategory = category.toUpperCase()

    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key')
    const companyId = searchParams.get('companyId')

    if (!key || !companyId) {
      return apiError(badRequest('key and companyId are required to delete an override'))
    }

    // Fetch existing for audit log
    const existing = await prisma.companyProcessSetting.findFirst({
      where: { settingType: upperCategory, settingKey: key, companyId },
    })

    await prisma.companyProcessSetting.deleteMany({
      where: {
        settingType: upperCategory,
        settingKey: key,
        companyId,
      },
    })

    // Audit log (fire-and-forget)
    if (existing) {
      prisma.auditLog.create({
        data: {
          actorId: 'system',
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
  } catch (err) {
    console.error('[Process Settings DELETE]', err)
    return apiError(err)
  }
}
