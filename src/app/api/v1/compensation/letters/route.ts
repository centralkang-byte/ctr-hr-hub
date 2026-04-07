// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation Letters (List + Batch Generate)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { letterGenerateSchema, letterSearchSchema } from '@/lib/schemas/compensation'
import { generateCompensationLetterPdf, buildLetterData } from '@/lib/documents/compensation-letter-pdf'
import { uploadBuffer, buildS3Key } from '@/lib/s3'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { getRequestLocale } from '@/lib/server-i18n'
import type { SessionUser } from '@/types'

// ─── Helpers ────────────────────────────────────────────────

const UPLOAD_CHUNK_SIZE = 50

async function processInChunks<T, R>(
  items: T[],
  chunkSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    const chunkResults = await Promise.all(chunk.map(fn))
    results.push(...chunkResults)
  }
  return results
}

// ─── GET /api/v1/compensation/letters ───────────────────
// 사이클별 통보서 목록 (유효한 최신 버전만)

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const parsed = letterSearchSchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) throw badRequest('잘못된 요청 파라미터입니다.')

    const { cycleId, page, limit } = parsed.data
    const companyId = user.companyId

    const where = {
      companyId,
      cycleId,
      invalidatedAt: null,
    }

    const [letters, total] = await Promise.all([
      prisma.compensationLetter.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          employeeId: true,
          version: true,
          status: true,
          sentAt: true,
          sentToEmail: true,
          failureReason: true,
          createdAt: true,
          employee: {
            select: {
              name: true,
              employeeNo: true,
              assignments: {
                where: { isPrimary: true, endDate: null },
                take: 1,
                select: {
                  department: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.compensationLetter.count({ where }),
    ])

    const data = letters.map((l) => {
      const primaryAssignment = extractPrimaryAssignment(l.employee.assignments ?? [])
      return {
        id: l.id,
        employeeId: l.employeeId,
        employeeName: l.employee.name,
        employeeNo: l.employee.employeeNo,
        department: primaryAssignment?.department?.name ?? '-',
        version: l.version,
        status: l.status,
        sentAt: l.sentAt,
        sentToEmail: l.sentToEmail,
        failureReason: l.failureReason,
        createdAt: l.createdAt,
      }
    })

    return apiPaginated(data, { page, limit, total, totalPages: Math.ceil(total / limit) })
  },
  perm(MODULE.COMPENSATION, ACTION.VIEW),
)

// ─── POST /api/v1/compensation/letters ──────────────────
// 배치 생성 (기존 유효 레터 invalidate + 신규 생성)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const locale = await getRequestLocale()
    const body: unknown = await req.json()
    const parsed = letterGenerateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })

    const { cycleId, employeeIds } = parsed.data
    const companyId = user.companyId
    const { ip, userAgent } = extractRequestMeta(req.headers)

    try {
      // 1. CompensationHistory 배치 조회
      const historyWhere: Record<string, unknown> = { companyId, cycleId }
      if (employeeIds && employeeIds.length > 0) {
        historyWhere.employeeId = { in: employeeIds }
      }

      const histories = await prisma.compensationHistory.findMany({
        where: historyWhere,
        orderBy: { effectiveDate: 'desc' },
        select: {
          id: true,
          employeeId: true,
          previousBaseSalary: true,
          newBaseSalary: true,
          changePct: true,
          changeType: true,
          effectiveDate: true,
          currency: true,
          employee: {
            select: {
              name: true,
              employeeNo: true,
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
          approver: { select: { name: true } },
          company: { select: { name: true } },
        },
      })

      if (histories.length === 0) throw notFound('해당 사이클에 확정된 보상 이력이 없습니다.')

      // employeeId 기준 최신 history만 (중복 제거)
      const latestHistoryMap = new Map<string, typeof histories[0]>()
      for (const h of histories) {
        if (!latestHistoryMap.has(h.employeeId)) {
          latestHistoryMap.set(h.employeeId, h)
        }
      }
      const latestHistories = [...latestHistoryMap.values()]

      // 2. 기존 유효 레터 조회 (버전 확인용)
      const historyIds = latestHistories.map((h) => h.id)
      const existingLetters = await prisma.compensationLetter.findMany({
        where: {
          compensationHistoryId: { in: historyIds },
          invalidatedAt: null,
        },
        select: { id: true, compensationHistoryId: true, version: true },
      })

      const existingMap = new Map<string, number>()
      for (const l of existingLetters) {
        existingMap.set(l.compensationHistoryId, l.version)
      }

      // 3. S3 업로드 선행 (50건씩 청크 병렬)
      const uploadResults = await processInChunks(latestHistories, UPLOAD_CHUNK_SIZE, async (history) => {
        const primaryAssignment = extractPrimaryAssignment(history.employee.assignments ?? [])
        const pdfData = buildLetterData(history, primaryAssignment)
        const buffer = await generateCompensationLetterPdf(locale, pdfData)
        const fileUuid = randomUUID()
        const prevVersion = existingMap.get(history.id) ?? 0
        const newVersion = prevVersion + 1
        const filename = `comp-letter-${history.employee.employeeNo}-v${newVersion}.html`
        const s3Key = buildS3Key(companyId, 'compensation-letters', history.id, `${fileUuid}.html`)

        await uploadBuffer(s3Key, buffer, 'text/html')

        return {
          companyId,
          employeeId: history.employeeId,
          compensationHistoryId: history.id,
          cycleId,
          version: newVersion,
          s3Key,
          filename,
          generatedById: user.employeeId,
          isRegenerated: prevVersion > 0,
        }
      })

      // 4. DB 트랜잭션: invalidate + createMany
      const invalidateIds = existingLetters.map((l) => l.id)
      await prisma.$transaction(async (tx) => {
        if (invalidateIds.length > 0) {
          await tx.compensationLetter.updateMany({
            where: { id: { in: invalidateIds } },
            data: { invalidatedAt: new Date() },
          })
        }
        for (const data of uploadResults) {
          const { isRegenerated: _, ...createData } = data
          await tx.compensationLetter.create({ data: createData })
        }
      })

      const generated = uploadResults.filter((r) => !r.isRegenerated).length
      const regenerated = uploadResults.filter((r) => r.isRegenerated).length

      // 5. 감사 로그
      logAudit({
        actorId: user.employeeId,
        action: 'compensation.letter.generate',
        resourceType: 'compensationLetter',
        resourceId: cycleId,
        companyId,
        sensitivityLevel: 'HIGH',
        changes: { generated, regenerated, cycleId },
        ip,
        userAgent,
      })

      return apiSuccess({ generated, regenerated })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.APPROVE),
)
