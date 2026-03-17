// ================================================================
// CTR HR Hub — Seed Data: Payroll & Other Module Gaps
// prisma/seeds/34-payroll-other-gaps.ts
//
// Fills:
//   1. BankTransferBatch + BankTransferItem
//   2. HrDocument (employment rules, policies, handbooks)
//   3. RecruitmentCost (per posting cost analysis)
//   4. ApprovalFlow + ApprovalFlowStep (system defaults)
// ================================================================

import { PrismaClient } from '../../src/generated/prisma/client'

function deterministicUUID(ns: string, key: string): string {
  const str = `${ns}:${key}`
  let h = 0
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0 }
  const hex = Math.abs(h).toString(16).padStart(8, '0')
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(1, 4)}-${hex.padEnd(12, '0').slice(0, 12)}`
}

export async function seedPayrollOtherGaps(prisma: PrismaClient) {
  console.log('📌 Seeding payroll & other module gaps...')

  const ctrKr = await prisma.company.findFirst({ where: { code: 'CTR-KR' } })
  if (!ctrKr) { console.log('  ⚠️ CTR-KR not found'); return }

  const hrEmp = await prisma.employee.findFirst({ where: { email: 'hr@ctr.co.kr' } })
  if (!hrEmp) { console.log('  ⚠️ HR employee not found'); return }

  const employees = await prisma.employee.findMany({
    where: { assignments: { some: { companyId: ctrKr.id, endDate: null } } },
    select: { id: true, name: true, employeeNo: true },
    take: 15,
  })

  // ─── 1. Bank Transfer Batch + Items ───────────────────────────
  console.log('  📌 1/4: Bank transfer batches...')

  const payrollRuns = await prisma.payrollRun.findMany({
    where: { companyId: ctrKr.id },
    select: { id: true, yearMonth: true },
    orderBy: { yearMonth: 'desc' },
    take: 3,
  })

  let batchCount = 0
  const batches = [
    { key: 'bt-1', bankCode: 'KB', bankName: '국민은행', status: 'COMPLETED' as const, runIdx: 0 },
    { key: 'bt-2', bankCode: 'SH', bankName: '신한은행', status: 'COMPLETED' as const, runIdx: 0 },
    { key: 'bt-3', bankCode: 'KB', bankName: '국민은행', status: 'GENERATED' as const, runIdx: 1 },
    { key: 'bt-4', bankCode: 'WR', bankName: '우리은행', status: 'DRAFT' as const, runIdx: 2 },
  ]

  for (const b of batches) {
    const batchId = deterministicUUID('bt-batch', b.key)
    const existing = await prisma.bankTransferBatch.findUnique({ where: { id: batchId } })
    if (existing) continue

    const run = payrollRuns[b.runIdx]
    if (!run) continue

    // Create batch
    const itemCount = Math.min(employees.length, 8 + b.runIdx * 2)
    const amounts = employees.slice(0, itemCount).map((_, i) => 2500000 + (i * 150000))
    const totalAmount = amounts.reduce((a, b) => a + b, 0)

    await prisma.bankTransferBatch.create({
      data: {
        id: batchId,
        companyId: ctrKr.id,
        payrollRunId: run.id,
        bankCode: b.bankCode,
        bankName: b.bankName,
        format: 'CSV',
        status: b.status,
        totalAmount,
        totalCount: itemCount,
        successCount: b.status === 'COMPLETED' ? itemCount : 0,
        failCount: 0,
        createdBy: hrEmp.id,
        generatedAt: b.status !== 'DRAFT' ? new Date('2026-02-25') : null,
        submittedAt: b.status === 'COMPLETED' ? new Date('2026-02-26') : null,
        completedAt: b.status === 'COMPLETED' ? new Date('2026-02-27') : null,
        note: `${run.yearMonth} ${b.bankName} 급여이체`,
      },
    })

    // Create items
    for (let i = 0; i < itemCount; i++) {
      const emp = employees[i]
      if (!emp) continue
      await prisma.bankTransferItem.create({
        data: {
          id: deterministicUUID('bt-item', `${b.key}:${emp.id}`),
          batchId,
          employeeId: emp.id,
          employeeName: emp.name,
          employeeNo: emp.employeeNo,
          bankCode: b.bankCode,
          accountNumber: `${b.bankCode}${String(1000000 + i * 11111).padStart(10, '0')}`,
          accountHolder: emp.name,
          amount: amounts[i],
          status: b.status === 'COMPLETED' ? 'SUCCESS' : 'PENDING',
          transferredAt: b.status === 'COMPLETED' ? new Date('2026-02-27') : null,
        },
      })
    }
    batchCount++
  }
  console.log(`  ✅ ${batchCount} bank transfer batches with items`)

  // ─── 2. HR Documents ──────────────────────────────────────────
  console.log('  📌 2/4: HR documents...')

  const hrDocs = [
    { key: 'doc-1', title: '취업규칙', docType: 'EMPLOYMENT_RULES' as const, content: '제1장 총칙\n제1조(목적) 이 규칙은 주식회사 씨티알(이하 "회사")의 취업에 관한 사항을 정함을 목적으로 한다.\n제2조(적용범위) 이 규칙은 회사에 근무하는 모든 직원에게 적용한다.\n제3조(정의) 1. "직원"이란 이 규칙에 의하여 채용된 자를 말한다.\n\n제2장 채용\n제4조(채용) 직원의 채용은 공개채용을 원칙으로 한다.\n제5조(채용서류) 채용에 필요한 서류는 이력서, 자기소개서 등으로 한다.\n\n제3장 근로시간 및 휴일\n제6조(근로시간) 1일 근로시간은 8시간, 1주 근로시간은 40시간으로 한다.\n제7조(휴일) 매주 토요일, 일요일 및 법정공휴일을 유급휴일로 한다.' },
    { key: 'doc-2', title: '인사관리규정', docType: 'HR_POLICY' as const, content: '제1장 총칙\n제1조(목적) 이 규정은 임직원의 인사관리에 관한 기본원칙과 절차를 정함을 목적으로 한다.\n\n제2장 인사체계\n제3조(직급체계) G1(대표이사), G2(본부장), G3(팀장), G4(선임), G5(주임), G6(사원)\n제4조(승진) 승진은 근무성적, 경력, 직무수행능력을 종합 평가하여 결정한다.\n\n제3장 평가\n제5조(성과평가) 상반기(1~6월), 하반기(7~12월) 연 2회 실시한다.\n제6조(평가등급) S(최우수), A(우수), B(보통), C(미흡) 4등급으로 구분한다.' },
    { key: 'doc-3', title: '복리후생 안내서', docType: 'BENEFIT_GUIDE' as const, content: '1. 건강검진: 매년 1회 종합건강검진 지원\n2. 자기개발비: 연 200만원 한도 교육비 지원\n3. 경조금: 결혼 100만원, 출산 50만원, 상조 50만원\n4. 학자금: 자녀 대학 학자금 연 500만원 한도\n5. 주거지원: 무주택자 전세자금 대출이자 지원\n6. 건강관리: 헬스장 월 5만원 지원\n7. 식대: 일 1만원 식대 지급\n8. 교통비: 월 10만원 교통비 지원' },
    { key: 'doc-4', title: '안전보건관리규정', docType: 'SAFETY_MANUAL' as const, content: '제1장 총칙\n제1조(목적) 산업안전보건법에 의거하여 근로자의 안전과 보건을 유지·증진함을 목적으로 한다.\n\n제2장 안전관리조직\n제3조(안전보건관리책임자) 대표이사를 안전보건관리책임자로 한다.\n제4조(안전관리자) 각 사업장에 1명 이상의 안전관리자를 선임한다.\n\n제3장 안전작업 수칙\n제5조(보호구 착용) 작업 특성에 맞는 보호구를 반드시 착용한다.\n제6조(위험물 취급) 위험물 취급 시 안전수칙을 준수한다.' },
    { key: 'doc-5', title: '직원 핸드북 2026', docType: 'EMPLOYEE_HANDBOOK' as const, content: 'CTR 그룹 직원 핸드북에 오신 것을 환영합니다.\n\n회사 소개: CTR은 자동차 부품 전문 기업으로 1985년 설립되었습니다.\n핵심 가치: 혁신, 품질, 신뢰, 상생\n\n근무시간: 09:00~18:00 (점심 12:00~13:00)\n연차: 입사 1년 미만 매월 1일, 1년 이상 15일\n복장: 비즈니스 캐주얼\n\nIT 장비: 노트북, 모니터, 키보드, 마우스 기본 제공\n보안: 사내 정보 외부 유출 금지, 퇴근 시 PC 잠금' },
  ]

  let docCount = 0
  for (const d of hrDocs) {
    const id = deterministicUUID('hrdoc', d.key)
    const existing = await prisma.hrDocument.findUnique({ where: { id } })
    if (existing) continue
    await prisma.hrDocument.create({
      data: {
        id,
        companyId: ctrKr.id,
        title: d.title,
        docType: d.docType,
        contentText: d.content,
        version: '1.0',
        locale: 'ko',
        uploadedBy: hrEmp.id,
        isActive: true,
      },
    })
    docCount++
  }
  console.log(`  ✅ ${docCount} HR documents`)

  // ─── 3. Recruitment Costs ─────────────────────────────────────
  console.log('  📌 3/4: Recruitment costs...')

  const postings = await prisma.jobPosting.findMany({
    where: { companyId: ctrKr.id },
    select: { id: true, title: true },
    take: 5,
  })

  const costData = [
    { key: 'rc-1', postIdx: 0, source: 'JOB_BOARD' as const, type: 'AD_FEE' as const, amount: 500000, vendor: '사람인', desc: '채용공고 게시 30일' },
    { key: 'rc-2', postIdx: 0, source: 'AGENCY' as const, type: 'AGENCY_FEE' as const, amount: 8000000, vendor: '로버트월터스', desc: '헤드헌팅 수수료 (연봉 15%)' },
    { key: 'rc-3', postIdx: 1, source: 'JOB_BOARD' as const, type: 'AD_FEE' as const, amount: 300000, vendor: '잡코리아', desc: '채용공고 게시 15일' },
    { key: 'rc-4', postIdx: 1, source: 'DIRECT' as const, type: 'ASSESSMENT_TOOL' as const, amount: 150000, vendor: 'SHL Korea', desc: '인적성검사 10회분' },
    { key: 'rc-5', postIdx: 2, source: 'REFERRAL' as const, type: 'REFERRAL_BONUS' as const, amount: 1000000, vendor: null, desc: '내부 추천 포상금' },
    { key: 'rc-6', postIdx: 2, source: 'DIRECT' as const, type: 'TRAVEL' as const, amount: 250000, vendor: null, desc: '지방 면접 교통비 지원' },
    { key: 'rc-7', postIdx: 3, source: 'AGENCY' as const, type: 'AGENCY_FEE' as const, amount: 5000000, vendor: '맨파워', desc: '채용대행 수수료' },
    { key: 'rc-8', postIdx: 3, source: 'DIRECT' as const, type: 'SIGNING_BONUS' as const, amount: 3000000, vendor: null, desc: 'Sign-on bonus' },
    { key: 'rc-9', postIdx: 4, source: 'JOB_BOARD' as const, type: 'AD_FEE' as const, amount: 800000, vendor: '링크드인', desc: 'LinkedIn Recruiter 광고' },
    { key: 'rc-10', postIdx: 4, source: 'DIRECT' as const, type: 'RELOCATION' as const, amount: 5000000, vendor: null, desc: '이주비 지원 (해외 인재)' },
  ]

  let costCount = 0
  for (const c of costData) {
    const id = deterministicUUID('rcost', c.key)
    const posting = postings[c.postIdx]
    if (!posting) continue
    const existing = await prisma.recruitmentCost.findUnique({ where: { id } })
    if (existing) continue
    await prisma.recruitmentCost.create({
      data: {
        id,
        companyId: ctrKr.id,
        postingId: posting.id,
        applicantSource: c.source,
        costType: c.type,
        amount: c.amount,
        currency: 'KRW',
        description: c.desc,
        vendorName: c.vendor,
        invoiceDate: new Date('2026-02-15'),
        createdBy: hrEmp.id,
      },
    })
    costCount++
  }
  console.log(`  ✅ ${costCount} recruitment costs`)

  // ─── 4. Approval Flows ────────────────────────────────────────
  console.log('  📌 4/4: Approval flow defaults...')

  const flows = [
    { key: 'af-leave', name: '휴가 승인', module: 'leave', steps: [{ role: 'direct_manager', order: 1 }] },
    { key: 'af-leave-long', name: '장기휴가 승인 (5일+)', module: 'leave', steps: [{ role: 'direct_manager', order: 1 }, { role: 'hr_admin', order: 2 }] },
    { key: 'af-benefits', name: '복리후생 신청', module: 'benefits', steps: [{ role: 'direct_manager', order: 1 }, { role: 'hr_admin', order: 2 }] },
    { key: 'af-recruit', name: '채용 요청', module: 'recruitment', steps: [{ role: 'dept_head', order: 1 }, { role: 'hr_admin', order: 2 }, { role: 'ceo', order: 3 }] },
    { key: 'af-promotion', name: '승진 추천', module: 'promotion', steps: [{ role: 'direct_manager', order: 1 }, { role: 'hr_admin', order: 2 }, { role: 'ceo', order: 3 }] },
    { key: 'af-general', name: '일반 결재', module: 'general', steps: [{ role: 'direct_manager', order: 1 }] },
  ]

  let flowCount = 0
  for (const f of flows) {
    const flowId = deterministicUUID('af', f.key)
    const existing = await prisma.approvalFlow.findUnique({ where: { id: flowId } })
    if (existing) continue

    await prisma.approvalFlow.create({
      data: {
        id: flowId,
        name: f.name,
        description: `${f.name} 기본 플로우`,
        companyId: ctrKr.id,
        module: f.module,
        isActive: true,
        steps: {
          create: f.steps.map(s => ({
            id: deterministicUUID('af-step', `${f.key}:${s.order}`),
            stepOrder: s.order,
            approverType: 'role',
            approverRole: s.role,
            isRequired: true,
          })),
        },
      },
    })
    flowCount++
  }
  console.log(`  ✅ ${flowCount} approval flows with steps`)
}
