// ═══════════════════════════════════════════════════════════
// Stage 3 — IS_PE01 → Employee + EmployeeRrn + EmployeeAssignment (HIRE/TERMINATE)
//
// 사전 조건: 02-map-org.ts 가 0 unresolved 로 통과한 상태.
// (CodeMaster 에 모든 legacy 조직 코드 → DB ID 매핑 완료)
//
// 사용법:
//   DRY_RUN=true npx tsx scripts/migrate/03-import-employees.ts /path/to/IS_PE01.xlsx
//   npx tsx scripts/migrate/03-import-employees.ts /path/to/IS_PE01.xlsx
// ═══════════════════════════════════════════════════════════

import dotenv from 'dotenv'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import * as xlsx from 'xlsx'
import { v5 as uuidv5 } from 'uuid'
import { PrismaClient } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { encryptRRN, maskRRN, normalizeRRN } from '../../src/lib/pii/rrn'
import { encrypt as encryptProbe } from '../../src/lib/pii/encryption'
import type { LegacyEmployeeRow } from './types'

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })

const DRY_RUN = process.env.DRY_RUN === 'true'
const EMPLOYEE_NS = '4d3f7a1c-9b2e-4d8a-9f1e-3c5d7b8a1c2d'

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Usage: tsx scripts/migrate/03-import-employees.ts <path-to-IS_PE01.xlsx>')
  process.exit(1)
}
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}
const adapter = new PrismaPg({ connectionString: DATABASE_URL })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma: PrismaClient = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] })

// ─── ID helpers ──────────────────────────────────────────
function empId(legacyId: number | string): string {
  return uuidv5(`emp:${legacyId}`, EMPLOYEE_NS)
}
function rrnId(legacyId: number | string): string {
  return uuidv5(`rrn:${legacyId}`, EMPLOYEE_NS)
}
function assignmentId(legacyId: number | string, changeType: string, effectiveDate: string): string {
  return uuidv5(`assign:${legacyId}:${changeType}:${effectiveDate}`, EMPLOYEE_NS)
}

// ─── string/date helpers (01/02 와 동일 로직 — 일관성 유지) ─
function s(v: unknown): string | undefined {
  if (v == null) return undefined
  const str = String(v).trim()
  return str === '' ? undefined : str
}
function nullable(v: unknown): string | null {
  return s(v) ?? null
}
function normalizeLegacy(v: unknown): string {
  return v == null ? '' : String(v).trim()
}
function parseDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  if (!trimmed) return null
  const ymd = trimmed.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
  if (ymd) return new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])))
  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? null : d
}

// ─── Org mapping resolver (CodeMaster reference1 → DB ID) ─
type CompanyScopedKind = 'department' | 'jobGrade' | 'employeeTitle' | 'position' | 'workLocation'
interface OrgResolver {
  companyIdOf(compycd: string): string | null
  /** company-scoped 모델은 compycd 필요 (CodeMaster 의 컴포지트 키 lookup 용) */
  resolve(
    target: CompanyScopedKind | 'job',
    legacy: string,
    compycd: string,
  ): Promise<string | null>
}

async function buildOrgResolver(rows: LegacyEmployeeRow[]): Promise<OrgResolver> {
  const compycds = new Set<string>()
  for (const r of rows) {
    const c = normalizeLegacy(r.COMPYCD)
    if (c) compycds.add(c)
  }
  const compyItems = await prisma.codeItem.findMany({
    where: { group: { code: 'COMPYCD' }, code: { in: [...compycds] } },
    select: { code: true, reference1: true },
  })
  const ourCompanyCodes = compyItems.map((i) => i.reference1).filter((c): c is string => Boolean(c))
  const companies = ourCompanyCodes.length
    ? await prisma.company.findMany({
        where: { code: { in: ourCompanyCodes }, deletedAt: null },
        select: { id: true, code: true },
      })
    : []
  const ourCodeToId = new Map(companies.map((c) => [c.code, c.id]))
  const compycdToId = new Map<string, string>()
  for (const it of compyItems) {
    if (it.reference1) {
      const id = ourCodeToId.get(it.reference1)
      if (id) compycdToId.set(it.code, id)
    }
  }

  const groupByTarget: Record<CompanyScopedKind | 'job', string> = {
    department: 'DEPTCD',
    jobGrade: 'JIKGUBCD',
    employeeTitle: 'JIKWICD',
    position: 'JIKCKCD',
    job: 'JIKMUCD',
    workLocation: 'E109',
  }

  return {
    companyIdOf: (compycd) => compycdToId.get(compycd) ?? null,
    async resolve(target, legacy, compycd) {
      const isScoped = target !== 'job'
      const companyId = compycd ? compycdToId.get(compycd) ?? null : null
      if (isScoped && !companyId) return null

      // CodeMaster lookup — 컴포지트 키 "compycd:legacy" (company-scoped) 또는 "legacy" (global)
      const codeMasterCode = isScoped ? `${compycd}:${legacy}` : legacy
      const item = await prisma.codeItem.findFirst({
        where: { group: { code: groupByTarget[target] }, code: codeMasterCode },
        select: { reference1: true },
      })
      if (!item?.reference1) return null

      switch (target) {
        case 'department': {
          const d = await prisma.department.findFirst({
            where: { code: item.reference1, companyId: companyId!, deletedAt: null },
            select: { id: true },
          })
          return d?.id ?? null
        }
        case 'jobGrade': {
          const list = await prisma.jobGrade.findMany({
            where: { code: item.reference1, companyId: companyId!, deletedAt: null },
            select: { id: true },
            take: 2,
          })
          return list.length === 1 ? list[0].id : null
        }
        case 'employeeTitle': {
          const t = await prisma.employeeTitle.findFirst({
            where: { code: item.reference1, companyId: companyId!, deletedAt: null },
            select: { id: true },
          })
          return t?.id ?? null
        }
        case 'position': {
          const p = await prisma.position.findFirst({
            where: { code: item.reference1, companyId: companyId!, deletedAt: null },
            select: { id: true },
          })
          return p?.id ?? null
        }
        case 'workLocation': {
          const w = await prisma.workLocation.findFirst({
            where: { code: item.reference1, companyId: companyId!, deletedAt: null },
            select: { id: true },
          })
          return w?.id ?? null
        }
        case 'job': {
          const j = await prisma.job.findFirst({ where: { code: item.reference1 }, select: { id: true } })
          return j?.id ?? null
        }
      }
    },
  }
}

// ─── 메인 ────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`📥 IS_PE01 → Employee + Rrn + Assignment — ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`)
  console.log(`   input: ${inputPath}\n`)

  // 시작 시점에 PII_ENCRYPTION_KEY 검증 — 잘못된 키로 import 진행하면 RRN 전부 누락 위험.
  try {
    encryptProbe('__probe__')
  } catch (err) {
    console.error(`💥 PII 암호화 키 검증 실패: ${err instanceof Error ? err.message : String(err)}`)
    console.error(`   .env.local 의 PII_ENCRYPTION_KEY 를 확인하세요.`)
    process.exit(1)
  }

  const wb = xlsx.read(readFileSync(inputPath), { cellDates: true })
  const sheetName = wb.SheetNames[0]
  const rows = xlsx.utils.sheet_to_json<LegacyEmployeeRow>(wb.Sheets[sheetName], {
    range: 1,
    defval: null,
    raw: false,
    blankrows: false,
  })
  console.log(`   sheet="${sheetName}", rows=${rows.length}\n`)

  const resolver = await buildOrgResolver(rows)

  // ─── 1. 사전 검증 + payload 빌드 ─────────────────────────
  const errors: Array<{ row: number; legacyId?: number; reason: string }> = []
  type EmpPayload = {
    employee: Parameters<typeof prisma.employee.upsert>[0]['create']
    rrn: { id: string; employeeId: string; numberEncrypted: string; numberMasked: string } | null
    assignments: Array<Parameters<typeof prisma.employeeAssignment.create>[0]['data']>
  }
  const payloads: EmpPayload[] = []

  for (const [idx, r] of rows.entries()) {
    const rowNum = idx + 3 // header rows + 1-indexed
    if (r.EMP_ID == null || !s(r.EMPCD) || !s(r.HNAME)) {
      errors.push({ row: rowNum, legacyId: r.EMP_ID ?? undefined, reason: 'EMP_ID/EMPCD/HNAME 누락' })
      continue
    }
    const compycd = normalizeLegacy(r.COMPYCD)
    const companyId = compycd ? resolver.companyIdOf(compycd) : null
    if (!companyId) {
      errors.push({ row: rowNum, legacyId: r.EMP_ID, reason: `COMPYCD="${compycd}" 매핑 안 됨` })
      continue
    }

    const hireDate = parseDate(r.IGENTDAT)
    if (!hireDate) {
      errors.push({ row: rowNum, legacyId: r.EMP_ID, reason: 'IGENTDAT(입사일) 없음/파싱실패' })
      continue
    }
    // RETDAT 의 sentinel(예: 1900-01-01) 또는 hireDate 이전 값은 null 처리 (재직 중).
    let resignDate = parseDate(r.RETDAT)
    if (resignDate && resignDate.getUTCFullYear() <= 1901) resignDate = null
    if (resignDate && resignDate < hireDate) {
      errors.push({
        row: rowNum,
        legacyId: r.EMP_ID,
        reason: `RETDAT(${resignDate.toISOString().slice(0, 10)}) < IGENTDAT(${hireDate.toISOString().slice(0, 10)})`,
      })
      continue
    }
    const birthDate = parseDate(r.BIRTHDAT)

    // RRN
    let rrnPayload: EmpPayload['rrn'] = null
    const rawRrn = s(r.JUMINNO)
    if (rawRrn) {
      try {
        const normalized = normalizeRRN(rawRrn)
        rrnPayload = {
          id: rrnId(r.EMP_ID),
          employeeId: empId(r.EMP_ID),
          numberEncrypted: encryptRRN(normalized),
          numberMasked: maskRRN(normalized),
        }
      } catch (e) {
        // JUMINNO 가 legacy 자체 암호화 또는 손상 — skip RRN, 경고
        console.warn(`⚠️  row=${rowNum} EMP_ID=${r.EMP_ID}: JUMINNO 정규화 실패 (skip RRN): ${e instanceof Error ? e.message : e}`)
      }
    }

    // 조직 매핑 (employment assignment 용) — compycd 직접 전달 (역매핑 손실 방지)
    const departmentId = await resolver.resolve('department', normalizeLegacy(r.DEPTCD), compycd)
    const jobGradeId = await resolver.resolve('jobGrade', normalizeLegacy(r.JIKGUBCD), compycd)
    const titleId = await resolver.resolve('employeeTitle', normalizeLegacy(r.JIKWICD), compycd)
    const positionId = await resolver.resolve('position', normalizeLegacy(r.JIKCKCD), compycd)
    const workLocationId = await resolver.resolve('workLocation', normalizeLegacy(r.WORK_AREA), compycd)
    // job 은 nullable — 다음 단계로 미룸

    // Employee payload
    const employee = {
      id: empId(r.EMP_ID),
      employeeNo: String(r.EMPCD).trim(),
      name: String(r.HNAME).trim(),
      nameEn: s(r.ENAME) ?? null,
      birthDate,
      gender: deriveGender(r.SEXGB),
      nationality: s(r.TERRITORY_CODE) ?? null,
      email: s(r.EMAIL) ?? `${String(r.EMPCD).trim()}@migrated.invalid`,
      phone: s(r.HANDPON) ?? null,
      hireDate,
      resignDate,
      nameHanja: nullable(r.JNAME),
      birthCalendar: r.BIRDGB == null ? 'SOLAR' : Number(r.BIRDGB) === 2 ? 'LUNAR' : 'SOLAR',
      isMarried: r.MARRGB == null ? null : String(r.MARRGB).trim().toUpperCase() === 'Y',
      marriageDate: parseDate(r.MARRDAT),
      officePhone: nullable(r.OFFICE_PHONE),
      faxNumber: nullable(r.FAX_NUM),
      carLicensePlate: nullable(r.CAR_LICENSE),
      groupHireDate: parseDate(r.FSTIGENTDAT),
      lastOrderDate: parseDate(r.LSTBALDAT),
      midSettlementDate: parseDate(r.MIDJSDAT),
      retireCalcBaseDate: parseDate(r.STD_RETCAL_DAT),
    }

    // Assignments
    const employmentType = deriveEmploymentType(r.JIKJGCD)
    const assignments: EmpPayload['assignments'] = []
    const hireIso = hireDate.toISOString().slice(0, 10)
    assignments.push({
      id: assignmentId(r.EMP_ID, 'HIRE', hireIso),
      employeeId: employee.id,
      effectiveDate: hireDate,
      // 재직 기간: hireDate ~ (resignDate-1) or null. status 는 항상 ACTIVE (이 기간의 신분).
      endDate: resignDate ? resignDate : null,
      changeType: 'HIRE',
      companyId,
      departmentId: departmentId ?? null,
      jobGradeId: jobGradeId ?? null,
      employmentType,
      status: 'ACTIVE',
      positionId: positionId ?? null,
      isPrimary: true,
      workLocationId: workLocationId ?? null,
      titleId: titleId ?? null,
    })
    if (resignDate) {
      const resignIso = resignDate.toISOString().slice(0, 10)
      assignments.push({
        id: assignmentId(r.EMP_ID, 'TERMINATE', resignIso),
        employeeId: employee.id,
        effectiveDate: resignDate,
        // TERMINATE row 는 직원의 "현재" 상태 — endDate: null 로 두어
        // current-assignment 쿼리(isPrimary && endDate:null)가 퇴사자도 찾을 수 있게 함.
        // HIRE row 의 endDate=resignDate 가 재직 기간 경계. status=TERMINATED 가 exit 신호.
        endDate: null,
        changeType: 'TERMINATE',
        companyId,
        departmentId: departmentId ?? null,
        jobGradeId: jobGradeId ?? null,
        employmentType,
        // dashboard query 들이 status='TERMINATED' 로 exit count. IS_PE01 에 자발/비자발 구분 없어
        // 일괄 TERMINATED 적용. 정밀 구분은 follow-up (REGULARGB 매핑 확정 후).
        status: 'TERMINATED',
        positionId: positionId ?? null,
        isPrimary: true,
        workLocationId: workLocationId ?? null,
        titleId: titleId ?? null,
      })
    }

    payloads.push({ employee, rrn: rrnPayload, assignments })
  }

  if (errors.length > 0) {
    console.log(`\n⚠️  Validation errors (${errors.length}, showing 10):`)
    for (const e of errors.slice(0, 10)) {
      console.log(`   row=${e.row} EMP_ID=${e.legacyId ?? '-'} reason=${e.reason}`)
    }
    console.log(`\nAborting before DB writes.`)
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log(`✓ Built ${payloads.length} employee payloads`)
  console.log(`  - with RRN: ${payloads.filter((p) => p.rrn).length}`)
  console.log(`  - with resign: ${payloads.filter((p) => p.assignments.length === 2).length}`)

  if (DRY_RUN) {
    for (const p of payloads.slice(0, 3)) {
      console.log(`   [DRY] ${p.employee.employeeNo} ${p.employee.name} (${p.assignments.length} assignments)`)
    }
    await prisma.$disconnect()
    process.exit(0)
  }

  // ─── 2. LIVE: 단일 transaction — all-or-nothing ─────────
  // RLS 가 활성화된 테이블(employees / employee_assignments / employee_rrns)에 write 하려면
  // app.current_user_role 가 'SUPER_ADMIN' 으로 설정돼야 함. transaction-local.
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL "app.current_user_role" = 'SUPER_ADMIN'`)
        for (const p of payloads) {
          await tx.employee.upsert({
            where: { id: p.employee.id as string },
            create: p.employee,
            update: omitImmutableEmployeeFields(p.employee),
          })
          if (p.rrn) {
            await tx.employeeRrn.upsert({
              where: { id: p.rrn.id },
              create: p.rrn,
              update: { numberEncrypted: p.rrn.numberEncrypted, numberMasked: p.rrn.numberMasked },
            })
          }
          for (const a of p.assignments) {
            await tx.employeeAssignment.upsert({
              where: { id: a.id as string },
              create: a,
              update: omitImmutableAssignmentFields(a),
            })
          }
        }
      },
      { timeout: 600_000 },
    )
    console.log(`\n📊 Imported ${payloads.length} employees (transactional).`)
  } catch (err) {
    console.error(`\n💥 Transaction rolled back: ${err instanceof Error ? err.message : String(err)}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  await prisma.$disconnect()
  process.exit(0)
}

function deriveGender(sexgb: unknown): string | null {
  const v = normalizeLegacy(sexgb)
  if (!v) return null
  if (v === '01' || v === 'M' || v === 'm') return 'MALE'
  if (v === '02' || v === 'F' || v === 'f') return 'FEMALE'
  return v // 알 수 없는 값 — caller 가 확인
}

function deriveEmploymentType(jikjgcd: unknown): string {
  // JIKJGCD 는 E108 고용형태 — 단순 매핑 (정밀 매핑은 운영팀과 협의)
  // EmploymentType enum: FULL_TIME | CONTRACT | DISPATCH | INTERN
  let v = normalizeLegacy(jikjgcd)
  // unpadded numeric ('1' → '01') 정규화 — IS_SY02 의 E108 은 2자리 코드
  if (/^\d$/.test(v)) v = '0' + v
  switch (v) {
    case '01': // 임원
    case '02': // 정규직 관리직
    case '03': // 정규직 생산직
    case '04': // 정규직 해외주재원
    case '10': // 리더
      return 'FULL_TIME'
    case '05': // 계약직
    case '08': // 도급직
      return 'CONTRACT'
    case '06': // 파견직
      return 'DISPATCH'
    case '07': // 인턴직
      return 'INTERN'
    case '09': // 일용직
    default:
      return 'CONTRACT' // 보수적 fallback
  }
}

function omitImmutableEmployeeFields(d: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, employeeNo: _eno, ...rest } = d
  return rest
}

function omitImmutableAssignmentFields(d: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, employeeId: _eid, ...rest } = d
  return rest
}

main().catch(async (err) => {
  console.error('💥 Fatal error:', err)
  await prisma.$disconnect()
  process.exit(1)
})
