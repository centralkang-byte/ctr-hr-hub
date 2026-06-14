// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Recognition Summary (Profile Widget)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/cfr/recognitions/employee/[id] ──────────

// 본인 외 타인의 인정 요약을 조회할 수 있는 역할 (회사 범위 내 — 아래 companyId 필터로 테넌트 격리)
const PRIVILEGED_VIEW_ROLES: string[] = [
  ROLE.SUPER_ADMIN,
  ROLE.HR_ADMIN,
  ROLE.EXECUTIVE,
  ROLE.MANAGER,
]

export const GET = withPermission(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id: employeeId } = await context.params

    // ─── Self-scope 가드 (IDOR) ────────────────────────────
    // 이 위젯은 본인 인정 요약용. 일반 직원이 사내 타인의 인정 내역·받은 메시지 본문을
    // 임의 ID로 조회하지 못하도록 차단. 권한 역할(HR·경영진·매니저)은 회사 범위 내 조회 허용.
    if (employeeId !== user.employeeId && !PRIVILEGED_VIEW_ROLES.includes(user.role)) {
      throw forbidden('본인 인정 내역만 조회할 수 있습니다.')
    }

    const [received, sent] = await Promise.all([
      prisma.recognition.groupBy({
        by: ['coreValue'],
        where: { receiverId: employeeId, companyId: user.companyId },
        _count: { id: true },
      }),
      prisma.recognition.count({
        where: { senderId: employeeId, companyId: user.companyId },
      }),
    ])

    const totalReceived = received.reduce((sum, v) => sum + v._count.id, 0)
    const valueBreakdown = received.map((v) => ({
      value: v.coreValue,
      count: v._count.id,
    }))

    // Recent recognitions (last 5)
    const recentRecognitions = await prisma.recognition.findMany({
      where: { receiverId: employeeId, companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        sender: { select: { name: true } },
      },
    })

    return apiSuccess({
      receivedCount: totalReceived,
      sentCount: sent,
      valueBreakdown,
      recent: recentRecognitions.map((r) => ({
        senderName: r.sender.name,
        coreValue: r.coreValue,
        message: r.message,
        createdAt: r.createdAt,
      })),
    })
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
