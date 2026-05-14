// ═══════════════════════════════════════════════════════════
// Stage 2 — 조직 매핑 검증 (read-only)
// IS_PE01 의 legacy 조직 코드 (COMPYCD/DEPTCD/JIKGUBCD/JIKWICD/JIKCKCD/JIKMUCD/WORK_AREA)
// → CodeMaster 의 reference1 (우리 시스템의 Company.code/Department.code 등) → 실제 DB ID 매핑
//
// 사전 작업: 운영팀이 CodeMaster 에 다음 분류(CodeGroup.code) + 매핑(CodeItem.reference1) 등록 필요:
//   COMPYCD  → Company.code         (CodeGroup.code = "COMPYCD")
//   DEPTCD   → Department.code      (CodeGroup.code = "DEPTCD", 회사별 unique → 컴포지트 "<COMPYCD>:<DEPTCD>")
//   JIKGUBCD → JobGrade.code        (CodeGroup.code = "JIKGUBCD", 컴포지트)
//   JIKWICD  → EmployeeTitle.code   (CodeGroup.code = "JIKWICD",  컴포지트)
//   JIKCKCD  → Position.code        (CodeGroup.code = "JIKCKCD",  컴포지트)
//   JIKMUCD  → Job.code             (CodeGroup.code = "JIKMUCD")
//   WORK_AREA→ WorkLocation.code    (CodeGroup.code = "E109",     컴포지트)  ← IS_SY02 의 E109 분류 재사용
//
// 사용법:
//   npx tsx scripts/migrate/02-map-org.ts /path/to/IS_PE01.xlsx
// ═══════════════════════════════════════════════════════════

import dotenv from 'dotenv'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import * as xlsx from 'xlsx'
import { PrismaClient } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import type { LegacyEmployeeRow } from './types'

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Usage: tsx scripts/migrate/02-map-org.ts <path-to-IS_PE01.xlsx>')
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

// ─── 매핑 그룹 정의 ───────────────────────────────────────
// Company-scoped 모델은 검증 시 (companyId, code) 짝으로 확인해야 함.
// 그래서 검증 키도 (COMPYCD, value) pair 로 추출.
type ScopedDomain =
  | { kind: 'company' } // global
  | { kind: 'department' }
  | { kind: 'jobGrade' }
  | { kind: 'employeeTitle' }
  | { kind: 'position' }
  | { kind: 'job' } // global (Job.companyId nullable, code unique global)
  | { kind: 'workLocation' }

interface MappingGroup {
  legacyColumn: keyof LegacyEmployeeRow
  codeMasterGroup: string
  domain: string
  target: ScopedDomain
  /** true 면 같은 row 의 COMPYCD 도 함께 unique key 에 포함 (company-scoped 모델) */
  companyScoped: boolean
}

const GROUPS: MappingGroup[] = [
  { legacyColumn: 'COMPYCD', codeMasterGroup: 'COMPYCD', domain: '회사', target: { kind: 'company' }, companyScoped: false },
  { legacyColumn: 'DEPTCD', codeMasterGroup: 'DEPTCD', domain: '부서', target: { kind: 'department' }, companyScoped: true },
  { legacyColumn: 'JIKGUBCD', codeMasterGroup: 'JIKGUBCD', domain: '직급', target: { kind: 'jobGrade' }, companyScoped: true },
  { legacyColumn: 'JIKWICD', codeMasterGroup: 'JIKWICD', domain: '호칭', target: { kind: 'employeeTitle' }, companyScoped: true },
  { legacyColumn: 'JIKCKCD', codeMasterGroup: 'JIKCKCD', domain: '직책', target: { kind: 'position' }, companyScoped: true },
  { legacyColumn: 'JIKMUCD', codeMasterGroup: 'JIKMUCD', domain: '직무', target: { kind: 'job' }, companyScoped: false },
  { legacyColumn: 'WORK_AREA', codeMasterGroup: 'E109', domain: '근무지/사업장', target: { kind: 'workLocation' }, companyScoped: true },
]

// ─── helpers ──────────────────────────────────────────────
function normalizeLegacyCode(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

/** company-scoped 모델: companyId 필수. global: companyId 무시. */
async function existsInTarget(target: ScopedDomain, code: string, companyId: string | null): Promise<boolean> {
  switch (target.kind) {
    case 'company':
      return (await prisma.company.count({ where: { code, deletedAt: null } })) > 0
    case 'department':
      return companyId
        ? (await prisma.department.count({ where: { code, companyId, deletedAt: null } })) > 0
        : false
    case 'jobGrade': {
      // JobGrade 는 schema 상 @@unique([companyId, code]) 없음 → ambiguity 가능.
      // 정확히 1건만 매칭돼야 employee import 시 단일 ID 결정 가능.
      if (!companyId) return false
      const cnt = await prisma.jobGrade.count({ where: { code, companyId, deletedAt: null } })
      return cnt === 1
    }
    case 'employeeTitle':
      return companyId
        ? (await prisma.employeeTitle.count({ where: { code, companyId, deletedAt: null } })) > 0
        : false
    case 'position':
      return companyId
        ? (await prisma.position.count({ where: { code, companyId, deletedAt: null } })) > 0
        : false
    case 'job':
      return (await prisma.job.count({ where: { code } })) > 0
    case 'workLocation':
      return companyId
        ? (await prisma.workLocation.count({ where: { code, companyId, deletedAt: null } })) > 0
        : false
  }
}

// ─── 메인 ────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`📥 IS_PE01 → CTR HR Hub 조직 매핑 검증 (read-only)`)
  console.log(`   input: ${inputPath}\n`)

  const wb = xlsx.read(readFileSync(inputPath), { cellDates: true })
  const sheetName = wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  // header row 0=한글, row 1=ERP code name. range:1 → ERP code 를 key 로.
  const rows = xlsx.utils.sheet_to_json<LegacyEmployeeRow>(sheet, {
    range: 1,
    defval: null,
    raw: false,
    blankrows: false,
  })
  console.log(`   sheet="${sheetName}", rows=${rows.length}\n`)

  let totalMissing = 0
  const reports: string[] = []

  // ─── 1) COMPYCD 먼저 매핑 — 다른 검증의 company 컨텍스트로 사용 ───
  const compycdToCompanyId = await resolveCompanyIds(rows)

  for (const g of GROUPS) {
    // unique key 추출: companyScoped 면 (COMPYCD, code), 아니면 (null, code)
    const uniqueKeys = new Set<string>()
    const pairs: Array<{ legacy: string; compycd: string | null }> = []
    for (const r of rows) {
      const code = normalizeLegacyCode((r as Record<string, unknown>)[g.legacyColumn as string])
      if (!code) continue
      const compycd = g.companyScoped ? normalizeLegacyCode(r.COMPYCD) : null
      const key = `${compycd ?? '*'}::${code}`
      if (!uniqueKeys.has(key)) {
        uniqueKeys.add(key)
        pairs.push({ legacy: code, compycd })
      }
    }

    // CodeMaster lookup —
    //   company-scoped 면 컴포지트 키 "compycd:legacy" 로 저장됐다고 가정 (README 참조).
    //   같은 legacy 가 회사별로 다른 reference1 을 가질 수 있음.
    const lookupKey = (p: { legacy: string; compycd: string | null }): string =>
      g.companyScoped ? `${p.compycd ?? ''}:${p.legacy}` : p.legacy
    const lookupCodes = [...new Set(pairs.map(lookupKey))]
    const items = await prisma.codeItem.findMany({
      where: { group: { code: g.codeMasterGroup }, code: { in: lookupCodes } },
      select: { code: true, reference1: true },
    })
    const codeMap = new Map(items.map((i) => [i.code, i.reference1]))

    const missing: Array<{ legacy: string; compycd: string | null }> = []
    const refMissing: Array<{ legacy: string; compycd: string | null; ourCode: string | null }> = []

    for (const p of pairs) {
      const key = lookupKey(p)
      const ourCode = codeMap.get(key)
      if (!codeMap.has(key)) {
        missing.push(p)
        continue
      }
      if (!ourCode) {
        refMissing.push({ ...p, ourCode: null })
        continue
      }
      // company-scoped: COMPYCD → Company.id 가 미해결이면 검증 불가
      let companyId: string | null = null
      if (g.companyScoped) {
        if (!p.compycd) {
          refMissing.push({ ...p, ourCode })
          continue
        }
        companyId = compycdToCompanyId.get(p.compycd) ?? null
        if (!companyId) {
          // COMPYCD 자체가 매핑 안 됨 — 별도 COMPYCD 그룹에서 잡힐 거라 여기선 skip 보고
          refMissing.push({ ...p, ourCode })
          continue
        }
      }
      const exists = await existsInTarget(g.target, ourCode, companyId)
      if (!exists) refMissing.push({ ...p, ourCode })
    }

    const localMissing = missing.length + refMissing.length
    totalMissing += localMissing

    const scopeNote = g.companyScoped ? ' [company-scoped]' : ''
    if (localMissing === 0) {
      reports.push(`   ✓ ${g.domain.padEnd(12)}${scopeNote} (${g.legacyColumn}, pairs=${pairs.length}): all mapped`)
    } else {
      reports.push(`   ✗ ${g.domain.padEnd(12)}${scopeNote} (${g.legacyColumn}, pairs=${pairs.length}): ${localMissing} unresolved`)
      for (const m of missing.slice(0, 5)) {
        const key = m.compycd ? `${m.compycd}/${m.legacy}` : m.legacy
        reports.push(`     - ${g.codeMasterGroup}/${key}: CodeMaster 에 매핑 없음`)
      }
      if (missing.length > 5) reports.push(`     ... +${missing.length - 5} more`)
      for (const r of refMissing.slice(0, 5)) {
        const key = r.compycd ? `${r.compycd}/${r.legacy}` : r.legacy
        reports.push(`     - ${g.codeMasterGroup}/${key}: ourCode="${r.ourCode ?? '(null)'}" 가 ${g.target.kind} 에 없음`)
      }
      if (refMissing.length > 5) reports.push(`     ... +${refMissing.length - 5} more`)
    }
  }

  console.log(`📊 Mapping Report:\n${reports.join('\n')}\n`)

  if (totalMissing > 0) {
    console.log(`⚠️  Total unresolved: ${totalMissing}.`)
    console.log(`   다음 단계 (03-import-employees) 진행 전 CodeMaster 에 매핑을 추가하세요.`)
    console.log(`   예: prisma.codeItem.upsert({ ..., reference1: "CTR" }) — Prisma Studio 또는 GUI 사용.`)
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log(`✅ All legacy 조직 codes are mapped to existing DB entities. Ready for Stage 3.`)
  await prisma.$disconnect()
  process.exit(0)
}

/**
 * 모든 COMPYCD legacy 값을 CodeMaster lookup → Company.id 로 변환.
 * 매핑 안 되거나 Company 가 없으면 null.
 */
async function resolveCompanyIds(rows: LegacyEmployeeRow[]): Promise<Map<string, string>> {
  const compycds = new Set<string>()
  for (const r of rows) {
    const code = normalizeLegacyCode(r.COMPYCD)
    if (code) compycds.add(code)
  }
  if (compycds.size === 0) return new Map()

  const items = await prisma.codeItem.findMany({
    where: { group: { code: 'COMPYCD' }, code: { in: [...compycds] } },
    select: { code: true, reference1: true },
  })
  const ourCodes = items.map((i) => i.reference1).filter((c): c is string => Boolean(c))
  const companies =
    ourCodes.length > 0
      ? await prisma.company.findMany({ where: { code: { in: ourCodes }, deletedAt: null }, select: { id: true, code: true } })
      : []
  const codeToId = new Map(companies.map((c) => [c.code, c.id]))

  const result = new Map<string, string>()
  for (const item of items) {
    if (item.reference1) {
      const id = codeToId.get(item.reference1)
      if (id) result.set(item.code, id)
    }
  }
  return result
}

main().catch(async (err) => {
  console.error('💥 Fatal error:', err)
  await prisma.$disconnect()
  process.exit(1)
})
