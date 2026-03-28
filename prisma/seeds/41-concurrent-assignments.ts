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
