// ================================================================
// CTR HR Hub — Seed Data: Compliance Module Gaps
// prisma/seeds/33-compliance-gaps.ts
//
// Fills:
//   1. GDPR — GdprRequest (DSAR), DataRetentionPolicy, DpiaRecord
//   2. CN — SocialInsuranceConfig + SocialInsuranceRecord
//   3. KR — SeveranceInterimPayment
// ================================================================

import { PrismaClient } from '../../src/generated/prisma/client'

function deterministicUUID(ns: string, key: string): string {
  const str = `${ns}:${key}`
  let h = 0
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0 }
  const hex = Math.abs(h).toString(16).padStart(8, '0')
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(1, 4)}-${hex.padEnd(12, '0').slice(0, 12)}`
}

export async function seedComplianceGaps(prisma: PrismaClient) {
  console.log('📌 Seeding compliance module gaps...')

  const ctrKr = await prisma.company.findFirst({ where: { code: 'CTR' } })
  const ctrCn = await prisma.company.findFirst({ where: { code: 'CTR-CN' } })
  if (!ctrKr) { console.log('  ⚠️ CTR-KR not found'); return }

  const hrEmp = await prisma.employee.findFirst({ where: { email: 'hr@ctr.co.kr' } })
  if (!hrEmp) { console.log('  ⚠️ HR employee not found'); return }

  const employees = await prisma.employee.findMany({
    where: { assignments: { some: { companyId: ctrKr.id, endDate: null } } },
    select: { id: true, name: true },
    take: 10,
  })

  // ─── 1. GDPR: GdprRequest (DSAR) ─────────────────────────────
  console.log('  📌 1/6: GDPR data requests (DSAR)...')

  const dsarRequests = [
    { key: 'dsar-1', empIdx: 0, requestType: 'ACCESS' as const, status: 'COMPLETED' as const, desc: '개인정보 열람 요청 — 인사 기록 전체', daysAgo: 45, completedDaysAgo: 40 },
    { key: 'dsar-2', empIdx: 1, requestType: 'PORTABILITY' as const, status: 'COMPLETED' as const, desc: '개인정보 이동권 — CSV 형태 출력 요청', daysAgo: 30, completedDaysAgo: 22 },
    { key: 'dsar-3', empIdx: 2, requestType: 'ERASURE' as const, status: 'GDPR_PENDING' as const, desc: '퇴직자 개인정보 삭제 요청', daysAgo: 5, completedDaysAgo: null },
    { key: 'dsar-4', empIdx: 3, requestType: 'RECTIFICATION' as const, status: 'IN_PROGRESS' as const, desc: '주소 및 연락처 정정 요청', daysAgo: 10, completedDaysAgo: null },
    { key: 'dsar-5', empIdx: 4, requestType: 'RESTRICTION' as const, status: 'REJECTED' as const, desc: '성과평가 데이터 처리 제한 요청', daysAgo: 60, completedDaysAgo: 55 },
    { key: 'dsar-6', empIdx: 5, requestType: 'ACCESS' as const, status: 'IN_PROGRESS' as const, desc: '급여 이력 전체 열람 요청', daysAgo: 3, completedDaysAgo: null },
    { key: 'dsar-7', empIdx: 6, requestType: 'OBJECTION' as const, status: 'GDPR_PENDING' as const, desc: 'AI 기반 이직 예측 분석 거부', daysAgo: 1, completedDaysAgo: null },
  ]

  let dsarCount = 0
  for (const r of dsarRequests) {
    const id = deterministicUUID('dsar', r.key)
    const emp = employees[r.empIdx]
    if (!emp) continue
    const existing = await prisma.gdprRequest.findUnique({ where: { id } })
    if (existing) continue
    const now = new Date()
    const createdAt = new Date(now.getTime() - r.daysAgo * 86400000)
    const deadline = new Date(createdAt.getTime() + 30 * 86400000) // GDPR 30-day deadline
    await prisma.gdprRequest.create({
      data: {
        id,
        companyId: ctrKr.id,
        employeeId: emp.id,
        requestType: r.requestType,
        status: r.status,
        description: r.desc,
        deadline,
        completedAt: r.completedDaysAgo ? new Date(now.getTime() - r.completedDaysAgo * 86400000) : null,
        completedById: r.completedDaysAgo ? hrEmp.id : null,
        responseNote: r.status === 'COMPLETED' ? '처리 완료됨' : (r.status === 'REJECTED' ? '법적 근거 부재로 거부' : null),
      },
    })
    dsarCount++
  }
  console.log(`  ✅ ${dsarCount} GDPR data requests`)

  // ─── 2. GDPR: DataRetentionPolicy ─────────────────────────────
  console.log('  📌 2/6: Data retention policies...')

  const retentionPolicies = [
    { category: 'EMPLOYMENT_RECORDS' as const, months: 36, desc: '퇴직 후 3년 보관 (근로기준법)', autoDelete: false },
    { category: 'PAYROLL_DATA' as const, months: 60, desc: '급여 기록 5년 보관 (국세기본법)', autoDelete: false },
    { category: 'PERFORMANCE_DATA' as const, months: 36, desc: '성과 평가 기록 3년 보관', autoDelete: true },
    { category: 'TRAINING_RECORDS' as const, months: 36, desc: '교육 이수 기록 3년 보관', autoDelete: true },
    { category: 'RECRUITMENT_DATA' as const, months: 6, desc: '불합격 지원자 6개월 보관', autoDelete: true },
    { category: 'HEALTH_SAFETY' as const, months: 36, desc: '건강검진/산재 기록 3년 보관', autoDelete: false },
    { category: 'DISCIPLINARY_RECORDS' as const, months: 24, desc: '징계 기록 2년 보관', autoDelete: true },
    { category: 'LEAVE_RECORDS' as const, months: 36, desc: '휴가 기록 3년 보관', autoDelete: true },
    { category: 'AUDIT_LOGS' as const, months: 12, desc: '감사 로그 1년 보관', autoDelete: true },
  ]

  let retCount = 0
  for (const p of retentionPolicies) {
    const existing = await prisma.dataRetentionPolicy.findUnique({
      where: { companyId_category: { companyId: ctrKr.id, category: p.category } },
    })
    if (existing) continue
    await prisma.dataRetentionPolicy.create({
      data: {
        id: deterministicUUID('retention', `${ctrKr.id}:${p.category}`),
        companyId: ctrKr.id,
        category: p.category,
        retentionMonths: p.months,
        description: p.desc,
        autoDelete: p.autoDelete,
        anonymize: true,
      },
    })
    retCount++
  }
  console.log(`  ✅ ${retCount} data retention policies`)

  // ─── 3. GDPR: DpiaRecord ──────────────────────────────────────
  console.log('  📌 3/6: DPIA records...')

  const dpias = [
    { key: 'dpia-1', title: 'AI 기반 이직 예측 시스템 DPIA', scope: '전 직원 출퇴근/성과/급여 데이터', risk: 'HIGH', status: 'APPROVED' as const, mitigations: '데이터 익명화, 접근 통제 강화, 결과 설명 가능성 보장' },
    { key: 'dpia-2', title: '신규 근태관리 생체인식 시스템', scope: '지문/안면인식 데이터 수집', risk: 'HIGH', status: 'IN_REVIEW' as const, mitigations: '명시적 동의 수집, 대체 수단 제공, 데이터 암호화 저장' },
    { key: 'dpia-3', title: 'HR 챗봇 시스템 개인정보 처리', scope: '직원 문의 대화 기록, 개인정보 참조', risk: 'MEDIUM', status: 'APPROVED' as const, mitigations: '대화 기록 90일 자동 삭제, PII 마스킹' },
    { key: 'dpia-4', title: '글로벌 급여 데이터 통합', scope: '6개국 법인 급여 데이터 통합 처리', risk: 'HIGH', status: 'DPIA_DRAFT' as const, mitigations: null },
    { key: 'dpia-5', title: '채용 ATS AI 스크리닝', scope: '지원자 이력서 AI 분석', risk: 'MEDIUM', status: 'REJECTED' as const, mitigations: 'AI 판단 근거 투명성 부족 — 보완 후 재심의' },
  ]

  let dpiaCount = 0
  for (const d of dpias) {
    const id = deterministicUUID('dpia', d.key)
    const existing = await prisma.dpiaRecord.findUnique({ where: { id } })
    if (existing) continue
    await prisma.dpiaRecord.create({
      data: {
        id,
        companyId: ctrKr.id,
        title: d.title,
        description: d.title,
        processingScope: d.scope,
        riskLevel: d.risk,
        mitigations: d.mitigations,
        status: d.status,
        reviewedById: (d.status !== 'DPIA_DRAFT') ? hrEmp.id : null,
        reviewedAt: (d.status !== 'DPIA_DRAFT') ? new Date('2026-02-15') : null,
        approvedAt: (d.status === 'APPROVED') ? new Date('2026-02-20') : null,
      },
    })
    dpiaCount++
  }
  console.log(`  ✅ ${dpiaCount} DPIA records`)

  // ─── 4. CN: SocialInsuranceConfig ─────────────────────────────
  if (ctrCn) {
    console.log('  📌 4/6: CN social insurance configs...')

    const insuranceTypes = [
      { type: 'PENSION' as const, city: '上海', erRate: 16, eeRate: 8, min: 6520, max: 36549 },
      { type: 'MEDICAL' as const, city: '上海', erRate: 10, eeRate: 2, min: 6520, max: 36549 },
      { type: 'UNEMPLOYMENT' as const, city: '上海', erRate: 0.5, eeRate: 0.5, min: 6520, max: 36549 },
      { type: 'WORK_INJURY' as const, city: '上海', erRate: 0.4, eeRate: 0, min: 6520, max: 36549 },
      { type: 'MATERNITY_INS' as const, city: '上海', erRate: 1, eeRate: 0, min: 6520, max: 36549 },
      { type: 'HOUSING_FUND' as const, city: '上海', erRate: 7, eeRate: 7, min: 2690, max: 36549 },
    ]

    let siConfigCount = 0
    for (const si of insuranceTypes) {
      const existing = await prisma.socialInsuranceConfig.findUnique({
        where: { companyId_insuranceType_city_effectiveFrom: { companyId: ctrCn.id, insuranceType: si.type, city: si.city, effectiveFrom: new Date('2026-01-01') } },
      })
      if (existing) continue
      await prisma.socialInsuranceConfig.create({
        data: {
          id: deterministicUUID('si-config', `${ctrCn.id}:${si.type}:${si.city}`),
          companyId: ctrCn.id,
          insuranceType: si.type,
          city: si.city,
          employerRate: si.erRate,
          employeeRate: si.eeRate,
          baseMin: si.min,
          baseMax: si.max,
          effectiveFrom: new Date('2026-01-01'),
        },
      })
      siConfigCount++
    }
    console.log(`  ✅ ${siConfigCount} social insurance configs`)

    // SocialInsuranceRecord — 3 months for some CN employees
    console.log('  📌 5/6: CN social insurance records...')

    const cnEmployees = await prisma.employee.findMany({
      where: { assignments: { some: { companyId: ctrCn.id, endDate: null } } },
      select: { id: true },
      take: 5,
    })

    let siRecordCount = 0
    for (const emp of cnEmployees) {
      for (const month of [1, 2, 3]) {
        for (const si of insuranceTypes) {
          const baseSalary = 15000 + Math.floor(Math.random() * 10000)
          const erAmt = Math.round(baseSalary * si.erRate / 100)
          const eeAmt = Math.round(baseSalary * si.eeRate / 100)
          const existing = await prisma.socialInsuranceRecord.findUnique({
            where: { employeeId_insuranceType_year_month: { employeeId: emp.id, insuranceType: si.type, year: 2026, month } },
          })
          if (existing) continue
          await prisma.socialInsuranceRecord.create({
            data: {
              id: deterministicUUID('si-rec', `${emp.id}:${si.type}:2026:${month}`),
              companyId: ctrCn.id,
              employeeId: emp.id,
              insuranceType: si.type,
              year: 2026,
              month,
              baseSalary,
              employerAmount: erAmt,
              employeeAmount: eeAmt,
            },
          })
          siRecordCount++
        }
      }
    }
    console.log(`  ✅ ${siRecordCount} social insurance records`)
  } else {
    console.log('  ⚠️ CTR-CN not found, skipping social insurance')
  }

  // ─── 6. KR: SeveranceInterimPayment ───────────────────────────
  console.log('  📌 6/6: KR severance interim payments...')

  const severancePayments = [
    { key: 'sev-1', empIdx: 0, reason: 'HOUSING_PURCHASE' as const, status: 'SIP_PAID' as const, amount: 25000000, years: 5.2, avgSalary: 4800000 },
    { key: 'sev-2', empIdx: 1, reason: 'HOUSING_LEASE' as const, status: 'SIP_APPROVED' as const, amount: 15000000, years: 3.8, avgSalary: 3900000 },
    { key: 'sev-3', empIdx: 2, reason: 'MEDICAL_EXPENSE' as const, status: 'SIP_PENDING' as const, amount: 8000000, years: 7.1, avgSalary: 4200000 },
    { key: 'sev-4', empIdx: 3, reason: 'BANKRUPTCY' as const, status: 'SIP_REJECTED' as const, amount: 20000000, years: 2.5, avgSalary: 5000000 },
    { key: 'sev-5', empIdx: 4, reason: 'HOUSING_PURCHASE' as const, status: 'SIP_PENDING' as const, amount: 30000000, years: 8.3, avgSalary: 5500000 },
    { key: 'sev-6', empIdx: 5, reason: 'NATURAL_DISASTER' as const, status: 'SIP_PAID' as const, amount: 10000000, years: 4.0, avgSalary: 3500000 },
  ]

  let sevCount = 0
  for (const s of severancePayments) {
    const id = deterministicUUID('severance', s.key)
    const emp = employees[s.empIdx]
    if (!emp) continue
    const existing = await prisma.severanceInterimPayment.findUnique({ where: { id } })
    if (existing) continue
    await prisma.severanceInterimPayment.create({
      data: {
        id,
        companyId: ctrKr.id,
        employeeId: emp.id,
        reason: s.reason,
        status: s.status,
        amount: s.amount,
        yearsOfService: s.years,
        avgSalary: s.avgSalary,
        requestDate: new Date('2026-02-01'),
        approvedById: (s.status === 'SIP_APPROVED' || s.status === 'SIP_PAID') ? hrEmp.id : null,
        approvedAt: (s.status === 'SIP_APPROVED' || s.status === 'SIP_PAID') ? new Date('2026-02-10') : null,
        paidAt: (s.status === 'SIP_PAID') ? new Date('2026-02-20') : null,
        rejectionReason: (s.status === 'SIP_REJECTED') ? '근속 3년 미만으로 중간정산 불가' : null,
      },
    })
    sevCount++
  }
  console.log(`  ✅ ${sevCount} severance interim payments`)
}
