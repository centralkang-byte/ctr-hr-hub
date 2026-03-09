// ================================================================
// CTR HR Hub — Seed Data Expansion: Session 2 — Attendance
// prisma/seeds/03-attendance.ts
//
// Period: 2025-09-01 ~ 2026-02-28 (6 months)
// Target: All active KR + CN employees (~100명 × ~130일 = ~13,000건)
// Method: createMany + skipDuplicates (idempotent batch)
// ================================================================

import { AttendanceStatus, ClockMethod, PrismaClient, WorkType } from '../../src/generated/prisma/client'

// ────────────────────────────────────────────────────────────
// Shared helpers
// ────────────────────────────────────────────────────────────
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

/** Seeded deterministic random [0,1) */
function sr(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

/** Add minutes to a Date */
function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000)
}

/** Difference in minutes between two dates */
function diffMins(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000)
}

/** Build a Date for a specific time on a given day */
function timeOnDay(day: Date, hour: number, minute: number): Date {
  const d = new Date(day)
  d.setHours(hour, minute, 0, 0)
  return d
}

/** Format date as YYYY-MM-DD */
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ────────────────────────────────────────────────────────────
// Holiday sets (KR + CN)
// ────────────────────────────────────────────────────────────
const KR_HOLIDAYS = new Set([
  // 2025
  '2025-01-01','2025-01-28','2025-01-29','2025-01-30',
  '2025-03-01','2025-05-05','2025-05-06','2025-06-06',
  '2025-08-15','2025-10-03','2025-10-04','2025-10-05','2025-10-06','2025-10-09',
  '2025-12-25',
  // 2026
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-03-01',
])

const CN_HOLIDAYS = new Set([
  // 国庆节 2025-10-01~07
  '2025-10-01','2025-10-02','2025-10-03','2025-10-04','2025-10-05','2025-10-06','2025-10-07',
  // 春节 2026-01-28~02-03 (approx)
  '2026-01-28','2026-01-29','2026-01-30','2026-01-31',
  '2026-02-01','2026-02-02','2026-02-03','2026-02-04',
  // 元旦
  '2026-01-01',
])

function isKrHoliday(d: Date): boolean { return KR_HOLIDAYS.has(fmtDate(d)) }
function isCnHoliday(d: Date): boolean { return CN_HOLIDAYS.has(fmtDate(d)) }

/** Get all dates in range [start, end] */
function dateRange(start: Date, end: Date): Date[] {
  const result: Date[] = []
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endMs = end.getTime()
  while (cur.getTime() <= endMs) {
    result.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

// ────────────────────────────────────────────────────────────
// Persona → Time Generator
// ────────────────────────────────────────────────────────────
type ShiftSlot = { inH: number; inM: number; outH: number; outM: number; workType: WorkType }

const SHIFTS: ShiftSlot[] = [
  { inH: 6,  inM: 0,  outH: 14, outM: 0,  workType: 'NORMAL' },  // Day
  { inH: 14, inM: 0,  outH: 22, outM: 0,  workType: 'OVERTIME' }, // Swing
  { inH: 22, inM: 0,  outH: 6,  outM: 0,  workType: 'NIGHT' },   // Night
]

interface AttRec {
  id:              string
  employeeId:      string
  companyId:       string
  workDate:        Date
  clockIn:         Date | null
  clockOut:        Date | null
  clockInMethod:   ClockMethod
  workType:        WorkType
  totalMinutes:    number | null
  overtimeMinutes: number | null
  status:          AttendanceStatus
  shiftGroup:      string | null
  note:            string | null
}

function generateRecord(
  empNo: string,
  empId: string,
  companyId: string,
  day: Date,
  persona: string,
  dayIdx: number,  // global seed for this employee+day
  weekNo: number,  // 0-based week number
): AttRec | null {
  const dateStr = fmtDate(day)
  const dow = day.getDay() // 0=Sun, 6=Sat
  const isWeekend = dow === 0 || dow === 6

  // P7: ON_LEAVE — no records
  if (persona === 'P7') return null

  // Weekend handling
  if (isWeekend) {
    if (persona === 'P3') {
      // Only ~2 Saturdays per month (appear every ~2 weeks)
      if (dow !== 6) return null
      const weekInMonth = Math.floor(day.getDate() / 7)
      if (weekInMonth % 2 !== 0) return null
    } else if (persona === 'P8') {
      // Shift workers work weekends — handled below
    } else {
      return null
    }
  }

  const id = deterministicUUID('att', `${empNo}:${dateStr}`)
  let clockIn: Date | null
  let clockOut: Date | null
  let workType: WorkType = 'NORMAL'
  let status: AttendanceStatus = 'NORMAL'
  let shiftGroup: string | null = null
  let note: string | null = null

  const r1 = sr(dayIdx * 17 + 3)
  const r2 = sr(dayIdx * 31 + 7)
  const r3 = sr(dayIdx * 53 + 11)

  if (persona === 'P8') {
    // 3-shift rotation: week % 3 → Day/Swing/Night
    const shiftIdx = weekNo % 3
    const shift = SHIFTS[shiftIdx]
    shiftGroup = ['DAY', 'SWING', 'NIGHT'][shiftIdx]
    workType = shift.workType

    let ciDay = new Date(day)
    // Night shift: clock-in on THIS day, clock-out is NEXT day (store end time on same day for simplicity)
    const inMin = Math.floor(r1 * 10) - 5   // ±5 min
    const outMin = Math.floor(r2 * 10) - 5
    clockIn  = timeOnDay(ciDay, shift.inH, shift.inM + inMin)
    // For night shift, out is next day but we record total mins
    const rawOut = shift.outH === 6
      ? new Date(ciDay.getTime() + 8 * 60 * 60_000) // +8h from start = 6am next day approx
      : timeOnDay(ciDay, shift.outH, shift.outM + outMin)
    clockOut = rawOut
    const total = diffMins(clockIn, clockOut)
    const ot = Math.max(0, total - 480)
    return {
      id, employeeId: empId, companyId, workDate: day,
      clockIn, clockOut, clockInMethod: 'CARD_READER',
      workType, totalMinutes: total, overtimeMinutes: ot,
      status: 'NORMAL', shiftGroup, note: null,
    }
  }

  if (persona === 'P1') {
    // 08:50~09:00 in, 18:00~18:20 out
    clockIn  = timeOnDay(day, 8, 50 + Math.floor(r1 * 10))
    clockOut = timeOnDay(day, 18, Math.floor(r2 * 20))
  } else if (persona === 'P2') {
    // 08:30~09:00 in, 20:00~22:00 out
    clockIn  = timeOnDay(day, 8, 30 + Math.floor(r1 * 30))
    clockOut = timeOnDay(day, 20, Math.floor(r2 * 120))
    workType = 'OVERTIME'
  } else if (persona === 'P3') {
    // 08:00~09:00 in, 22:00~24:00 out (extreme OT)
    clockIn  = timeOnDay(day, 8, Math.floor(r1 * 60))
    // ~3 missing clock-out per month: dayIdx % 22 === 0
    if (dayIdx % 22 === 0) {
      clockOut = null
      note = '퇴근 미등록 (시스템 오류)'
    } else {
      clockOut = timeOnDay(day, 22, Math.floor(r2 * 120))
    }
    workType = 'OVERTIME'
    if (isWeekend) workType = 'HOLIDAY'
  } else if (persona === 'P4') {
    // 08:40~09:00 in, 18:30~19:30 out (eager)
    clockIn  = timeOnDay(day, 8, 40 + Math.floor(r1 * 20))
    clockOut = timeOnDay(day, 18, 30 + Math.floor(r2 * 60))
  } else if (persona === 'P5') {
    // Occasional late (3-5 per month: dayIdx % 7 === 0)
    if (dayIdx % 7 === 0) {
      clockIn  = timeOnDay(day, 9, 30 + Math.floor(r1 * 30)) // late
      status = 'LATE'
    } else {
      clockIn  = timeOnDay(day, 9, Math.floor(r1 * 15))
    }
    clockOut = timeOnDay(day, 18, Math.floor(r2 * 5))
  } else if (persona === 'P6') {
    // Strict 09:00-18:00
    clockIn  = timeOnDay(day, 9, Math.floor(r1 * 5))
    clockOut = timeOnDay(day, 18, Math.floor(r2 * 5))
  } else if (persona === 'P9') {
    // 08:30~09:00 in, 19:00~20:00 out
    clockIn  = timeOnDay(day, 8, 30 + Math.floor(r1 * 30))
    clockOut = timeOnDay(day, 19, Math.floor(r2 * 60))
    workType = 'OVERTIME'
  } else if (persona === 'P10') {
    // Winding down: 09:00~09:10 in, 18:00~18:10 out
    clockIn  = timeOnDay(day, 9, Math.floor(r1 * 10))
    clockOut = timeOnDay(day, 18, Math.floor(r2 * 10))
  } else {
    // Default (P4 신입 fallback)
    clockIn  = timeOnDay(day, 9, Math.floor(r1 * 15))
    clockOut = timeOnDay(day, 18, 30 + Math.floor(r2 * 30))
  }

  const total = (clockIn && clockOut) ? diffMins(clockIn, clockOut) : null
  const ot    = total != null ? Math.max(0, total - 480) : null

  // Late check (P5 handled above; also catch P4 occasional)
  if (clockIn && status === 'NORMAL') {
    const inMins = clockIn.getHours() * 60 + clockIn.getMinutes()
    if (inMins > 9 * 60 + 15) status = 'LATE'
  }

  return {
    id, employeeId: empId, companyId, workDate: day,
    clockIn, clockOut, clockInMethod: persona === 'P8' ? 'CARD_READER' : 'WEB',
    workType, totalMinutes: total, overtimeMinutes: ot,
    status, shiftGroup, note,
  }
}

// ────────────────────────────────────────────────────────────
// Persona mapping (from 02-employees.ts blueprints)
// ────────────────────────────────────────────────────────────
const KR_PERSONA_MAP: Record<string, string> = {
  // Test accounts
  'CTR-KR-0001': 'P1',  // hr@
  'CTR-KR-0002': 'P9',  // manager@
  'CTR-KR-0003': 'P1',  // employee@
  // B8-3 MFG skill matrix employees
  'CTR-KR-2001': 'P8', 'CTR-KR-2002': 'P8', 'CTR-KR-2003': 'P8',
  'CTR-KR-2004': 'P8', 'CTR-KR-2005': 'P8', 'CTR-KR-2006': 'P8',
  // New KR 70명
  'CTR-KR-3001': 'P8',  'CTR-KR-3002': 'P8',  'CTR-KR-3003': 'P8',
  'CTR-KR-3004': 'P3',  'CTR-KR-3005': 'P3',  'CTR-KR-3006': 'P2',
  'CTR-KR-3007': 'P2',  'CTR-KR-3008': 'P8',  'CTR-KR-3009': 'P8',
  'CTR-KR-3010': 'P1',  'CTR-KR-3011': 'P6',  'CTR-KR-3012': 'P6',
  'CTR-KR-3013': 'P4',  'CTR-KR-3014': 'P1',  'CTR-KR-3015': 'P7',
  'CTR-KR-3016': 'P5',  'CTR-KR-3017': 'P9',  'CTR-KR-3018': 'P9',
  'CTR-KR-3019': 'P1',  'CTR-KR-3020': 'P1',  'CTR-KR-3021': 'P2',
  'CTR-KR-3022': 'P2',  'CTR-KR-3023': 'P5',  'CTR-KR-3024': 'P4',
  'CTR-KR-3025': 'P4',  'CTR-KR-3026': 'P1',  'CTR-KR-3027': 'P6',
  'CTR-KR-3028': 'P3',  'CTR-KR-3029': 'P9',  'CTR-KR-3030': 'P9',
  'CTR-KR-3031': 'P1',  'CTR-KR-3032': 'P1',  'CTR-KR-3033': 'P2',
  'CTR-KR-3034': 'P5',  'CTR-KR-3035': 'P8',  'CTR-KR-3036': 'P8',
  'CTR-KR-3037': 'P4',  'CTR-KR-3038': 'P6',  'CTR-KR-3039': 'P9',
  'CTR-KR-3040': 'P9',  'CTR-KR-3041': 'P1',  'CTR-KR-3042': 'P2',
  'CTR-KR-3043': 'P5',  'CTR-KR-3044': 'P5',  'CTR-KR-3045': 'P4',
  'CTR-KR-3046': 'P6',  'CTR-KR-3047': 'P1',  'CTR-KR-3048': 'P9',
  'CTR-KR-3049': 'P2',  'CTR-KR-3050': 'P1',  'CTR-KR-3051': 'P1',
  'CTR-KR-3052': 'P4',  'CTR-KR-3053': 'P5',  'CTR-KR-3054': 'P6',
  'CTR-KR-3055': 'P9',  'CTR-KR-3056': 'P1',  'CTR-KR-3057': 'P1',
  'CTR-KR-3058': 'P2',  'CTR-KR-3059': 'P4',  'CTR-KR-3060': 'P6',
  'CTR-KR-3061': 'P9',  'CTR-KR-3062': 'P1',  'CTR-KR-3063': 'P1',
  'CTR-KR-3064': 'P7',  'CTR-KR-3065': 'P5',  'CTR-KR-3066': 'P9',
  'CTR-KR-3067': 'P1',  'CTR-KR-3068': 'P4',  'CTR-KR-3069': 'P9',
  'CTR-KR-3070': 'P10',
}

const CN_PERSONA_MAP: Record<string, string> = {
  // B7-2 foreign payroll employees (CN001~CN010) → treat as P8 production workers
  'CN001': 'P8', 'CN002': 'P8', 'CN003': 'P9', 'CN004': 'P1',
  'CN005': 'P8', 'CN006': 'P9', 'CN007': 'P1', 'CN008': 'P9',
  'CN009': 'P1', 'CN010': 'P8',
  // New CN 18명
  'CTR-CN-1001': 'P9', 'CTR-CN-1002': 'P8', 'CTR-CN-1003': 'P1',
  'CTR-CN-1004': 'P8', 'CTR-CN-1005': 'P2', 'CTR-CN-1006': 'P4',
  'CTR-CN-1007': 'P8', 'CTR-CN-1008': 'P9', 'CTR-CN-1009': 'P1',
  'CTR-CN-1010': 'P2', 'CTR-CN-1011': 'P9', 'CTR-CN-1012': 'P1',
  'CTR-CN-1013': 'P5', 'CTR-CN-1014': 'P4', 'CTR-CN-1015': 'P9',
  'CTR-CN-1016': 'P1', 'CTR-CN-1017': 'P2', 'CTR-CN-1018': 'P10',
}

// ────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────
export async function seedAttendance(prisma: PrismaClient): Promise<void> {
  console.log('\n📅 Session 2: Seeding attendance records (2025-09 ~ 2026-02)...\n')

  const PERIOD_START = new Date('2025-09-01')
  const PERIOD_END   = new Date('2026-02-28')
  const TODAY        = new Date('2026-03-09')  // seed context "today"
  const allDays      = dateRange(PERIOD_START, PERIOD_END)

  // Fetch all employees with their primary active assignment
  // We need: employeeNo, employeeId, companyId, status
  const assignments = await prisma.employeeAssignment.findMany({
    where: { isPrimary: true, endDate: null },
    select: {
      employeeId: true,
      companyId:  true,
      status:     true,
      employee:   { select: { employeeNo: true } },
      company:    { select: { code: true } },
    },
  })

  // Separate KR and CN (only process these two companies)
  const krEmps = assignments.filter(a => a.company.code === 'CTR-KR' && a.status !== 'TERMINATED')
  const cnEmps = assignments.filter(a => a.company.code === 'CTR-CN' && a.status !== 'TERMINATED')

  console.log(`  KR employees to process: ${krEmps.length}`)
  console.log(`  CN employees to process: ${cnEmps.length}`)

  // Build all records in memory
  const records: AttRec[] = []
  let empIdx = 0

  // ── CTR-KR attendance ────────────────────────────────────
  for (const emp of krEmps) {
    const empNo  = emp.employee.employeeNo
    const persona = KR_PERSONA_MAP[empNo] ?? 'P1' // default to P1

    // P7 ON_LEAVE: skip attendance
    if (persona === 'P7' || emp.status === 'ON_LEAVE') { empIdx++; continue }

    let dayIdx = empIdx * 1000
    let weekNo = 0
    let prevWeek = -1

    for (const day of allDays) {
      // Skip future dates
      if (day > TODAY) break
      const dow = day.getDay()
      const isoWeek = Math.floor((day.getTime() - PERIOD_START.getTime()) / (7 * 86_400_000))
      if (isoWeek !== prevWeek) { weekNo = isoWeek; prevWeek = isoWeek }

      if (isKrHoliday(day)) { dayIdx++; continue }

      const rec = generateRecord(empNo, emp.employeeId, emp.companyId, day, persona, dayIdx, weekNo)
      if (rec) records.push(rec)
      dayIdx++
    }
    empIdx++
  }

  // ── CTR-CN attendance ────────────────────────────────────
  for (const emp of cnEmps) {
    const empNo  = emp.employee.employeeNo
    const persona = CN_PERSONA_MAP[empNo] ?? 'P1'

    if (persona === 'P7' || emp.status === 'ON_LEAVE') { empIdx++; continue }

    let dayIdx = empIdx * 1000
    let weekNo = 0
    let prevWeek = -1

    for (const day of allDays) {
      if (day > TODAY) break
      const isoWeek = Math.floor((day.getTime() - PERIOD_START.getTime()) / (7 * 86_400_000))
      if (isoWeek !== prevWeek) { weekNo = isoWeek; prevWeek = isoWeek }

      if (isCnHoliday(day)) { dayIdx++; continue }

      const rec = generateRecord(empNo, emp.employeeId, emp.companyId, day, persona, dayIdx, weekNo)
      if (rec) records.push(rec)
      dayIdx++
    }
    empIdx++
  }

  console.log(`  Total records to insert: ${records.length}`)

  // ── Batch insert in chunks of 2,000 ─────────────────────
  const CHUNK = 2_000
  let inserted = 0
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK)
    const result = await prisma.attendance.createMany({
      data: chunk.map(r => ({
        id:              r.id,
        employeeId:      r.employeeId,
        companyId:       r.companyId,
        workDate:        r.workDate,
        clockIn:         r.clockIn,
        clockOut:        r.clockOut,
        clockInMethod:   r.clockInMethod,
        workType:        r.workType,
        totalMinutes:    r.totalMinutes,
        overtimeMinutes: r.overtimeMinutes,
        status:          r.status,
        shiftGroup:      r.shiftGroup,
        note:            r.note,
      })),
      skipDuplicates: true,
    })
    inserted += result.count
    console.log(`    … batch ${Math.floor(i / CHUNK) + 1}: inserted ${result.count}`)
  }

  // ── Summary ──────────────────────────────────────────────
  const totalAtt = await prisma.attendance.count()
  console.log('\n======================================')
  console.log('📅 Attendance Seed Complete!')
  console.log('======================================')
  console.log(`  Records inserted this run: ${inserted}`)
  console.log(`  Total attendance records:  ${totalAtt}`)
  console.log(`  KR employees processed:    ${krEmps.length}`)
  console.log(`  CN employees processed:    ${cnEmps.length}`)
  console.log('======================================\n')
}
