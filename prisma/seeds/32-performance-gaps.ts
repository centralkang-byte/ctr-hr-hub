// ================================================================
// CTR HR Hub — Seed Data: Performance Module Gaps
// prisma/seeds/32-performance-gaps.ts
//
// Fills:
//   1. EmployeeSkillAssessment for 2026-H1 (team skills + skill matrix)
//   2. PerformanceCycle status: FINALIZED, COMP_REVIEW, COMP_COMPLETED
//   3. TrainingEnrollment expanded (status variety + scores)
// ================================================================

import { PrismaClient } from '../../src/generated/prisma/client'

function deterministicUUID(ns: string, key: string): string {
  const str = `${ns}:${key}`
  let h = 0
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0 }
  const hex = Math.abs(h).toString(16).padStart(8, '0')
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(1, 4)}-${hex.padEnd(12, '0').slice(0, 12)}`
}

export async function seedPerformanceGaps(prisma: PrismaClient) {
  console.log('📌 Seeding performance module gaps...')

  const ctrKr = await prisma.company.findFirst({ where: { code: 'CTR-KR' } })
  if (!ctrKr) { console.log('  ⚠️ CTR-KR not found'); return }

  const hrEmp = await prisma.employee.findFirst({ where: { email: 'hr@ctr.co.kr' } })
  const mgrEmp = await prisma.employee.findFirst({ where: { email: 'manager@ctr.co.kr' } })
  if (!hrEmp || !mgrEmp) { console.log('  ⚠️ HR/Manager employee not found'); return }

  // ─── 1. EmployeeSkillAssessment for 2026-H1 ──────────────────
  console.log('  📌 1/3: Skill assessments (2026-H1)...')

  const allEmployees = await prisma.employee.findMany({
    where: { assignments: { some: { companyId: ctrKr.id, isPrimary: true, endDate: null } } },
    select: { id: true },
    take: 25,
  })

  const competencies = await prisma.competency.findMany({
    select: { id: true, code: true },
  })
  const compMap: Record<string, string> = {}
  for (const c of competencies) compMap[c.code] = c.id

  const period2026H1 = '2026-H1'
  let skillCount = 0

  // Broader assignments for 2026-H1 — covers more employees × more competencies
  const h1Assignments = [
    { empIdx: 0,  codes: ['PYTHON', 'SQL', 'DATA_ANAL', 'CLOUD'],          self: [4, 4, 5, 3], mgr: [4, 3, 4, 3] },
    { empIdx: 1,  codes: ['TYPESCRIPT', 'SQL', 'CLOUD', 'TEAM_MGMT'],      self: [5, 4, 4, 3], mgr: [5, 4, 3, 3] },
    { empIdx: 2,  codes: ['SAP', 'SQL', 'PROCESS_IMP'],                    self: [5, 4, 4],     mgr: [5, 5, 4] },
    { empIdx: 3,  codes: ['AUTOCAD', 'MOLD_DESIGN', 'QC', 'SIX_SIGMA'],   self: [4, 4, 4, 3], mgr: [4, 3, 5, 3] },
    { empIdx: 4,  codes: ['TEAM_MGMT', 'COACHING', 'DECISION', 'STRATEGY'],self: [4, 5, 4, 3], mgr: [5, 5, 4, 4] },
    { empIdx: 5,  codes: ['PRESENT', 'BIZ_EN', 'NEGOTIATION', 'CONFLICT'], self: [4, 4, 3, 3], mgr: [3, 4, 4, 3] },
    { empIdx: 6,  codes: ['QC', 'PROCESS_IMP', 'SIX_SIGMA', 'ISO_9001'],  self: [5, 4, 4, 5], mgr: [5, 5, 4, 5] },
    { empIdx: 7,  codes: ['PYTHON', 'DATA_ANAL', 'CLOUD'],                 self: [3, 3, 3],     mgr: [3, 3, 2] },
    { empIdx: 8,  codes: ['SAP', 'PRESENT', 'BIZ_EN'],                     self: [4, 4, 3],     mgr: [4, 3, 4] },
    { empIdx: 9,  codes: ['LEAN_MFG', 'QC', 'SAFETY_MGT'],                self: [4, 4, 5],     mgr: [5, 4, 5] },
    { empIdx: 10, codes: ['TEAM_MGMT', 'STRATEGY', 'DECISION'],            self: [5, 5, 5],     mgr: [5, 4, 5] },
    { empIdx: 11, codes: ['LANG_EN', 'LANG_ZH', 'NEGOTIATION'],            self: [4, 5, 4],     mgr: [4, 5, 4] },
    { empIdx: 12, codes: ['TYPESCRIPT', 'PYTHON', 'SQL', 'CLOUD'],         self: [4, 4, 3, 2], mgr: [3, 4, 3, 3] },
    { empIdx: 13, codes: ['COACHING', 'PRESENT', 'CONFLICT'],               self: [4, 4, 4],     mgr: [5, 4, 3] },
    { empIdx: 14, codes: ['ISO_9001', 'QC', 'PROCESS_IMP'],                self: [5, 5, 4],     mgr: [5, 5, 5] },
    { empIdx: 15, codes: ['MOLD_DESIGN', 'AUTOCAD', 'SIX_SIGMA'],          self: [3, 4, 3],     mgr: [4, 4, 4] },
    { empIdx: 16, codes: ['LANG_VI', 'LANG_EN', 'PRESENT'],                self: [5, 3, 3],     mgr: [5, 3, 3] },
    { empIdx: 17, codes: ['DATA_ANAL', 'SQL', 'PYTHON'],                   self: [3, 3, 3],     mgr: [2, 3, 2] },
    { empIdx: 18, codes: ['SAFETY_MGT', 'LEAN_MFG', 'QC'],                self: [5, 4, 3],     mgr: [4, 3, 4] },
    { empIdx: 19, codes: ['BIZ_EN', 'PRESENT', 'TECH_WRITE'],              self: [4, 3, 4],     mgr: [3, 4, 4] },
    { empIdx: 20, codes: ['SAP', 'PROCESS_IMP', 'TEAM_MGMT'],             self: [3, 4, 3],     mgr: [4, 4, 3] },
    { empIdx: 21, codes: ['TEAM_MGMT', 'CONFLICT', 'STRATEGY'],            self: [4, 4, 3],     mgr: [3, 4, 4] },
    { empIdx: 22, codes: ['CLOUD', 'SQL', 'DATA_ANAL'],                    self: [3, 3, 3],     mgr: [2, 3, 2] },
    { empIdx: 23, codes: ['ISO_9001', 'SAFETY_MGT', 'LEAN_MFG'],          self: [4, 4, 4],     mgr: [5, 5, 4] },
    { empIdx: 24, codes: ['LANG_ZH', 'NEGOTIATION', 'BIZ_EN'],            self: [4, 3, 3],     mgr: [4, 4, 3] },
  ]

  for (const asgn of h1Assignments) {
    const emp = allEmployees[asgn.empIdx]
    if (!emp) continue
    for (let i = 0; i < asgn.codes.length; i++) {
      const code = asgn.codes[i]
      const compId = compMap[code]
      if (!compId) continue
      const selfLevel = asgn.self[i]
      const managerLevel = asgn.mgr[i]
      const finalLevel = managerLevel // manager's assessment is final
      await prisma.employeeSkillAssessment.upsert({
        where: { employeeId_competencyId_assessmentPeriod: { employeeId: emp.id, competencyId: compId, assessmentPeriod: period2026H1 } },
        update: { selfLevel, managerLevel, finalLevel },
        create: {
          id: deterministicUUID('skill-h1', `${emp.id}:${code}:${period2026H1}`),
          employeeId: emp.id,
          competencyId: compId,
          assessmentPeriod: period2026H1,
          selfLevel,
          managerLevel,
          finalLevel,
          currentLevel: finalLevel,
          assessedById: mgrEmp.id,
          assessedAt: new Date('2026-03-10'),
        },
      })
      skillCount++
    }
  }
  console.log(`  ✅ ${skillCount} skill assessments for 2026-H1`)

  // ─── 2. Performance Cycles with FINALIZED / COMP_REVIEW ────────
  console.log('  📌 2/3: Additional performance cycles...')

  // Add a FINALIZED cycle (2025 H1 — old cycle that went through calibration)
  const cycle2025H1Id = deterministicUUID('cycle', 'CTR-KR:2025:H1')
  await prisma.performanceCycle.upsert({
    where: { id: cycle2025H1Id },
    update: { status: 'FINALIZED' },
    create: {
      id: cycle2025H1Id,
      companyId: ctrKr.id,
      name: '2025년 상반기 성과평가',
      year: 2025,
      half: 'H1',
      goalStart: new Date('2025-01-01'),
      goalEnd: new Date('2025-02-15'),
      evalStart: new Date('2025-06-01'),
      evalEnd: new Date('2025-06-30'),
      status: 'FINALIZED',
    },
  })

  // Add a COMP_REVIEW cycle (2024 H2 — went through comp review)
  const cycle2024H2Id = deterministicUUID('cycle', 'CTR-KR:2024:H2')
  await prisma.performanceCycle.upsert({
    where: { id: cycle2024H2Id },
    update: { status: 'COMP_REVIEW' },
    create: {
      id: cycle2024H2Id,
      companyId: ctrKr.id,
      name: '2024년 하반기 성과평가',
      year: 2024,
      half: 'H2',
      goalStart: new Date('2024-07-01'),
      goalEnd: new Date('2024-08-15'),
      evalStart: new Date('2024-12-01'),
      evalEnd: new Date('2024-12-31'),
      status: 'COMP_REVIEW',
    },
  })

  // Add a COMP_COMPLETED cycle
  const cycle2024H1Id = deterministicUUID('cycle', 'CTR-KR:2024:H1')
  await prisma.performanceCycle.upsert({
    where: { id: cycle2024H1Id },
    update: { status: 'COMP_COMPLETED' },
    create: {
      id: cycle2024H1Id,
      companyId: ctrKr.id,
      name: '2024년 상반기 성과평가',
      year: 2024,
      half: 'H1',
      goalStart: new Date('2024-01-01'),
      goalEnd: new Date('2024-02-15'),
      evalStart: new Date('2024-06-01'),
      evalEnd: new Date('2024-06-30'),
      status: 'COMP_COMPLETED',
    },
  })

  console.log('  ✅ 3 additional cycles (FINALIZED, COMP_REVIEW, COMP_COMPLETED)')

  // ─── 3. Training Enrollments — expanded ────────────────────────
  console.log('  📌 3/3: Expanding training enrollments...')

  const courses = await prisma.trainingCourse.findMany({
    where: { isActive: true },
    select: { id: true, title: true },
    take: 6,
  })

  if (courses.length === 0) {
    console.log('  ⚠️ No training courses found, skipping enrollments')
    return
  }

  const enrollStatuses = ['ENROLLED', 'IN_PROGRESS', 'ENROLLMENT_COMPLETED', 'DROPPED', 'FAILED'] as const
  let enrollCount = 0

  for (let i = 0; i < Math.min(allEmployees.length, 20); i++) {
    const emp = allEmployees[i]
    // Assign 1~2 courses per employee
    const courseCount = (i % 3 === 0) ? 2 : 1
    for (let c = 0; c < courseCount && c < courses.length; c++) {
      const courseIdx = (i + c) % courses.length
      const course = courses[courseIdx]
      const statusIdx = (i + c) % enrollStatuses.length
      const status = enrollStatuses[statusIdx]

      const enrollId = deterministicUUID('enroll-gap', `${emp.id}:${course.id}`)

      const existing = await prisma.trainingEnrollment.findUnique({
        where: { courseId_employeeId: { courseId: course.id, employeeId: emp.id } },
      })
      if (existing) continue

      const enrolledAt = new Date(`2026-${String(1 + (i % 3)).padStart(2, '0')}-${String(5 + (i % 20)).padStart(2, '0')}`)
      const completedAt = (status === 'ENROLLMENT_COMPLETED')
        ? new Date(enrolledAt.getTime() + 14 * 86400000) // 14 days later
        : null
      const score = (status === 'ENROLLMENT_COMPLETED')
        ? 70 + (i % 30) // 70~99
        : (status === 'FAILED' ? 30 + (i % 20) : null)

      await prisma.trainingEnrollment.create({
        data: {
          id: enrollId,
          courseId: course.id,
          employeeId: emp.id,
          status,
          source: (i % 4 === 0) ? 'mandatory_auto' : (i % 3 === 0) ? 'gap_recommendation' : 'manual',
          enrolledAt,
          completedAt,
          score: score ? score : undefined,
          startDate: status !== 'ENROLLED' ? enrolledAt : undefined,
        },
      })
      enrollCount++
    }
  }
  console.log(`  ✅ ${enrollCount} additional training enrollments`)
}
