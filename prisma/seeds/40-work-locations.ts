// ================================================================
// Track B B-2c: WorkLocation Seed (22 locations across 13 companies)
// prisma/seeds/40-work-locations.ts
//
// Idempotent: uses findFirst + create/update on @@unique([companyId, code])
// Also sets EmployeeAssignment.workLocationId + Employee.locale
// ================================================================

import type { PrismaClient } from '../../src/generated/prisma/client'

// [companyCode, code, name, nameEn, country, city, timezone, locationType]
type LocationTuple = [string, string, string, string, string, string | null, string, string]

const LOCATION_DATA: LocationTuple[] = [
  // ── CTR (7 locations) ──────────────────────────────────
  ['CTR', 'CHANGWON', '창원공장', 'Changwon Plant', 'KR', '창원', 'Asia/Seoul', 'PLANT'],
  ['CTR', 'MASAN', '마산공장', 'Masan Plant', 'KR', '마산', 'Asia/Seoul', 'PLANT'],
  ['CTR', 'YOUNGSAN', '영산공장', 'Youngsan Plant', 'KR', '영산', 'Asia/Seoul', 'PLANT'],
  ['CTR', 'DAEHAP', '대합공장', 'Daehap Plant', 'KR', '창원', 'Asia/Seoul', 'PLANT'],
  ['CTR', 'SEOUL-HQ', '서울 본사', 'Seoul HQ', 'KR', '서울', 'Asia/Seoul', 'OFFICE'],
  ['CTR', 'SANTIAGO', '산티아고 사무소', 'Santiago Office', 'CL', 'Santiago', 'America/Santiago', 'BRANCH_OFFICE'],
  ['CTR', 'BANGKOK', '방콕 사무소', 'Bangkok Office', 'TH', 'Bangkok', 'Asia/Bangkok', 'BRANCH_OFFICE'],
  ['CTR', 'JAKARTA', '자카르타 사무소', 'Jakarta Office', 'ID', 'Jakarta', 'Asia/Jakarta', 'BRANCH_OFFICE'],

  // ── CTR-MOB (3 plants) ──────────────────────────────────
  ['CTR-MOB', 'ULSAN', '울산공장', 'Ulsan Plant', 'KR', '울산', 'Asia/Seoul', 'PLANT'],
  ['CTR-MOB', 'SEOSAN', '서산공장', 'Seosan Plant', 'KR', '서산', 'Asia/Seoul', 'PLANT'],
  ['CTR-MOB', 'DAEGU', '대구공장', 'Daegu Plant', 'KR', '대구', 'Asia/Seoul', 'PLANT'],

  // ── CTR-ECO (1 plant) ────────────────────────────────────
  ['CTR-ECO', 'MIRYANG', '밀양공장', 'Miryang Plant', 'KR', '밀양', 'Asia/Seoul', 'PLANT'],

  // ── CTR-CN (1 plant) ─────────────────────────────────────
  ['CTR-CN', 'ZHANGJIAGANG', '장가항공장', 'Zhangjiagang Plant', 'CN', '张家港', 'Asia/Shanghai', 'PLANT'],

  // ── CTR-US (2 locations) ─────────────────────────────────
  ['CTR-US', 'DETROIT', '디트로이트 사무소', 'Detroit Office', 'US', 'Detroit', 'America/Detroit', 'OFFICE'],
  ['CTR-US', 'MONTERREY', '몬테레이 공장', 'Monterrey Plant', 'MX', 'Monterrey', 'America/Monterrey', 'PLANT'],

  // ── CTR-VN (1 plant) ─────────────────────────────────────
  ['CTR-VN', 'DANANG', '다낭 공장', 'Da Nang Plant', 'VN', 'Da Nang', 'Asia/Ho_Chi_Minh', 'PLANT'],

  // ── CTR-ROB, CTR-ENR, CTR-FML (1 office each) ───────────
  ['CTR-ROB', 'CHANGWON-ROB', '창원 사무소', 'Changwon Office (Robotics)', 'KR', '창원', 'Asia/Seoul', 'OFFICE'],
  ['CTR-ENR', 'CHANGWON-ENR', '창원 사무소', 'Changwon Office (Energy)', 'KR', '창원', 'Asia/Seoul', 'OFFICE'],
  ['CTR-FML', 'SEOUL-FML', '서울 사무소', 'Seoul Office (Formation Labs)', 'KR', '서울', 'Asia/Seoul', 'OFFICE'],

  // ── CTR-RU, CTR-EU (1 office each) ──────────────────────
  ['CTR-RU', 'MOSCOW', '모스크바 사무소', 'Moscow Office', 'RU', 'Moscow', 'Europe/Moscow', 'OFFICE'],
  ['CTR-EU', 'WARSAW', '바르샤바 사무소', 'Warsaw Office', 'PL', 'Warsaw', 'Europe/Warsaw', 'OFFICE'],

  // ── CTR-HOLD (1 office) ──────────────────────────────────
  ['CTR-HOLD', 'SEOUL-HOLD', '서울 본사', 'Seoul HQ (Holdings)', 'KR', '서울', 'Asia/Seoul', 'OFFICE'],
]

// ── Department → WorkLocation mapping ──────────────────────
// ⚠️ HARD-CODED — do NOT parse department codes
const DEPT_TO_LOCATION: Record<string, { companyCode: string; locationCode: string }> = {
  'PLT-CHANGWON': { companyCode: 'CTR', locationCode: 'CHANGWON' },
  'PLT-MASAN': { companyCode: 'CTR', locationCode: 'MASAN' },
  'PLT-YOUNGSAN': { companyCode: 'CTR', locationCode: 'YOUNGSAN' },
  'PLT-DAEHAP': { companyCode: 'CTR', locationCode: 'DAEHAP' },
  'PLT-MOB-ULSAN': { companyCode: 'CTR-MOB', locationCode: 'ULSAN' },
  'PLT-MOB-SEOSAN': { companyCode: 'CTR-MOB', locationCode: 'SEOSAN' },
  'PLT-MOB-DAEGU': { companyCode: 'CTR-MOB', locationCode: 'DAEGU' },
  'PLT-ECO-MIRYANG': { companyCode: 'CTR-ECO', locationCode: 'MIRYANG' },
  'PLT-CN-ZJG': { companyCode: 'CTR-CN', locationCode: 'ZHANGJIAGANG' },
  'PLT-US-MTY': { companyCode: 'CTR-US', locationCode: 'MONTERREY' },
}

// Default office location per company (for non-plant employees)
const COMPANY_DEFAULT_LOCATION: Record<string, string> = {
  'CTR-HOLD': 'SEOUL-HOLD',
  'CTR': 'SEOUL-HQ',
  'CTR-MOB': 'ULSAN',
  'CTR-ECO': 'MIRYANG',
  'CTR-ROB': 'CHANGWON-ROB',
  'CTR-ENR': 'CHANGWON-ENR',
  'CTR-FML': 'SEOUL-FML',
  'CTR-CN': 'ZHANGJIAGANG',
  'CTR-US': 'DETROIT',
  'CTR-VN': 'DANANG',
  'CTR-RU': 'MOSCOW',
  'CTR-EU': 'WARSAW',
}

// Locale by company
const COMPANY_LOCALE: Record<string, string> = {
  'CTR-HOLD': 'ko', 'CTR': 'ko', 'CTR-MOB': 'ko', 'CTR-ECO': 'ko',
  'CTR-ROB': 'ko', 'CTR-ENR': 'ko', 'CTR-FML': 'ko',
  'CTR-CN': 'zh',
  'CTR-US': 'en',
  'CTR-VN': 'vi',
  'CTR-RU': 'en',
  'CTR-EU': 'en',
}

export async function seedWorkLocations(p: PrismaClient) {
  console.log('  📍 Seeding work locations...')

  // ── 1. Load all companies ──────────────────────────────
  const companies = await p.company.findMany({ select: { id: true, code: true } })
  const codeToCompany = new Map(companies.map((c) => [c.code, c]))

  // ── 2. Create/update WorkLocation records ──────────────
  let created = 0
  let updated = 0
  // Map for lookups: "companyCode:locationCode" → locationId
  const locationMap = new Map<string, string>()

  for (const [companyCode, code, name, nameEn, country, city, timezone, locationType] of LOCATION_DATA) {
    const company = codeToCompany.get(companyCode)
    if (!company) {
      console.log(`    ⚠️  Company ${companyCode} not found, skipping location ${code}`)
      continue
    }

    const existing = await p.workLocation.findFirst({
      where: { companyId: company.id, code },
    })

    if (existing) {
      await p.workLocation.update({
        where: { id: existing.id },
        data: { name, nameEn, country, city, timezone, locationType, isActive: true },
      })
      locationMap.set(`${companyCode}:${code}`, existing.id)
      updated++
    } else {
      const loc = await p.workLocation.create({
        data: {
          companyId: company.id,
          code,
          name,
          nameEn,
          country,
          city,
          timezone,
          locationType,
          isActive: true,
        },
      })
      locationMap.set(`${companyCode}:${code}`, loc.id)
      created++
    }
  }

  console.log(`  ✅ WorkLocations: ${created} created, ${updated} updated (${LOCATION_DATA.length} total)`)

  // ── 3. Set EmployeeAssignment.workLocationId ───────────
  console.log('  📍 Linking assignments to work locations...')

  // Load all departments with their hierarchy for PLT-* ancestor lookup
  const departments = await p.department.findMany({
    select: { id: true, code: true, companyId: true, parentId: true },
  })
  const deptById = new Map(departments.map((d) => [d.id, d]))
  const companyIdToCode = new Map(companies.map((c) => [c.id, c.code]))

  // Build function: walk up department tree to find PLT-* ancestor
  function findPlantDeptCode(deptId: string): string | null {
    let current = deptById.get(deptId)
    const visited = new Set<string>()
    while (current) {
      if (visited.has(current.id)) break
      visited.add(current.id)
      if (current.code && current.code in DEPT_TO_LOCATION) {
        return current.code
      }
      if (!current.parentId) break
      current = deptById.get(current.parentId)
    }
    return null
  }

  // Load all active assignments that don't have workLocationId yet
  const assignments = await p.employeeAssignment.findMany({
    where: { endDate: null },
    select: { id: true, departmentId: true, companyId: true },
  })

  let assignmentUpdated = 0
  let assignmentSkipped = 0

  for (const assignment of assignments) {
    const companyCode = companyIdToCode.get(assignment.companyId)
    if (!companyCode) { assignmentSkipped++; continue }

    let locationId: string | undefined

    // Try PLT-* ancestor mapping first
    if (assignment.departmentId) {
      const plantCode = findPlantDeptCode(assignment.departmentId)
      if (plantCode && DEPT_TO_LOCATION[plantCode]) {
        const mapping = DEPT_TO_LOCATION[plantCode]
        locationId = locationMap.get(`${mapping.companyCode}:${mapping.locationCode}`)
      }
    }

    // Fallback: company default location
    if (!locationId) {
      const defaultCode = COMPANY_DEFAULT_LOCATION[companyCode]
      if (defaultCode) {
        locationId = locationMap.get(`${companyCode}:${defaultCode}`)
      }
    }

    if (locationId) {
      await p.employeeAssignment.update({
        where: { id: assignment.id },
        data: { workLocationId: locationId },
      })
      assignmentUpdated++
    } else {
      assignmentSkipped++
    }
  }

  console.log(`  ✅ Assignments linked: ${assignmentUpdated} updated, ${assignmentSkipped} skipped`)

  // ── 4. Set Employee.locale by company ──────────────────
  console.log('  🌐 Setting employee locale defaults...')
  let localeUpdated = 0

  for (const [companyCode, locale] of Object.entries(COMPANY_LOCALE)) {
    const company = codeToCompany.get(companyCode)
    if (!company) continue

    const result = await p.employee.updateMany({
      where: {
        assignments: { some: { companyId: company.id, isPrimary: true, endDate: null } },
        locale: null,
      },
      data: { locale },
    })
    localeUpdated += result.count
  }

  console.log(`  ✅ Employee locale: ${localeUpdated} employees updated`)

  // ── 5. Add holiday_calendar_basis global setting ───────
  console.log('  📅 Adding holiday_calendar_basis setting...')
  const existingHoliday = await p.companyProcessSetting.findFirst({
    where: { settingType: 'LEAVE', settingKey: 'holiday_calendar_basis', companyId: null },
  })
  if (!existingHoliday) {
    await p.companyProcessSetting.create({
      data: {
        settingType: 'LEAVE',
        settingKey: 'holiday_calendar_basis',
        settingValue: 'COMPANY',
        description: 'COMPANY=법인 기준 공휴일 달력, LOCATION=근무지 기준 (future)',
        companyId: null,
      },
    })
    console.log('  ✅ holiday_calendar_basis setting created')
  } else {
    console.log('  ⏭️  holiday_calendar_basis setting already exists')
  }

  // ── 6. Per-company weekly_hour_limit (attendance) ──────
  // Already handled by COMPANY_LABOR_SETTINGS in 26-process-settings.ts
  // The work-hour-limits entries for CTR, CTR-CN, CTR-US, CTR-VN, CTR-RU, CTR-EU already exist
  // Korean subsidiaries (CTR-HOLD, CTR-MOB, CTR-ECO, CTR-ROB, CTR-ENR, CTR-FML) use global default (52h)
  console.log('  ⏭️  Per-company work-hour-limits already seeded in 26-process-settings.ts')
}
