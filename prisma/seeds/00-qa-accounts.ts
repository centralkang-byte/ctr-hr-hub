// ================================================================
// QF-PRE-RUN: 9 QA Test Accounts for comprehensive E2E testing
// prisma/seeds/00-qa-accounts.ts
//
// Accounts:
//   1. super@ctr.co.kr      SUPER_ADMIN  CTR-HOLD
//   2. hr@ctr.co.kr         HR_ADMIN     CTR  (existing — upsert)
//   3. hr@ctr-cn.com        HR_ADMIN     CTR-CN
//   4. manager@ctr.co.kr    MANAGER      CTR  QA Team A (existing — upsert)
//   5. manager2@ctr.co.kr   MANAGER      CTR  QA Team B
//   6. employee-a@ctr.co.kr EMPLOYEE     CTR  QA Team A → reports to M1
//   7. employee-b@ctr.co.kr EMPLOYEE     CTR  QA Team A → reports to M1
//   8. employee-c@ctr.co.kr EMPLOYEE     CTR  QA Team B → reports to M2
//   9. executive@ctr.co.kr  EXECUTIVE    CTR  경영리더 (E1)
//
// Idempotent: uses upsert throughout. Safe to re-run.
// ================================================================

import { PrismaClient } from '../../src/generated/prisma/client'

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

const TEST_PASSWORD_HASH = '$2b$10$dummyHashForSeedOnlyNotRealBcryptHashValue000000000000'

// ================================================================
// Account definitions
// ================================================================
interface QAAccount {
  email: string
  name: string
  nameEn: string
  employeeNo: string
  roleCode: string
  companyCode: string
  deptCode: string | null   // null = no specific QA dept needed
  gradeCode: string
  positionCode: string | null
}

const QA_ACCOUNTS: QAAccount[] = [
  // Session 45 확정: E1(경영리더), S1(전문리더), L2(책임매니저), L1(매니저)
  { email: 'super@ctr.co.kr',      name: '최상우',   nameEn: 'Sangwoo Choi',   employeeNo: 'CTR-QA-0001', roleCode: 'SUPER_ADMIN', companyCode: 'CTR-HOLD', deptCode: null,      gradeCode: 'E1', positionCode: null },
  { email: 'hr@ctr.co.kr',         name: '한지영',   nameEn: 'Jiyoung Han',    employeeNo: 'CTR-KR-0001', roleCode: 'HR_ADMIN',    companyCode: 'CTR', deptCode: null,      gradeCode: 'L2', positionCode: null },
  { email: 'hr@ctr-cn.com',        name: '陈美玲',   nameEn: 'Meiling Chen',   employeeNo: 'CTR-QA-0003', roleCode: 'HR_ADMIN',    companyCode: 'CTR-CN', deptCode: 'ADMIN',   gradeCode: 'L2', positionCode: null },
  { email: 'manager@ctr.co.kr',    name: '박준혁',   nameEn: 'Junhyuk Park',   employeeNo: 'CTR-KR-0002', roleCode: 'MANAGER',     companyCode: 'CTR', deptCode: 'QA-TEAM-A', gradeCode: 'L2', positionCode: 'CTR-KR-QA-TEAM-A-MGR' },
  { email: 'manager2@ctr.co.kr',   name: '김서연',   nameEn: 'Seoyeon Kim',    employeeNo: 'CTR-QA-0005', roleCode: 'MANAGER',     companyCode: 'CTR', deptCode: 'QA-TEAM-B', gradeCode: 'L2', positionCode: 'CTR-KR-QA-TEAM-B-MGR' },
  { email: 'employee-a@ctr.co.kr', name: '이민준',   nameEn: 'Minjun Lee',     employeeNo: 'CTR-QA-0006', roleCode: 'EMPLOYEE',    companyCode: 'CTR', deptCode: 'QA-TEAM-A', gradeCode: 'L1', positionCode: 'CTR-KR-QA-TEAM-A-01' },
  { email: 'employee-b@ctr.co.kr', name: '정다은',   nameEn: 'Daeun Jung',     employeeNo: 'CTR-QA-0007', roleCode: 'EMPLOYEE',    companyCode: 'CTR', deptCode: 'QA-TEAM-A', gradeCode: 'L1', positionCode: 'CTR-KR-QA-TEAM-A-02' },
  { email: 'employee-c@ctr.co.kr', name: '송현우',   nameEn: 'Hyunwoo Song',   employeeNo: 'CTR-QA-0008', roleCode: 'EMPLOYEE',    companyCode: 'CTR', deptCode: 'QA-TEAM-B', gradeCode: 'L1', positionCode: 'CTR-KR-QA-TEAM-B-01' },
  { email: 'executive@ctr.co.kr', name: '강대표',   nameEn: 'Daepyo Kang',    employeeNo: 'CTR-QA-0009', roleCode: 'EXECUTIVE',   companyCode: 'CTR', deptCode: null,         gradeCode: 'E1', positionCode: null },
]

export async function seedQAAccounts(prisma: PrismaClient) {
  console.log('📌 Seeding QA test accounts (9)...')

  // ── Lookup company IDs ──
  const companies = await prisma.company.findMany({ select: { id: true, code: true } })
  const companyMap: Record<string, string> = {}
  for (const c of companies) companyMap[c.code] = c.id

  const krId = companyMap['CTR']
  const hqId = companyMap['CTR-HOLD']
  const cnId = companyMap['CTR-CN']
  if (!krId || !hqId || !cnId) {
    throw new Error(`Missing company: CTR-KR=${krId}, CTR-HQ=${hqId}, CTR-CN=${cnId}`)
  }

  // ── Lookup roles ──
  const roles = await prisma.role.findMany({ select: { id: true, code: true } })
  const roleMap: Record<string, string> = {}
  for (const r of roles) roleMap[r.code] = r.id

  // ── Lookup existing departments ──
  const departments = await prisma.department.findMany({ select: { id: true, code: true, companyId: true } })
  const deptMap: Record<string, string> = {} // "companyCode:deptCode" -> id
  for (const d of departments) {
    const compCode = companies.find(c => c.id === d.companyId)?.code
    if (compCode) deptMap[`${compCode}:${d.code}`] = d.id
  }

  // ── Lookup job grades ──
  const grades = await prisma.jobGrade.findMany({ select: { id: true, code: true, companyId: true } })
  const gradeMap: Record<string, string> = {} // "companyCode:gradeCode" -> id
  for (const g of grades) {
    const compCode = companies.find(c => c.id === g.companyId)?.code
    if (compCode) gradeMap[`${compCode}:${g.code}`] = g.id
  }

  // ── Lookup job categories (OFFICE) ──
  const cats = await prisma.jobCategory.findMany({ where: { code: 'OFFICE' }, select: { id: true, companyId: true } })
  const officeCatMap: Record<string, string> = {} // companyId -> catId
  for (const c of cats) officeCatMap[c.companyId] = c.id

  // ── Create QA Team A & QA Team B departments under CTR ──
  const qaTeamAId = deterministicUUID('qa-dept', 'QA-TEAM-A')
  const qaTeamBId = deterministicUUID('qa-dept', 'QA-TEAM-B')

  await prisma.department.upsert({
    where: { companyId_code: { companyId: krId, code: 'QA-TEAM-A' } },
    update: { name: '생산기술팀', nameEn: 'Production Engineering' },
    create: { id: qaTeamAId, companyId: krId, code: 'QA-TEAM-A', name: '생산기술팀', nameEn: 'Production Engineering', level: 1, sortOrder: 90 },
  })
  deptMap['CTR:QA-TEAM-A'] = qaTeamAId

  await prisma.department.upsert({
    where: { companyId_code: { companyId: krId, code: 'QA-TEAM-B' } },
    update: { name: '품질관리팀', nameEn: 'Quality Control' },
    create: { id: qaTeamBId, companyId: krId, code: 'QA-TEAM-B', name: '품질관리팀', nameEn: 'Quality Control', level: 1, sortOrder: 91 },
  })
  deptMap['CTR:QA-TEAM-B'] = qaTeamBId

  console.log('  ✅ QA departments: 생산기술팀, 품질관리팀')

  // ── Create Positions for manager/employee reporting chain ──
  const posM1Id = deterministicUUID('qa-pos', 'CTR-KR-QA-TEAM-A-MGR')
  const posM2Id = deterministicUUID('qa-pos', 'CTR-KR-QA-TEAM-B-MGR')
  const posEA  = deterministicUUID('qa-pos', 'CTR-KR-QA-TEAM-A-01')
  const posEB  = deterministicUUID('qa-pos', 'CTR-KR-QA-TEAM-A-02')
  const posEC  = deterministicUUID('qa-pos', 'CTR-KR-QA-TEAM-B-01')

  // Manager positions (no reportsTo — they are the top)
  await prisma.position.upsert({
    where: { code: 'CTR-KR-QA-TEAM-A-MGR' },
    update: { titleKo: '생산기술팀장', titleEn: 'Production Engineering Manager', departmentId: qaTeamAId, isFilled: true },
    create: { id: posM1Id, code: 'CTR-KR-QA-TEAM-A-MGR', titleKo: '생산기술팀장', titleEn: 'Production Engineering Manager', companyId: krId, departmentId: qaTeamAId, isFilled: true },
  })

  await prisma.position.upsert({
    where: { code: 'CTR-KR-QA-TEAM-B-MGR' },
    update: { titleKo: '품질관리팀장', titleEn: 'Quality Control Manager', departmentId: qaTeamBId, isFilled: true },
    create: { id: posM2Id, code: 'CTR-KR-QA-TEAM-B-MGR', titleKo: '품질관리팀장', titleEn: 'Quality Control Manager', companyId: krId, departmentId: qaTeamBId, isFilled: true },
  })

  // Employee positions (reportsTo manager)
  await prisma.position.upsert({
    where: { code: 'CTR-KR-QA-TEAM-A-01' },
    update: { titleKo: '생산기술팀원', titleEn: 'Production Engineering Staff 1', reportsToPositionId: posM1Id, departmentId: qaTeamAId, isFilled: true },
    create: { id: posEA, code: 'CTR-KR-QA-TEAM-A-01', titleKo: '생산기술팀원', titleEn: 'Production Engineering Staff 1', companyId: krId, departmentId: qaTeamAId, reportsToPositionId: posM1Id, isFilled: true },
  })

  await prisma.position.upsert({
    where: { code: 'CTR-KR-QA-TEAM-A-02' },
    update: { titleKo: '생산기술팀원', titleEn: 'Production Engineering Staff 2', reportsToPositionId: posM1Id, departmentId: qaTeamAId, isFilled: true },
    create: { id: posEB, code: 'CTR-KR-QA-TEAM-A-02', titleKo: '생산기술팀원', titleEn: 'Production Engineering Staff 2', companyId: krId, departmentId: qaTeamAId, reportsToPositionId: posM1Id, isFilled: true },
  })

  await prisma.position.upsert({
    where: { code: 'CTR-KR-QA-TEAM-B-01' },
    update: { titleKo: '품질관리팀원', titleEn: 'Quality Control Staff 1', reportsToPositionId: posM2Id, departmentId: qaTeamBId, isFilled: true },
    create: { id: posEC, code: 'CTR-KR-QA-TEAM-B-01', titleKo: '품질관리팀원', titleEn: 'Quality Control Staff 1', companyId: krId, departmentId: qaTeamBId, reportsToPositionId: posM2Id, isFilled: true },
  })

  console.log('  ✅ QA positions: 2 managers + 3 employees (with reportsTo)')

  // Position lookup for assignment
  const positionMap: Record<string, string> = {
    'CTR-KR-QA-TEAM-A-MGR': posM1Id,
    'CTR-KR-QA-TEAM-B-MGR': posM2Id,
    'CTR-KR-QA-TEAM-A-01': posEA,
    'CTR-KR-QA-TEAM-A-02': posEB,
    'CTR-KR-QA-TEAM-B-01': posEC,
  }

  // ── Create employees ──
  const employeeMap: Record<string, string> = {} // email -> id

  for (const acc of QA_ACCOUNTS) {
    const empId = deterministicUUID('qa-employee', acc.email)
    const compId = companyMap[acc.companyCode]

    // Resolve department
    let deptId: string | undefined
    if (acc.deptCode) {
      deptId = deptMap[`${acc.companyCode}:${acc.deptCode}`]
    }

    // Resolve grade — use company-specific, fallback to CTR
    const gradeId = gradeMap[`${acc.companyCode}:${acc.gradeCode}`] ?? gradeMap[`CTR-KR:${acc.gradeCode}`]
    const catId = officeCatMap[compId] ?? officeCatMap[krId]

    // For HQ, get HQ dept
    if (acc.companyCode === 'CTR-HOLD' && !deptId) {
      const hqDept = await prisma.department.findFirst({ where: { companyId: hqId } })
      if (hqDept) deptId = hqDept.id
    }

    // Employee upsert
    const emp = await prisma.employee.upsert({
      where: { employeeNo: acc.employeeNo },
      update: { name: acc.name, nameEn: acc.nameEn, email: acc.email },
      create: {
        id: empId,
        employeeNo: acc.employeeNo,
        name: acc.name,
        nameEn: acc.nameEn,
        email: acc.email,
        hireDate: new Date('2024-01-01'),
      },
    })
    employeeMap[acc.email] = emp.id

    // EmployeeAssignment — only create if no primary active assignment exists
    const existingAssign = await prisma.employeeAssignment.findFirst({
      where: { employeeId: emp.id, isPrimary: true, endDate: null },
    })

    const posId = acc.positionCode ? positionMap[acc.positionCode] : undefined

    if (existingAssign) {
      // Update positionId + departmentId on existing assignment for QA positions
      if (posId) {
        await prisma.employeeAssignment.update({
          where: { id: existingAssign.id },
          data: { positionId: posId, departmentId: deptId ?? existingAssign.departmentId },
        })
      }
    } else {
      const assignId = deterministicUUID('qa-assign', acc.email)
      await prisma.employeeAssignment.create({
        data: {
          id: assignId,
          employeeId: emp.id,
          companyId: compId,
          departmentId: deptId,
          jobGradeId: gradeId,
          jobCategoryId: catId,
          positionId: posId,
          effectiveDate: new Date('2024-01-01'),
          changeType: 'HIRE',
          employmentType: 'FULL_TIME',
          status: 'ACTIVE',
          isPrimary: true,
        },
      })
    }

    // EmployeeAuth
    const authId = deterministicUUID('qa-auth', acc.email)
    await prisma.employeeAuth.upsert({
      where: { employeeId: emp.id },
      update: { passwordHash: TEST_PASSWORD_HASH },
      create: { id: authId, employeeId: emp.id, passwordHash: TEST_PASSWORD_HASH },
    })

    // SsoIdentity (required for credentials login)
    const ssoId = deterministicUUID('qa-sso', acc.email)
    const providerAccountId = deterministicUUID('qa-sso-provider', acc.email)
    await prisma.ssoIdentity.upsert({
      where: { provider_providerAccountId: { provider: 'azure-ad', providerAccountId } },
      update: { email: acc.email },
      create: { id: ssoId, employeeId: emp.id, provider: 'azure-ad', providerAccountId, email: acc.email },
    })

    // EmployeeRole
    const roleId = roleMap[acc.roleCode]
    if (roleId) {
      const eroleId = deterministicUUID('qa-emprole', `${acc.email}:${acc.roleCode}`)
      await prisma.employeeRole.upsert({
        where: { employeeId_roleId_companyId: { employeeId: emp.id, roleId, companyId: compId } },
        update: {},
        create: { id: eroleId, employeeId: emp.id, roleId, companyId: compId, startDate: new Date('2024-01-01') },
      })
    }
  }

  console.log(`  ✅ ${QA_ACCOUNTS.length} QA test accounts seeded (employee + auth + sso + role + position)`)

  // ── LeaveYearBalance for EA and EB (annual leave, 15 days) ──
  // Look for annual leave: company-specific first, then global
  const annualLeave = await prisma.leaveTypeDef.findFirst({
    where: { code: 'annual', companyId: krId },
  }) ?? await prisma.leaveTypeDef.findFirst({
    where: { code: 'annual', companyId: null },
  })
  if (annualLeave) {
    const leaveAccounts = ['employee-a@ctr.co.kr', 'employee-b@ctr.co.kr']
    for (const email of leaveAccounts) {
      const empId = employeeMap[email]
      if (!empId) continue
      const balId = deterministicUUID('qa-leave', `${email}:ANNUAL:2026`)
      await prisma.leaveYearBalance.upsert({
        where: { employeeId_leaveTypeDefId_year: { employeeId: empId, leaveTypeDefId: annualLeave.id, year: 2026 } },
        update: { entitled: 15 },
        create: { id: balId, employeeId: empId, leaveTypeDefId: annualLeave.id, year: 2026, entitled: 15, used: 0, carriedOver: 0, adjusted: 0, pending: 0 },
      })
    }
    console.log('  ✅ LeaveYearBalance: EA + EB have 15 days annual leave (2026)')
  } else {
    console.warn('  ⚠️ No ANNUAL LeaveTypeDef found for CTR-KR — skipping leave balance')
  }
}
