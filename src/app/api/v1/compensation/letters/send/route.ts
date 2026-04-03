// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation Letters Batch Send (Email)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { letterSendSchema } from '@/lib/schemas/compensation'
import { sendEmail } from '@/lib/email'
import { generateCompensationLetterPdf } from '@/lib/documents/compensation-letter-pdf'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/compensation/letters/send ─────────────
// 배치 이메일 발송 (유효한 레터만)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = letterSendSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })

    const { letterIds } = parsed.data
    const { ip, userAgent } = extractRequestMeta(req.headers)

    try {
      // 유효한 레터만 조회 (invalidatedAt=null)
      const letters = await prisma.compensationLetter.findMany({
        where: {
          id: { in: letterIds },
          companyId: user.companyId,
          invalidatedAt: null,
        },
        select: {
          id: true,
          compensationHistoryId: true,
          employee: {
            select: {
              name: true,
              employeeNo: true,
              email: true,
              assignments: {
                where: { isPrimary: true, endDate: null },
                take: 1,
                select: {
                  department: { select: { name: true } },
                  position: { select: { titleKo: true } },
                },
              },
            },
          },
          compensationHistory: {
            select: {
              previousBaseSalary: true,
              newBaseSalary: true,
              changePct: true,
              changeType: true,
              effectiveDate: true,
              currency: true,
              approver: { select: { name: true } },
              company: { select: { name: true } },
            },
          },
        },
      })

      if (letters.length === 0) throw badRequest('발송 가능한 통보서가 없습니다.')

      let sent = 0
      let failed = 0
      const failures: Array<{ letterId: string; employeeName: string; reason: string }> = []

      for (const letter of letters) {
        const email = letter.employee.email
        if (!email) {
          // 이메일 없는 직원
          await prisma.compensationLetter.update({
            where: { id: letter.id },
            data: { status: 'FAILED', failureReason: '직원 이메일 주소가 등록되어 있지 않습니다.' },
          })
          failures.push({ letterId: letter.id, employeeName: letter.employee.name, reason: '이메일 미등록' })
          failed++
          continue
        }

        // 이메일 본문용 HTML 재생성
        const h = letter.compensationHistory
        const primaryAssignment = extractPrimaryAssignment(letter.employee.assignments ?? [])
        const htmlBuffer = generateCompensationLetterPdf({
          companyName: h.company.name,
          employeeName: letter.employee.name,
          employeeNo: letter.employee.employeeNo,
          departmentName: primaryAssignment?.department?.name ?? '-',
          positionName: primaryAssignment?.position?.titleKo ?? '-',
          previousBaseSalary: Number(h.previousBaseSalary),
          newBaseSalary: Number(h.newBaseSalary),
          changePct: Number(h.changePct),
          changeType: h.changeType,
          effectiveDate: h.effectiveDate.toISOString().split('T')[0],
          currency: h.currency,
          approverName: h.approver?.name ?? '-',
        })

        const result = await sendEmail({
          to: email,
          subject: `[${h.company.name}] 연봉 조정 통보서`,
          htmlBody: htmlBuffer.toString('utf-8'),
        })

        if (result.success) {
          await prisma.compensationLetter.update({
            where: { id: letter.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              sentToEmail: email,
              failureReason: null,
            },
          })
          sent++
        } else {
          const reason = '이메일 발송 실패 (SES 오류)'
          await prisma.compensationLetter.update({
            where: { id: letter.id },
            data: { status: 'FAILED', failureReason: reason },
          })
          failures.push({ letterId: letter.id, employeeName: letter.employee.name, reason })
          failed++
        }
      }

      // 감사 로그
      logAudit({
        actorId: user.employeeId,
        action: 'compensation.letter.send',
        resourceType: 'compensationLetter',
        resourceId: `batch-${letterIds.length}`,
        companyId: user.companyId,
        sensitivityLevel: 'HIGH',
        changes: { sent, failed, totalRequested: letterIds.length },
        ip,
        userAgent,
      })

      return apiSuccess({ sent, failed, failures })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.APPROVE),
)
