// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/manager-hub/announce
// 매니저 → 직속부하 전체 팀 공지 (헤더 "팀 공지" 액션).
// 전용 공지 백엔드 부재 → 알림 SSOT(sendNotifications)로 수신자별 발송.
// 스코프: getDirectReportIds + 자사 active primary (전출자/타 법인 제외).
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { getDirectReportIds } from '@/lib/employee/direct-reports'
import { sendNotifications } from '@/lib/notifications'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import type { SessionUser } from '@/types'

const announceSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
})

export const POST = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      if (user.role === 'EMPLOYEE') throw forbidden('매니저 이상만 팀 공지를 보낼 수 있습니다.')

      const raw: unknown = await req.json()
      const parsed = announceSchema.safeParse(raw)
      if (!parsed.success) {
        throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
      }
      const { title, body } = parsed.data

      const directIds = await getDirectReportIds(user.employeeId)
      if (directIds.length === 0) return apiSuccess({ sent: 0 })

      // "현재 활성" = getDirectReportIds 와 동일 술어 (예약 조직개편 현 발령 포함).
      // endDate:null 단독은 미래 endDate 현 발령을 떨어뜨림 (Codex Gate2 P1).
      const now = new Date()
      // 자사 active primary 직속부하만 (전출자/타 법인 제외)
      const recipients = await prisma.employee.findMany({
        where: {
          id: { in: directIds },
          assignments: {
            some: {
              companyId: user.companyId,
              isPrimary: true,
              // status:'ACTIVE' — 오프보딩(RESIGNED/TERMINATED) 계정에 공지 발송 차단 (Codex Gate2 P1)
              status: 'ACTIVE',
              effectiveDate: { lte: now },
              OR: [{ endDate: null }, { endDate: { gt: now } }],
            },
          },
        },
        select: { id: true },
      })
      if (recipients.length === 0) return apiSuccess({ sent: 0 })

      sendNotifications(
        recipients.map((r) => ({
          employeeId: r.id,
          triggerType: 'TEAM_ANNOUNCEMENT',
          title,
          body,
          companyId: user.companyId,
          link: '/',
        })),
      )

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'manager_hub.announce',
        resourceType: 'notification',
        resourceId: user.employeeId,
        companyId: user.companyId,
        changes: { recipients: recipients.length, title },
        ip,
        userAgent,
      })

      return apiSuccess({ sent: recipients.length })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
