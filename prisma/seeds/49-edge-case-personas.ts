// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Edge Case Personas (30 personas)
// UAT에서 HR팀이 만날 수 있는 비정상 상황 시뮬레이션
// ═══════════════════════════════════════════════════════════

import type { PrismaClient } from '../../src/generated/prisma/client'

// ─── Deterministic UUID ────────────────────────────────────

function deterministicUUID(namespace: string, key: string): string {
  const str = `${namespace}:${key}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(0, 3)}-${hex.padEnd(12, '0').slice(0, 12)}`
}

const uid = (key: string) => deterministicUUID('edge-persona-49', key)

// ─── Persona Definitions ───────────────────────────────────

interface PersonaDef {
  key: string
  employeeNo: string
  name: string
  nameEn: string
  email: string
  companyCode: string
  gradeCode: string
  hireDate: string
  // Edge case specifics
  probationStatus?: string
  probationEndDate?: string
  contractEndDate?: string
  resignDate?: string
  assignmentStatus: string
  employmentType: string
}

// 30 personas grouped by edge case category
const PERSONAS: PersonaDef[] = [
  // ─── 고용 상태 엣지케이스 (1-8) ──────────────────────────
  {
    key: 'probation-active',
    employeeNo: 'EDGE-001',
    name: '김수습',
    nameEn: 'Kim Suseup',
    email: 'edge-probation@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L1',
    hireDate: '2026-03-01',
    probationStatus: 'IN_PROGRESS',
    probationEndDate: '2026-06-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'probation-expired',
    employeeNo: 'EDGE-002',
    name: '박만료',
    nameEn: 'Park Manryo',
    email: 'edge-probation-expired@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L1',
    hireDate: '2025-10-01',
    probationStatus: 'IN_PROGRESS',
    probationEndDate: '2026-01-01', // 이미 지남
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'contract-expiring',
    employeeNo: 'EDGE-003',
    name: '이계약',
    nameEn: 'Lee Gyeyak',
    email: 'edge-contract-expiring@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L1',
    hireDate: '2025-05-01',
    contractEndDate: '2026-05-01', // D-30
    assignmentStatus: 'ACTIVE',
    employmentType: 'CONTRACT',
  },
  {
    key: 'contract-expired',
    employeeNo: 'EDGE-004',
    name: '최만기',
    nameEn: 'Choi Mangi',
    email: 'edge-contract-expired@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L1',
    hireDate: '2024-04-01',
    contractEndDate: '2026-03-31', // 이미 만료
    assignmentStatus: 'ACTIVE',
    employmentType: 'CONTRACT',
  },
  {
    key: 'on-leave-childcare',
    employeeNo: 'EDGE-005',
    name: '정육아',
    nameEn: 'Jung Yuka',
    email: 'edge-on-leave@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2022-03-01',
    assignmentStatus: 'ON_LEAVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'loa-return-soon',
    employeeNo: 'EDGE-006',
    name: '한복귀',
    nameEn: 'Han Bokgwi',
    email: 'edge-loa-return@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2021-06-01',
    assignmentStatus: 'ON_LEAVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'offboarding-d30',
    employeeNo: 'EDGE-007',
    name: '오퇴사',
    nameEn: 'Oh Toesa',
    email: 'edge-offboarding@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2020-01-15',
    resignDate: '2026-05-06',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'resigned',
    employeeNo: 'EDGE-008',
    name: '유퇴직',
    nameEn: 'Yoo Toejik',
    email: 'edge-resigned@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2019-03-01',
    resignDate: '2026-03-15',
    assignmentStatus: 'RESIGNED',
    employmentType: 'FULL_TIME',
  },

  // ─── 조직 엣지케이스 (9-14) ──────────────────────────────
  {
    key: 'concurrent-2company',
    employeeNo: 'EDGE-009',
    name: '강겸직',
    nameEn: 'Kang Gyeomjik',
    email: 'edge-concurrent@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'S1',
    hireDate: '2018-05-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'concurrent-3pos',
    employeeNo: 'EDGE-010',
    name: '임다직',
    nameEn: 'Lim Dajik',
    email: 'edge-multipos@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'S1',
    hireDate: '2017-01-15',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'no-manager-ceo',
    employeeNo: 'EDGE-011',
    name: '윤대표',
    nameEn: 'Yoon Daepyo',
    email: 'edge-ceo@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'E1',
    hireDate: '2015-01-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'no-department',
    employeeNo: 'EDGE-012',
    name: '신입사',
    nameEn: 'Shin Ipsa',
    email: 'edge-no-dept@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L1',
    hireDate: '2026-04-06', // 오늘 입사
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'entity-transfer',
    employeeNo: 'EDGE-013',
    name: '배전적',
    nameEn: 'Bae Jeonjeok',
    email: 'edge-transfer@ctr-cn.com',
    companyCode: 'CTR-CN',
    gradeCode: 'L2',
    hireDate: '2020-06-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'no-grade-overseas',
    employeeNo: 'EDGE-014',
    name: 'Alex NoGrade',
    nameEn: 'Alex NoGrade',
    email: 'edge-nograde@ctr-us.com',
    companyCode: 'CTR-US',
    gradeCode: '', // 직급 없음
    hireDate: '2023-01-15',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },

  // ─── 급여/보상 엣지케이스 (15-20) ────────────────────────
  {
    key: 'band-overflow',
    employeeNo: 'EDGE-015',
    name: '고초과',
    nameEn: 'Ko Chogwa',
    email: 'edge-band-over@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2016-03-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'band-underflow',
    employeeNo: 'EDGE-016',
    name: '하미달',
    nameEn: 'Ha Midal',
    email: 'edge-band-under@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2024-09-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'zero-salary-intern',
    employeeNo: 'EDGE-017',
    name: '무급실',
    nameEn: 'Mugeum Sil',
    email: 'edge-intern@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L1',
    hireDate: '2026-03-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'INTERN',
  },
  {
    key: 'frequent-salary-change',
    employeeNo: 'EDGE-018',
    name: '변봉급',
    nameEn: 'Byeon Bonggeup',
    email: 'edge-freq-salary@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2021-01-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'offcycle-pending',
    employeeNo: 'EDGE-019',
    name: '승대기',
    nameEn: 'Seung Daegi',
    email: 'edge-offcycle-pending@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2022-04-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'offcycle-revised',
    employeeNo: 'EDGE-020',
    name: '재수정',
    nameEn: 'Jae Sujeong',
    email: 'edge-offcycle-revised@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2021-08-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },

  // ─── 휴가/근태 엣지케이스 (21-25) ────────────────────────
  {
    key: 'leave-zero',
    employeeNo: 'EDGE-021',
    name: '공소진',
    nameEn: 'Gong Sojin',
    email: 'edge-leave-zero@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2022-01-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'leave-negative',
    employeeNo: 'EDGE-022',
    name: '마이너',
    nameEn: 'Ma Ineo',
    email: 'edge-leave-neg@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2023-03-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'tardy-frequent',
    employeeNo: 'EDGE-023',
    name: '지각왕',
    nameEn: 'Ji Gakwang',
    email: 'edge-tardy@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L1',
    hireDate: '2024-01-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'overtime-warning',
    employeeNo: 'EDGE-024',
    name: '과로자',
    nameEn: 'Gwa Roja',
    email: 'edge-overtime@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2021-05-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'dual-leave',
    employeeNo: 'EDGE-025',
    name: '복합휴',
    nameEn: 'Bok Haphyu',
    email: 'edge-dual-leave@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2022-06-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },

  // ─── 성과/평가 엣지케이스 (26-30) ────────────────────────
  {
    key: 'goal-revision-pending',
    employeeNo: 'EDGE-026',
    name: '목수정',
    nameEn: 'Mok Sujeong',
    email: 'edge-goal-rev@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2022-01-15',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'qr-employee-done',
    employeeNo: 'EDGE-027',
    name: '분리뷰',
    nameEn: 'Bun Ribyu',
    email: 'edge-qr-done@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2021-09-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'calibration-target',
    employeeNo: 'EDGE-028',
    name: '등하향',
    nameEn: 'Deung Hahyang',
    email: 'edge-calib@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2020-07-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'new-hire-no-cycle',
    employeeNo: 'EDGE-029',
    name: '신삼월',
    nameEn: 'Shin Samwol',
    email: 'edge-newhire@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L1',
    hireDate: '2026-02-15', // 입사 3개월 미만
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
  {
    key: 'peer-review-pending',
    employeeNo: 'EDGE-030',
    name: '피어뷰',
    nameEn: 'Pi Eobyu',
    email: 'edge-peer@ctr.co.kr',
    companyCode: 'CTR',
    gradeCode: 'L2',
    hireDate: '2021-11-01',
    assignmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
  },
]

// ─── Main Seed Function ────────────────────────────────────

export async function seedEdgeCasePersonas(prisma: PrismaClient) {
  console.log('\n🌱 Seeding 49-edge-case-personas (30 personas)...')

  // 1. Lookup maps
  const companies = await prisma.company.findMany({ select: { id: true, code: true } })
  const companyMap: Record<string, string> = {}
  for (const c of companies) companyMap[c.code] = c.id

  const grades = await prisma.jobGrade.findMany({ select: { id: true, code: true, companyId: true } })
  const gradeMap: Record<string, string> = {} // "companyId:code" -> id
  for (const g of grades) gradeMap[`${g.companyId}:${g.code}`] = g.id

  const departments = await prisma.department.findMany({
    select: { id: true, code: true, companyId: true },
    where: { deletedAt: null },
  })
  // 첫 번째 부서를 기본값으로 (부서 미배정 케이스 제외)
  const deptByCompany: Record<string, string> = {}
  for (const d of departments) {
    if (!deptByCompany[d.companyId]) deptByCompany[d.companyId] = d.id
  }

  // 연차 LeaveTypeDef 조회 (잔여 0 / 마이너스 케이스용)
  // NOTE: Canonical casing is lowercase 'annual' — matches 00-qa-accounts.ts,
  // 27-fix-4-data.ts, 35-statutory-leave-types.ts. Phase 6B validator caught
  // a prior 'ANNUAL' typo here that silently skipped leave-zero/leave-negative
  // seed data for EDGE-021/022. See scripts/seed-validate-phase6b.ts §A8/B1.
  const annualLeaveType = await prisma.leaveTypeDef.findFirst({
    where: { code: 'annual', companyId: companyMap['CTR'] },
    select: { id: true },
  })

  let created = 0
  let skipped = 0

  for (const p of PERSONAS) {
    const companyId = companyMap[p.companyCode]
    if (!companyId) {
      console.warn(`  ⚠️ Company ${p.companyCode} not found, skipping ${p.key}`)
      skipped++
      continue
    }

    const employeeId = uid(p.key)
    const assignmentId = uid(`${p.key}-assign`)

    // Check if already exists
    const existing = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (existing) {
      skipped++
      continue
    }

    // Resolve jobGradeId (may be empty for overseas no-grade case)
    let jobGradeId: string | null = null
    if (p.gradeCode) {
      jobGradeId = gradeMap[`${companyId}:${p.gradeCode}`] ?? null
    }

    const departmentId = p.key === 'no-department' ? null : (deptByCompany[companyId] ?? null)

    // Create Employee
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeNo: p.employeeNo,
        name: p.name,
        nameEn: p.nameEn,
        email: p.email,
        hireDate: new Date(p.hireDate),
        resignDate: p.resignDate ? new Date(p.resignDate) : null,
        ...(p.probationStatus ? {
          probationStatus: p.probationStatus as 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'WAIVED',
          probationStartDate: new Date(p.hireDate),
          probationEndDate: p.probationEndDate ? new Date(p.probationEndDate) : null,
        } : {}),
        contractStartDate: p.employmentType === 'CONTRACT' ? new Date(p.hireDate) : null,
        contractEndDate: p.contractEndDate ? new Date(p.contractEndDate) : null,
        locale: p.companyCode.includes('CN') ? 'zh' : p.companyCode.includes('US') ? 'en' : 'ko',
      },
    })

    // Note: No User/EmployeeAuth creation — edge case personas don't need login.
    // Auth is via EmployeeAuth + SsoIdentity (see 00-qa-accounts.ts).

    // Create Primary Assignment
    await prisma.employeeAssignment.create({
      data: {
        id: assignmentId,
        employeeId,
        effectiveDate: new Date(p.hireDate),
        changeType: 'HIRE',
        companyId,
        departmentId,
        jobGradeId,
        employmentType: p.employmentType,
        status: p.assignmentStatus,
        isPrimary: true,
      },
    })

    created++
  }

  // ─── Domain-Specific Data ──────────────────────────────────

  // 5. 휴직 중 (육아휴직) — LeaveOfAbsence ACTIVE
  const loaType = await prisma.leaveOfAbsenceType.findFirst({
    where: { companyId: companyMap['CTR'], code: 'PARENTAL' },
    select: { id: true },
  })
  if (loaType) {
    const loaEmployeeId = uid('on-leave-childcare')
    const existingLoa = await prisma.leaveOfAbsence.findFirst({ where: { employeeId: loaEmployeeId, status: 'ACTIVE' } })
    if (!existingLoa) {
      await prisma.leaveOfAbsence.create({
        data: {
          id: uid('loa-childcare'),
          employeeId: loaEmployeeId,
          companyId: companyMap['CTR']!,
          typeId: loaType.id,
          startDate: new Date('2026-01-15'),
          expectedEndDate: new Date('2027-01-15'),
          status: 'ACTIVE',
          payType: 'PARTIAL',
          reason: '육아휴직 (edge case seed)',
        },
      })
    }
  }

  // 6. 휴직 복귀 예정 7일 전 — LeaveOfAbsence ACTIVE, expectedEndDate 7일 후
  if (loaType) {
    const returnEmployeeId = uid('loa-return-soon')
    const existingReturn = await prisma.leaveOfAbsence.findFirst({ where: { employeeId: returnEmployeeId, status: 'ACTIVE' } })
    if (!existingReturn) {
      const sevenDaysLater = new Date()
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
      await prisma.leaveOfAbsence.create({
        data: {
          id: uid('loa-return-soon-record'),
          employeeId: returnEmployeeId,
          companyId: companyMap['CTR']!,
          typeId: loaType.id,
          startDate: new Date('2025-04-01'),
          expectedEndDate: sevenDaysLater,
          status: 'ACTIVE',
          payType: 'UNPAID',
          reason: '개인사유 휴직 — 복귀 임박 (edge case seed)',
        },
      })
    }
  }

  // 9. 겸직 2개 법인 — Secondary Assignment in CTR-HOLD
  const holdCompanyId = companyMap['CTR-HOLD']
  if (holdCompanyId) {
    const concurrentId = uid('concurrent-2company')
    const existingSecondary = await prisma.employeeAssignment.findFirst({
      where: { employeeId: concurrentId, isPrimary: false },
    })
    if (!existingSecondary) {
      await prisma.employeeAssignment.create({
        data: {
          id: uid('concurrent-2company-secondary'),
          employeeId: concurrentId,
          effectiveDate: new Date('2024-01-01'),
          changeType: 'TRANSFER',
          companyId: holdCompanyId,
          employmentType: 'FULL_TIME',
          status: 'ACTIVE',
          isPrimary: false,
        },
      })
    }
  }

  // 13. 해외 법인 전적 이력 — Previous assignment in CTR (KR)
  const transferEmployeeId = uid('entity-transfer')
  const existingTransferHistory = await prisma.employeeAssignment.findFirst({
    where: { employeeId: transferEmployeeId, companyId: companyMap['CTR'] },
  })
  if (!existingTransferHistory && companyMap['CTR']) {
    await prisma.employeeAssignment.create({
      data: {
        id: uid('entity-transfer-prev'),
        employeeId: transferEmployeeId,
        effectiveDate: new Date('2020-06-01'),
        endDate: new Date('2023-12-31'),
        changeType: 'HIRE',
        companyId: companyMap['CTR']!,
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        isPrimary: false,
      },
    })
  }

  // 21. 연차 잔여 0일
  if (annualLeaveType) {
    const zeroLeaveId = uid('leave-zero')
    const existingBalance = await prisma.leaveYearBalance.findFirst({
      where: { employeeId: zeroLeaveId, year: 2026, leaveTypeDefId: annualLeaveType.id },
    })
    if (!existingBalance) {
      await prisma.leaveYearBalance.create({
        data: {
          id: uid('leave-zero-balance'),
          employeeId: zeroLeaveId,
          leaveTypeDefId: annualLeaveType.id,
          year: 2026,
          entitled: 15,
          used: 15,
          pending: 0,
          carriedOver: 0,
          adjusted: 0,
        },
      })
    }
  }

  // 22. 연차 잔여 마이너스 (선사용)
  if (annualLeaveType) {
    const negLeaveId = uid('leave-negative')
    const existingNeg = await prisma.leaveYearBalance.findFirst({
      where: { employeeId: negLeaveId, year: 2026, leaveTypeDefId: annualLeaveType.id },
    })
    if (!existingNeg) {
      await prisma.leaveYearBalance.create({
        data: {
          id: uid('leave-neg-balance'),
          employeeId: negLeaveId,
          leaveTypeDefId: annualLeaveType.id,
          year: 2026,
          entitled: 15,
          used: 17, // 2일 선사용
          pending: 0,
          carriedOver: 0,
          adjusted: 0,
        },
      })
    }
  }

  // 23. 이번 달 지각 5회+ — Attendance LATE records
  const tardyId = uid('tardy-frequent')
  const tardyCompanyId = companyMap['CTR']
  if (tardyCompanyId) {
    const existingTardy = await prisma.attendance.findFirst({
      where: { employeeId: tardyId, status: 'LATE' },
    })
    if (!existingTardy) {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth()
      for (let day = 1; day <= 7; day++) {
        const workDate = new Date(year, month, day)
        if (workDate.getDay() === 0 || workDate.getDay() === 6) continue // 주말 스킵
        await prisma.attendance.create({
          data: {
            id: uid(`tardy-att-${day}`),
            employeeId: tardyId,
            companyId: tardyCompanyId,
            workDate,
            clockIn: new Date(year, month, day, 9, 15 + day * 5), // 점점 늦게
            clockOut: new Date(year, month, day, 18, 0),
            clockInMethod: 'WEB',
            clockOutMethod: 'WEB',
            status: 'LATE',
            workType: 'NORMAL',
            totalMinutes: 480,
          },
        })
      }
    }
  }

  // 24. 52시간 경고 대상 — 주 48시간+ 근태
  const overtimeId = uid('overtime-warning')
  if (tardyCompanyId) {
    const existingOt = await prisma.attendance.findFirst({
      where: { employeeId: overtimeId, overtimeMinutes: { gt: 0 } },
    })
    if (!existingOt) {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth()
      // 이번 주 월~금 10시간씩 = 50시간
      for (let day = 1; day <= 5; day++) {
        const workDate = new Date(year, month, day)
        if (workDate.getDay() === 0 || workDate.getDay() === 6) continue
        await prisma.attendance.create({
          data: {
            id: uid(`overtime-att-${day}`),
            employeeId: overtimeId,
            companyId: tardyCompanyId,
            workDate,
            clockIn: new Date(year, month, day, 8, 0),
            clockOut: new Date(year, month, day, 20, 0), // 12시간
            clockInMethod: 'WEB',
            clockOutMethod: 'WEB',
            status: 'NORMAL',
            workType: 'NORMAL',
            totalMinutes: 720,
            overtimeMinutes: 240,
          },
        })
      }
    }
  }

  // 19. 비정기 보상 PENDING_APPROVAL
  const pendingOcId = uid('offcycle-pending')
  if (companyMap['CTR']) {
    const existingOc = await prisma.offCycleCompRequest.findFirst({
      where: { employeeId: pendingOcId, status: 'PENDING_APPROVAL' },
    })
    if (!existingOc) {
      await prisma.offCycleCompRequest.create({
        data: {
          id: uid('offcycle-pending-req'),
          companyId: companyMap['CTR']!,
          employeeId: pendingOcId,
          initiatorId: pendingOcId, // self-initiated for simplicity
          initiatorType: 'HR',
          reasonCategory: 'RETENTION',
          currentBaseSalary: 65_000_000,
          proposedBaseSalary: 72_000_000,
          changePct: 10.77,
          effectiveDate: new Date('2026-07-01'),
          status: 'PENDING_APPROVAL',
          reason: 'Edge case — 핵심인재 리텐션 (seed)',
          submittedAt: new Date('2026-04-01'),
        },
      })
    }
  }

  // 20. 비정기 보상 REJECTED → REVISED (DRAFT 상태)
  const revisedOcId = uid('offcycle-revised')
  if (companyMap['CTR']) {
    const existingRevised = await prisma.offCycleCompRequest.findFirst({
      where: { employeeId: revisedOcId, status: 'DRAFT' },
    })
    if (!existingRevised) {
      await prisma.offCycleCompRequest.create({
        data: {
          id: uid('offcycle-revised-req'),
          companyId: companyMap['CTR']!,
          employeeId: revisedOcId,
          initiatorId: revisedOcId,
          initiatorType: 'MANAGER',
          reasonCategory: 'PROMOTION',
          currentBaseSalary: 55_000_000,
          proposedBaseSalary: 62_000_000,
          changePct: 12.73,
          effectiveDate: new Date('2026-06-01'),
          status: 'DRAFT', // REJECTED 후 REVISED → DRAFT
          reason: 'Edge case — 승진 급여 조정 재수정 (seed)',
        },
      })
    }
  }

  console.log(`  ✅ Edge case personas: ${created} created, ${skipped} skipped`)
  return { created, skipped }
}
