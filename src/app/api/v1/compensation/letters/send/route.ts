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
import { generateCompensationLetterPdf, buildLetterData } from '@/lib/documents/compensation-letter-pdf'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

// ─── Helpers ────────────────────────────────────────────────

const SEND_CHUNK_SIZE = 10

interface SendResult {
  letterId: string
  employeeName: string
  success: boolean
  email?: string
  reason?: string
}

// ─── POST /api/v1/compensation/letters/send ─────────────
// 배치 이메일 발송 (유효한 레터만, 10건씩 병렬)

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

      // 10건씩 청크 병렬 발송
      const allResults: SendResult[] = []

      for (let i = 0; i < letters.length; i += SEND_CHUNK_SIZE) {
        const chunk = letters.slice(i, i + SEND_CHUNK_SIZE)
        const chunkResults = await Promise.all(
          chunk.map(async (letter): Promise<SendResult> => {
            const email = letter.employee.email
            if (!email) {
              return {
                letterId: letter.id,
                employeeName: letter.employee.name,
                success: false,
                reason: '이메일 미등록',
              }
            }

            const h = letter.compensationHistory
            const primaryAssignment = extractPrimaryAssignment(letter.employee.assignments ?? [])
            const pdfData = buildLetterData(
              { ...h, employee: letter.employee },
              primaryAssignment,
            )
            const htmlBuffer = generateCompensationLetterPdf(pdfData)

            const result = await sendEmail({
              to: email,
              subject: `[${h.company.name}] 연봉 조정 통보서`,
              htmlBody: htmlBuffer.toString('utf-8'),
            })

            return {
              letterId: letter.id,
              employeeName: letter.employee.name,
              success: result.success,
              email,
              reason: result.success ? undefined : '이메일 발송 실패 (SES 오류)',
            }
          }),
        )
        allResults.push(...chunkResults)
      }

      // DB 배치 업데이트
      const successes = allResults.filter((r) => r.success)
      const failures = allResults.filter((r) => !r.success)

      if (successes.length > 0) {
        await prisma.compensationLetter.updateMany({
          where: { id: { in: successes.map((r) => r.letterId) } },
          data: { status: 'SENT', sentAt: new Date(), failureReason: null },
        })
        // sentToEmail은 건별로 다르므로 개별 업데이트
        await Promise.all(
          successes.map((r) =>
            prisma.compensationLetter.update({
              where: { id: r.letterId },
              data: { sentToEmail: r.email },
            }),
          ),
        )
      }

      if (failures.length > 0) {
        for (const f of failures) {
          await prisma.compensationLetter.update({
            where: { id: f.letterId },
            data: {
              status: 'FAILED',
              failureReason: f.reason ?? '알 수 없는 오류',
            },
          })
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
        changes: { sent: successes.length, failed: failures.length, totalRequested: letterIds.length },
        ip,
        userAgent,
      })

      return apiSuccess({
        sent: successes.length,
        failed: failures.length,
        failures: failures.map((f) => ({
          letterId: f.letterId,
          employeeName: f.employeeName,
          reason: f.reason ?? '알 수 없는 오류',
        })),
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.APPROVE),
)
