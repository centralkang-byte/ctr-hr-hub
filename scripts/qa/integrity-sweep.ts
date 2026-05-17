// ═══════════════════════════════════════════════════════════
// CTR HR Hub — QA Data Integrity Sweep (Layer 1)
// ───────────────────────────────────────────────────────────
// 전 법인 × 전 참조엔티티를 한 패스로 단언하여 UAT 전에
// 다음 결함 클래스를 앱 전역에서 검출:
//   A. 빈 필수 참조데이터 (드롭다운 0건 → 화면 사용 불가)
//   B. canonical 키 기준 중복 (드롭다운에 같은 값 N개)
//   C. 드롭다운 소스 미해결 (직급=GradeTitleMapping 소스인데 매핑 0)
//   D. global→법인 전파 누락 (일부 법인에 마스터 코드 부재)
//
// 읽기 전용. CI 게이트용: HIGH 위반 시 exit 1.
// 실행: DATABASE_URL=... npx tsx scripts/qa/integrity-sweep.ts
// ═══════════════════════════════════════════════════════════

import { PrismaClient } from '../../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { writeFileSync, mkdirSync } from 'node:fs'

type Severity = 'HIGH' | 'MED' | 'LOW'

interface Finding {
  check: string
  severity: Severity
  company: string | null
  entity: string
  detail: string
}

const findings: Finding[] = []
const add = (f: Finding) => findings.push(f)

// JobCategoryCode enum = 전사 공통 4종 (스키마 SSOT)
const JOB_CATEGORY_CODES = ['OFFICE', 'PRODUCTION', 'R_AND_D', 'MANAGEMENT'] as const

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) throw new Error('DATABASE_URL is required to run integrity sweep')

  // 안전 가드: 로컬 QA DB만 허용 (staging/prod 차단)
  if (/supabase\.(co|com)|pooler\.supabase|amazonaws\.com|\.rds\./i.test(DATABASE_URL)) {
    throw new Error(`SAFETY STOP: DATABASE_URL이 원격(staging/prod)으로 보입니다. 읽기 전용이라도 로컬 QA DB에서만 실행하세요.`)
  }

  const adapter = new PrismaPg({ connectionString: DATABASE_URL })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: PrismaClient = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] })

  try {
    const companies = await prisma.company.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    })
    const cName = (id: string) => companies.find((c) => c.id === id)?.code ?? id
    const companyIds = companies.map((c) => c.id)

    // ── CHECK A: 빈 필수 참조데이터 (법인별) ──────────────────
    // 등록 필수(빈값=등록 차단) = HIGH. 호칭/직책(EmployeeTitle)은 등록 폼
    // 필수항목 아님(자동완성 보조) + 해외법인은 설계상 추후정의 → MED.
    const requiredEntities: { key: string; label: string; severity: Severity; rows: () => Promise<{ companyId: string }[]> }[] = [
      { key: 'jobGrade', label: '직급(JobGrade)', severity: 'HIGH', rows: () => prisma.jobGrade.findMany({ where: { deletedAt: null }, select: { companyId: true } }) },
      { key: 'department', label: '부서(Department)', severity: 'HIGH', rows: () => prisma.department.findMany({ where: { deletedAt: null }, select: { companyId: true } }) },
      { key: 'jobCategory', label: '직군(JobCategory)', severity: 'HIGH', rows: () => prisma.jobCategory.findMany({ where: { deletedAt: null }, select: { companyId: true } }) },
      { key: 'position', label: '직책/직위(Position)', severity: 'HIGH', rows: () => prisma.position.findMany({ where: { deletedAt: null }, select: { companyId: true } }) },
      { key: 'employeeTitle', label: '호칭(EmployeeTitle)', severity: 'MED', rows: () => prisma.employeeTitle.findMany({ where: { deletedAt: null }, select: { companyId: true } }) },
    ]
    for (const ent of requiredEntities) {
      const rows = await ent.rows()
      const byCompany = new Set(rows.map((r) => r.companyId))
      for (const c of companies) {
        if (!byCompany.has(c.id)) {
          add({ check: 'A-빈필수', severity: ent.severity, company: c.code, entity: ent.label, detail: ent.severity === 'HIGH' ? `활성 법인인데 ${ent.label} 0건 → 등록 필수값 → 화면 사용 불가` : `${ent.label} 0건 — 등록 비차단(자동완성 보조). 해외법인은 설계상 추후정의` })
        }
      }
    }

    // ── CHECK B: canonical 키 기준 중복 ──────────────────────
    const dupChecks: { key: string; label: string; keyFields: string[]; rows: () => Promise<Record<string, unknown>[]> }[] = [
      { key: 'department', label: '부서(Department) — UI는 name 표시', keyFields: ['companyId', 'name'], rows: () => prisma.department.findMany({ where: { deletedAt: null }, select: { companyId: true, name: true, code: true } }) },
      { key: 'position', label: '직책/직위(Position)', keyFields: ['companyId', 'titleKo'], rows: () => prisma.position.findMany({ where: { deletedAt: null }, select: { companyId: true, titleKo: true, code: true } }) },
      { key: 'jobGrade', label: '직급(JobGrade)', keyFields: ['companyId', 'code'], rows: () => prisma.jobGrade.findMany({ where: { deletedAt: null }, select: { companyId: true, code: true } }) },
      { key: 'employeeTitle', label: '직위/호칭(EmployeeTitle)', keyFields: ['companyId', 'code'], rows: () => prisma.employeeTitle.findMany({ where: { deletedAt: null }, select: { companyId: true, code: true } }) },
      { key: 'jobCategory', label: '직군(JobCategory) — code enum', keyFields: ['companyId', 'code'], rows: () => prisma.jobCategory.findMany({ where: { deletedAt: null }, select: { companyId: true, code: true } }) },
    ]
    for (const dc of dupChecks) {
      const rows = await dc.rows()
      const groups = new Map<string, { companyId: string; n: number; sample: string }>()
      for (const r of rows) {
        const ck = dc.keyFields.map((f) => String(r[f])).join('§')
        const g = groups.get(ck)
        if (g) g.n++
        else groups.set(ck, { companyId: String(r['companyId']), n: 1, sample: dc.keyFields.map((f) => `${f}=${r[f]}`).join(', ') })
      }
      for (const [, g] of groups) {
        if (g.n > 1) {
          add({ check: 'B-중복', severity: 'MED', company: cName(g.companyId), entity: dc.label, detail: `중복 ${g.n}건 (${g.sample}) → 드롭다운에 같은 값 ${g.n}개 노출` })
        }
      }
    }

    // (F3 이후) 직군 폼은 선택 법인으로 필터 → 법인당 4종(code별 1행)이 정상.
    // 전사 교차중복은 더 이상 결함 아님. 실제 불변식(법인당 code 중복 없음 +
    // 4종 전부 보유)은 CHECK B-중복(companyId,code) + CHECK D에서 검증.

    // ── CHECK C: GradeTitleMapping 커버리지 (정보성) ──────────
    // F2 이후 직급 드롭다운 1차 소스 = JobGrade. GradeTitleMapping은
    // 호칭(EmployeeTitle) 자동완성 보조용 → 0건이어도 드롭다운/등록 정상.
    // 따라서 게이트(HIGH) 아님. 매핑 없으면 호칭 자동완성만 비활성 → LOW 가시화.
    const grades = await prisma.jobGrade.findMany({ where: { deletedAt: null }, select: { companyId: true } })
    const gradeByCo = new Set(grades.map((g) => g.companyId))
    const mappings = await prisma.gradeTitleMapping.findMany({ select: { companyId: true } })
    const mapByCo = new Set(mappings.map((m) => m.companyId))
    for (const c of companies) {
      if (gradeByCo.has(c.id) && !mapByCo.has(c.id)) {
        add({ check: 'C-매핑커버리지', severity: 'LOW', company: c.code, entity: 'GradeTitleMapping', detail: `JobGrade 있으나 매핑 0 — 직급 선택은 정상(JobGrade 직접 소스), 호칭 자동완성만 비활성` })
      }
    }

    // ── CHECK D: global→법인 전파 (직군 4종 enum 기준) ──────
    const catRows = await prisma.jobCategory.findMany({ where: { deletedAt: null }, select: { companyId: true, code: true } })
    for (const c of companies) {
      const codes = new Set(catRows.filter((r) => r.companyId === c.id).map((r) => String(r.code)))
      const missing = JOB_CATEGORY_CODES.filter((code) => !codes.has(code))
      if (missing.length > 0) {
        add({ check: 'D-전파누락', severity: 'MED', company: c.code, entity: '직군(JobCategory)', detail: `전사 공통 코드 중 미보유: ${missing.join(', ')}` })
      }
    }

    // ── 리포트 출력 ──────────────────────────────────────────
    const order: Severity[] = ['HIGH', 'MED', 'LOW']
    findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || a.check.localeCompare(b.check))
    const counts = { HIGH: 0, MED: 0, LOW: 0 }
    for (const f of findings) counts[f.severity]++

    const lines: string[] = []
    lines.push(`# QA 데이터 정합성 스윕 결과 (Layer 1)`)
    lines.push('')
    lines.push(`> 실행: ${new Date().toISOString()} · 활성 법인 ${companies.length}개`)
    lines.push(`> 위반: **HIGH ${counts.HIGH} / MED ${counts.MED} / LOW ${counts.LOW}**`)
    lines.push('')
    lines.push('| 심각도 | 체크 | 법인 | 엔티티 | 상세 |')
    lines.push('|---|---|---|---|---|')
    for (const f of findings) {
      lines.push(`| ${f.severity} | ${f.check} | ${f.company ?? '(전사)'} | ${f.entity} | ${f.detail} |`)
    }
    if (findings.length === 0) lines.push('| — | — | — | — | 위반 없음 |')
    const report = lines.join('\n') + '\n'

    mkdirSync('docs/qa', { recursive: true })
    writeFileSync('docs/qa/2026-05-integrity-sweep.md', report)

    console.log(report)
    console.log(`\n📋 리포트 저장: docs/qa/2026-05-integrity-sweep.md`)
    console.log(`결과: HIGH ${counts.HIGH} / MED ${counts.MED} / LOW ${counts.LOW}`)

    if (counts.HIGH > 0) {
      console.error(`\n❌ HIGH 위반 ${counts.HIGH}건 — CI 게이트 실패`)
      process.exitCode = 1
    } else {
      console.log(`\n✅ HIGH 위반 없음`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('❌ integrity-sweep 실패:', e)
  process.exit(1)
})
