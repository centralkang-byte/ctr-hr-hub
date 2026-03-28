// ================================================================
// CTR HR Hub — Seed QA Fix: Fill Missing Data
// prisma/seeds/09-qa-fixes.ts
// ================================================================

import { PrismaClient, AttendanceStatus, WorkType } from '../../src/generated/prisma/client'

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

export async function seedQAFixes(prisma: PrismaClient): Promise<void> {
  console.log('\n🔧 QA Fixes: Filling missing seed data...\n')

  const ctrKr = await prisma.company.findFirst({ where: { code: 'CTR' } })
  if (!ctrKr) { console.error('  ❌ CTR-KR not found'); return }
  const krId = ctrKr.id

  // ── PART A: Recent Attendance (last 7 weekdays) ───────────
  console.log('📌 PART A: Recent attendance records...')

  const activeAssignments = await prisma.employeeAssignment.findMany({
    where: { isPrimary: true, endDate: null, status: { in: ['ACTIVE', 'PROBATION'] } },
    select: { employeeId: true, companyId: true },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let recentAttCount = 0

  for (let dayOffset = -6; dayOffset <= 0; dayOffset++) {
    const date = new Date(today)
    date.setDate(date.getDate() + dayOffset)
    const dow = date.getDay()
    if (dow === 0 || dow === 6) continue

    for (const emp of activeAssignments) {
      const dateStr = date.toISOString().slice(0, 10)
      const attId = deterministicUUID('recent-att', `${emp.employeeId}:${dateStr}`)
      const seed = emp.employeeId.charCodeAt(0) + dayOffset

      // 5% absent
      if (seed % 20 === 0) continue

      const clockInHour = 8 + (seed % 3)
      const clockInMin = Math.abs(seed * 3) % 60
      const clockIn = new Date(date)
      clockIn.setHours(clockInHour, clockInMin, 0, 0)

      const isToday = dayOffset === 0
      let clockOut: Date | null = null
      let totalMinutes: number | null = null

      if (!isToday) {
        const clockOutHour = 17 + (seed % 3)
        clockOut = new Date(date)
        clockOut.setHours(clockOutHour, Math.abs(seed * 7) % 60, 0, 0)
        totalMinutes = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000)
      }

      const isLate = clockInHour >= 10
      const overtimeMinutes = totalMinutes && totalMinutes > 540 ? totalMinutes - 540 : 0

      try {
        await prisma.attendance.create({
          data: {
            id: attId,
            employeeId: emp.employeeId,
            companyId: emp.companyId,
            workDate: date,
            clockIn,
            clockOut,
            workType: WorkType.NORMAL,
            status: isLate ? AttendanceStatus.LATE : AttendanceStatus.NORMAL,
            totalMinutes,
            overtimeMinutes,
          },
        })
        recentAttCount++
      } catch { /* duplicate — skip */ }
    }
  }
  console.log(`  ✅ ${recentAttCount} recent attendance records`)

  // ── PART B: Payslips ──────────────────────────────────────
  console.log('📌 PART B: Payslips...')

  const payrollItems = await prisma.payrollItem.findMany({
    select: { id: true, runId: true, employeeId: true, grossPay: true, netPay: true },
  })

  // Get run info for year/month
  const payrollRuns = await prisma.payrollRun.findMany({
    select: { id: true, companyId: true, periodStart: true, periodEnd: true },
  })
  const runMap = new Map(payrollRuns.map(r => [r.id, r]))

  let payslipCount = 0
  for (const item of payrollItems) {
    const run = runMap.get(item.runId)
    if (!run) continue
    const psId = deterministicUUID('payslip', `${item.runId}:${item.employeeId}`)
    const endDate = run.periodEnd
    const year = endDate.getFullYear()
    const month = endDate.getMonth() + 1

    try {
      await prisma.payslip.create({
        data: {
          id: psId,
          payrollItemId: item.id,
          employeeId: item.employeeId,
          companyId: run.companyId,
          year,
          month,
          pdfPath: null,
        },
      })
      payslipCount++
    } catch { /* duplicate */ }
  }
  console.log(`  ✅ ${payslipCount} payslips`)

  // ── PART C: Employee Profile Extensions ───────────────────
  console.log('📌 PART C: Employee profile extensions...')

  const SKILLS = [
    'React', 'TypeScript', 'Node.js', 'Python', 'SQL', 'AWS', 'Docker',
    '프로젝트 관리', '데이터 분석', '품질관리', '용접기술', 'CNC',
    'Excel', 'SAP', '영업관리', '재무분석', '인사관리', 'AI/ML',
    'Lean Manufacturing', 'Six Sigma', '리더십', '커뮤니케이션',
  ]
  const CERTS = [
    '정보처리기사', 'PMP', 'AWS SAA', '빅데이터분석기사',
    '공인노무사', 'CPA', 'ISO 9001 심사원', '기계설계기사',
  ]

  const allEmps = await prisma.employee.findMany({ select: { id: true } })
  let profExtCount = 0

  for (let i = 0; i < allEmps.length; i++) {
    const emp = allEmps[i]
    const extId = deterministicUUID('profext', emp.id)
    const seed = emp.id.charCodeAt(0) + i

    const skills: string[] = []
    const numSkills = 2 + (seed % 4)
    for (let j = 0; j < numSkills; j++) {
      skills.push(SKILLS[(seed + j * 3) % SKILLS.length])
    }

    const languages: string[] = ['ko']
    if (seed % 3 === 0) languages.push('en')

    const certs: string[] = []
    if (seed % 2 === 0) certs.push(CERTS[seed % CERTS.length])

    try {
      await prisma.employeeProfileExtension.create({
        data: {
          id: extId,
          employeeId: emp.id,
          bio: null,
          skills,
          languages,
          certifications: certs,
          avatarPath: null,
        },
      })
      profExtCount++
    } catch { /* duplicate */ }
  }
  console.log(`  ✅ ${profExtCount} profile extensions`)

  // ── PART D: Recognitions ──────────────────────────────────
  console.log('📌 PART D: Recognitions...')

  // coreValue must be one of the tenant core values
  const coreValues = ['CHALLENGE', 'TRUST', 'RESPONSIBILITY', 'RESPECT']
  const messages = [
    '프로젝트 마감을 지켜주셔서 감사합니다!',
    '팀 협업에 큰 도움이 되었습니다.',
    '탁월한 아이디어를 제시해 주셨습니다.',
    '신입 교육에 시간을 내주셔서 감사합니다.',
    '야근하면서까지 프로젝트를 완성해주셨습니다.',
    '고객 대응을 훌륭하게 처리해주셨습니다.',
    '코드 리뷰를 꼼꼼하게 해주셨습니다.',
    '새로운 프로세스 도입을 선도해주셨습니다.',
    '항상 긍정적인 에너지로 팀 사기를 높여줍니다.',
    '출장 준비를 완벽하게 해주셔서 감사합니다.',
  ]

  let recogCount = 0
  const empIds = allEmps.map(e => e.id)

  for (let i = 0; i < Math.min(40, empIds.length); i++) {
    const senderId = empIds[i]
    const recipientIdx = (i + 3 + Math.floor(i / 2)) % empIds.length
    if (recipientIdx === i) continue

    const recId = deterministicUUID('recog', `${senderId}:${empIds[recipientIdx]}:${i}`)
    const daysAgo = 1 + (i % 30)
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)

    try {
      await prisma.recognition.create({
        data: {
          id: recId,
          senderId,
          receiverId: empIds[recipientIdx],
          companyId: krId,
          coreValue: coreValues[i % coreValues.length],
          message: messages[i % messages.length],
          isPublic: i % 3 !== 0,
          createdAt: date,
        },
      })
      recogCount++
    } catch { /* duplicate */ }
  }
  console.log(`  ✅ ${recogCount} recognitions`)

  // ── PART E: Work Schedule ─────────────────────────────────
  console.log('📌 PART E: Work schedule...')

  const wsId = deterministicUUID('ws', 'CTR-KR:STANDARD')
  try {
    await prisma.workSchedule.create({
      data: {
        id: wsId,
        companyId: krId,
        name: '표준 근무',
        scheduleType: 'STANDARD',
        weeklyHours: 40,
        dailyConfig: {
          mon: { start: '09:00', end: '18:00', breakMinutes: 60 },
          tue: { start: '09:00', end: '18:00', breakMinutes: 60 },
          wed: { start: '09:00', end: '18:00', breakMinutes: 60 },
          thu: { start: '09:00', end: '18:00', breakMinutes: 60 },
          fri: { start: '09:00', end: '18:00', breakMinutes: 60 },
        },
      },
    })
    console.log('  ✅ 1 work schedule (표준 근무)')
  } catch {
    console.log('  ⏭ Work schedule already exists')
  }

  // ── PART F: 전체 알림 읽음 처리 ──────────────────────────
  console.log('📌 PART F: Mark all notifications as read...')

  const readResult = await prisma.notification.updateMany({
    where: { isRead: false },
    data: { isRead: true, readAt: new Date() },
  })
  console.log(`  ✅ ${readResult.count} notifications marked as read`)

  // ── Summary ───────────────────────────────────────────────
  console.log('\n======================================')
  console.log('🔧 QA Fixes Complete!')
  console.log('======================================')
  console.log(`  Recent Attendance:     ${recentAttCount}`)
  console.log(`  Payslips:              ${payslipCount}`)
  console.log(`  Profile Extensions:    ${profExtCount}`)
  console.log(`  Recognitions:          ${recogCount}`)
  console.log(`  Notifications Read:    ${readResult.count}`)
  console.log('======================================\n')
}
