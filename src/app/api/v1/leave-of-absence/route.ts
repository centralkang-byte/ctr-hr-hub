// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/leave-of-absence
// 휴직 목록 조회 + 휴직 신청
//
// RBAC (역할 인지):
//  - GET: leave:manage 보유(HR_ADMIN/SUPER)는 법인 전체/임의 직원 조회.
//         그 외(직원·매니저)는 본인(employeeId=self) 으로 강제 스코프.
//  - POST self(본인 신청): leave create/update/manage 중 하나면 가능(직원·매니저·HR).
//         POST 대리(타인 신청): leave:manage(HR_ADMIN/SUPER)만.
//  - 증빙(proof): 임의 문자열이 아니라 FileUpload(proofUploadId) 단일 소비·검증.
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, notFound, forbidden, handlePrismaError, isAppError } from '@/lib/errors'
import { withAuth, hasPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import { getObjectRange, copyObject } from '@/lib/s3'
import { validateMagicBytes } from '@/lib/file-validation'
import { LOA_PROOF_PURPOSE } from '@/lib/upload/proof-upload'
import type { SessionUser } from '@/types'

const CONSUMED_BY_LOA = 'LEAVE_OF_ABSENCE'

/** HR_ADMIN/SUPER (leave:manage) = 법인 전체 조회·대리 신청 가능 */
function isLeaveAdmin(user: SessionUser): boolean {
  return hasPermission(user, perm(MODULE.LEAVE, ACTION.APPROVE))
}

// ─── GET /api/v1/leave-of-absence ────────────────────────

export const GET = withAuth(async (req: NextRequest, _context, user: SessionUser) => {
  // fail-closed: 휴직 조회는 최소 leave:read 필요 (비관리자는 아래에서 본인 스코프 강제)
  if (!hasPermission(user, perm(MODULE.LEAVE, ACTION.VIEW))) {
    throw forbidden('휴직 조회 권한이 없습니다.')
  }
  const sp = req.nextUrl.searchParams
  const page = Math.max(1, Number(sp.get('page') ?? 1))
  const limit = Math.min(100, Math.max(1, Number(sp.get('limit') ?? 20)))
  const status = sp.get('status')
  const typeId = sp.get('typeId')
  // 멀티테넌트 격리: 비-SUPER는 자기 법인 강제 (타 법인 휴직 기록·직원 PII 차단).
  const companyId = resolveCompanyId(user, sp.get('companyId'))

  const where: Record<string, unknown> = { companyId, deletedAt: null }
  if (status) where.status = status
  if (typeId) where.typeId = typeId

  if (isLeaveAdmin(user)) {
    // 관리자: 임의 직원 필터 허용 (없으면 법인 전체)
    const employeeId = sp.get('employeeId')
    if (employeeId) where.employeeId = employeeId
  } else {
    // 비관리자: 본인 기록만 (클라이언트 employeeId 무시·강제 self)
    where.employeeId = user.employeeId
  }

  const [records, total] = await Promise.all([
    prisma.leaveOfAbsence.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, nameEn: true, employeeNo: true } },
        type: { select: { id: true, code: true, name: true, nameEn: true, category: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { requestedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.leaveOfAbsence.count({ where }),
  ])

  return apiPaginated(records, buildPagination(page, limit, total))
})

// ─── POST /api/v1/leave-of-absence ──────────────────────

export const POST = withAuth(async (req: NextRequest, _context, user: SessionUser) => {
  try {
    if (!user.employeeId) throw forbidden('직원 계정만 휴직을 신청할 수 있습니다.')

    const body = (await req.json()) as Record<string, unknown>
    const { typeId, startDate, expectedEndDate, reason, proofUploadId } = body

    // 신청 대상: 미지정 시 본인. 본인이면 self, 타인이면 대리(leave:manage 필요).
    const targetEmployeeId =
      typeof body.employeeId === 'string' && body.employeeId ? body.employeeId : user.employeeId
    const isSelf = targetEmployeeId === user.employeeId

    if (isSelf) {
      const canWriteLeave =
        hasPermission(user, perm(MODULE.LEAVE, ACTION.CREATE)) ||
        hasPermission(user, perm(MODULE.LEAVE, ACTION.UPDATE)) ||
        hasPermission(user, perm(MODULE.LEAVE, ACTION.APPROVE))
      if (!canWriteLeave) throw forbidden('휴직 신청 권한이 없습니다.')
    } else if (!isLeaveAdmin(user)) {
      // 대리 신청은 HR_ADMIN/SUPER 만 (매니저의 회사 전체 대리신청 = BOLA 차단)
      throw forbidden('다른 직원의 휴직을 대리 신청할 권한이 없습니다.')
    }

    // 검증
    if (!typeId || typeof typeId !== 'string') throw badRequest('휴직 유형은 필수입니다.')
    if (!startDate || typeof startDate !== 'string') throw badRequest('시작일은 필수입니다.')
    if (proofUploadId !== undefined && typeof proofUploadId !== 'string')
      throw badRequest('잘못된 증빙 업로드 ID입니다.')

    // 휴직 유형 (법인 스코프)
    const loaType = await prisma.leaveOfAbsenceType.findFirst({
      where: { id: typeId, companyId: user.companyId, deletedAt: null },
    })
    if (!loaType) throw badRequest('유효하지 않은 휴직 유형입니다.')

    // 직원 존재 + 법인 스코프 (크로스테넌트 employeeId 차단).
    // Employee 는 companyId 직접 컬럼이 없고, 활성 주발령(EmployeeAssignment)의
    // companyId 로 소속을 판별한다 (employees 목록 스코프와 동일 패턴).
    const employee = await prisma.employee.findFirst({
      where: {
        id: targetEmployeeId,
        deletedAt: null,
        assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } },
      },
      select: { id: true },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    // 증빙 필수 체크 (이제 실제 업로드 ID 존재 검사)
    if (loaType.requiresProof && !proofUploadId) {
      throw badRequest(`이 휴직 유형은 증빙 서류가 필수입니다. (${loaType.proofDescription ?? '증빙 서류'})`)
    }

    // 증빙 사전 검증(트랜잭션 밖): 소유권·상태·만료(DB) + 실제 업로드 바이트의
    // magic-byte 검증(형식 위조 차단) + 불변 키로 복사(소비 후 변조 방지).
    let proofFinalKey: string | null = null
    if (proofUploadId) {
      const fu = await prisma.fileUpload.findFirst({
        where: {
          id: proofUploadId,
          companyId: user.companyId,
          uploaderEmployeeId: user.employeeId,
          purpose: LOA_PROOF_PURPOSE,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        select: { s3Key: true, filename: true, contentType: true },
      })
      if (!fu) throw badRequest('유효하지 않거나 만료된 증빙 업로드입니다. 다시 업로드해 주세요.')
      const head = await getObjectRange(fu.s3Key, 16)
      if (!head) throw badRequest('증빙 파일이 업로드되지 않았습니다. 다시 시도해 주세요.')
      // ETag 없으면 버전을 고정할 수 없으므로 fail-closed (변조 차단 불가 → 거부)
      if (!head.etag) throw badRequest('증빙 검증에 실패했습니다. 다시 시도해 주세요.')
      const magic = validateMagicBytes(head.bytes, fu.contentType)
      if (!magic.valid) throw badRequest(magic.error ?? '증빙 파일 형식이 올바르지 않습니다.')
      // presigned POST 만료 전 같은 키 재POST 로 내용을 바꿀 수 있으므로, server-only
      // prefix 로 복사해 LoA 에는 불변 사본을 연결한다. ETag 고정으로 검증↔복사 사이
      // 변조(재POST)를 차단한다 (불일치 시 412 → 거부).
      proofFinalKey = `${user.companyId}/loa-proof-final/${proofUploadId}/${fu.filename}`
      try {
        await copyObject(fu.s3Key, proofFinalKey, head.etag)
      } catch (e) {
        const status = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode
        const name = (e as { name?: string })?.name
        if (status === 412 || name === 'PreconditionFailed') {
          throw badRequest('증빙 파일이 검증 중 변경되었습니다. 다시 업로드해 주세요.')
        }
        throw e
      }
    }

    // 분할 사용 시 시퀀스 계산
    let splitSequence = 1
    if (loaType.splittable) {
      const existingSplits = await prisma.leaveOfAbsence.count({
        where: {
          employeeId: targetEmployeeId,
          typeId,
          status: { notIn: ['CANCELLED', 'REJECTED'] },
          deletedAt: null,
        },
      })
      splitSequence = existingSplits + 1
      if (loaType.maxSplitCount && splitSequence > loaType.maxSplitCount) {
        throw badRequest(`최대 분할 횟수(${loaType.maxSplitCount}회)를 초과했습니다.`)
      }
    }

    const record = await prisma.$transaction(async (tx) => {
      if (proofUploadId) {
        // 단일 소비: PENDING → CONSUMED 를 원자적 조건부 갱신. count!==1 이면 롤백.
        const consumed = await tx.fileUpload.updateMany({
          where: {
            id: proofUploadId,
            companyId: user.companyId,
            uploaderEmployeeId: user.employeeId,
            purpose: LOA_PROOF_PURPOSE,
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
          data: {
            status: 'CONSUMED',
            consumedAt: new Date(),
            consumedByType: CONSUMED_BY_LOA,
          },
        })
        if (consumed.count !== 1) {
          throw badRequest('증빙 업로드가 이미 사용되었거나 만료되었습니다. 다시 업로드해 주세요.')
        }
      }

      const created = await tx.leaveOfAbsence.create({
        data: {
          employeeId: targetEmployeeId,
          companyId: user.companyId,
          typeId,
          startDate: new Date(startDate as string),
          expectedEndDate: expectedEndDate ? new Date(expectedEndDate as string) : null,
          status: 'REQUESTED',
          reason: reason ? String(reason) : null,
          proofFileUrl: proofFinalKey,
          splitSequence,
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          type: { select: { id: true, code: true, name: true } },
        },
      })

      if (proofUploadId) {
        await tx.fileUpload.update({
          where: { id: proofUploadId },
          data: { consumedById: created.id },
        })
      }

      return created
    })

    return apiSuccess(record)
  } catch (error) {
    if (isAppError(error)) throw error
    throw handlePrismaError(error)
  }
})
