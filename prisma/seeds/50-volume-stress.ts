// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Volume Stress Seed (2,500 employees)
// Flag-gated: SEED_VOLUME=true npx tsx prisma/seed.ts
// Purpose: pagination, search perf, dashboard aggregation
// ═══════════════════════════════════════════════════════════

import type { PrismaClient } from '../../src/generated/prisma/client'

// ─── Deterministic helpers ─────────────────────────────────

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

const uid = (key: string) => deterministicUUID('vol-50', key)

// Seeded PRNG for reproducible randomness
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff
    return s / 0x7fffffff
  }
}

// ─── Name pools ────────────────────────────────────────────

const KR_LAST = ['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','류','전','홍','고','문','양','손','배','백','허','유','남','심','노','하','곽','성','차','주','우','구','민','진','나','표','천','지','도','엄','원','연']
const KR_FIRST = ['민준','서윤','도윤','서연','시우','하은','예준','지우','주원','지유','하준','수아','지호','다은','준서','채원','건우','지윤','현우','은서','유준','수빈','정우','소율','승민','예린','우진','하린','지환','시은','서준','아인','태민','소연','준혁','채은','민서','유나','지원','연우','하율','은채','현준','하윤','성민','시현','도현','수현','시윤','서현']
const CN_LAST = ['王','李','张','刘','陈','杨','赵','黄','周','吴','徐','孙','马','胡','朱','郭','何','林','罗','高']
const CN_FIRST = ['Wei','Fang','Na','Lei','Jing','Min','Yong','Xia','Li','Hua','Jun','Mei','Chao','Yan','Bo','Ting','Gang','Ping','Kai','Feng']
const EN_FIRST = ['James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','David','Elizabeth','William','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen','Daniel','Lisa','Matthew','Nancy','Anthony','Betty','Mark','Sandra','Steven','Ashley']
const EN_LAST = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson']

// ─── Distribution config ───────────────────────────────────

const TOTAL = 2500

// Company distribution (approximate)
const COMPANY_DIST: { code: string; pct: number }[] = [
  { code: 'CTR', pct: 0.35 },
  { code: 'CTR-MOB', pct: 0.08 },
  { code: 'CTR-ECO', pct: 0.06 },
  { code: 'CTR-ROB', pct: 0.04 },
  { code: 'CTR-ENR', pct: 0.04 },
  { code: 'CTR-FML', pct: 0.03 },
  { code: 'CTR-CN', pct: 0.15 },
  { code: 'CTR-VN', pct: 0.06 },
  { code: 'CTR-US', pct: 0.06 },
  { code: 'CTR-RU', pct: 0.05 },
  { code: 'CTR-EU', pct: 0.04 },
  { code: 'CTR-HOLD', pct: 0.04 },
]

const GRADE_DIST = [
  { code: 'E1', pct: 0.05 },
  { code: 'S1', pct: 0.10 },
  { code: 'L2', pct: 0.50 },
  { code: 'L1', pct: 0.35 },
]

const EMP_TYPE_DIST = [
  { type: 'FULL_TIME', pct: 0.80 },
  { type: 'CONTRACT', pct: 0.15 },
  { type: 'INTERN', pct: 0.05 },
]

// Salary ranges by grade (KRW, annual)
const SALARY_BY_GRADE: Record<string, { min: number; max: number }> = {
  E1: { min: 120_000_000, max: 200_000_000 },
  S1: { min: 80_000_000, max: 160_000_000 },
  L2: { min: 40_000_000, max: 130_000_000 },
  L1: { min: 32_000_000, max: 45_000_000 },
}

// ─── Helpers ───────────────────────────────────────────────

function pickWeighted<T extends { pct: number }>(items: T[], rand: () => number): T {
  const r = rand()
  let cumulative = 0
  for (const item of items) {
    cumulative += item.pct
    if (r < cumulative) return item
  }
  return items[items.length - 1]
}

function isKrCompany(code: string): boolean {
  return ['CTR', 'CTR-HOLD', 'CTR-MOB', 'CTR-ECO', 'CTR-ROB', 'CTR-ENR', 'CTR-FML'].includes(code)
}

function isCnCompany(code: string): boolean {
  return code === 'CTR-CN'
}

function generateName(i: number, companyCode: string, rand: () => number): { name: string; nameEn: string } {
  if (isCnCompany(companyCode)) {
    const last = CN_LAST[Math.floor(rand() * CN_LAST.length)]
    const first = CN_FIRST[Math.floor(rand() * CN_FIRST.length)]
    return { name: `${last}${first}`, nameEn: `${first} ${last}` }
  }
  if (isKrCompany(companyCode)) {
    const last = KR_LAST[Math.floor(rand() * KR_LAST.length)]
    const first = KR_FIRST[Math.floor(rand() * KR_FIRST.length)]
    return { name: `${last}${first}`, nameEn: `${first} ${last}` }
  }
  // Overseas (EN)
  const first = EN_FIRST[Math.floor(rand() * EN_FIRST.length)]
  const last = EN_LAST[Math.floor(rand() * EN_LAST.length)]
  return { name: `${first} ${last}`, nameEn: `${first} ${last}` }
}

function generateHireDate(rand: () => number): Date {
  // 2020-01 ~ 2026-03 range
  const start = new Date('2020-01-01').getTime()
  const end = new Date('2026-03-01').getTime()
  return new Date(start + rand() * (end - start))
}

// ─── Main ──────────────────────────────────────────────────

export async function seedVolumeStress(prisma: PrismaClient) {
  console.log('\n🌱 Seeding 50-volume-stress (2,500 employees)...')

  // Check flag
  if (process.env.SEED_VOLUME !== 'true') {
    console.log('  ⏭️  Skipped (set SEED_VOLUME=true to enable)')
    return { created: 0, skipped: 0 }
  }

  // Check if already seeded
  const existingCount = await prisma.employee.count({
    where: { employeeNo: { startsWith: 'VOL-' } },
  })
  if (existingCount >= TOTAL) {
    console.log(`  ⏭️  Already seeded (${existingCount} VOL- employees exist)`)
    return { created: 0, skipped: existingCount }
  }

  // Lookup maps
  const companies = await prisma.company.findMany({ select: { id: true, code: true } })
  const companyMap: Record<string, string> = {}
  for (const c of companies) companyMap[c.code] = c.id

  const departments = await prisma.department.findMany({
    where: { deletedAt: null },
    select: { id: true, companyId: true },
  })
  const deptsByCompany: Record<string, string[]> = {}
  for (const d of departments) {
    if (!deptsByCompany[d.companyId]) deptsByCompany[d.companyId] = []
    deptsByCompany[d.companyId].push(d.id)
  }

  const grades = await prisma.jobGrade.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, companyId: true },
  })
  const gradesByCompany: Record<string, Record<string, string>> = {} // companyId -> { code -> id }
  for (const g of grades) {
    if (!gradesByCompany[g.companyId]) gradesByCompany[g.companyId] = {}
    gradesByCompany[g.companyId][g.code] = g.id
  }

  const rand = seededRandom(50_2025) // fixed seed for reproducibility

  // Generate employee data in batches
  const BATCH_SIZE = 500
  let created = 0

  for (let batch = 0; batch < Math.ceil(TOTAL / BATCH_SIZE); batch++) {
    const batchStart = batch * BATCH_SIZE
    const batchEnd = Math.min(batchStart + BATCH_SIZE, TOTAL)
    const employeeData: Array<{
      id: string; employeeNo: string; name: string; nameEn: string;
      email: string; hireDate: Date; locale: string;
    }> = []
    const assignmentData: Array<{
      id: string; employeeId: string; effectiveDate: Date;
      changeType: string; companyId: string; departmentId: string | null;
      jobGradeId: string | null; employmentType: string; status: string; isPrimary: boolean;
    }> = []

    for (let i = batchStart; i < batchEnd; i++) {
      const idx = String(i).padStart(4, '0')
      const empId = uid(`emp-${idx}`)
      const assignId = uid(`assign-${idx}`)

      const company = pickWeighted(COMPANY_DIST, rand)
      const companyId = companyMap[company.code]
      if (!companyId) continue

      const { name, nameEn } = generateName(i, company.code, rand)
      const hireDate = generateHireDate(rand)

      // Grade
      const gradeChoice = pickWeighted(GRADE_DIST, rand)
      const companyGrades = gradesByCompany[companyId] ?? {}
      const jobGradeId = companyGrades[gradeChoice.code] ?? null

      // Department
      const companyDepts = deptsByCompany[companyId] ?? []
      const departmentId = companyDepts.length > 0
        ? companyDepts[Math.floor(rand() * companyDepts.length)]
        : null

      // Employment type
      const empType = pickWeighted(EMP_TYPE_DIST, rand)
      const locale = isCnCompany(company.code) ? 'zh'
        : isKrCompany(company.code) ? 'ko'
        : 'en'

      employeeData.push({
        id: empId,
        employeeNo: `VOL-${idx}`,
        name,
        nameEn,
        email: `vol-${idx}@${company.code.toLowerCase().replace(/-/g, '')}.test`,
        hireDate,
        locale,
      })

      assignmentData.push({
        id: assignId,
        employeeId: empId,
        effectiveDate: hireDate,
        changeType: 'HIRE',
        companyId,
        departmentId,
        jobGradeId,
        employmentType: empType.type,
        status: 'ACTIVE',
        isPrimary: true,
      })
    }

    // Batch create employees
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.employee.createMany({ data: employeeData as any[], skipDuplicates: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.employeeAssignment.createMany({ data: assignmentData as any[], skipDuplicates: true })

    created += employeeData.length
    console.log(`  📦 Batch ${batch + 1}/${Math.ceil(TOTAL / BATCH_SIZE)}: ${employeeData.length} employees`)
  }

  console.log(`  ✅ Volume stress: ${created} employees created`)

  // ─── Transaction Data: Attendance (recent 3 months) ──────

  console.log('  ⏳ Generating attendance records (3 months)...')
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  // Get all VOL employees with their assignments
  const volEmployees = await prisma.employee.findMany({
    where: { employeeNo: { startsWith: 'VOL-' } },
    select: { id: true, employeeNo: true },
  })
  const volAssignments = await prisma.employeeAssignment.findMany({
    where: {
      employeeId: { in: volEmployees.map(e => e.id) },
      isPrimary: true,
    },
    select: { employeeId: true, companyId: true },
  })
  const empCompanyMap: Record<string, string> = {}
  for (const a of volAssignments) empCompanyMap[a.employeeId] = a.companyId

  // Sample 500 employees for attendance (full 2500 × 66 days = 165K records is too slow)
  const attendanceSample = volEmployees.slice(0, 500)
  let attCreated = 0
  const ATT_BATCH = 1000

  // Generate 3 months of weekday attendance
  const attRecords: Array<{
    id: string; employeeId: string; companyId: string; workDate: Date;
    clockIn: Date; clockOut: Date; clockInMethod: string; clockOutMethod: string;
    status: string; workType: string; totalMinutes: number;
  }> = []

  for (const emp of attendanceSample) {
    const companyId = empCompanyMap[emp.id]
    if (!companyId) continue

    const current = new Date(threeMonthsAgo)
    const now = new Date()
    while (current < now) {
      if (current.getDay() !== 0 && current.getDay() !== 6) {
        const y = current.getFullYear()
        const m = current.getMonth()
        const d = current.getDate()
        const idx = emp.employeeNo.replace('VOL-', '')

        attRecords.push({
          id: uid(`att-${idx}-${y}${m}${d}`),
          employeeId: emp.id,
          companyId,
          workDate: new Date(y, m, d),
          clockIn: new Date(y, m, d, 8, 50 + Math.floor(rand() * 20)),
          clockOut: new Date(y, m, d, 17, 50 + Math.floor(rand() * 30)),
          clockInMethod: 'WEB',
          clockOutMethod: 'WEB',
          status: rand() < 0.05 ? 'LATE' : 'NORMAL',
          workType: 'NORMAL',
          totalMinutes: 480 + Math.floor(rand() * 60),
        })

        if (attRecords.length >= ATT_BATCH) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await prisma.attendance.createMany({ data: attRecords as any[], skipDuplicates: true })
          attCreated += attRecords.length
          attRecords.length = 0
        }
      }
      current.setDate(current.getDate() + 1)
    }
  }

  // Flush remaining
  if (attRecords.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.attendance.createMany({ data: attRecords as any[], skipDuplicates: true })
    attCreated += attRecords.length
  }

  console.log(`  ✅ Attendance: ${attCreated} records (500 employees × ~66 weekdays)`)

  // ─── Transaction Data: Goals (3 per employee, sample 1000) ─

  console.log('  ⏳ Generating MBO goals...')
  const goalSample = volEmployees.slice(0, 1000)

  // Find an active performance cycle
  const activeCycle = await prisma.performanceCycle.findFirst({
    where: { status: { not: 'CLOSED' } },
    select: { id: true, companyId: true },
    orderBy: { createdAt: 'desc' },
  })

  let goalCreated = 0
  if (activeCycle) {
    const goalRecords: Array<{
      id: string; cycleId: string; employeeId: string; companyId: string;
      title: string; weight: number; status: string;
    }> = []

    const goalTitles = [
      '매출 목표 달성', '고객 만족도 향상', '프로세스 효율화',
      '팀 역량 강화', '비용 절감', '신규 프로젝트 수행',
      '품질 개선', '납기 준수율 향상', '안전사고 Zero',
    ]

    for (const emp of goalSample) {
      const companyId = empCompanyMap[emp.id]
      if (!companyId) continue
      const idx = emp.employeeNo.replace('VOL-', '')

      for (let g = 0; g < 3; g++) {
        goalRecords.push({
          id: uid(`goal-${idx}-${g}`),
          cycleId: activeCycle.id,
          employeeId: emp.id,
          companyId,
          title: goalTitles[Math.floor(rand() * goalTitles.length)],
          weight: g === 0 ? 40 : g === 1 ? 35 : 25,
          status: 'APPROVED',
        })
      }

      if (goalRecords.length >= 1500) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await prisma.mboGoal.createMany({ data: goalRecords as any[], skipDuplicates: true })
        goalCreated += goalRecords.length
        goalRecords.length = 0
      }
    }

    if (goalRecords.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.mboGoal.createMany({ data: goalRecords as any[], skipDuplicates: true })
      goalCreated += goalRecords.length
    }
  }

  console.log(`  ✅ Goals: ${goalCreated} records (1000 employees × 3)`)

  const totalRecords = created + attCreated + goalCreated
  console.log(`  🎉 Volume stress total: ${totalRecords} records`)
  return { created, attendance: attCreated, goals: goalCreated }
}
