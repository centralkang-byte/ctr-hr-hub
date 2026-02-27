// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Offboarding Completion Helpers
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

type TransactionClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

/**
 * 퇴직 완료 시 IT 계정 비활성화
 * - itAccountDeactivated = true
 * - ssoSession 모두 revoke
 * - employeeAuth lockedUntil = 영구 (2099-12-31)
 */
export async function deactivateItAccount(
  tx: TransactionClient,
  employeeId: string,
): Promise<void> {
  await tx.employeeOffboarding.updateMany({
    where: { employeeId },
    data: { itAccountDeactivated: true },
  })

  await tx.ssoSession.updateMany({
    where: { employeeId, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  await tx.employeeAuth.updateMany({
    where: { employeeId },
    data: { lockedUntil: new Date('2099-12-31') },
  })
}
