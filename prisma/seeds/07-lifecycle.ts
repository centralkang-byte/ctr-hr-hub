// ================================================================
// CTR HR Hub — Seed Data Expansion: Session 4 — Lifecycle
// prisma/seeds/07-lifecycle.ts
//
// Creates:
//   PART A: 5 EmployeeOnboarding plans + tasks
//   PART B: 2 EmployeeOffboarding processes + tasks
//   PART C: ExitInterview (for completed offboarding)
//   PART D: Departed employee (CTR-KR-9001) for analytics
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

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

const TEST_PASSWORD_HASH = '$2b$10$dummyHashForSeedOnlyNotRealBcryptHashValue000000000000'

// ── Onboarding task list (must match seed.ts onboardingTasks) ─
const KR_OB_TASKS = [
  { title: '서류제출',  dueDaysAfter: 1, sortOrder: 1 },
  { title: '장비수령',  dueDaysAfter: 1, sortOrder: 2 },
  { title: '부서소개',  dueDaysAfter: 2, sortOrder: 3 },
  { title: '보안교육',  dueDaysAfter: 3, sortOrder: 4 },
  { title: 'OJT',       dueDaysAfter: 5, sortOrder: 5 },
  { title: '멘토미팅',  dueDaysAfter: 7, sortOrder: 6 },
]

// ── Offboarding task list (must match seed.ts offboardingTasks) ─
const KR_OFF_TASKS = [
  { title: '사직서 접수',        dueDaysBefore: 14, sortOrder: 1 },
  { title: '업무 인수인계 문서', dueDaysBefore: 10, sortOrder: 2 },
  { title: '인수자 확인',        dueDaysBefore: 7,  sortOrder: 3 },
  { title: '장비 반납',          dueDaysBefore: 3,  sortOrder: 4 },
  { title: '보안카드 반납',      dueDaysBefore: 1,  sortOrder: 5 },
  { title: '계정 비활성화',      dueDaysBefore: 0,  sortOrder: 6 },
  { title: '퇴직면담',           dueDaysBefore: 3,  sortOrder: 7 },
  { title: '퇴직금 정산',        dueDaysBefore: -7, sortOrder: 8 },
]

// ────────────────────────────────────────────────────────────
export async function seedLifecycle(prisma: PrismaClient): Promise<void> {
  console.log('\n🔄 Session 4: Seeding lifecycle (onboarding + offboarding)...\n')

  // Company & template IDs
  const krCo = await prisma.company.findFirst({ where: { code: 'CTR-KR' } })
  const cnCo = await prisma.company.findFirst({ where: { code: 'CTR-CN' } })
  if (!krCo) { console.error('  ❌ CTR-KR not found'); return }
  const krId   = krCo.id
  const cnId   = cnCo?.id

  // Template IDs (already seeded)
  const obTplId  = deterministicUUID('onbtpl', 'CTR-KR:NEW_HIRE')
  const offChkId = deterministicUUID('offchk', 'CTR-KR:VOLUNTARY')

  // Global onboarding template for CN
  const globalTplId = deterministicUUID('onbtpl', 'GLOBAL:DEFAULT')

  // Fetch template task IDs
  const obTemplateTasks = await prisma.onboardingTask.findMany({
    where: { templateId: obTplId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, title: true, dueDaysAfter: true },
  })

  const offTemplateTasks = await prisma.offboardingTask.findMany({
    where: { checklistId: offChkId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, title: true, dueDaysBefore: true },
  })

  // HR approver
  const hrEmp = await prisma.employee.findFirst({ where: { employeeNo: 'CTR-KR-0001' } })
  const hrId   = hrEmp?.id ?? ''

  // ── PART D: Create Departed Employee (CTR-KR-9001) first ──
  // (needed for offboarding Case 2)
  console.log('📌 Creating departed employee (CTR-KR-9001)...')
  const dep9001Id     = deterministicUUID('employee',   'dep:CTR-KR-9001')
  const dep9001FgId   = deterministicUUID('assignment', 'dep:CTR-KR-9001')
  const dep9001AuthId = deterministicUUID('auth',       'dep:CTR-KR-9001')

  const krGradeG5Id = (await prisma.jobGrade.findFirst({ where: { code: 'G5' } }))?.id
  const krSalesDeptId = deterministicUUID('dept', 'CTR-KR:SALES')
  const krSalesPosId  = deterministicUUID('pos', 'CTR-KR-SALES-004')
  const krOfficeCatId = deterministicUUID('jobcat', 'CTR-KR:OFFICE')
  const empRole = await prisma.role.findFirst({ where: { code: 'EMPLOYEE' } })
  const empRoleId = empRole?.id ?? ''

  const dep = await prisma.employee.upsert({
    where:  { employeeNo: 'CTR-KR-9001' },
    update: { name: '박진혁', nameEn: 'Park Jinhyuk' },
    create: {
      id:         dep9001Id,
      employeeNo: 'CTR-KR-9001',
      name:       '박진혁',
      nameEn:     'Park Jinhyuk',
      email:      'jinhyuk.park@ctr.co.kr',
      hireDate:   new Date('2022-03-01'),
    },
  })
  const actualDepId = dep.id

  // EmployeeAssignment (TERMINATED)
  const existsDepAsgn = await prisma.employeeAssignment.findFirst({
    where: { employeeId: actualDepId, isPrimary: true },
  })
  if (!existsDepAsgn) {
    await prisma.employeeAssignment.create({
      data: {
        id:             dep9001FgId,
        employeeId:     actualDepId,
        companyId:      krId,
        departmentId:   krSalesDeptId,
        positionId:     krSalesPosId,
        jobGradeId:     krGradeG5Id ?? undefined,
        jobCategoryId:  krOfficeCatId,
        effectiveDate:  new Date('2022-03-01'),
        changeType:     'HIRE',
        employmentType: 'FULL_TIME',
        status:         'TERMINATED',
        endDate:        new Date('2025-11-30'),
        isPrimary:      true,
      },
    })
  }

  await prisma.employeeAuth.upsert({
    where:  { employeeId: actualDepId },
    update: {},
    create: { id: dep9001AuthId, employeeId: actualDepId, passwordHash: TEST_PASSWORD_HASH },
  })

  await prisma.employeeRole.upsert({
    where:  { employeeId_roleId_companyId: { employeeId: actualDepId, roleId: empRoleId, companyId: krId } },
    update: {},
    create: { id: deterministicUUID('emprole', 'dep:CTR-KR-9001:EMPLOYEE'), employeeId: actualDepId, roleId: empRoleId, companyId: krId, startDate: new Date('2022-03-01') },
  })

  console.log('  ✅ CTR-KR-9001 departed employee created')

  // ── Fetch buddy (P1 from SALES dept) ─────────────────────
  const buddyEmp = await prisma.employee.findFirst({
    where: { employeeNo: 'CTR-KR-0003' }, // P1 SALES
    select: { id: true },
  })
  const buddyId = buddyEmp?.id ?? hrId

  // ── PART A: Onboarding Plans ──────────────────────────────
  console.log('📌 Seeding onboarding plans (5 cases)...')
  let obPlanCount = 0, obTaskCount = 0

  // Determine P4 employees
  const P4_EMPLOYEES = ['CTR-KR-3013','CTR-KR-3024','CTR-KR-3025','CTR-KR-3037','CTR-KR-3045','CTR-KR-3052','CTR-KR-3059','CTR-KR-3068']

  interface ObCase {
    empNo:    string
    status:   'NOT_STARTED'|'IN_PROGRESS'|'COMPLETED'|'SUSPENDED'|'ARCHIVED'
    hireDate: Date
    tasksStatus: ('DONE'|'PENDING'|'SKIPPED')[]
    completedAt?: Date
  }

  const OB_CASES: ObCase[] = [
    // Case 1: COMPLETED (Dec hire)
    {
      empNo: 'CTR-KR-3059', status: 'COMPLETED',
      hireDate: new Date('2025-12-01'),
      tasksStatus: ['DONE','DONE','DONE','DONE','DONE','DONE'],
      completedAt: new Date('2025-12-09'),
    },
    // Case 2: IN_PROGRESS Day 30 (Feb hire)
    {
      empNo: 'CTR-KR-3068', status: 'IN_PROGRESS',
      hireDate: new Date('2026-02-03'),
      tasksStatus: ['DONE','DONE','DONE','DONE','PENDING','PENDING'],
    },
    // Case 3: IN_PROGRESS Day 7 (recent Mar hire)
    {
      empNo: 'CTR-KR-3052', status: 'IN_PROGRESS',
      hireDate: new Date('2026-03-03'),
      tasksStatus: ['DONE','DONE','PENDING','PENDING','PENDING','PENDING'],
    },
    // Case 4: COMPLETED with overdue OJT (Oct hire)
    {
      empNo: 'CTR-KR-3045', status: 'COMPLETED',
      hireDate: new Date('2025-10-15'),
      tasksStatus: ['DONE','DONE','DONE','DONE','DONE','DONE'],
      completedAt: new Date('2025-10-24'),
    },
    // Case 5: CN P4
    {
      empNo: 'CTR-CN-1006', status: 'IN_PROGRESS',
      hireDate: new Date('2026-01-15'),
      tasksStatus: ['DONE','DONE','DONE','PENDING','PENDING','PENDING'],
    },
  ]

  for (const c of OB_CASES) {
    const empRow = await prisma.employee.findFirst({
      where: { employeeNo: c.empNo }, select: { id: true },
    })
    if (!empRow) { console.log(`  ⚠ ${c.empNo} not found, skipping`); continue }

    const isCn    = c.empNo.startsWith('CTR-CN')
    const tplId   = isCn ? globalTplId : obTplId
    const compId  = isCn ? cnId : krId
    if (!compId) continue

    // Check template exists
    const tplExists = await prisma.onboardingTemplate.findFirst({ where: { id: tplId } })
    if (!tplExists) { console.log(`  ⚠ Template ${tplId} not found, skipping ${c.empNo}`); continue }

    const planId = deterministicUUID('obplan', c.empNo)
    const existing = await prisma.employeeOnboarding.findFirst({ where: { id: planId } })
    if (!existing) {
      await prisma.employeeOnboarding.create({
        data: {
          id:          planId,
          employeeId:  empRow.id,
          templateId:  tplId,
          companyId:   compId,
          buddyId:     buddyId,
          planType:    'ONBOARDING',
          status:      c.status,
          startedAt:   c.hireDate,
          completedAt: c.completedAt,
        },
      })
      obPlanCount++
    }

    // Create plan tasks
    const taskRows = await prisma.onboardingTask.findMany({
      where: { templateId: tplId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, dueDaysAfter: true },
    })

    for (let ti = 0; ti < taskRows.length; ti++) {
      const task      = taskRows[ti]
      const taskStatus = c.tasksStatus[ti] ?? 'PENDING'
      const planTaskId = deterministicUUID('obplantask', `${c.empNo}:${ti}`)

      // Case 4: OJT (ti=4) was late — completedAt = dueDate + 3 days
      const dueDate = addDays(c.hireDate, task.dueDaysAfter ?? (ti + 1))
      let completedAt: Date | undefined
      if (taskStatus === 'DONE') {
        completedAt = (ti === 4 && c.empNo === 'CTR-KR-3045')
          ? addDays(dueDate, 3)  // deliberately overdue
          : addDays(c.hireDate, (task.dueDaysAfter ?? (ti + 1)) + 1)
      }

      const existsTask = await prisma.employeeOnboardingTask.findFirst({ where: { id: planTaskId } })
      if (!existsTask) {
        await prisma.employeeOnboardingTask.create({
          data: {
            id:                   planTaskId,
            employeeOnboardingId: planId,
            taskId:               task.id,
            status:               taskStatus,
            completedBy:          taskStatus === 'DONE' ? empRow.id : undefined,
            completedAt:          taskStatus === 'DONE' ? completedAt : undefined,
          },
        })
        obTaskCount++
      }
    }
  }

  console.log(`  ✅ ${obPlanCount} onboarding plans, ${obTaskCount} tasks`)

  // ── PART B: Offboarding Processes ────────────────────────
  console.log('📌 Seeding offboarding processes (2 cases)...')
  let offProcCount = 0, offTaskCount = 0

  // Case 1: P10 (CTR-KR-3070) IN_PROGRESS
  const p10Row = await prisma.employee.findFirst({
    where: { employeeNo: 'CTR-KR-3070' }, select: { id: true },
  })
  if (p10Row) {
    const offProcId1   = deterministicUUID('offproc', 'CTR-KR-3070')
    const lastWorkDate1 = new Date('2026-03-31')
    const existsProc1  = await prisma.employeeOffboarding.findFirst({ where: { id: offProcId1 } })

    if (!existsProc1) {
      await prisma.employeeOffboarding.create({
        data: {
          id:                   offProcId1,
          employeeId:           p10Row.id,
          checklistId:          offChkId,
          resignType:           'VOLUNTARY',
          resignReasonCode:     'CAREER_GROWTH',
          resignReasonDetail:   '새로운 도전을 위한 자발적 퇴직',
          handoverToId:         hrId || undefined,
          status:               'IN_PROGRESS',
          lastWorkingDate:      lastWorkDate1,
          startedAt:            new Date('2026-03-05'),
        },
      })
      offProcCount++
    }

    // Tasks: only first 2 done
    const tasksStatus1 = ['DONE','PENDING','PENDING','PENDING','PENDING','PENDING','PENDING','PENDING']
    for (let ti = 0; ti < offTemplateTasks.length; ti++) {
      const taskId   = offTemplateTasks[ti].id
      const dbl      = offTemplateTasks[ti].dueDaysBefore ?? (8 - ti)
      const dueDate  = addDays(lastWorkDate1, -(dbl))
      const ts       = (tasksStatus1[ti] ?? 'PENDING') as 'DONE' | 'PENDING' | 'SKIPPED' | 'BLOCKED'
      const ptId     = deterministicUUID('offptask', `CTR-KR-3070:${ti}`)
      const existsT  = await prisma.employeeOffboardingTask.findFirst({ where: { id: ptId } })
      if (!existsT) {
        await prisma.employeeOffboardingTask.create({
          data: {
            id:                   ptId,
            employeeOffboardingId: offProcId1,
            taskId,
            status:               ts,
            completedBy:          ts === 'DONE' ? hrId || undefined : undefined,
            completedAt:          ts === 'DONE' ? new Date('2026-03-06') : undefined,
          },
        })
        offTaskCount++
      }
    }
  }

  // Case 2: Departed employee (CTR-KR-9001) COMPLETED
  const offProcId2    = deterministicUUID('offproc', 'CTR-KR-9001')
  const lwDate2       = new Date('2025-11-30')
  const existsProc2   = await prisma.employeeOffboarding.findFirst({ where: { id: offProcId2 } })

  if (!existsProc2) {
    await prisma.employeeOffboarding.create({
      data: {
        id:                         offProcId2,
        employeeId:                 actualDepId,
        checklistId:                offChkId,
        resignType:                 'VOLUNTARY',
        resignReasonCode:           'COMPENSATION',
        resignReasonDetail:         '보상 패키지 조정 불가로 인한 자발적 퇴직',
        status:                     'COMPLETED',
        lastWorkingDate:            lwDate2,
        startedAt:                  new Date('2025-11-01'),
        completedAt:                new Date('2025-12-10'),
        severanceCalculated:        true,
        itAccountDeactivated:       true,
        exitInterviewCompleted:     true,
      },
    })
    offProcCount++
  }

  // All 8 tasks COMPLETED
  for (let ti = 0; ti < offTemplateTasks.length; ti++) {
    const ptId    = deterministicUUID('offptask', `CTR-KR-9001:${ti}`)
    const existsT = await prisma.employeeOffboardingTask.findFirst({ where: { id: ptId } })
    if (!existsT) {
      await prisma.employeeOffboardingTask.create({
        data: {
          id:                    ptId,
          employeeOffboardingId: offProcId2,
          taskId:                offTemplateTasks[ti].id,
          status:                'DONE',
          completedBy:           hrId || undefined,
          completedAt:           addDays(lwDate2, -(8 - ti)),
        },
      })
      offTaskCount++
    }
  }

  console.log(`  ✅ ${offProcCount} offboarding processes, ${offTaskCount} tasks`)

  // ── PART C: ExitInterview for CTR-KR-9001 ────────────────
  console.log('📌 Seeding exit interview...')
  const exitIntId = deterministicUUID('exitint', 'CTR-KR-9001')
  const existsEI  = await prisma.exitInterview.findFirst({ where: { id: exitIntId } })
  if (!existsEI) {
    await prisma.exitInterview.create({
      data: {
        id:                   exitIntId,
        employeeOffboardingId:offProcId2,
        employeeId:           actualDepId,
        interviewerId:        hrId,
        companyId:            krId,
        interviewDate:        new Date('2025-11-20'),
        primaryReason:        'COMPENSATION',
        detailedReason:       '시장 대비 보상 수준이 낮다고 판단하여 퇴직을 결정했습니다.',
        satisfactionScore:    3,
        satisfactionDetail:   { overall: 3, compensation: 2, culture: 4, management: 3, growth: 3 },
        wouldRecommend:       true,
        feedbackText:         '보상 수준이 시장 대비 낮다고 느꼈습니다. 팀 문화는 좋았습니다.',
        suggestions:          '급여 경쟁력 강화 및 성과 인센티브 제도 개선이 필요합니다.',
        isConfidential:       true,
      },
    })
  }
  console.log('  ✅ 1 exit interview (CTR-KR-9001)')

  // ── Summary ───────────────────────────────────────────────
  const totalOb    = await prisma.employeeOnboarding.count()
  const totalObT   = await prisma.employeeOnboardingTask.count()
  const totalOff   = await prisma.employeeOffboarding.count()
  const totalOffT  = await prisma.employeeOffboardingTask.count()
  const totalEI    = await prisma.exitInterview.count()

  console.log('\n======================================')
  console.log('🔄 Lifecycle Seed Complete!')
  console.log('======================================')
  console.log(`  Onboarding plans:   ${totalOb}`)
  console.log(`  Onboarding tasks:   ${totalObT}`)
  console.log(`  Offboarding procs:  ${totalOff}`)
  console.log(`  Offboarding tasks:  ${totalOffT}`)
  console.log(`  Exit interviews:    ${totalEI}`)
  console.log('======================================\n')
}
