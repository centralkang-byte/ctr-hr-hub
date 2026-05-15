// ═══════════════════════════════════════════════════════════
// Stage 4 — IS_PE01 → 부속 모델 5종
// EmployeeAddress / EmployeeBankAccount / KoreaSocialInsurance /
// EmployeeStatutoryStatus / MilitaryRegistration
//
// 사전 조건: 03-import-employees 가 완료된 상태 (Employee row 존재)
//
// 사용법:
//   DRY_RUN=true npx tsx scripts/migrate/04-import-supporting.ts /path/to/IS_PE01.xlsx
//   npx tsx scripts/migrate/04-import-supporting.ts /path/to/IS_PE01.xlsx
// ═══════════════════════════════════════════════════════════

import dotenv from 'dotenv'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import * as xlsx from 'xlsx'
import { v5 as uuidv5 } from 'uuid'
import { PrismaClient, Prisma } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { encryptAccountNumber, maskAccountNumber, normalizeAccountNumber } from '../../src/lib/pii/account'
import { encrypt as encryptProbe } from '../../src/lib/pii/encryption'
import type { LegacyEmployeeRow } from './types'

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })

const DRY_RUN = process.env.DRY_RUN === 'true'
const EMPLOYEE_NS = '4d3f7a1c-9b2e-4d8a-9f1e-3c5d7b8a1c2d' // 03 과 동일

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Usage: tsx scripts/migrate/04-import-supporting.ts <path-to-IS_PE01.xlsx>')
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
const empId = (legacyId: number | string): string => uuidv5(`emp:${legacyId}`, EMPLOYEE_NS)
const addrId = (legacyId: number | string, type: string): string =>
  uuidv5(`addr:${legacyId}:${type}`, EMPLOYEE_NS)
const bankId = (legacyId: number | string, purpose: string): string =>
  uuidv5(`bank:${legacyId}:${purpose}`, EMPLOYEE_NS)
const insId = (legacyId: number | string, type: string): string =>
  uuidv5(`ins:${legacyId}:${type}`, EMPLOYEE_NS)
const statId = (legacyId: number | string): string => uuidv5(`stat:${legacyId}`, EMPLOYEE_NS)
const milId = (legacyId: number | string): string => uuidv5(`mil:${legacyId}`, EMPLOYEE_NS)

// ─── 공통 helpers (03 과 동일) ───────────────────────────
function s(v: unknown): string | undefined {
  if (v == null) return undefined
  const str = String(v).trim()
  return str === '' ? undefined : str
}
function nullable(v: unknown): string | null {
  return s(v) ?? null
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
function isSentinelDate(d: Date | null): boolean {
  return d != null && d.getUTCFullYear() <= 1901
}
function decimal(v: unknown): Prisma.Decimal | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  return new Prisma.Decimal(n)
}
function yesNo(v: unknown): boolean | null {
  if (v == null) return null
  const str = String(v).trim().toUpperCase()
  if (str === 'Y') return true
  if (str === 'N') return false
  return null
}

// ─── 메인 ────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`📥 IS_PE01 → 부속 모델 import — ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`)
  console.log(`   input: ${inputPath}\n`)

  try {
    encryptProbe('__probe__')
  } catch (err) {
    console.error(`💥 PII 암호화 키 검증 실패: ${err instanceof Error ? err.message : String(err)}`)
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

  // ─── 1. 사전 검증 + payload 빌드 ─────────────────────────
  const errors: Array<{ row: number; legacyId?: number; reason: string }> = []
  const addresses: Array<Parameters<typeof prisma.employeeAddress.create>[0]['data']> = []
  const banks: Array<Parameters<typeof prisma.employeeBankAccount.create>[0]['data']> = []
  const insurances: Array<Parameters<typeof prisma.koreaSocialInsurance.create>[0]['data']> = []
  const statuses: Array<Parameters<typeof prisma.employeeStatutoryStatus.create>[0]['data']> = []
  const military: Array<{ create: Prisma.MilitaryRegistrationCreateInput; update: Prisma.MilitaryRegistrationUpdateInput; id: string }> = []

  // Employee + current assignment 조회 — RLS 활성화된 테이블이라 SUPER_ADMIN 컨텍스트 필요.
  const empIds = rows.map((r) => (r.EMP_ID != null ? empId(r.EMP_ID) : null)).filter((x): x is string => x !== null)
  const { existing, empToCompany } = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL "app.current_user_role" = 'SUPER_ADMIN'`)
    const emps = await tx.employee.findMany({
      where: { id: { in: empIds } },
      select: { id: true, hireDate: true },
    })
    // 군 정보 import 에 companyId 필요 — current assignment (isPrimary, 최근) 에서
    const asgs = await tx.employeeAssignment.findMany({
      where: { employeeId: { in: empIds }, isPrimary: true, changeType: 'HIRE' },
      select: { employeeId: true, companyId: true },
    })
    return {
      existing: emps,
      empToCompany: new Map(asgs.map((a) => [a.employeeId, a.companyId])),
    }
  })
  const empMap = new Map(existing.map((e) => [e.id, e]))

  for (const [idx, r] of rows.entries()) {
    const rowNum = idx + 3
    if (r.EMP_ID == null) {
      errors.push({ row: rowNum, reason: 'EMP_ID 없음' })
      continue
    }
    const eid = empId(r.EMP_ID)
    const emp = empMap.get(eid)
    if (!emp) {
      errors.push({ row: rowNum, legacyId: r.EMP_ID, reason: 'Employee 미존재 (Stage 3 먼저 실행)' })
      continue
    }
    const hireDate = emp.hireDate

    // ─── Addresses ──
    pushAddress(addresses, r, 'REGISTERED', r.HUNPOST, r.HUNADDR1, r.HUNADDR2, hireDate)
    pushAddress(addresses, r, 'RESIDENCE', r.SILPOST, r.SILADDR1, r.SILADDR2, hireDate)
    pushAddress(addresses, r, 'FOREIGN', null, r.FOREIGN_ADDR1, r.FOREIGN_ADDR2, hireDate, false)

    // ─── Bank accounts ──
    pushBank(banks, r, 'PAYROLL', r.BANKCD1, r.PAYACNTNO1, r.PAYNAME1, errors, rowNum)
    pushBank(banks, r, 'EXPENSE', r.BANKCD2, r.PAYACNTNO2, r.PAYNAME2, errors, rowNum)
    pushBank(banks, r, 'PENSION', r.BANKCD3, r.PAYACNTNO3, r.PAYNAME3, errors, rowNum)

    // ─── Korea Social Insurance ──
    pushInsurance(insurances, r, 'HEALTH', {
      enrolled: yesNo(r.MEDYN),
      monthlySalary: decimal(r.MEDIGRADE),
      acquireDate: parseDate(r.MEDIFYMD),
      loseDate: parseDate(r.MEDITYMD),
      groupCode: nullable(r.MEDIDIV),
      certNumber: nullable(r.MEDINO),
      exemptReason: nullable(r.MEDETC),
      longTermCareAmount: decimal(r.LONG_MEDIAMT),
      employerAmount: decimal(r.MEDIAMT),
    })
    pushInsurance(insurances, r, 'NATIONAL_PENSION', {
      enrolled: yesNo(r.NATYN),
      monthlySalary: decimal(r.NATGRADE),
      acquireDate: parseDate(r.NATFYMD),
      loseDate: parseDate(r.NATTYMD),
      groupCode: null,
      certNumber: null,
      exemptReason: nullable(r.NATETC),
      longTermCareAmount: null,
      employerAmount: decimal(r.NATAMT),
    })
    pushInsurance(insurances, r, 'EMPLOYMENT', {
      enrolled: yesNo(r.EMPLYN),
      monthlySalary: decimal(r.EMPLGRADE),
      acquireDate: parseDate(r.EMPLFYMD),
      loseDate: parseDate(r.EMPLTYMD),
      groupCode: null,
      certNumber: null,
      exemptReason: nullable(r.EMPLETC),
      longTermCareAmount: null,
      employerAmount: decimal(r.EMPL_CMP_AMT),
    })

    // ─── Statutory status (보훈/장애/노조) ──
    // 모든 영속 필드 검사 — 일부만 채워진 row 도 import (silent data loss 방지)
    const hasStat =
      nullable(r.BOHUNCD) ||
      nullable(r.BOHUN_BENEFIT) ||
      nullable(r.BOHUNNO) ||
      nullable(r.BOHUN_REL) ||
      nullable(r.BOHUN_ORG) ||
      nullable(r.HANDICAP_TYPE) ||
      nullable(r.HANDICAP_CLASS) ||
      cleanSentinel(parseDate(r.HANDICAP_DAT)) ||
      yesNo(r.NOJOYN) === true ||
      cleanSentinel(parseDate(r.NOJODAT)) ||
      nullable(r.NOJOGRADE)
    if (hasStat) {
      statuses.push({
        id: statId(r.EMP_ID),
        employeeId: eid,
        veteranType: nullable(r.BOHUNCD),
        veteranBenefit: nullable(r.BOHUN_BENEFIT),
        veteranNumber: nullable(r.BOHUNNO),
        veteranRelation: nullable(r.BOHUN_REL),
        veteranOrg: nullable(r.BOHUN_ORG),
        disabilityType: nullable(r.HANDICAP_TYPE),
        disabilityClass: nullable(r.HANDICAP_CLASS),
        disabilityDate: cleanSentinel(parseDate(r.HANDICAP_DAT)),
        unionMember: yesNo(r.NOJOYN) ?? false,
        unionJoinDate: cleanSentinel(parseDate(r.NOJODAT)),
        unionRank: nullable(r.NOJOGRADE),
      })
    }

    // ─── Military registration ──
    const milFrom = cleanSentinel(parseDate(r.MIL_FROM))
    const milTo = cleanSentinel(parseDate(r.MIL_TO))
    const milCause = nullable(r.MIL_NO_CAUSE)
    const milGroup = nullable(r.MIL_GROUP)
    const milClass = nullable(r.MIL_CLASS)
    const milNo = nullable(r.MIL_NO)
    const milDis = nullable(r.MIL_DIS)
    const milSection = nullable(r.MIL_SECTION)
    const hasMil = milGroup || milClass || milFrom || milTo || milCause || milNo || milDis || milSection
    if (hasMil) {
      const companyId = empToCompany.get(eid)
      if (!companyId) {
        errors.push({
          row: rowNum,
          legacyId: r.EMP_ID,
          reason: 'MIL_* 있으나 current assignment(HIRE primary) 없음 — companyId 결정 불가',
        })
      } else {
        // category/fitnessCategory 는 enum 필수 — 보수적 default.
        // 정확한 매핑(MIL_GROUP → OFFICER/SOLDIER/RESERVIST, fitness)은 운영자 협의 후 follow-up.
        const category = milCause ? 'EXEMPT' : 'SOLDIER'
        const fitnessCategory = milCause ? 'UNFIT' : 'FIT_A'
        military.push({
          id: milId(r.EMP_ID),
          create: {
            id: milId(r.EMP_ID),
            employee: { connect: { id: eid } },
            company: { connect: { id: companyId } },
            category,
            rank: milClass,
            specialtyCode: null,
            fitnessCategory,
            militaryOffice: null,
            registrationDate: milFrom,
            deregistrationDate: milTo,
            notes: null,
            exemptReason: milCause,
            serviceType: milSection,
            dischargeType: milDis,
            militaryNumber: milNo,
          },
          update: {
            category,
            rank: milClass,
            fitnessCategory,
            registrationDate: milFrom,
            deregistrationDate: milTo,
            exemptReason: milCause,
            serviceType: milSection,
            dischargeType: milDis,
            militaryNumber: milNo,
          },
        })
      }
    }
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

  console.log(`✓ Built payloads:`)
  console.log(`  - addresses:  ${addresses.length}`)
  console.log(`  - banks:      ${banks.length}`)
  console.log(`  - insurances: ${insurances.length}`)
  console.log(`  - statuses:   ${statuses.length}`)
  console.log(`  - military:   ${military.length}`)

  if (DRY_RUN) {
    await prisma.$disconnect()
    process.exit(0)
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL "app.current_user_role" = 'SUPER_ADMIN'`)
        for (const a of addresses) {
          await tx.employeeAddress.upsert({ where: { id: a.id as string }, create: a, update: omit(a, ['id', 'employeeId']) })
        }
        for (const b of banks) {
          await tx.employeeBankAccount.upsert({ where: { id: b.id as string }, create: b, update: omit(b, ['id', 'employeeId']) })
        }
        for (const i of insurances) {
          await tx.koreaSocialInsurance.upsert({ where: { id: i.id as string }, create: i, update: omit(i, ['id', 'employeeId']) })
        }
        for (const s of statuses) {
          await tx.employeeStatutoryStatus.upsert({ where: { id: s.id as string }, create: s, update: omit(s, ['id', 'employeeId']) })
        }
        for (const m of military) {
          await tx.militaryRegistration.upsert({ where: { id: m.id }, create: m.create, update: m.update })
        }
      },
      { timeout: 600_000 },
    )
    console.log(`\n📊 Imported supporting data (transactional).`)
  } catch (err) {
    console.error(`\n💥 Transaction rolled back: ${err instanceof Error ? err.message : String(err)}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  await prisma.$disconnect()
  process.exit(0)
}

// ─── push helpers ────────────────────────────────────────
function pushAddress(
  acc: Array<Parameters<typeof prisma.employeeAddress.create>[0]['data']>,
  r: LegacyEmployeeRow,
  type: 'REGISTERED' | 'RESIDENCE' | 'FOREIGN',
  post: unknown,
  line1: unknown,
  line2: unknown,
  hireDate: Date,
  defaultKR = true,
): void {
  const hasContent = nullable(post) || nullable(line1) || nullable(line2)
  if (!hasContent || r.EMP_ID == null) return
  acc.push({
    id: addrId(r.EMP_ID, type),
    employeeId: empId(r.EMP_ID),
    type,
    postalCode: nullable(post),
    addressLine1: nullable(line1),
    addressLine2: nullable(line2),
    countryCode: defaultKR ? 'KR' : null,
    isActive: true,
    effectiveFrom: hireDate, // 정확한 시작일 모름 — hireDate 사용
    effectiveTo: null,
  })
}

function pushBank(
  acc: Array<Parameters<typeof prisma.employeeBankAccount.create>[0]['data']>,
  r: LegacyEmployeeRow,
  purpose: 'PAYROLL' | 'EXPENSE' | 'PENSION',
  bankCode: unknown,
  accountNo: unknown,
  holder: unknown,
  errors: Array<{ row: number; legacyId?: number; reason: string }>,
  rowNum: number,
): void {
  const bc = nullable(bankCode)
  const acno = nullable(accountNo)
  if (!bc || !acno || r.EMP_ID == null) return
  try {
    const normalized = normalizeAccountNumber(acno)
    acc.push({
      id: bankId(r.EMP_ID, purpose),
      employeeId: empId(r.EMP_ID),
      purpose,
      bankCode: bc,
      numberEncrypted: encryptAccountNumber(normalized),
      numberMasked: maskAccountNumber(normalized),
      accountHolder: nullable(holder) ?? '(unknown)',
      isPrimary: true,
      isActive: true,
    })
  } catch (err) {
    errors.push({
      row: rowNum,
      legacyId: r.EMP_ID,
      reason: `${purpose} 계좌 정규화 실패: ${err instanceof Error ? err.message : String(err)}`,
    })
  }
}

function pushInsurance(
  acc: Array<Parameters<typeof prisma.koreaSocialInsurance.create>[0]['data']>,
  r: LegacyEmployeeRow,
  type: 'HEALTH' | 'NATIONAL_PENSION' | 'EMPLOYMENT',
  fields: {
    enrolled: boolean | null
    monthlySalary: Prisma.Decimal | null
    acquireDate: Date | null
    loseDate: Date | null
    groupCode: string | null
    certNumber: string | null
    exemptReason: string | null
    longTermCareAmount: Prisma.Decimal | null
    employerAmount: Prisma.Decimal | null
  },
): void {
  if (r.EMP_ID == null) return
  // 모든 영속 필드 검사 — 부분 채워진 row 도 import. sentinel date 는 null 취급.
  const hasContent =
    fields.enrolled !== null ||
    cleanSentinel(fields.acquireDate) ||
    cleanSentinel(fields.loseDate) ||
    fields.exemptReason ||
    fields.monthlySalary ||
    fields.groupCode ||
    fields.certNumber ||
    fields.longTermCareAmount ||
    fields.employerAmount
  if (!hasContent) return
  acc.push({
    id: insId(r.EMP_ID, type),
    employeeId: empId(r.EMP_ID),
    insuranceType: type,
    isEnrolled: fields.enrolled ?? false,
    monthlySalary: fields.monthlySalary,
    acquireDate: cleanSentinel(fields.acquireDate),
    loseDate: cleanSentinel(fields.loseDate),
    groupCode: fields.groupCode,
    certNumber: fields.certNumber,
    exemptReason: fields.exemptReason,
    longTermCareAmount: fields.longTermCareAmount,
    employerAmount: fields.employerAmount,
  })
}

function cleanSentinel(d: Date | null): Date | null {
  return d && !isSentinelDate(d) ? d : null
}

function omit<T extends Record<string, unknown>>(o: T, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...o }
  for (const k of keys) delete out[k]
  return out
}

main().catch(async (err) => {
  console.error('💥 Fatal error:', err)
  await prisma.$disconnect()
  process.exit(1)
})
