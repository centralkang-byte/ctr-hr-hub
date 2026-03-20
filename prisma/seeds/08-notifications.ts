// ================================================================
// CTR HR Hub — Seed Data Expansion: Session 4 — Notifications
// prisma/seeds/08-notifications.ts
//
// Creates:
//   ~350 Notification records across multiple categories
//   - Leave, Performance, Attendance, Onboarding, Payroll, System, Offboarding
//   - 70% isRead=true (historical), 30% unread (recent 2 weeks)
// ================================================================

import { Prisma, PrismaClient } from '../../src/generated/prisma/client'

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

function sr(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

/** Random date between two dates using seed */
function randomBetween(start: Date, end: Date, seed: number): Date {
  const ms = start.getTime() + sr(seed) * (end.getTime() - start.getTime())
  return new Date(Math.round(ms))
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// ── Persona map ───────────────────────────────────────────────
const KR_PERSONA: Record<string, string> = {
  'CTR-KR-0001':'P1','CTR-KR-0002':'P9','CTR-KR-0003':'P1',
  'CTR-KR-2001':'P8','CTR-KR-2002':'P8','CTR-KR-2003':'P8',
  'CTR-KR-2004':'P8','CTR-KR-2005':'P8','CTR-KR-2006':'P8',
  'CTR-KR-3001':'P8','CTR-KR-3002':'P8','CTR-KR-3003':'P8',
  'CTR-KR-3004':'P3','CTR-KR-3005':'P3','CTR-KR-3006':'P2',
  'CTR-KR-3007':'P2','CTR-KR-3008':'P8','CTR-KR-3009':'P8',
  'CTR-KR-3010':'P1','CTR-KR-3011':'P6','CTR-KR-3012':'P6',
  'CTR-KR-3013':'P4','CTR-KR-3014':'P1','CTR-KR-3015':'P7',
  'CTR-KR-3016':'P5','CTR-KR-3017':'P9','CTR-KR-3018':'P9',
  'CTR-KR-3019':'P1','CTR-KR-3020':'P1','CTR-KR-3021':'P2',
  'CTR-KR-3022':'P2','CTR-KR-3023':'P5','CTR-KR-3024':'P4',
  'CTR-KR-3025':'P4','CTR-KR-3026':'P1','CTR-KR-3027':'P6',
  'CTR-KR-3028':'P3','CTR-KR-3029':'P9','CTR-KR-3030':'P9',
  'CTR-KR-3031':'P1','CTR-KR-3032':'P1','CTR-KR-3033':'P2',
  'CTR-KR-3034':'P5','CTR-KR-3035':'P8','CTR-KR-3036':'P8',
  'CTR-KR-3037':'P4','CTR-KR-3038':'P6','CTR-KR-3039':'P9',
  'CTR-KR-3040':'P9','CTR-KR-3041':'P1','CTR-KR-3042':'P2',
  'CTR-KR-3043':'P5','CTR-KR-3044':'P5','CTR-KR-3045':'P4',
  'CTR-KR-3046':'P6','CTR-KR-3047':'P1','CTR-KR-3048':'P9',
  'CTR-KR-3049':'P2','CTR-KR-3050':'P1','CTR-KR-3051':'P1',
  'CTR-KR-3052':'P4','CTR-KR-3053':'P5','CTR-KR-3054':'P6',
  'CTR-KR-3055':'P9','CTR-KR-3056':'P1','CTR-KR-3057':'P1',
  'CTR-KR-3058':'P2','CTR-KR-3059':'P4','CTR-KR-3060':'P6',
  'CTR-KR-3061':'P9','CTR-KR-3062':'P1','CTR-KR-3063':'P1',
  'CTR-KR-3064':'P7','CTR-KR-3065':'P5','CTR-KR-3066':'P9',
  'CTR-KR-3067':'P1','CTR-KR-3068':'P4','CTR-KR-3069':'P9',
  'CTR-KR-3070':'P10',
}

interface NotifData {
  id:          string
  employeeId:  string
  triggerType: string
  title:       string
  body:        string
  channel:     'IN_APP' | 'EMAIL' | 'PUSH' | 'TEAMS'
  isRead:      boolean
  readAt:      Date | null
  createdAt:   Date
  link:        string | null
  priority:    string
  metadata:    Prisma.InputJsonValue | null
}

// ────────────────────────────────────────────────────────────
export async function seedNotifications(prisma: PrismaClient): Promise<void> {
  console.log('\n🔔 Session 4: Seeding notifications...\n')

  const TODAY       = new Date('2026-03-09')
  const PERIOD_START = new Date('2025-09-01')
  const TWO_WEEKS_AGO = addDays(TODAY, -14)

  // Fetch KR employees
  const krCo = await prisma.company.findFirst({ where: { code: 'CTR' } })
  if (!krCo) { console.error('  ❌ CTR-KR not found'); return }
  const krId = krCo.id

  const krAssignments = await prisma.employeeAssignment.findMany({
    where:  { companyId: krId, isPrimary: true, endDate: null },
    select: { employeeId: true, employee: { select: { employeeNo: true, name: true } } },
  })

  // Fetch existing leave requests, payroll runs, MBO goals for linking
  const allLeaveReqs = await prisma.leaveRequest.findMany({
    where:  { companyId: krId },
    select: { id: true, employeeId: true, status: true, startDate: true, days: true },
    take:   80,
  })
  const allPayrollRuns = await prisma.payrollRun.findMany({
    where:  { companyId: krId },
    select: { id: true, yearMonth: true },
    orderBy:{ yearMonth: 'asc' },
  })
  const allGoals = await prisma.mboGoal.findMany({
    where:  { companyId: krId, status: 'APPROVED' },
    select: { id: true, employeeId: true },
    take:   30,
  })

  const notifs: NotifData[] = []
  let seed = 1000

  function mkNotif(params: {
    key:        string
    empId:      string
    type:       string
    title:      string
    body:       string
    createdAt:  Date
    link?:      string
    metadata?:  object
    channel?:   'IN_APP'|'EMAIL'|'PUSH'
    priority?:  string
  }): void {
    const isRecent = params.createdAt >= TWO_WEEKS_AGO
    const isRead   = !isRecent && sr(seed++) > 0.30 // 70% read for historical

    notifs.push({
      id:          deterministicUUID('notif', params.key),
      employeeId:  params.empId,
      triggerType: params.type,
      title:       params.title,
      body:        params.body,
      channel:     params.channel ?? 'IN_APP',
      isRead:      isRecent ? false : isRead,
      readAt:      (!isRecent && isRead) ? addDays(params.createdAt, 1) : null,
      createdAt:   params.createdAt,
      link:        params.link ?? null,
      priority:    params.priority ?? 'normal',
      metadata:    params.metadata ?? Prisma.JsonNull,
    })
  }

  // ── 1. Leave Notifications ────────────────────────────────
  console.log('  📋 Generating leave notifications...')
  for (let i = 0; i < allLeaveReqs.length; i++) {
    const req    = allLeaveReqs[i]
    const emp    = krAssignments.find(a => a.employeeId === req.employeeId)
    const name   = emp?.employee.name ?? '직원'
    const dateStr = req.startDate.toISOString().slice(0, 10)

    if (req.status === 'APPROVED') {
      mkNotif({
        key: `leave_approved:${req.id}`,
        empId: req.employeeId, type: 'LEAVE_APPROVED',
        title: '휴가가 승인되었습니다',
        body:  `${dateStr} 휴가 ${req.days}일이 승인되었습니다.`,
        createdAt: randomBetween(PERIOD_START, TODAY, seed + i),
        link: `/leave/${req.id}`,
        metadata: { leaveRequestId: req.id },
      })
    } else if (req.status === 'REJECTED') {
      mkNotif({
        key: `leave_rejected:${req.id}`,
        empId: req.employeeId, type: 'LEAVE_REJECTED',
        title: '휴가 신청이 반려되었습니다',
        body:  `${dateStr} 휴가 신청이 반려되었습니다. 사유를 확인해주세요.`,
        createdAt: randomBetween(PERIOD_START, TODAY, seed + i + 500),
        link: `/leave/${req.id}`,
        priority: 'high',
      })
    } else if (req.status === 'PENDING') {
      // Notify manager
      mkNotif({
        key: `leave_pending:${req.id}`,
        empId: req.employeeId, type: 'LEAVE_SUBMITTED',
        title: '휴가 신청이 접수되었습니다',
        body:  `${name}님의 ${dateStr} 휴가 신청이 접수되어 검토 중입니다.`,
        createdAt: randomBetween(addDays(TODAY, -20), TODAY, seed + i + 200),
      })
    }
  }

  // ── 2. Overtime/Attendance Notifications ──────────────────
  console.log('  ⏰ Generating attendance notifications...')
  const overtimePersonas = ['P2', 'P3']
  let otCount = 0
  for (const asgn of krAssignments) {
    const empNo  = asgn.employee.employeeNo
    const persona = KR_PERSONA[empNo] ?? 'P1'
    if (!overtimePersonas.includes(persona)) continue
    if (otCount >= 30) break

    const isP3  = persona === 'P3'
    const hours = isP3 ? 52 + Math.floor(sr(seed + otCount) * 6) : 47 + Math.floor(sr(seed + otCount) * 3)
    const type  = isP3 ? 'OVERTIME_CRITICAL' : 'OVERTIME_WARNING'
    const ts    = randomBetween(PERIOD_START, TODAY, seed + otCount * 7)

    mkNotif({
      key: `ot:${empNo}:${otCount}`,
      empId: asgn.employeeId, type,
      title: isP3 ? '⚠️ 법정 근무시간 초과' : '근무시간 주의',
      body:  isP3
        ? `${asgn.employee.name}님의 주간 근무시간이 ${hours}시간으로 법정 한도(52시간)를 초과했습니다.`
        : `${asgn.employee.name}님의 이번 주 근무시간이 ${hours}시간입니다. 법정 한도(52시간)에 주의하세요.`,
      createdAt: ts,
      priority: isP3 ? 'high' : 'normal',
      metadata: { weeklyHours: hours, threshold: 52 },
    })
    otCount++
  }

  // P5 late arrivals
  const p5Emps = krAssignments.filter(a => KR_PERSONA[a.employee.employeeNo] === 'P5')
  for (let i = 0; i < p5Emps.length * 2 && i < 10; i++) {
    const emp = p5Emps[i % p5Emps.length]
    mkNotif({
      key: `late:${emp.employee.employeeNo}:${i}`,
      empId: emp.employeeId, type: 'LATE_ARRIVAL',
      title: '지각 기록',
      body:  `${emp.employee.name}님의 지각이 기록되었습니다.`,
      createdAt: randomBetween(PERIOD_START, TODAY, seed + i * 13 + 300),
    })
  }

  // ── 3. Performance Notifications ─────────────────────────
  console.log('  🎯 Generating performance notifications...')
  // EVAL_REMINDER for all KR employees (cycle deadline)
  for (let i = 0; i < Math.min(krAssignments.length, 20); i++) {
    const asgn = krAssignments[i]
    mkNotif({
      key: `evalremind:${asgn.employee.employeeNo}:1`,
      empId: asgn.employeeId, type: 'EVAL_REMINDER',
      title: '성과평가 마감 알림',
      body:  '2025 하반기 성과평가 마감 7일 전입니다. 자기평가를 완료해주세요.',
      createdAt: new Date('2025-12-24'),
      link: '/performance/eval',
      priority: 'high',
    })
  }

  // MBO goal reviews
  for (let i = 0; i < Math.min(allGoals.length, 20); i++) {
    const goal = allGoals[i]
    mkNotif({
      key: `goalapproved:${goal.id}`,
      empId: goal.employeeId, type: 'MBO_GOAL_REVIEWED',
      title: '목표가 승인되었습니다',
      body:  '제출한 성과 목표가 검토 완료되었습니다.',
      createdAt: randomBetween(new Date('2026-01-01'), new Date('2026-02-15'), seed + i * 11),
      link: '/performance/goals',
    })
  }

  // Cycle completed notification
  for (let i = 0; i < Math.min(krAssignments.length, 15); i++) {
    const asgn = krAssignments[i]
    mkNotif({
      key: `cycleclosed:${asgn.employee.employeeNo}`,
      empId: asgn.employeeId, type: 'CYCLE_COMPLETED',
      title: '2025 H2 성과평가 확정',
      body:  '2025년 하반기 성과평가 결과가 확정되었습니다. 결과를 확인해주세요.',
      createdAt: new Date('2026-01-15'),
      link: '/performance/results',
    })
  }

  // ── 4. Payroll Notifications ──────────────────────────────
  console.log('  💰 Generating payroll notifications...')
  for (let mi = 0; mi < allPayrollRuns.length; mi++) {
    const run = allPayrollRuns[mi]
    // Notify all active employees for each month (sample: first 15)
    for (let i = 0; i < Math.min(krAssignments.length, 15); i++) {
      const asgn = krAssignments[i]
      mkNotif({
        key: `payslip:${run.yearMonth}:${asgn.employee.employeeNo}`,
        empId: asgn.employeeId, type: 'PAYSLIP_AVAILABLE',
        title: `${run.yearMonth} 급여명세서 발급`,
        body:  `${run.yearMonth} 급여명세서가 확인 가능합니다.`,
        createdAt: new Date(`${run.yearMonth}-26`),
        link: `/payroll/payslip/${run.id}`,
        metadata: { payrollRunId: run.id, yearMonth: run.yearMonth },
      })
    }
  }

  // ── 5. Onboarding Notifications ───────────────────────────
  console.log('  📦 Generating onboarding notifications...')
  const p4Emps = krAssignments.filter(a => KR_PERSONA[a.employee.employeeNo] === 'P4')
  for (let i = 0; i < Math.min(p4Emps.length, 8); i++) {
    const asgn = p4Emps[i]
    const ts = randomBetween(new Date('2025-12-01'), TODAY, seed + i * 19 + 700)
    mkNotif({
      key: `obtask:${asgn.employee.employeeNo}:${i}`,
      empId: asgn.employeeId, type: 'ONBOARDING_TASK_ASSIGNED',
      title: '온보딩 과제가 배정되었습니다',
      body:  '새로운 온보딩 태스크를 확인해주세요.',
      createdAt: ts,
      link: '/onboarding',
    })
  }

  // Overdue notification (1 case)
  if (p4Emps.length > 0) {
    mkNotif({
      key: `oboverdue:${p4Emps[0].employee.employeeNo}`,
      empId: p4Emps[0].employeeId, type: 'ONBOARDING_OVERDUE',
      title: '⚠️ 온보딩 태스크 기한 초과',
      body:  'OJT 과제의 완료 기한이 지났습니다. 빠른 확인이 필요합니다.',
      createdAt: randomBetween(new Date('2025-10-20'), new Date('2025-11-01'), seed + 800),
      priority: 'high',
    })
  }

  // ── 6. Contract Expiry Notifications ─────────────────────
  console.log('  📅 Generating system notifications...')
  const p6Emps = krAssignments.filter(a => KR_PERSONA[a.employee.employeeNo] === 'P6')
  for (let i = 0; i < Math.min(p6Emps.length, 5); i++) {
    const emp = p6Emps[i]
    mkNotif({
      key: `contractexp:${emp.employee.employeeNo}`,
      empId: emp.employeeId, type: 'CONTRACT_EXPIRY_30D',
      title: '계약 만료 30일 전 알림',
      body:  `${emp.employee.name}님의 계약이 30일 후 만료됩니다. 갱신 여부를 확인해주세요.`,
      createdAt: randomBetween(addDays(TODAY, -30), addDays(TODAY, -25), seed + i * 5 + 900),
      link: '/employees/' + emp.employeeId,
      priority: 'high',
      metadata: { employeeNo: emp.employee.employeeNo },
    })
  }

  // Training enrolled
  for (let i = 0; i < Math.min(krAssignments.length, 12); i++) {
    const asgn = krAssignments[i]
    mkNotif({
      key: `training:${asgn.employee.employeeNo}:1`,
      empId: asgn.employeeId, type: 'TRAINING_ENROLLED',
      title: '교육 과정 등록 완료',
      body:  '新규 교육 과정에 등록되었습니다. 교육 일정을 확인해주세요.',
      createdAt: randomBetween(PERIOD_START, addDays(TODAY, -30), seed + i * 3 + 1100),
      link: '/training',
    })
  }

  // ── 7. Offboarding Notifications ─────────────────────────
  console.log('  🚪 Generating offboarding notifications...')
  // For P10 / departed employee
  const p10Emp = krAssignments.find(a => a.employee.employeeNo === 'CTR-KR-3070')
  if (p10Emp) {
    mkNotif({
      key: `offstarted:CTR-KR-3070`,
      empId: p10Emp.employeeId, type: 'OFFBOARDING_STARTED',
      title: '퇴직 프로세스가 시작되었습니다',
      body:  '퇴직 처리 프로세스가 시작되었습니다. 업무 인수인계 계획을 확인해주세요.',
      createdAt: new Date('2026-03-05'),
      priority: 'high',
    })
    mkNotif({
      key: `offtask:CTR-KR-3070:1`,
      empId: p10Emp.employeeId, type: 'OFFBOARDING_TASK_ASSIGNED',
      title: '퇴직 체크리스트 배정',
      body:  '업무 인수인계 문서 작성 태스크가 배정되었습니다.',
      createdAt: new Date('2026-03-05'),
      link: '/offboarding',
    })
  }
  // Notify HR for exit interview pending
  const hrRow = await prisma.employee.findFirst({ where: { employeeNo: 'CTR-KR-0001' }, select: { id: true } })
  if (hrRow) {
    mkNotif({
      key: `exitint:CTR-KR-9001`,
      empId: hrRow.id, type: 'EXIT_INTERVIEW_PENDING',
      title: '퇴직 면담 일정 확인',
      body:  '박진혁님의 퇴직 면담이 예정되어 있습니다. 일정을 확인해주세요.',
      createdAt: new Date('2025-11-15'),
    })
  }

  // ── Batch insert notifications ────────────────────────────
  console.log(`\n  Total notifications to insert: ${notifs.length}`)
  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < notifs.length; i += CHUNK) {
    const chunk = notifs.slice(i, i + CHUNK)
    const result = await prisma.notification.createMany({
      data: chunk.map(n => ({
        id:          n.id,
        employeeId:  n.employeeId,
        triggerType: n.triggerType,
        title:       n.title,
        body:        n.body,
        channel:     n.channel,
        isRead:      n.isRead,
        readAt:      n.readAt,
        createdAt:   n.createdAt,
        link:        n.link,
        priority:    n.priority,
        metadata:    n.metadata ?? Prisma.JsonNull,
      })),
      skipDuplicates: true,
    })
    inserted += result.count
  }

  // ── Summary ───────────────────────────────────────────────
  const totalNotifs = await prisma.notification.count()
  const unreadCount = await prisma.notification.count({ where: { isRead: false } })
  const readCount   = await prisma.notification.count({ where: { isRead: true } })

  // Count by triggerType top-5
  const triggerGroups = await prisma.notification.groupBy({
    by: ['triggerType'],
    _count: { triggerType: true },
    orderBy: { _count: { triggerType: 'desc' } },
    take: 5,
  })

  // ── FINAL overall summary ─────────────────────────────────
  const totalEmps    = await prisma.employee.count()
  const totalAtt     = await prisma.attendance.count()
  const totalLeave   = await prisma.leaveRequest.count()
  const totalBal     = await prisma.employeeLeaveBalance.count()
  const totalGoals   = await prisma.mboGoal.count()
  const totalEvals   = await prisma.performanceEvaluation.count()
  const totalPayroll = await prisma.payrollItem.count()
  const totalOb      = await prisma.employeeOnboarding.count()
  const totalOff     = await prisma.employeeOffboarding.count()

  console.log('\n======================================')
  console.log('🔔 Notification Seed Complete!')
  console.log('======================================')
  console.log(`  Notifications inserted: ${inserted}`)
  console.log(`  Total notifications:    ${totalNotifs}`)
  console.log(`    isRead=true:          ${readCount}`)
  console.log(`    isRead=false:         ${unreadCount}`)
  console.log('  Top trigger types:')
  for (const tg of triggerGroups) {
    console.log(`    ${tg.triggerType}: ${tg._count.triggerType}`)
  }
  console.log('======================================')

  console.log('\n========================================')
  console.log('🌱 Seed Data Expansion — FINAL SUMMARY')
  console.log('========================================')
  console.log(`  Employees:             ${totalEmps}`)
  console.log(`  Attendance Records:    ${totalAtt}`)
  console.log(`  Leave Requests:        ${totalLeave}`)
  console.log(`  Leave Balances:        ${totalBal}`)
  console.log(`  MBO Goals:             ${totalGoals}`)
  console.log(`  Evaluations:           ${totalEvals}`)
  console.log(`  Payroll Items:         ${totalPayroll}`)
  console.log(`  Onboarding Plans:      ${totalOb}`)
  console.log(`  Offboarding Procs:     ${totalOff}`)
  console.log(`  Notifications:         ${totalNotifs}`)
  console.log('========================================\n')
}
