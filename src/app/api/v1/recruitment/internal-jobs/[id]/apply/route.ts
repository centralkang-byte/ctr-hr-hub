// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/recruitment/internal-jobs/[id]/apply
// B4: Internal Mobility — 직원 내부 공고 지원
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import type { SessionUser } from '@/types'

export const POST = withAuth(
  async (
    _req: NextRequest,
    { params }: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await params

    // 공고 존재 + 내부 공고 + 공개 상태 확인
    const posting = await prisma.jobPosting.findUnique({
      where: { id, deletedAt: null },
    })
    if (!posting) throw notFound('공고를 찾을 수 없습니다.')
    if (!(posting as any).isInternal) throw badRequest('내부 채용 공고가 아닙니다.')
    if (posting.status !== 'OPEN') throw badRequest('현재 지원 가능한 공고가 아닙니다.')

    // 직원 이메일로 기존 지원자 조회 또는 생성
    if (!user.email) throw badRequest('이메일 정보가 없습니다.')

    let applicant = await prisma.applicant.findUnique({
      where: { email: user.email },
    })

    if (!applicant) {
      // 내부 직원 → Applicant 레코드 생성 (source: INTERNAL)
      const employee = await prisma.employee.findUnique({
        where: { id: user.employeeId ?? '' },
        select: { name: true, nameEn: true, phone: true },
      })
      applicant = await prisma.applicant.create({
        data: {
          name: employee?.name ?? user.name ?? user.email,
          email: user.email,
          phone: employee?.phone ?? null,
          source: 'INTERNAL',
        },
      })
    }

    // 중복 지원 확인
    const existing = await prisma.application.findFirst({
      where: { postingId: id, applicantId: applicant.id },
    })
    if (existing) throw badRequest('이미 지원한 공고입니다.')

    try {
      const application = await prisma.application.create({
        data: {
          postingId: id,
          applicantId: applicant.id,
          stage: 'APPLIED',
          appliedAt: new Date(),
        },
      })

      return apiSuccess({ applicationId: application.id, message: '내부 지원이 완료되었습니다.' }, 201)
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
)
