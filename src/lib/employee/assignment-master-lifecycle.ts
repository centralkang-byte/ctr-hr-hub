// ═══════════════════════════════════════════════════════════
// CTR HR Hub — EmployeeAssignment master-data lifecycle fence
// ═══════════════════════════════════════════════════════════

import 'server-only'

import type { Prisma } from '@/generated/prisma/client'
import { AppError, badRequest, conflict, notFound } from '@/lib/errors'
import { getTodayForTimezone } from '@/lib/assignments'
import { prisma } from '@/lib/prisma'
import type { PrismaTx } from '@/lib/prisma-rls'

export interface ActivePositionReferenceLockInput {
  companyId: string
  positionIds: readonly (string | null | undefined)[]
  forUpdatePositionIds?: readonly string[]
}

function requireLockId(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw badRequest(`${field} 값이 필요합니다.`)
  return normalized
}

function assertTransactionClient(tx: PrismaTx): void {
  const candidate = tx as unknown as {
    $connect?: unknown
    $disconnect?: unknown
  }
  if (
    typeof candidate.$connect === 'function' ||
    typeof candidate.$disconnect === 'function'
  ) {
    throw new AppError(
      500,
      'POSITION_REFERENCE_TRANSACTION_REQUIRED',
      '직위 참조 잠금에는 데이터베이스 트랜잭션이 필요합니다.',
    )
  }
}

export async function lockActivePositionReferences(
  tx: PrismaTx,
  input: ActivePositionReferenceLockInput,
): Promise<string[]> {
  assertTransactionClient(tx)
  const companyId = requireLockId(input.companyId, 'companyId')
  const lockModeById = new Map<string, 'share' | 'update'>()

  for (const value of input.positionIds) {
    if (value === null || value === undefined) continue
    lockModeById.set(requireLockId(value, 'positionId'), 'share')
  }
  for (const value of input.forUpdatePositionIds ?? []) {
    lockModeById.set(requireLockId(value, 'positionId'), 'update')
  }

  const sortedTargets = [...lockModeById.entries()]
    .sort(([left], [right]) => left.localeCompare(right))

  for (const [positionId, mode] of sortedTargets) {
    const locked = mode === 'update'
      ? await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM positions
          WHERE id = ${positionId}
            AND company_id = ${companyId}
            AND deleted_at IS NULL
          FOR UPDATE
        `
      : await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM positions
          WHERE id = ${positionId}
            AND company_id = ${companyId}
            AND deleted_at IS NULL
          FOR SHARE
        `
    if (locked.length !== 1 || locked[0]?.id !== positionId) {
      throw conflict(
        '직위가 다른 법인에 속하거나 삭제되었습니다. 새로고침 후 다시 시도해 주세요.',
      )
    }
  }

  return sortedTargets.map(([positionId]) => positionId)
}

export async function countCurrentOrFutureAssignmentMasterReferences(
  tx: PrismaTx,
  companyId: string,
  references: readonly Prisma.EmployeeAssignmentWhereInput[],
): Promise<number> {
  if (references.length === 0) return 0

  const company = await tx.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { timezone: true },
  })
  if (!company) throw notFound('법인 정보를 찾을 수 없습니다.')

  const today = getTodayForTimezone(company.timezone)
  return tx.employeeAssignment.count({
    where: {
      companyId,
      AND: [
        { OR: [...references] },
        { OR: [{ endDate: null }, { endDate: { gt: today } }] },
      ],
    },
  })
}

export interface SoftDeletePositionMasterDeps {
  db?: typeof prisma
  afterPositionDeleteLock?: (context: {
    positionId: string
    companyId: string
  }) => Promise<void>
}

export async function softDeletePositionMaster(params: {
  positionId: string
  companyId: string
  deps?: SoftDeletePositionMasterDeps
}): Promise<{ id: string; companyId: string; deletedAt: Date }> {
  const db = params.deps?.db ?? prisma

  return db.$transaction(async (tx) => {
    const [position] = await tx.$queryRaw<Array<{
      id: string
      companyId: string
      deletedAt: Date | null
    }>>`
      SELECT id, company_id AS "companyId", deleted_at AS "deletedAt"
      FROM positions
      WHERE id = ${params.positionId}
        AND company_id = ${params.companyId}
      FOR UPDATE
    `
    if (!position || position.deletedAt) throw notFound('직위를 찾을 수 없습니다.')
    await params.deps?.afterPositionDeleteLock?.({
      positionId: position.id,
      companyId: position.companyId,
    })

    const [assignmentCount, childPositionCount, postingCount, requisitionCount] =
      await Promise.all([
        countCurrentOrFutureAssignmentMasterReferences(
          tx,
          position.companyId,
          [{ positionId: position.id }],
        ),
        tx.position.count({
          where: {
            companyId: position.companyId,
            deletedAt: null,
            OR: [
              { reportsToPositionId: position.id },
              { dottedLinePositionId: position.id },
            ],
          },
        }),
        tx.jobPosting.count({
          where: {
            positionId: position.id,
            companyId: position.companyId,
            deletedAt: null,
            status: { in: ['DRAFT', 'OPEN'] },
          },
        }),
        tx.requisition.count({
          where: {
            positionId: position.id,
            companyId: position.companyId,
            status: { in: ['draft', 'pending', 'approved'] },
          },
        }),
      ])

    if (assignmentCount > 0) {
      throw conflict(
        `현재 또는 예정 발령에서 사용 중인 직위입니다(${assignmentCount}명).`,
      )
    }
    if (childPositionCount > 0 || postingCount > 0 || requisitionCount > 0) {
      throw conflict(
        '활성 하위 직위 또는 채용 건에서 사용 중인 직위는 삭제할 수 없습니다.',
      )
    }

    const deletedAt = new Date()
    const deleted = await tx.position.updateMany({
      where: {
        id: position.id,
        companyId: position.companyId,
        deletedAt: null,
      },
      data: { deletedAt },
    })
    if (deleted.count !== 1) throw notFound('직위를 찾을 수 없습니다.')

    return { id: position.id, companyId: position.companyId, deletedAt }
  })
}
