// ================================================================
// CTR HR Hub — Seed Data: Discipline & Rewards
// prisma/seeds/31-discipline.ts
//
// Creates:
//   6 DisciplinaryActions (various types/statuses)
//   5 RewardRecords (various types)
// ================================================================

import { PrismaClient } from '../../src/generated/prisma/client'

function deterministicUUID(ns: string, key: string): string {
  const str = `${ns}:${key}`
  let h = 0
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0 }
  const hex = Math.abs(h).toString(16).padStart(8, '0')
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(1, 4)}-${hex.padEnd(12, '0').slice(0, 12)}`
}

export async function seedDiscipline(prisma: PrismaClient) {
  console.log('📌 Seeding discipline & reward records...')

  // Get CTR company
  const company = await prisma.company.findFirst({ where: { code: 'CTR' } })
  if (!company) { console.log('  ⚠️ CTR-KR not found, skipping'); return }

  // Get some employees for discipline data
  const employees = await prisma.employee.findMany({
    where: {
      assignments: { some: { companyId: company.id, endDate: null } },
    },
    take: 10,
    select: { id: true, name: true, employeeNo: true },
  })

  if (employees.length < 6) {
    console.log(`  ⚠️ Only ${employees.length} employees found, need at least 6`)
    return
  }

  // HR admin as issuer
  const hrEmp = await prisma.employee.findFirst({
    where: { email: 'hr@ctr.co.kr' },
  })
  if (!hrEmp) { console.log('  ⚠️ HR employee not found'); return }

  // Manager as issuer for some
  const mgrEmp = await prisma.employee.findFirst({
    where: { email: 'manager@ctr.co.kr' },
  })
  if (!mgrEmp) { console.log('  ⚠️ Manager employee not found'); return }

  // ── Disciplinary Actions ──────────────────────────────────────
  const actions = [
    {
      key: 'disc-1',
      employeeId: employees[2].id,
      actionType: 'VERBAL_WARNING' as const,
      category: 'ATTENDANCE' as const,
      incidentDate: new Date('2026-01-15'),
      description: '무단 지각 3회 누적 (1월 5일, 10일, 15일)',
      decision: '구두 경고 조치',
      decisionDate: new Date('2026-01-17'),
      status: 'DISCIPLINE_ACTIVE' as const,
      appealStatus: 'NONE' as const,
      validMonths: 3,
      expiresAt: new Date('2026-04-17'),
      issuedById: mgrEmp!.id,
    },
    {
      key: 'disc-2',
      employeeId: employees[3].id,
      actionType: 'WRITTEN_WARNING' as const,
      category: 'SAFETY' as const,
      incidentDate: new Date('2026-02-03'),
      description: '안전 보호구 미착용으로 작업장 출입 (생산라인 B동)',
      decision: '서면 경고 및 안전교육 재이수 명령',
      decisionDate: new Date('2026-02-05'),
      status: 'DISCIPLINE_ACTIVE' as const,
      appealStatus: 'NONE' as const,
      validMonths: 6,
      expiresAt: new Date('2026-08-05'),
      issuedById: hrEmp.id,
    },
    {
      key: 'disc-3',
      employeeId: employees[4].id,
      actionType: 'REPRIMAND' as const,
      category: 'CONDUCT' as const,
      incidentDate: new Date('2025-11-20'),
      description: '사내 규정 위반 — 업무 시간 중 개인 사업 활동',
      committeeDate: new Date('2025-12-01'),
      committeeMembers: ['인사팀장', '법무팀장', '경영지원본부장'],
      decision: '견책 처분 및 6개월 승진 제한',
      decisionDate: new Date('2025-12-05'),
      status: 'DISCIPLINE_EXPIRED' as const,
      appealStatus: 'NONE' as const,
      validMonths: 6,
      expiresAt: new Date('2026-06-05'),
      issuedById: hrEmp.id,
    },
    {
      key: 'disc-4',
      employeeId: employees[5].id,
      actionType: 'SUSPENSION' as const,
      category: 'MISCONDUCT' as const,
      incidentDate: new Date('2026-02-20'),
      description: '고객 개인정보 무단 열람 및 외부 유출 시도',
      committeeDate: new Date('2026-03-01'),
      committeeMembers: ['인사팀장', '정보보안팀장', '대표이사'],
      decision: '3일 정직 처분',
      decisionDate: new Date('2026-03-03'),
      suspensionStart: new Date('2026-03-10'),
      suspensionEnd: new Date('2026-03-12'),
      status: 'DISCIPLINE_ACTIVE' as const,
      appealStatus: 'FILED' as const,
      appealDate: new Date('2026-03-14'),
      appealText: '개인정보 열람은 업무 목적이었으며 외부 유출 시도는 사실과 다릅니다.',
      validMonths: 12,
      expiresAt: new Date('2027-03-03'),
      issuedById: hrEmp.id,
    },
    {
      key: 'disc-5',
      employeeId: employees[6].id,
      actionType: 'WRITTEN_WARNING' as const,
      category: 'QUALITY' as const,
      incidentDate: new Date('2026-01-28'),
      description: '품질 검사 기준 미준수 — 불량률 기준치 초과 3회',
      decision: '서면 경고 및 품질교육 이수',
      decisionDate: new Date('2026-02-01'),
      status: 'DISCIPLINE_ACTIVE' as const,
      appealStatus: 'OVERTURNED' as const,
      appealDate: new Date('2026-02-10'),
      appealResult: '측정 장비 오류로 인한 오판정 확인, 징계 철회',
      validMonths: 6,
      expiresAt: new Date('2026-08-01'),
      issuedById: mgrEmp!.id,
    },
    {
      key: 'disc-6',
      employeeId: employees[7].id,
      actionType: 'VERBAL_WARNING' as const,
      category: 'POLICY_VIOLATION' as const,
      incidentDate: new Date('2026-03-05'),
      description: '회사 장비 사적 사용 — 회사 노트북으로 개인 프로젝트 진행',
      decision: '구두 경고',
      decisionDate: new Date('2026-03-07'),
      status: 'DISCIPLINE_ACTIVE' as const,
      appealStatus: 'NONE' as const,
      validMonths: 3,
      expiresAt: new Date('2026-06-07'),
      issuedById: mgrEmp!.id,
    },
  ]

  let discCount = 0
  for (const a of actions) {
    const id = deterministicUUID('discipline', a.key)
    const existing = await prisma.disciplinaryAction.findUnique({ where: { id } })
    if (!existing) {
      await prisma.disciplinaryAction.create({
        data: {
          id,
          employeeId: a.employeeId,
          companyId: company.id,
          actionType: a.actionType,
          category: a.category,
          incidentDate: a.incidentDate,
          description: a.description,
          committeeDate: a.committeeDate ?? null,
          committeeMembers: a.committeeMembers ? JSON.parse(JSON.stringify(a.committeeMembers)) : undefined,
          decision: a.decision,
          decisionDate: a.decisionDate,
          suspensionStart: a.suspensionStart ?? null,
          suspensionEnd: a.suspensionEnd ?? null,
          status: a.status,
          appealStatus: a.appealStatus,
          appealDate: a.appealDate ?? null,
          appealText: a.appealText ?? null,
          appealResult: a.appealResult ?? null,
          validMonths: a.validMonths,
          expiresAt: a.expiresAt,
          issuedById: a.issuedById,
        },
      })
      discCount++
    }
  }
  console.log(`  ✅ ${discCount} disciplinary actions created`)

  // ── Reward Records ────────────────────────────────────────────
  const rewards = [
    {
      key: 'reward-1',
      employeeId: employees[0].id,
      rewardType: 'COMMENDATION' as const,
      title: '2025년 하반기 우수사원 표창',
      description: '프로젝트 납기 준수 및 품질 개선 기여',
      awardedDate: new Date('2026-01-10'),
      awardedById: hrEmp.id,
    },
    {
      key: 'reward-2',
      employeeId: employees[1].id,
      rewardType: 'INNOVATION' as const,
      title: '업무 프로세스 혁신상',
      description: '재고 관리 자동화 시스템 도입으로 연간 2억원 절감',
      amount: 3000000,
      awardedDate: new Date('2026-02-15'),
      awardedById: hrEmp.id,
    },
    {
      key: 'reward-3',
      employeeId: employees[2].id,
      rewardType: 'LONG_SERVICE' as const,
      title: '장기근속 포상 (10년)',
      description: '입사 10주년 장기근속 포상',
      amount: 1000000,
      awardedDate: new Date('2026-03-01'),
      awardedById: hrEmp.id,
      serviceYears: 10,
    },
    {
      key: 'reward-4',
      employeeId: employees[8].id,
      rewardType: 'SAFETY_AWARD' as const,
      title: '무재해 500일 달성 공로상',
      description: '생산팀 무재해 500일 달성 기여',
      awardedDate: new Date('2026-01-20'),
      awardedById: mgrEmp!.id,
    },
    {
      key: 'reward-5',
      employeeId: employees[9].id,
      rewardType: 'CTR_VALUE_AWARD' as const,
      title: 'CTR Value Champion — 혁신',
      description: 'CTR 핵심 가치 "혁신" 부문 분기 수상자',
      awardedDate: new Date('2026-03-10'),
      awardedById: hrEmp.id,
      ctrValue: 'INNOVATION',
    },
  ]

  let rewardCount = 0
  for (const r of rewards) {
    const id = deterministicUUID('reward', r.key)
    const existing = await prisma.rewardRecord.findUnique({ where: { id } })
    if (!existing) {
      await prisma.rewardRecord.create({
        data: {
          id,
          employeeId: r.employeeId,
          companyId: company.id,
          rewardType: r.rewardType,
          title: r.title,
          description: r.description ?? null,
          amount: r.amount ?? null,
          awardedDate: r.awardedDate,
          awardedById: r.awardedById,
          serviceYears: r.serviceYears ?? null,
          ctrValue: r.ctrValue ?? null,
        },
      })
      rewardCount++
    }
  }
  console.log(`  ✅ ${rewardCount} reward records created`)
}
