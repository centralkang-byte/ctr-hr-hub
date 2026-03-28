// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/employees/[id]/certificate-requests/[requestId]/approve
// HR Admin: 증명서 승인 → PDF 생성 → S3 업로드 → 상태 ISSUED
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { uploadBuffer, buildS3Key } from '@/lib/s3'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { sendNotification } from '@/lib/notifications'
import { generateEmploymentCertPdf, generateCareerCertPdf } from '@/lib/documents/certificate-pdf'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id, requestId } = await context.params

    // 증명서 요청 조회
    const certRequest = await prisma.certificateRequest.findFirst({
      where: { id: requestId, employeeId: id },
    })
    if (!certRequest) throw notFound('증명서 요청을 찾을 수 없습니다.')
    if (certRequest.status !== 'REQUESTED') {
      throw badRequest(`현재 상태(${certRequest.status})에서는 승인할 수 없습니다.`)
    }

    // 직원 정보 조회
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        assignments: {
          where: { isPrimary: true, endDate: null },
          include: {
            department: true,
            position: true,
            jobGrade: true,
            company: true,
          },
          take: 1,
        },
      },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const primary = extractPrimaryAssignment(employee.assignments) as any
    const dept = primary?.department
    const pos = primary?.position as { titleKo: string; titleEn: string | null } | null
    const grade = primary?.jobGrade
    const comp = primary?.company

    const empInfo = {
      name: employee.name,
      employeeNo: employee.employeeNo ?? '',
      birthDate: employee.birthDate ? employee.birthDate.toISOString() : null,
      hireDate: employee.hireDate ? employee.hireDate.toISOString() : '',
      departmentName: dept?.name ?? '-',
      positionName: pos?.titleKo ?? '-',
      jobGradeName: grade?.name ?? '-',
    }

    const compInfo = {
      name: comp?.name ?? '',
      code: comp?.code ?? '',
      countryCode: comp?.countryCode ?? 'KR',
    }

    // PDF 생성
    let pdfBuffer: Buffer

    if (certRequest.type === 'CAREER_CERT') {
      // 경력증명서: 전체 발령 이력 가져오기
      const allAssignments = await prisma.employeeAssignment.findMany({
        where: { employeeId: id },
        include: {
          department: true,
          position: true,
        },
        orderBy: { effectiveDate: 'asc' },
      })
      const history = allAssignments.map((a) => ({
        departmentName: a.department?.name ?? '-',
        positionName: a.position?.titleKo ?? '-',
        startDate: a.effectiveDate.toISOString(),
        endDate: a.endDate ? a.endDate.toISOString() : null,
      }))
      pdfBuffer = generateCareerCertPdf(empInfo, compInfo, history, certRequest.purpose ?? undefined)
    } else {
      // 재직증명서 / 소득증명서 (동일 템플릿)
      pdfBuffer = generateEmploymentCertPdf(empInfo, compInfo, certRequest.purpose ?? undefined)
    }

    // S3 업로드 (서버 직접 업로드)
    const filename = `${certRequest.type}_${Date.now()}.html`
    const s3Key = buildS3Key(certRequest.companyId, 'certificates', id, filename)
    await uploadBuffer(s3Key, pdfBuffer, 'text/html; charset=utf-8')

    // DB 상태 업데이트
    const updated = await prisma.certificateRequest.update({
      where: { id: requestId },
      data: {
        status: 'ISSUED',
        approvedAt: new Date(),
        issuedAt: new Date(),
        approvedById: user.employeeId,
        issuedFileKey: s3Key,
      },
    })

    // 직원에게 알림
    sendNotification({
      employeeId: id,
      triggerType: 'CERTIFICATE_ISSUED',
      title: '증명서 발급 완료',
      body: '신청하신 증명서가 발급되었습니다. 문서함에서 다운로드하세요.',
      link: '/my/documents',
      priority: 'normal',
      companyId: certRequest.companyId,
    })

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'certificate.request.approve',
      resourceType: 'certificate_request',
      resourceId: requestId,
      companyId: certRequest.companyId,
      ip,
      userAgent,
    })

    return apiSuccess(updated)
  },
  perm(MODULE.EMPLOYEES, ACTION.UPDATE),
)
