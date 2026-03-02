// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Year-End Settlements API
// GET  /api/v1/year-end/settlements?year=2025
//      — get current user's settlement for year (create if not exists)
// POST /api/v1/year-end/settlements
//      — create or reset settlement
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// BigInt → string serializer
function serializeSettlement(s: Record<string, unknown>) {
  return JSON.parse(
    JSON.stringify(s, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  )
}

// GET — get or create settlement for current user + year
export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') ?? '2025', 10)
    const employeeId = user.employeeId

    // Find existing or create
    let settlement = await prisma.yearEndSettlement.findUnique({
      where: { employeeId_year: { employeeId, year } },
      include: {
        dependents: true,
        deductions: true,
        documents: true,
      },
    })

    if (!settlement) {
      // Create settlement + default self dependent in a transaction
      settlement = await prisma.$transaction(async (tx) => {
        const employee = await tx.employee.findUnique({
          where: { id: employeeId },
          select: { name: true, birthDate: true },
        })

        const newSettlement = await tx.yearEndSettlement.create({
          data: {
            employeeId,
            year,
            status: 'not_started',
          },
        })

        // Create default self (본인) dependent
        await tx.yearEndDependent.create({
          data: {
            settlementId: newSettlement.id,
            relationship: '본인',
            name: employee?.name ?? '본인',
            birthDate: employee?.birthDate ?? null,
            isDisabled: false,
            isSenior: false,
            deductionAmount: 1500000,
            additionalDeduction: 0,
          },
        })

        return tx.yearEndSettlement.findUniqueOrThrow({
          where: { id: newSettlement.id },
          include: {
            dependents: true,
            deductions: true,
            documents: true,
          },
        })
      })
    }

    return apiSuccess(serializeSettlement(settlement as unknown as Record<string, unknown>))
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)

// POST — create or reset settlement
export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    try {
      const body = await req.json() as { year?: number }
      const year = body.year ?? 2025
      const employeeId = user.employeeId

      // Delete existing and recreate
      const existing = await prisma.yearEndSettlement.findUnique({
        where: { employeeId_year: { employeeId, year } },
      })

      if (existing) {
        await prisma.yearEndSettlement.delete({
          where: { id: existing.id },
        })
      }

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { name: true, birthDate: true },
      })

      const settlement = await prisma.$transaction(async (tx) => {
        const newSettlement = await tx.yearEndSettlement.create({
          data: { employeeId, year, status: 'not_started' },
        })

        await tx.yearEndDependent.create({
          data: {
            settlementId: newSettlement.id,
            relationship: '본인',
            name: employee?.name ?? '본인',
            birthDate: employee?.birthDate ?? null,
            isDisabled: false,
            isSenior: false,
            deductionAmount: 1500000,
            additionalDeduction: 0,
          },
        })

        return tx.yearEndSettlement.findUniqueOrThrow({
          where: { id: newSettlement.id },
          include: {
            dependents: true,
            deductions: true,
            documents: true,
          },
        })
      })

      return apiSuccess(serializeSettlement(settlement as unknown as Record<string, unknown>), 201)
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
