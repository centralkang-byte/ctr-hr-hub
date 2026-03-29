// ================================================================
// Track B B-3e: Concurrent (겸직) Assignment Seed
// prisma/seeds/41-concurrent-assignments.ts
//
// Creates secondary EmployeeAssignment rows (isPrimary: false) for
// 6 employees who hold concurrent positions across companies/departments.
//
// ⚠️ Append-Only: NEVER modifies existing Primary assignments
// ⚠️ Gemini Patch #1: Secondary effectiveDate = Primary's effectiveDate
// ⚠️ Uses deterministic UUIDs for idempotent upsert
// ================================================================

import type { PrismaClient } from '../../src/generated/prisma/client'

const TEST_PASSWORD_HASH = '$2b$10$dummyHashForSeedOnlyNotRealBcryptHashValue000000000000'

// Leadership employees required for concurrent assignments
// Source: 39-employees.ts NAMED array (Track B B-1e)
type LeaderDef = {
  name: string
  nameEn: string
  email: string
  companyCode: string
  positionCode: string
  gradeCode: string
  roleCode: string
  employeeNoSuffix: string
}

const LEADERSHIP_EMPLOYEES: LeaderDef[] = [
  { name: '이동옥', nameEn: 'Dongok Lee',    email: 'dongok.lee@ctr.co.kr',    companyCode: 'CTR',     positionCode: 'POS-CTR-CEO',         gradeCode: 'L2', roleCode: 'MANAGER',  employeeNoSuffix: 'ECTR0001' },
  { name: '한성욱', nameEn: 'Sungwook Han',  email: 'sungwook.han@ctr.co.kr',  companyCode: 'CTR',     positionCode: 'POS-CTR-TL-FINANCE',  gradeCode: 'L2', roleCode: 'MANAGER',  employeeNoSuffix: 'ECTR0002' },
  { name: '방우영', nameEn: 'Wooyoung Bang', email: 'wooyoung.bang@ctr.co.kr', companyCode: 'CTR',     positionCode: 'POS-CTR-DIR-SCM',     gradeCode: 'L2', roleCode: 'MANAGER',  employeeNoSuffix: 'ECTR0003' },
  { name: '정병주', nameEn: 'Byungju Jeong', email: 'byungju.jeong@ctr.co.kr', companyCode: 'CTR',     positionCode: 'POS-CTR-TL-QM',       gradeCode: 'L2', roleCode: 'MANAGER',  employeeNoSuffix: 'ECTR0004' },
  { name: '박양원', nameEn: 'Yangwon Park',  email: 'yangwon.park@ctr.co.kr',  companyCode: 'CTR',     positionCode: 'POS-CTR-DIR-AM-RND',  gradeCode: 'L2', roleCode: 'MANAGER',  employeeNoSuffix: 'ECTR0005' },
  { name: '이경수', nameEn: 'Kyungsu Lee',   email: 'kyungsu.lee@ctr.co.kr',   companyCode: 'CTR-MOB', positionCode: 'POS-MOB-DIR-MGMT',    gradeCode: 'L2', roleCode: 'HR_ADMIN', employeeNoSuffix: 'EMOB0001' },
]

// Minimal positions required for leadership employees + their concurrent assignments
// (departmentId: null — Track B departments not yet seeded)
type PosDef = { code: string; titleKo: string; titleEn: string; companyCode: string }

const REQUIRED_POSITIONS: PosDef[] = [
  // Primary positions (6 leaders)
  { code: 'POS-CTR-CEO',         titleKo: '대표이사',       titleEn: 'CEO',                    companyCode: 'CTR' },
  { code: 'POS-CTR-TL-FINANCE',  titleKo: '재무회계팀장',   titleEn: 'Finance TL',             companyCode: 'CTR' },
  { code: 'POS-CTR-DIR-SCM',     titleKo: 'SCM본부장',      titleEn: 'SCM Division Director',  companyCode: 'CTR' },
  { code: 'POS-CTR-TL-QM',       titleKo: '품질경영팀장',   titleEn: 'Quality Management TL',  companyCode: 'CTR' },
  { code: 'POS-CTR-DIR-AM-RND',  titleKo: 'AM R&D센터장',   titleEn: 'AM R&D Center Director', companyCode: 'CTR' },
  { code: 'POS-MOB-DIR-MGMT',    titleKo: '경영지원본부장', titleEn: 'Management Division Director', companyCode: 'CTR-MOB' },
  // Secondary (겸직) positions
  { code: 'POS-CTR-SL-CFO',          titleKo: 'CFO',           titleEn: 'CFO',                    companyCode: 'CTR' },
  { code: 'POS-ECO-SL-CFO',          titleKo: 'CFO',           titleEn: 'CFO',                    companyCode: 'CTR-ECO' },
  { code: 'POS-MOB-TL-QM',           titleKo: '품질경영팀장',  titleEn: 'Quality Management TL',  companyCode: 'CTR-MOB' },
  { code: 'POS-MOB-TL-EHS',          titleKo: 'EHS팀장',       titleEn: 'EHS TL',                 companyCode: 'CTR-MOB' },
  { code: 'POS-MOB-TL-INFOSEC',      titleKo: '정보보안팀장',  titleEn: 'InfoSec TL',             companyCode: 'CTR-MOB' },
  { code: 'POS-CTR-TL-OM',           titleKo: 'OM팀장',        titleEn: 'OM TL',                  companyCode: 'CTR' },
  { code: 'POS-ECO-TL-FINANCE',      titleKo: '재무회계팀장',  titleEn: 'Finance TL',             companyCode: 'CTR-ECO' },
  { code: 'POS-CTR-TL-AM-DESIGNV',   titleKo: '설계팀V장',     titleEn: 'Design Team V Lead',     companyCode: 'CTR' },
]

async function ensureLeadershipEmployees(prisma: PrismaClient) {
  console.log('  📌 Ensuring leadership employees exist...')

  // Build lookup maps
  const companies = await prisma.company.findMany({ select: { id: true, code: true } })
  const companyMap = Object.fromEntries(companies.map(c => [c.code, c.id]))

  // Upsert required positions (departmentId: null — Track B deps not yet seeded)
  for (const pd of REQUIRED_POSITIONS) {
    const companyId = companyMap[pd.companyCode]
    if (!companyId) { console.warn(`  ⚠️ Company not found for position: ${pd.companyCode}`); continue }
    await prisma.position.upsert({
      where: { code: pd.code },
      update: {},
      create: { code: pd.code, titleKo: pd.titleKo, titleEn: pd.titleEn, companyId },
    })
  }

  const positions = await prisma.position.findMany({ select: { id: true, code: true, departmentId: true, companyId: true } })
  const positionMap = Object.fromEntries(positions.map(p => [p.code, p]))

  const grades = await prisma.jobGrade.findMany({ select: { id: true, code: true, companyId: true } })
  const roles = await prisma.role.findMany({ select: { id: true, code: true } })
  const roleMap = Object.fromEntries(roles.map(r => [r.code, r.id]))

  // jobCategory: pick OFFICE for each company (nullable)
  const jobCategories = await prisma.jobCategory.findMany({ select: { id: true, code: true, companyId: true } })
  const jobCatMap = Object.fromEntries(
    jobCategories
      .filter(jc => jc.code === 'OFFICE')
      .map(jc => [jc.companyId, jc.id])
  )

  const hireDate = new Date('2018-01-01')

  for (const leader of LEADERSHIP_EMPLOYEES) {
    const companyId = companyMap[leader.companyCode]
    if (!companyId) { console.warn(`  ⚠️ Company not found: ${leader.companyCode}`); continue }

    const pos = positionMap[leader.positionCode]
    if (!pos) { console.warn(`  ⚠️ Position not found: ${leader.positionCode} for ${leader.name}`); continue }

    const grade = grades.find(g => g.code === leader.gradeCode && g.companyId === companyId)
    const gradeId = grade?.id ?? null

    // 1. Employee upsert
    const emp = await prisma.employee.upsert({
      where: { email: leader.email },
      update: {},
      create: { employeeNo: leader.employeeNoSuffix, name: leader.name, nameEn: leader.nameEn, email: leader.email, hireDate },
    })

    // 2. Primary assignment — only if missing
    const existingAssign = await prisma.employeeAssignment.findFirst({
      where: { employeeId: emp.id, isPrimary: true, endDate: null },
    })
    if (!existingAssign) {
      await prisma.employeeAssignment.create({
        data: {
          employeeId: emp.id, companyId, departmentId: pos.departmentId,
          positionId: pos.id, jobGradeId: gradeId,
          jobCategoryId: jobCatMap[companyId] ?? null,
          effectiveDate: hireDate, changeType: 'HIRE',
          employmentType: 'FULL_TIME', status: 'ACTIVE', isPrimary: true,
        },
      })
    }

    // 3. EmployeeAuth
    await prisma.employeeAuth.upsert({
      where: { employeeId: emp.id },
      update: {},
      create: { employeeId: emp.id, passwordHash: TEST_PASSWORD_HASH },
    })

    // 4. SsoIdentity
    await prisma.ssoIdentity.upsert({
      where: { provider_providerAccountId: { provider: 'azure-ad', providerAccountId: `azure-leader-${leader.employeeNoSuffix}` } },
      update: {},
      create: { employeeId: emp.id, provider: 'azure-ad', providerAccountId: `azure-leader-${leader.employeeNoSuffix}`, email: leader.email },
    })

    // 5. EmployeeRole — target role + EMPLOYEE baseline
    const targetRoleId = roleMap[leader.roleCode]
    const employeeRoleId = roleMap['EMPLOYEE']
    if (targetRoleId && leader.roleCode !== 'EMPLOYEE') {
      await prisma.employeeRole.upsert({
        where: { employeeId_roleId_companyId: { employeeId: emp.id, roleId: targetRoleId, companyId } },
        update: {},
        create: { employeeId: emp.id, roleId: targetRoleId, companyId, startDate: hireDate },
      })
    }
    if (employeeRoleId) {
      await prisma.employeeRole.upsert({
        where: { employeeId_roleId_companyId: { employeeId: emp.id, roleId: employeeRoleId, companyId } },
        update: {},
        create: { employeeId: emp.id, roleId: employeeRoleId, companyId, startDate: hireDate },
      })
    }

    console.log(`    ✅ ${leader.name} (${leader.email})`)
  }
}

// Deterministic UUID — same algorithm as seed.ts lines 71-82
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

// ================================================================
// Secondary assignment definitions
// [employeeEmail, positionCode, description]
// ================================================================
type SecondaryDef = {
  email: string
  name: string
  positionCode: string
  description: string
}

const SECONDARY_ASSIGNMENTS: SecondaryDef[] = [
  // 이동옥: CEO of CTR, concurrently CTR CFO + CTR-ECO CFO
  { email: 'dongok.lee@ctr.co.kr', name: '이동옥', positionCode: 'POS-CTR-SL-CFO', description: 'CTR CFO(겸)' },
  { email: 'dongok.lee@ctr.co.kr', name: '이동옥', positionCode: 'POS-ECO-SL-CFO', description: 'CTR-ECO CFO(겸)' },

  // 정병주: CTR 품질경영팀장, concurrently CTR-MOB 품질경영팀장
  { email: 'byungju.jeong@ctr.co.kr', name: '정병주', positionCode: 'POS-MOB-TL-QM', description: 'CTR-MOB 품질경영팀장(겸)' },

  // 이경수: CTR-MOB 경영지원본부장, concurrently EHS팀장 + 정보보안팀장 (both CTR-MOB)
  { email: 'kyungsu.lee@ctr.co.kr', name: '이경수', positionCode: 'POS-MOB-TL-EHS', description: 'CTR-MOB EHS팀장(겸)' },
  { email: 'kyungsu.lee@ctr.co.kr', name: '이경수', positionCode: 'POS-MOB-TL-INFOSEC', description: 'CTR-MOB 정보보안팀장(겸)' },

  // 방우영: CTR SCM본부장, concurrently OM팀 팀장 in CTR
  { email: 'wooyoung.bang@ctr.co.kr', name: '방우영', positionCode: 'POS-CTR-TL-OM', description: 'CTR OM팀장(겸)' },

  // 한성욱: CTR 재무회계팀장, concurrently CTR-ECO 재무회계팀장 (cross-company)
  { email: 'sungwook.han@ctr.co.kr', name: '한성욱', positionCode: 'POS-ECO-TL-FINANCE', description: 'CTR-ECO 재무회계팀장(겸)' },

  // 박양원: CTR AM R&D 본부장, concurrently 설계팀V 팀장 in CTR
  { email: 'yangwon.park@ctr.co.kr', name: '박양원', positionCode: 'POS-CTR-TL-AM-DESIGNV', description: 'CTR 설계팀V장(겸)' },
]

export async function seedConcurrentAssignments(prisma: PrismaClient) {
  console.log('\n========================================')
  console.log('Track B B-3e: Concurrent Assignments (겸직)')
  console.log('========================================')

  await ensureLeadershipEmployees(prisma)

  let created = 0
  let skipped = 0

  for (const def of SECONDARY_ASSIGNMENTS) {
    const { email, name, positionCode, description } = def

    // 1. Look up the employee by email
    const employee = await prisma.employee.findFirst({ where: { email } })
    if (!employee) {
      console.warn(`  ⚠️ SKIP: Employee not found — ${name} (${email})`)
      skipped++
      continue
    }

    // 2. Look up the target position by code
    const position = await prisma.position.findFirst({
      where: { code: positionCode },
      include: { company: true, department: true },
    })
    if (!position) {
      console.warn(`  ⚠️ SKIP: Position not found — ${positionCode} for ${name}`)
      skipped++
      continue
    }

    // 3. Look up the employee's PRIMARY assignment to get effectiveDate (Gemini Patch #1)
    const primaryAssignment = await prisma.employeeAssignment.findFirst({
      where: { employeeId: employee.id, isPrimary: true, endDate: null },
    })
    if (!primaryAssignment) {
      console.warn(`  ⚠️ SKIP: No active primary assignment — ${name} (${email})`)
      skipped++
      continue
    }

    // 4. Look up JobGrade from primary assignment (reuse same grade)
    const jobGradeId = primaryAssignment.jobGradeId

    // 5. Deterministic UUID for idempotent upsert
    const assignmentId = deterministicUUID('concurrent-assignment', `${email}:${positionCode}`)

    // 6. Upsert secondary assignment
    await prisma.employeeAssignment.upsert({
      where: { id: assignmentId },
      update: {
        companyId: position.companyId,
        departmentId: position.departmentId,
        positionId: position.id,
        jobGradeId,
        employmentType: primaryAssignment.employmentType,
        status: primaryAssignment.status,
        isPrimary: false,
        changeType: 'CONCURRENT',
        effectiveDate: primaryAssignment.effectiveDate,
      },
      create: {
        id: assignmentId,
        employeeId: employee.id,
        companyId: position.companyId,
        departmentId: position.departmentId,
        positionId: position.id,
        jobGradeId,
        jobCategoryId: primaryAssignment.jobCategoryId,
        employmentType: primaryAssignment.employmentType,
        contractType: primaryAssignment.contractType,
        status: primaryAssignment.status,
        isPrimary: false,
        changeType: 'CONCURRENT',
        effectiveDate: primaryAssignment.effectiveDate,
        reason: description,
      },
    })

    console.log(`  ✅ ${name} → ${description} (${positionCode})`)
    created++
  }

  console.log(`\n  📊 Results: ${created} created/updated, ${skipped} skipped`)
  console.log('========================================\n')
}
