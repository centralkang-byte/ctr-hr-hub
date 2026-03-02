// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bulk Assignment Upload API
// B2: 4-step Excel 일괄 발령 업로드
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { createAssignment } from '@/lib/assignments'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import type { ChangeType } from '@/types/assignment'

// ─── Row interface matching template columns ───────────────
// Department has `code` field → use 부서코드
// JobGrade has `code` field → use 직급코드

interface UploadRow {
  사번: string
  부서코드: string
  직급코드: string
  발효일: string | Date
  변경유형?: string
  사유?: string
}

const VALID_CHANGE_TYPES = new Set<ChangeType>([
  'HIRE',
  'TRANSFER',
  'PROMOTION',
  'DEMOTION',
  'REORGANIZATION',
  'STATUS_CHANGE',
  'CONTRACT_CHANGE',
  'COMPANY_TRANSFER',
])

function isValidChangeType(value: string): value is ChangeType {
  return VALID_CHANGE_TYPES.has(value as ChangeType)
}

// ─── POST /api/v1/employees/bulk-upload ───────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) throw badRequest('파일이 필요합니다.')

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<UploadRow>(ws)

    if (rows.length === 0) throw badRequest('데이터가 없습니다.')
    if (rows.length > 500)
      throw badRequest('한 번에 최대 500건까지 업로드 가능합니다.')

    const errors: Array<{ row: number; message: string }> = []
    type ValidRow = UploadRow & {
      employeeId: string
      departmentId: string
      jobGradeId: string
      companyId: string
      currentEmploymentType: string
      currentStatus: string
      resolvedChangeType: ChangeType
      resolvedDate: Date
    }
    const validRows: ValidRow[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2

      const empNo = String(row.사번 ?? '').trim()
      const deptCode = String(row.부서코드 ?? '').trim()
      const gradeCode = String(row.직급코드 ?? '').trim()
      const rawDate = row.발효일
      const rawChangeType = String(row.변경유형 ?? 'TRANSFER').trim().toUpperCase()

      // ── Required field validation ──
      if (!empNo) {
        errors.push({ row: rowNum, message: '사번이 없습니다.' })
        continue
      }
      if (!deptCode) {
        errors.push({ row: rowNum, message: '부서코드가 없습니다.' })
        continue
      }
      if (!gradeCode) {
        errors.push({ row: rowNum, message: '직급코드가 없습니다.' })
        continue
      }
      if (!rawDate) {
        errors.push({ row: rowNum, message: '발효일이 없습니다.' })
        continue
      }

      // ── Date parsing ──
      let resolvedDate: Date
      if (rawDate instanceof Date) {
        resolvedDate = rawDate
      } else {
        resolvedDate = new Date(String(rawDate))
      }
      if (isNaN(resolvedDate.getTime())) {
        errors.push({ row: rowNum, message: `발효일 형식이 올바르지 않습니다: ${rawDate}` })
        continue
      }

      // ── ChangeType validation ──
      const resolvedChangeType: ChangeType = isValidChangeType(rawChangeType)
        ? rawChangeType
        : 'TRANSFER'

      // ── DB lookups ──
      const [employee, department, jobGrade] = await Promise.all([
        prisma.employee.findFirst({
          where: { employeeNo: empNo, deletedAt: null },
          select: { id: true },
        }),
        prisma.department.findFirst({
          where: { code: deptCode, isActive: true },
          select: { id: true, companyId: true },
        }),
        prisma.jobGrade.findFirst({
          where: { code: gradeCode, deletedAt: null },
          select: { id: true },
        }),
      ])

      if (!employee) {
        errors.push({ row: rowNum, message: `사번 '${empNo}'을 찾을 수 없습니다.` })
        continue
      }
      if (!department) {
        errors.push({ row: rowNum, message: `부서코드 '${deptCode}'를 찾을 수 없습니다.` })
        continue
      }
      if (!jobGrade) {
        errors.push({ row: rowNum, message: `직급코드 '${gradeCode}'를 찾을 수 없습니다.` })
        continue
      }

      // ── Get current assignment for continuity ──
      const currentAssignment = await prisma.employeeAssignment.findFirst({
        where: { employeeId: employee.id, isPrimary: true, endDate: null },
        select: { companyId: true, employmentType: true, status: true },
      })

      validRows.push({
        ...row,
        employeeId: employee.id,
        departmentId: department.id,
        jobGradeId: jobGrade.id,
        companyId: department.companyId,
        currentEmploymentType: currentAssignment?.employmentType ?? 'FULL_TIME',
        currentStatus: currentAssignment?.status ?? 'ACTIVE',
        resolvedChangeType,
        resolvedDate,
      })
    }

    // ── If validation errors exist, return preview + errors without applying ──
    if (errors.length > 0) {
      return apiSuccess({
        preview: rows.map((r, i) => ({ ...r, rowNum: i + 2 })),
        errors,
        applied: false,
      })
    }

    // ── Apply all valid rows ──
    const results = []
    for (const row of validRows) {
      const result = await createAssignment({
        employeeId: row.employeeId,
        effectiveDate: row.resolvedDate,
        changeType: row.resolvedChangeType,
        companyId: row.companyId,
        departmentId: row.departmentId,
        jobGradeId: row.jobGradeId,
        employmentType: row.currentEmploymentType,
        status: row.currentStatus,
        reason: row.사유 ?? undefined,
        approvedBy: user.id,
      })
      results.push(result)
    }

    return apiSuccess({ applied: true, count: results.length, errors: [] })
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
