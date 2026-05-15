// ═══════════════════════════════════════════════════════════
// Stage 5 — 마이그레이션 검증 (read-only)
// IS_PE01 입력 대비 imported 데이터 일관성 검증.
//
// 검증 항목:
//   1) Employee count: rows.length === imported employees
//   2) Assignment 무결성: 모든 employee 가 isPrimary=HIRE 1개 (퇴사자는 +TERMINATE 1개)
//   3) RRN round-trip: 샘플 N건 decrypt → normalized 13자리 numeric
//   4) Insurance 가입자 수: legacy MEDYN=Y count == imported HEALTH isEnrolled count (NAT/EMPL 동일)
//   5) Address/Bank 카운트: 채워진 IS_PE01 컬럼 수 == imported row 수
//   6) Orphan check: employee_assignments 가 없는 employee
//   7) sentinel 데이터 미존재: birth_date/marriage_date 등 1900-01-01 검사
//
// 사용법:
//   npx tsx scripts/migrate/05-verify.ts /path/to/IS_PE01.xlsx
// ═══════════════════════════════════════════════════════════

import dotenv from 'dotenv'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import * as xlsx from 'xlsx'
import { v5 as uuidv5 } from 'uuid'
import { PrismaClient } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { decryptRRN } from '../../src/lib/pii/rrn'
import type { LegacyEmployeeRow } from './types'

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })

const EMPLOYEE_NS = '4d3f7a1c-9b2e-4d8a-9f1e-3c5d7b8a1c2d'
const RRN_SAMPLE_SIZE = 100

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Usage: tsx scripts/migrate/05-verify.ts <path-to-IS_PE01.xlsx>')
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

const empId = (legacyId: number | string): string => uuidv5(`emp:${legacyId}`, EMPLOYEE_NS)

function nullable(v: unknown): string | null {
  if (v == null) return null
  const str = String(v).trim()
  return str === '' ? null : str
}
function yesNo(v: unknown): boolean | null {
  if (v == null) return null
  const str = String(v).trim().toUpperCase()
  if (str === 'Y') return true
  if (str === 'N') return false
  return null
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
/** Stage 3 와 동일한 sentinel 처리 — 1901 이하 연도는 무효 */
function isRealResign(v: unknown): boolean {
  const d = parseDate(v as never)
  return d !== null && d.getUTCFullYear() > 1901
}

interface Check {
  name: string
  passed: boolean
  detail: string
}

async function main(): Promise<void> {
  console.log(`📥 Migration verification (read-only)`)
  console.log(`   input: ${inputPath}\n`)

  const wb = xlsx.read(readFileSync(inputPath), { cellDates: true })
  const sheetName = wb.SheetNames[0]
  const rows = xlsx.utils.sheet_to_json<LegacyEmployeeRow>(wb.Sheets[sheetName], {
    range: 1,
    defval: null,
    raw: false,
    blankrows: false,
  })
  const missingEmpIdRows = rows.filter((r) => r.EMP_ID == null).length
  const empIds = rows.map((r) => (r.EMP_ID != null ? empId(r.EMP_ID) : null)).filter((x): x is string => x !== null)
  console.log(`   legacy rows: ${rows.length}, deterministic IDs: ${empIds.length}\n`)

  const checks: Check[] = []
  checks.push({
    name: 'No legacy rows missing EMP_ID',
    passed: missingEmpIdRows === 0,
    detail: `missing=${missingEmpIdRows}/${rows.length}`,
  })

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL "app.current_user_role" = 'SUPER_ADMIN'`)

    // ─── 1. Employee count (active only — deletedAt: null) ──
    const empActive = await tx.employee.count({ where: { id: { in: empIds }, deletedAt: null } })
    const empSoftDeleted = await tx.employee.count({ where: { id: { in: empIds }, deletedAt: { not: null } } })
    checks.push({
      name: 'Employee count (active)',
      passed: empActive === empIds.length,
      detail: `legacy=${empIds.length}, imported(active)=${empActive}`,
    })
    checks.push({
      name: 'No soft-deleted imported employees',
      passed: empSoftDeleted === 0,
      detail: `soft-deleted=${empSoftDeleted} (re-import 시 Stage 3 가 deletedAt clear 필요)`,
    })

    // ─── 2. Assignment integrity (per-employee, not just total) ──
    const hireGroups = await tx.employeeAssignment.groupBy({
      by: ['employeeId'],
      where: { employeeId: { in: empIds }, changeType: 'HIRE', isPrimary: true },
      _count: { _all: true },
    })
    const hireDistinct = hireGroups.length
    const hireDup = hireGroups.filter((g) => g._count._all > 1).length
    checks.push({
      name: 'HIRE assignments per employee',
      passed: hireDistinct === empIds.length && hireDup === 0,
      detail: `distinct=${hireDistinct}/${empIds.length}, duplicates=${hireDup}`,
    })

    // Set 단위 비교 — wrong employee 에 붙은 TERMINATE 도 catch
    const expectedResignedIds = new Set(
      rows.filter((r) => isRealResign(r.RETDAT) && r.EMP_ID != null).map((r) => empId(r.EMP_ID!)),
    )
    const termGroups = await tx.employeeAssignment.groupBy({
      by: ['employeeId'],
      where: { employeeId: { in: empIds }, changeType: 'TERMINATE', isPrimary: true },
      _count: { _all: true },
    })
    const actualTerminatedIds = new Set(termGroups.map((g) => g.employeeId))
    const termDup = termGroups.filter((g) => g._count._all > 1).length
    const missingTerm = [...expectedResignedIds].filter((id) => !actualTerminatedIds.has(id))
    const extraTerm = [...actualTerminatedIds].filter((id) => !expectedResignedIds.has(id))
    checks.push({
      name: 'TERMINATE assignments per employee',
      passed: missingTerm.length === 0 && extraTerm.length === 0 && termDup === 0,
      detail: `expected=${expectedResignedIds.size}, actual=${actualTerminatedIds.size}, missing=${missingTerm.length}, extra=${extraTerm.length}, dup=${termDup}`,
    })

    // ─── 3a. RRN total count ──────────────────────────────
    // Stage 3 의 normalizeRRN 가 수용하는 형태 (숫자 13개 ± hyphen 1개) 만 expected.
    const expectedRrn = rows.filter((r) => {
      const v = nullable(r.JUMINNO)
      if (!v) return false
      const digits = v.replace(/\D/g, '')
      return digits.length === 13
    }).length
    const importedRrnTotal = await tx.employeeRrn.count({ where: { employeeId: { in: empIds } } })
    checks.push({
      name: 'RRN total count',
      passed: importedRrnTotal === expectedRrn,
      detail: `expected(normalized 13-digit)=${expectedRrn}, imported=${importedRrnTotal}`,
    })

    // ─── 3b. RRN round-trip (샘플) ─────────────────────────
    const rrnSample = await tx.employeeRrn.findMany({
      where: { employeeId: { in: empIds } },
      take: RRN_SAMPLE_SIZE,
      select: { numberEncrypted: true, numberMasked: true },
    })
    let rrnOk = 0
    let rrnFail = 0
    for (const r of rrnSample) {
      try {
        const decrypted = decryptRRN(r.numberEncrypted)
        if (/^\d{13}$/.test(decrypted) && r.numberMasked.startsWith(decrypted.slice(0, 6))) {
          rrnOk++
        } else {
          rrnFail++
        }
      } catch {
        rrnFail++
      }
    }
    checks.push({
      name: 'RRN round-trip (sample)',
      // 샘플이 비어있고 expected 가 양수면 fail (count check 가 별도로 잡지만 이중 안전망)
      passed: rrnFail === 0 && (expectedRrn === 0 || rrnSample.length > 0),
      detail: `sample=${rrnSample.length}, ok=${rrnOk}, fail=${rrnFail}`,
    })

    // ─── 4. Insurance enrolled counts ─────────────────────
    const insChecks: Array<{ type: string; legacy: number; key: keyof LegacyEmployeeRow }> = [
      { type: 'HEALTH', legacy: rows.filter((r) => yesNo(r.MEDYN) === true).length, key: 'MEDYN' },
      { type: 'NATIONAL_PENSION', legacy: rows.filter((r) => yesNo(r.NATYN) === true).length, key: 'NATYN' },
      { type: 'EMPLOYMENT', legacy: rows.filter((r) => yesNo(r.EMPLYN) === true).length, key: 'EMPLYN' },
    ]
    for (const ic of insChecks) {
      const imported = await tx.koreaSocialInsurance.count({
        where: { employeeId: { in: empIds }, insuranceType: ic.type, isEnrolled: true },
      })
      checks.push({
        name: `Insurance ${ic.type} enrolled`,
        passed: imported === ic.legacy,
        detail: `legacy(${ic.key}=Y)=${ic.legacy}, imported=${imported}`,
      })
    }

    // ─── 5. Address / Bank count ──────────────────────────
    // Stage 4 의 pushAddress 와 동일한 기준 — postcode/line1/line2 중 하나라도 있으면 row 생성
    const legacyRegisteredAddr = rows.filter(
      (r) => nullable(r.HUNPOST) || nullable(r.HUNADDR1) || nullable(r.HUNADDR2),
    ).length
    const legacyResidenceAddr = rows.filter(
      (r) => nullable(r.SILPOST) || nullable(r.SILADDR1) || nullable(r.SILADDR2),
    ).length
    // FOREIGN 은 postcode 컬럼 없음 (외국 우편번호 schema 미정) — line 만 검사
    const legacyForeignAddr = rows.filter(
      (r) => nullable(r.FOREIGN_ADDR1) || nullable(r.FOREIGN_ADDR2),
    ).length
    const importedAddrByType = await tx.employeeAddress.groupBy({
      by: ['type'],
      where: { employeeId: { in: empIds } },
      _count: { _all: true },
    })
    const addrCounts = new Map(importedAddrByType.map((g) => [g.type, g._count._all]))
    checks.push({
      name: 'Address REGISTERED',
      passed: (addrCounts.get('REGISTERED') ?? 0) === legacyRegisteredAddr,
      detail: `legacy=${legacyRegisteredAddr}, imported=${addrCounts.get('REGISTERED') ?? 0}`,
    })
    checks.push({
      name: 'Address RESIDENCE',
      passed: (addrCounts.get('RESIDENCE') ?? 0) === legacyResidenceAddr,
      detail: `legacy=${legacyResidenceAddr}, imported=${addrCounts.get('RESIDENCE') ?? 0}`,
    })
    checks.push({
      name: 'Address FOREIGN',
      passed: (addrCounts.get('FOREIGN') ?? 0) === legacyForeignAddr,
      detail: `legacy=${legacyForeignAddr}, imported=${addrCounts.get('FOREIGN') ?? 0}`,
    })

    const legacyPayrollBank = rows.filter((r) => nullable(r.BANKCD1) && nullable(r.PAYACNTNO1)).length
    const legacyExpenseBank = rows.filter((r) => nullable(r.BANKCD2) && nullable(r.PAYACNTNO2)).length
    const legacyPensionBank = rows.filter((r) => nullable(r.BANKCD3) && nullable(r.PAYACNTNO3)).length
    const importedBankByPurpose = await tx.employeeBankAccount.groupBy({
      by: ['purpose'],
      where: { employeeId: { in: empIds } },
      _count: { _all: true },
    })
    const bankCounts = new Map(importedBankByPurpose.map((g) => [g.purpose, g._count._all]))
    checks.push({
      name: 'Bank PAYROLL',
      passed: (bankCounts.get('PAYROLL') ?? 0) === legacyPayrollBank,
      detail: `legacy=${legacyPayrollBank}, imported=${bankCounts.get('PAYROLL') ?? 0}`,
    })
    checks.push({
      name: 'Bank EXPENSE',
      passed: (bankCounts.get('EXPENSE') ?? 0) === legacyExpenseBank,
      detail: `legacy=${legacyExpenseBank}, imported=${bankCounts.get('EXPENSE') ?? 0}`,
    })
    checks.push({
      name: 'Bank PENSION',
      passed: (bankCounts.get('PENSION') ?? 0) === legacyPensionBank,
      detail: `legacy=${legacyPensionBank}, imported=${bankCounts.get('PENSION') ?? 0}`,
    })

    // ─── 6. Orphan check ──────────────────────────────────
    const orphans = await tx.employee.findMany({
      where: { id: { in: empIds }, assignments: { none: {} } },
      select: { id: true, employeeNo: true },
      take: 10,
    })
    checks.push({
      name: 'Employees without assignment',
      passed: orphans.length === 0,
      detail: `orphans=${orphans.length}${orphans.length > 0 ? ` (e.g. ${orphans.map((o) => o.employeeNo).join(', ')})` : ''}`,
    })

    // ─── 7. Sentinel date contamination (모든 Employee date field) ──
    const sentinelBoundary = new Date(Date.UTC(1901, 0, 1))
    const sentinelEmp = await tx.employee.count({
      where: {
        id: { in: empIds },
        OR: [
          { hireDate: { lte: sentinelBoundary } },
          { resignDate: { lte: sentinelBoundary } },
          { birthDate: { lte: sentinelBoundary } },
          { marriageDate: { lte: sentinelBoundary } },
          { groupHireDate: { lte: sentinelBoundary } },
          { lastOrderDate: { lte: sentinelBoundary } },
          { midSettlementDate: { lte: sentinelBoundary } },
          { retireCalcBaseDate: { lte: sentinelBoundary } },
        ],
      },
    })
    checks.push({
      name: 'No sentinel dates (≤1901-01-01)',
      passed: sentinelEmp === 0,
      detail: `hire/resign/birth/marriage/groupHire/lastOrder/midSettlement/retireCalcBase contaminated=${sentinelEmp}`,
    })
    },
    { timeout: 600_000 }, // 03/04 와 동일 — full-spreadsheet count/groupBy 시 5s default 부족
  )

  // ─── 결과 출력 ──────────────────────────────────────────
  console.log(`📊 Verification Report:`)
  let passed = 0
  let failed = 0
  for (const c of checks) {
    const icon = c.passed ? '✓' : '✗'
    console.log(`   ${icon} ${c.name.padEnd(35)} ${c.detail}`)
    if (c.passed) passed++
    else failed++
  }
  console.log(`\n   Total: ${passed} passed, ${failed} failed`)

  await prisma.$disconnect()
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(async (err) => {
  console.error('💥 Fatal error:', err)
  await prisma.$disconnect()
  process.exit(1)
})
