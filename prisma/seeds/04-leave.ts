// ================================================================
// CTR HR Hub — Seed Data Expansion: Session 2 — Leave
// prisma/seeds/04-leave.ts
//
// Creates:
//   1. LeavePolicy (CTR: annual/sick/special; CTR-CN: annual/sick)
//   2. EmployeeLeaveBalance (2025 + 2026 per employee per policy)
//   3. LeaveRequest (페르소나별 패턴, mixed statuses)
// ================================================================

import { LeaveRequestStatus, PrismaClient } from '../../src/generated/prisma/client'

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

// Count business days between two dates (KR holidays excluded)
const KR_HOLIDAYS = new Set([
  '2025-01-01','2025-01-28','2025-01-29','2025-01-30',
  '2025-03-01','2025-05-05','2025-05-06','2025-06-06',
  '2025-08-15','2025-10-03','2025-10-04','2025-10-05','2025-10-06','2025-10-09',
  '2025-12-25','2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-03-01',
])
const CN_HOLIDAYS = new Set([
  '2025-10-01','2025-10-02','2025-10-03','2025-10-04','2025-10-05','2025-10-06','2025-10-07',
  '2026-01-01','2026-01-28','2026-01-29','2026-01-30','2026-01-31',
  '2026-02-01','2026-02-02','2026-02-03','2026-02-04',
])

function fmtDate(d: Date): string { return d.toISOString().slice(0, 10) }

function businessDays(start: Date, end: Date, holidays: Set<string>): number {
  let count = 0
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endMs = end.getTime()
  while (cur.getTime() <= endMs) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6 && !holidays.has(fmtDate(cur))) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// Skip weekends when picking a random start date
function nextWeekday(d: Date): Date {
  const r = new Date(d)
  while (r.getDay() === 0 || r.getDay() === 6) r.setDate(r.getDate() + 1)
  return r
}

// ────────────────────────────────────────────────────────────
// Persona map (same as 03-attendance.ts)
// ────────────────────────────────────────────────────────────
const KR_PERSONA_MAP: Record<string, string> = {
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

const CN_PERSONA_MAP: Record<string, string> = {
  'CN001':'P8','CN002':'P8','CN003':'P9','CN004':'P1',
  'CN005':'P8','CN006':'P9','CN007':'P1','CN008':'P9',
  'CN009':'P1','CN010':'P8',
  'CTR-CN-1001':'P9','CTR-CN-1002':'P8','CTR-CN-1003':'P1',
  'CTR-CN-1004':'P8','CTR-CN-1005':'P2','CTR-CN-1006':'P4',
  'CTR-CN-1007':'P8','CTR-CN-1008':'P9','CTR-CN-1009':'P1',
  'CTR-CN-1010':'P2','CTR-CN-1011':'P9','CTR-CN-1012':'P1',
  'CTR-CN-1013':'P5','CTR-CN-1014':'P4','CTR-CN-1015':'P9',
  'CTR-CN-1016':'P1','CTR-CN-1017':'P2','CTR-CN-1018':'P10',
}

// ────────────────────────────────────────────────────────────
// Persona → Leave quota (annual days target for 6-month window)
// ────────────────────────────────────────────────────────────
// Full year entitlement assumption: 15 days (KR), 5 days (CN)
// 6-month window: roughly half

interface PersonaLeaveProfile {
  annualMin: number    // min days total annual used
  annualMax: number    // max days total annual used
  sickMax:   number    // max sick days
  blockSize: number    // typical block size in days (1 = single day)
  requests:  number    // how many LEAVE requests to generate
}

const KR_LEAVE_PROFILE: Record<string, PersonaLeaveProfile> = {
  P1:  { annualMin: 10, annualMax: 12, sickMax: 2, blockSize: 1, requests: 4 },
  P2:  { annualMin: 2,  annualMax: 3,  sickMax: 1, blockSize: 1, requests: 1 },
  P3:  { annualMin: 3,  annualMax: 5,  sickMax: 0, blockSize: 1, requests: 2 },
  P4:  { annualMin: 0,  annualMax: 1,  sickMax: 1, blockSize: 1, requests: 1 },
  P5:  { annualMin: 12, annualMax: 15, sickMax: 4, blockSize: 3, requests: 5 },
  P6:  { annualMin: 3,  annualMax: 5,  sickMax: 1, blockSize: 1, requests: 2 },
  P7:  { annualMin: 0,  annualMax: 0,  sickMax: 0, blockSize: 0, requests: 0 }, // childcare
  P8:  { annualMin: 5,  annualMax: 8,  sickMax: 2, blockSize: 1, requests: 3 },
  P9:  { annualMin: 8,  annualMax: 10, sickMax: 1, blockSize: 2, requests: 3 },
  P10: { annualMin: 12, annualMax: 15, sickMax: 0, blockSize: 5, requests: 2 },
}

const CN_LEAVE_PROFILE: Record<string, PersonaLeaveProfile> = {
  P1: { annualMin: 3, annualMax: 5, sickMax: 1, blockSize: 1, requests: 2 },
  P2: { annualMin: 1, annualMax: 2, sickMax: 0, blockSize: 1, requests: 1 },
  P4: { annualMin: 0, annualMax: 1, sickMax: 1, blockSize: 1, requests: 1 },
  P5: { annualMin: 4, annualMax: 5, sickMax: 2, blockSize: 2, requests: 2 },
  P8: { annualMin: 3, annualMax: 5, sickMax: 1, blockSize: 1, requests: 2 },
  P9: { annualMin: 3, annualMax: 5, sickMax: 1, blockSize: 1, requests: 2 },
  P10:{ annualMin: 4, annualMax: 5, sickMax: 0, blockSize: 3, requests: 1 },
}

const REJECTION_REASONS = [
  '해당 기간 프로젝트 마감으로 불가',
  '팀 내 동시 휴가 인원 초과',
  '신청 기한 경과 (최소 3일 전 신청 필요)',
  '잔여 연차 부족',
  '부서장 미승인',
]

// ────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────
export async function seedLeave(prisma: PrismaClient): Promise<void> {
  console.log('\n🏖  Session 2: Seeding leave policies, balances, requests...\n')

  // ── 1. Company IDs ────────────────────────────────────────
  const krCompany = await prisma.company.findFirst({ where: { code: 'CTR' } })
  const cnCompany = await prisma.company.findFirst({ where: { code: 'CTR-CN' } })
  if (!krCompany || !cnCompany) {
    console.error('  ❌ CTR-KR or CTR-CN company not found')
    return
  }
  const krId = krCompany.id
  const cnId = cnCompany.id

  // ── 2. Upsert LeavePolicy ─────────────────────────────────
  console.log('📌 Upserting leave policies...')

  const krPolicies = [
    { code: 'KR-ANNUAL', name: '연차유급휴가', leaveType: 'ANNUAL' as const, defaultDays: 15 },
    { code: 'KR-SICK',   name: '병가',         leaveType: 'SICK' as const,   defaultDays: 5  },
    { code: 'KR-SPECIAL',name: '특별휴가',     leaveType: 'SPECIAL' as const, defaultDays: 3 },
  ]
  const cnPolicies = [
    { code: 'CN-ANNUAL', name: '年假', leaveType: 'ANNUAL' as const, defaultDays: 5 },
    { code: 'CN-SICK',   name: '病假', leaveType: 'SICK' as const,   defaultDays: 7 },
  ]

  const policyMap: Record<string, string> = {}  // code → id

  for (const p of krPolicies) {
    const id = deterministicUUID('leavepolicy', `CTR-KR:${p.code}`)
    await prisma.leavePolicy.upsert({
      where:  { id },
      update: { name: p.name, defaultDays: p.defaultDays, isActive: true },
      create: {
        id, companyId: krId, name: p.name, leaveType: p.leaveType,
        defaultDays: p.defaultDays, isPaid: true, carryOverAllowed: false,
        minUnit: 'FULL_DAY', isActive: true,
      },
    })
    policyMap[p.code] = id
  }
  for (const p of cnPolicies) {
    const id = deterministicUUID('leavepolicy', `CTR-CN:${p.code}`)
    await prisma.leavePolicy.upsert({
      where:  { id },
      update: { name: p.name, defaultDays: p.defaultDays, isActive: true },
      create: {
        id, companyId: cnId, name: p.name, leaveType: p.leaveType,
        defaultDays: p.defaultDays, isPaid: true, carryOverAllowed: false,
        minUnit: 'FULL_DAY', isActive: true,
      },
    })
    policyMap[p.code] = id
  }
  console.log(`  ✅ ${Object.keys(policyMap).length} leave policies`)

  // ── 3. Fetch all employees for KR and CN ──────────────────
  console.log('📌 Fetching employee assignments...')

  const krAssignments = await prisma.employeeAssignment.findMany({
    where: { companyId: krId, isPrimary: true, endDate: null },
    select: {
      employeeId: true,
      employee:   { select: { employeeNo: true, hireDate: true } },
    },
  })
  const cnAssignments = await prisma.employeeAssignment.findMany({
    where: { companyId: cnId, isPrimary: true, endDate: null },
    select: {
      employeeId: true,
      employee:   { select: { employeeNo: true, hireDate: true } },
    },
  })

  // Fetch a HR manager (approver for KR)
  const hrManager = await prisma.employee.findFirst({
    where: { employeeNo: 'CTR-KR-0002' }, // manager@
    select: { id: true },
  })
  const krApproverId = hrManager?.id ?? null

  // ── 4. Upsert EmployeeLeaveBalance ───────────────────────
  console.log('📌 Seeding leave balances (2025 + 2026)...')
  let balCount = 0

  // KR employees
  for (const asgn of krAssignments) {
    const empNo  = asgn.employee.employeeNo
    const persona = KR_PERSONA_MAP[empNo] ?? 'P1'
    const profile = KR_LEAVE_PROFILE[persona] ?? KR_LEAVE_PROFILE['P1']

    // Annual balance
    for (const year of [2025, 2026]) {
      // Granted days: KR labor law — 1st year 11 days, 2nd year+ 15
      const hireYear = asgn.employee.hireDate.getFullYear()
      const tenureYears = year - hireYear
      const granted = tenureYears >= 1 ? 15 : 11

      // Approximate used days based on persona profile (half for 6-month window)
      const usedApprox = Math.round((profile.annualMin + profile.annualMax) / 2)

      await prisma.employeeLeaveBalance.upsert({
        where: { employeeId_policyId_year: { employeeId: asgn.employeeId, policyId: policyMap['KR-ANNUAL'], year } },
        update: {},
        create: {
          id:           deterministicUUID('leavebal', `${empNo}:KR-ANNUAL:${year}`),
          employeeId:   asgn.employeeId,
          policyId:     policyMap['KR-ANNUAL'],
          year,
          grantedDays:  granted,
          usedDays:     Math.min(usedApprox, granted),
          pendingDays:  0,
          carryOverDays:0,
        },
      })
      balCount++

      // Sick balance
      await prisma.employeeLeaveBalance.upsert({
        where: { employeeId_policyId_year: { employeeId: asgn.employeeId, policyId: policyMap['KR-SICK'], year } },
        update: {},
        create: {
          id:           deterministicUUID('leavebal', `${empNo}:KR-SICK:${year}`),
          employeeId:   asgn.employeeId,
          policyId:     policyMap['KR-SICK'],
          year,
          grantedDays:  5,
          usedDays:     Math.min(profile.sickMax, 5),
          pendingDays:  0,
          carryOverDays:0,
        },
      })
      balCount++
    }
  }

  // CN employees
  for (const asgn of cnAssignments) {
    const empNo  = asgn.employee.employeeNo
    const persona = CN_PERSONA_MAP[empNo] ?? 'P1'
    const profile = CN_LEAVE_PROFILE[persona] ?? CN_LEAVE_PROFILE['P1']

    for (const year of [2025, 2026]) {
      const hireYear = asgn.employee.hireDate.getFullYear()
      const tenureYears = year - hireYear
      // CN: <1yr → no annual; 1-10yr → 5 days; 10-20yr → 10 days
      const granted = tenureYears < 1 ? 0 : tenureYears < 10 ? 5 : 10

      await prisma.employeeLeaveBalance.upsert({
        where: { employeeId_policyId_year: { employeeId: asgn.employeeId, policyId: policyMap['CN-ANNUAL'], year } },
        update: {},
        create: {
          id:           deterministicUUID('leavebal', `${empNo}:CN-ANNUAL:${year}`),
          employeeId:   asgn.employeeId,
          policyId:     policyMap['CN-ANNUAL'],
          year,
          grantedDays:  granted,
          usedDays:     Math.min(Math.round((profile.annualMin + profile.annualMax) / 2), Math.max(granted, 1)),
          pendingDays:  0,
          carryOverDays:0,
        },
      })
      balCount++

      await prisma.employeeLeaveBalance.upsert({
        where: { employeeId_policyId_year: { employeeId: asgn.employeeId, policyId: policyMap['CN-SICK'], year } },
        update: {},
        create: {
          id:           deterministicUUID('leavebal', `${empNo}:CN-SICK:${year}`),
          employeeId:   asgn.employeeId,
          policyId:     policyMap['CN-SICK'],
          year,
          grantedDays:  7,
          usedDays:     profile.sickMax,
          pendingDays:  0,
          carryOverDays:0,
        },
      })
      balCount++
    }
  }

  console.log(`  ✅ ${balCount} leave balance records`)

  // ── 5. Create LeaveRequests ───────────────────────────────
  console.log('📌 Seeding leave requests...')

  // Status distribution: 70% APPROVED, 10% PENDING, 10% REJECTED, 10% CANCELLED
  function pickStatus(seed: number): LeaveRequestStatus {
    const r = sr(seed)
    if (r < 0.70) return 'APPROVED'
    if (r < 0.80) return 'PENDING'
    if (r < 0.90) return 'REJECTED'
    return 'CANCELLED'
  }

  // Base dates for request distribution across 2025-09 ~ 2026-02
  const PERIOD_MONTHS = [
    new Date('2025-09-01'), new Date('2025-10-01'), new Date('2025-11-01'),
    new Date('2025-12-01'), new Date('2026-01-01'), new Date('2026-02-01'),
  ]

  let reqCount = 0
  let approvedCount = 0, pendingCount = 0, rejectedCount = 0, cancelledCount = 0

  // ── KR leave requests ────────────────────────────────────
  for (let ei = 0; ei < krAssignments.length; ei++) {
    const asgn    = krAssignments[ei]
    const empNo   = asgn.employee.employeeNo
    const persona = KR_PERSONA_MAP[empNo] ?? 'P1'
    const profile = KR_LEAVE_PROFILE[persona] ?? KR_LEAVE_PROFILE['P1']

    if (profile.requests === 0) continue  // P7

    for (let ri = 0; ri < profile.requests; ri++) {
      const seed = ei * 1000 + ri * 37
      // Pick a month (weighted toward summer and Dec)
      const monthIdx = Math.floor(sr(seed + 1) * PERIOD_MONTHS.length)
      const baseDate  = PERIOD_MONTHS[monthIdx]

      // Random day within month
      const dayOffset = Math.floor(sr(seed + 2) * 20) + 1
      const startRaw  = addDays(baseDate, dayOffset)
      const startDate = nextWeekday(startRaw)

      // Block size
      const blockMax  = Math.max(profile.blockSize, 1)
      const blockDays = Math.max(1, Math.floor(sr(seed + 3) * blockMax) + (persona === 'P5' ? 2 : 0))
      const endDate   = addDays(startDate, blockDays - 1)

      // Don't generate future requests beyond 2026-02-28
      if (startDate > new Date('2026-02-28')) continue

      // Use annual or sick
      const isSick  = ri === profile.requests - 1 && profile.sickMax > 0
      const policyCode = isSick ? 'KR-SICK' : 'KR-ANNUAL'
      const policyId   = policyMap[policyCode]
      const days       = businessDays(startDate, endDate, KR_HOLIDAYS)
      if (days === 0) continue

      const status = pickStatus(seed + 5)
      const id     = deterministicUUID('leave', `${empNo}:${fmtDate(startDate)}:${ri}`)

      // Submission date = 3-7 days before start (or same day for PENDING)
      const submittedDaysBeforeStart = status === 'PENDING' ? 1 : 4 + Math.floor(sr(seed + 6) * 4)
      const submittedAt = addDays(startDate, -submittedDaysBeforeStart)

      const existing = await prisma.leaveRequest.findFirst({ where: { id } })
      if (!existing) {
        await prisma.leaveRequest.create({
          data: {
            id,
            employeeId:    asgn.employeeId,
            policyId,
            companyId:     krId,
            startDate,
            endDate,
            days,
            reason:        isSick ? '몸이 좋지 않아 휴가 신청합니다' : `${persona} 개인 사유`,
            status,
            approvedBy:    status === 'APPROVED' ? krApproverId : undefined,
            approvedAt:    status === 'APPROVED' ? addDays(submittedAt, 1) : undefined,
            rejectionReason: status === 'REJECTED'
              ? REJECTION_REASONS[Math.floor(sr(seed + 7) * REJECTION_REASONS.length)]
              : undefined,
            createdAt:     submittedAt,
          },
        })
        reqCount++
        if (status === 'APPROVED') approvedCount++
        else if (status === 'PENDING') pendingCount++
        else if (status === 'REJECTED') rejectedCount++
        else cancelledCount++
      }
    }
  }

  // ── CN leave requests ────────────────────────────────────
  const cnApproverId = krApproverId  // use same approver for CN (simplified)

  for (let ei = 0; ei < cnAssignments.length; ei++) {
    const asgn    = cnAssignments[ei]
    const empNo   = asgn.employee.employeeNo
    const persona = CN_PERSONA_MAP[empNo] ?? 'P1'
    const profile = CN_LEAVE_PROFILE[persona] ?? CN_LEAVE_PROFILE['P1']

    if (profile.requests === 0) continue

    for (let ri = 0; ri < profile.requests; ri++) {
      const seed = (ei + 500) * 1000 + ri * 37
      const monthIdx  = Math.floor(sr(seed + 1) * PERIOD_MONTHS.length)
      const baseDate   = PERIOD_MONTHS[monthIdx]
      const dayOffset  = Math.floor(sr(seed + 2) * 20) + 1
      const startDate  = nextWeekday(addDays(baseDate, dayOffset))

      const blockMax  = Math.max(profile.blockSize, 1)
      const blockDays = Math.max(1, Math.floor(sr(seed + 3) * blockMax) + 1)
      const endDate   = addDays(startDate, blockDays - 1)

      if (startDate > new Date('2026-02-28')) continue

      const isSick   = ri === profile.requests - 1 && profile.sickMax > 0
      const policyCode = isSick ? 'CN-SICK' : 'CN-ANNUAL'
      const policyId   = policyMap[policyCode]
      const days       = businessDays(startDate, endDate, CN_HOLIDAYS)
      if (days === 0) continue

      const status = pickStatus(seed + 5)
      const id     = deterministicUUID('leave', `${empNo}:${fmtDate(startDate)}:${ri}`)

      const submittedDaysBeforeStart = status === 'PENDING' ? 1 : 3 + Math.floor(sr(seed + 6) * 3)
      const submittedAt = addDays(startDate, -submittedDaysBeforeStart)

      const existing = await prisma.leaveRequest.findFirst({ where: { id } })
      if (!existing) {
        await prisma.leaveRequest.create({
          data: {
            id,
            employeeId:    asgn.employeeId,
            policyId,
            companyId:     cnId,
            startDate,
            endDate,
            days,
            reason:        isSick ? '身体不适' : '个人假期',
            status,
            approvedBy:    status === 'APPROVED' ? cnApproverId : undefined,
            approvedAt:    status === 'APPROVED' ? addDays(submittedAt, 1) : undefined,
            rejectionReason: status === 'REJECTED'
              ? REJECTION_REASONS[Math.floor(sr(seed + 7) * REJECTION_REASONS.length)]
              : undefined,
            createdAt:     submittedAt,
          },
        })
        reqCount++
        if (status === 'APPROVED') approvedCount++
        else if (status === 'PENDING') pendingCount++
        else if (status === 'REJECTED') rejectedCount++
        else cancelledCount++
      }
    }
  }

  // ── Summary ──────────────────────────────────────────────
  const totalReq  = await prisma.leaveRequest.count()
  const totalBal  = await prisma.employeeLeaveBalance.count()
  const totalPol  = await prisma.leavePolicy.count()

  console.log('\n======================================')
  console.log('🏖  Leave Seed Complete!')
  console.log('======================================')
  console.log(`  Leave policies:      ${totalPol}`)
  console.log(`  Leave balances:      ${totalBal}`)
  console.log(`  Leave requests (new):${reqCount}`)
  console.log(`    APPROVED:          ${approvedCount}`)
  console.log(`    PENDING:           ${pendingCount}`)
  console.log(`    REJECTED:          ${rejectedCount}`)
  console.log(`    CANCELLED:         ${cancelledCount}`)
  console.log(`  Total requests (DB): ${totalReq}`)
  console.log('======================================\n')
}
