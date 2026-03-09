// ================================================================
// CTR HR Hub — Seed Data Expansion: Session 3 — Performance
// prisma/seeds/05-performance.ts
//
// Creates:
//   STEP A: 2 PerformanceCycles (2025-H2 CLOSED, 2026-H1 ACTIVE)
//   STEP B: MboGoals for 2025-H2 (all APPROVED)
//   STEP C: PerformanceEvaluation SELF + MANAGER (status CONFIRMED)
//   STEP D: MboGoals for 2026-H1 (mixed DRAFT/PENDING/APPROVED)
//   STEP E: CalibrationSession for 2025-H2
// ================================================================

import { CycleStatus, EvalStatus, EvalType, GoalStatus, PrismaClient } from '../../src/generated/prisma/client'

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

function sr(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

// ── Persona → grade/score mapping ────────────────────────────
const PERSONA_GRADE: Record<string, { grade: string; scoreMin: number; scoreMax: number }> = {
  P1:  { grade: 'A',  scoreMin: 4.0, scoreMax: 4.8 },
  P2:  { grade: 'Bp', scoreMin: 3.5, scoreMax: 4.2 },
  P3:  { grade: 'Bp', scoreMin: 3.0, scoreMax: 3.8 },
  P4:  { grade: 'B',  scoreMin: 3.0, scoreMax: 3.5 },
  P5:  { grade: 'C',  scoreMin: 2.5, scoreMax: 3.2 },
  P6:  { grade: 'B',  scoreMin: 3.0, scoreMax: 3.5 },
  P8:  { grade: 'B',  scoreMin: 3.2, scoreMax: 4.0 },
  P9:  { grade: 'A',  scoreMin: 3.8, scoreMax: 4.5 },
  P10: { grade: 'B',  scoreMin: 2.8, scoreMax: 3.3 },
}

// Override top performers to S grade (first ~3% alphabetically)
const S_GRADE_EMPLOYEES = new Set(['CTR-KR-0002', 'CTR-KR-3017', 'CTR-KR-3029'])
const A_GRADE_FALLBACK  = new Set(['CTR-KR-0001', 'CTR-KR-0003'])

function getGrade(empNo: string, persona: string, seed: number): { grade: string; score: number } {
  if (S_GRADE_EMPLOYEES.has(empNo)) return { grade: 'S', score: 4.5 + sr(seed) * 0.5 }
  if (A_GRADE_FALLBACK.has(empNo)) return { grade: 'A', score: 4.0 + sr(seed) * 0.5 }
  const p = PERSONA_GRADE[persona] ?? PERSONA_GRADE['P1']
  const score = p.scoreMin + sr(seed) * (p.scoreMax - p.scoreMin)
  return { grade: p.grade, score: Math.round(score * 100) / 100 }
}

// ── KR Persona map (same as Session 2) ───────────────────────
const KR_PERSONA: Record<string, string> = {
  'CTR-KR-0001':'P1','CTR-KR-0002':'P9','CTR-KR-0003':'P1',
  'CTR-KR-2001':'P8','CTR-KR-2002':'P8','CTR-KR-2003':'P8',
  'CTR-KR-2004':'P8','CTR-KR-2005':'P8','CTR-KR-2006':'P8',
  'CTR-KR-3001':'P8','CTR-KR-3002':'P8','CTR-KR-3003':'P8',
  'CTR-KR-3004':'P3','CTR-KR-3005':'P3','CTR-KR-3006':'P2',
  'CTR-KR-3007':'P2','CTR-KR-3008':'P8','CTR-KR-3009':'P8',
  'CTR-KR-3010':'P1','CTR-KR-3011':'P6','CTR-KR-3012':'P6',
  'CTR-KR-3013':'P4','CTR-KR-3014':'P1','CTR-KR-3015':'P7',
  'CTR-KR-3016':'P5','CTR-KR-3017':'P9','CTR-KR-3018':'P9',
  'CTR-KR-3019':'P1','CTR-KR-3020':'P1','CTR-KR-3021':'P2',
  'CTR-KR-3022':'P2','CTR-KR-3023':'P5','CTR-KR-3024':'P4',
  'CTR-KR-3025':'P4','CTR-KR-3026':'P1','CTR-KR-3027':'P6',
  'CTR-KR-3028':'P3','CTR-KR-3029':'P9','CTR-KR-3030':'P9',
  'CTR-KR-3031':'P1','CTR-KR-3032':'P1','CTR-KR-3033':'P2',
  'CTR-KR-3034':'P5','CTR-KR-3035':'P8','CTR-KR-3036':'P8',
  'CTR-KR-3037':'P4','CTR-KR-3038':'P6','CTR-KR-3039':'P9',
  'CTR-KR-3040':'P9','CTR-KR-3041':'P1','CTR-KR-3042':'P2',
  'CTR-KR-3043':'P5','CTR-KR-3044':'P5','CTR-KR-3045':'P4',
  'CTR-KR-3046':'P6','CTR-KR-3047':'P1','CTR-KR-3048':'P9',
  'CTR-KR-3049':'P2','CTR-KR-3050':'P1','CTR-KR-3051':'P1',
  'CTR-KR-3052':'P4','CTR-KR-3053':'P5','CTR-KR-3054':'P6',
  'CTR-KR-3055':'P9','CTR-KR-3056':'P1','CTR-KR-3057':'P1',
  'CTR-KR-3058':'P2','CTR-KR-3059':'P4','CTR-KR-3060':'P6',
  'CTR-KR-3061':'P9','CTR-KR-3062':'P1','CTR-KR-3063':'P1',
  'CTR-KR-3064':'P7','CTR-KR-3065':'P5','CTR-KR-3066':'P9',
  'CTR-KR-3067':'P1','CTR-KR-3068':'P4','CTR-KR-3069':'P9',
  'CTR-KR-3070':'P10',
}

// ── Department-based MBO goal templates ──────────────────────
interface GoalTemplate { title: string; weight: number; metric: string }

const DEPT_GOALS: Record<string, GoalTemplate[]> = {
  MFG: [
    { title: '생산성 향상', weight: 35, metric: '${UPH 기준 목표 대비 달성률}' },
    { title: '불량률 감소', weight: 25, metric: '${불량률 0.5% 이하}' },
    { title: '안전사고 Zero', weight: 20, metric: '${안전사고 0건}' },
    { title: '5S 활동 참여', weight: 20, metric: '${5S 점검 점수 90점 이상}' },
  ],
  QA: [
    { title: '품질 검사 합격률', weight: 30, metric: '${합격률 98% 이상}' },
    { title: '고객 클레임 감소', weight: 30, metric: '${클레임 건수 전기 대비 20% 감소}' },
    { title: 'ISO 감사 대응', weight: 20, metric: '${ISO 9001 감사 적합 판정}' },
    { title: '검사 프로세스 개선', weight: 20, metric: '${개선 과제 2건 이상 완료}' },
  ],
  RANDD: [
    { title: '신규 기술 개발', weight: 35, metric: '${R&D 과제 1건 이상 완료}' },
    { title: '특허 출원', weight: 25, metric: '${특허 출원 1건 이상}' },
    { title: '프로젝트 일정 준수', weight: 20, metric: '${일정 준수율 90% 이상}' },
    { title: '기술 문서화', weight: 20, metric: '${기술 보고서 분기별 제출}' },
  ],
  SALES: [
    { title: '매출 목표 달성', weight: 40, metric: '${매출 목표 100% 달성}' },
    { title: '신규 고객 발굴', weight: 25, metric: '${신규 거래처 3개 이상 확보}' },
    { title: '고객 만족도 유지', weight: 20, metric: '${고객 만족도 85점 이상}' },
    { title: 'CRM 활용도', weight: 15, metric: '${CRM 입력률 95% 이상}' },
  ],
  DEV: [
    { title: '개발 일정 준수', weight: 35, metric: '${스프린트 완료율 90% 이상}' },
    { title: '코드 품질 개선', weight: 25, metric: '${버그 발생률 전기 대비 20% 감소}' },
    { title: '기술 역량 향상', weight: 20, metric: '${기술 교육 이수 40시간 이상}' },
    { title: '팀 협업 기여', weight: 20, metric: '${코드 리뷰 참여율 80% 이상}' },
  ],
  PUR: [
    { title: '구매 원가 절감', weight: 35, metric: '${원가 절감률 3% 이상}' },
    { title: '납기 준수율', weight: 30, metric: '${납기 준수율 95% 이상}' },
    { title: '공급업체 관리', weight: 20, metric: '${우수 공급업체 3개 이상 확보}' },
    { title: '구매 프로세스 개선', weight: 15, metric: '${개선 과제 1건 이상 완료}' },
  ],
  FIN: [
    { title: '결산 마감 준수', weight: 35, metric: '${결산 마감일 100% 준수}' },
    { title: '예산 관리', weight: 30, metric: '${예산 집행 효율 95% 이상}' },
    { title: '내부 통제 강화', weight: 20, metric: '${내부감사 지적사항 0건}' },
    { title: '재무 리포팅 개선', weight: 15, metric: '${월간 재무보고서 적시 제출}' },
  ],
  HR: [
    { title: '채용 목표 달성', weight: 35, metric: '${채용 계획 대비 90% 이상 완료}' },
    { title: '직원 유지율', weight: 30, metric: '${자발적 이직률 5% 이하}' },
    { title: '교육 이수율', weight: 20, metric: '${법정 의무교육 이수율 100%}' },
    { title: 'HR 시스템 활용', weight: 15, metric: '${데이터 정확도 99% 이상}' },
  ],
  MGMT: [
    { title: '경영 목표 달성', weight: 40, metric: '${사업부 KPI 100% 달성}' },
    { title: '조직 역량 강화', weight: 30, metric: '${팀 역량평가 평균 3.5점 이상}' },
    { title: '예산 효율 관리', weight: 30, metric: '${예산 대비 집행률 95% 이내}' },
  ],
  DEFAULT: [
    { title: '업무 목표 달성', weight: 40, metric: '${주요 목표 100% 달성}' },
    { title: '업무 역량 향상', weight: 30, metric: '${연간 교육 20시간 이수}' },
    { title: '팀 협업 기여', weight: 30, metric: '${팀 평가 3.5점 이상}' },
  ],
}

const SELF_COMMENTS = [
  '목표 달성을 위해 최선을 다했으며, 담당 업무에서 가시적 성과를 냈습니다.',
  '팀 협업과 소통에 적극적으로 참여하며 조직문화에 기여했습니다.',
  '기술 역량 향상을 위한 교육 이수 및 자기개발에 노력했습니다.',
  '하반기 프로젝트에서 일정 내 목표를 달성했습니다.',
  '개선 필요 사항을 인식하고 다음 기에 반영하겠습니다.',
  '적극적인 자세로 업무에 임했으며 팀에 기여했습니다.',
]
const MANAGER_COMMENTS = [
  '맡은 업무에 대해 책임감 있게 수행하였습니다.',
  '팀 내 기여도가 높으며 후배 지도에도 적극적입니다.',
  '목표 달성도는 기대 수준을 충족했습니다.',
  '시간 관리 및 업무 우선순위 설정에 일부 개선이 필요합니다.',
  '기술적 역량은 우수하나 커뮤니케이션 향상이 기대됩니다.',
  '성실하게 업무에 임하는 자세가 돋보입니다.',
]

// EMS block mapping from score
function emsBlock(perfScore: number, compScore: number): string {
  const pf = perfScore >= 4.0 ? 'H' : perfScore >= 3.0 ? 'M' : 'L'
  const cf = compScore >= 4.0 ? 'H' : compScore >= 3.0 ? 'M' : 'L'
  return `${pf}${cf}` // e.g. "HH", "HM", "MH", etc.
}

// ────────────────────────────────────────────────────────────
export async function seedPerformance(prisma: PrismaClient): Promise<void> {
  console.log('\n🎯 Session 3: Seeding performance cycles, goals, evaluations...\n')

  // Company IDs
  const krCo = await prisma.company.findFirst({ where: { code: 'CTR-KR' } })
  const cnCo = await prisma.company.findFirst({ where: { code: 'CTR-CN' } })
  if (!krCo) { console.error('  ❌ CTR-KR not found'); return }
  const krId = krCo.id
  const cnId = cnCo?.id

  // HR manager as fallback approver/evaluator
  const hrManager = await prisma.employee.findFirst({ where: { employeeNo: 'CTR-KR-0002' } })
  const fallbackMgrId = hrManager?.id ?? ''

  // ── STEP A: Performance Cycles ────────────────────────────
  console.log('📌 Creating performance cycles...')

  const cycle2025H2Id = deterministicUUID('cycle', 'CTR-KR:2025:H2')
  const cycle2026H1Id = deterministicUUID('cycle', 'CTR-KR:2026:H1')
  const cycle2025CnId = cnId ? deterministicUUID('cycle', 'CTR-CN:2025:ANNUAL') : null

  await prisma.performanceCycle.upsert({
    where:  { id: cycle2025H2Id },
    update: { status: 'CLOSED' },
    create: {
      id:        cycle2025H2Id,
      companyId: krId,
      name:      '2025년 하반기 성과평가',
      year:      2025,
      half:      'H2',
      goalStart: new Date('2025-07-01'),
      goalEnd:   new Date('2025-08-15'),
      evalStart: new Date('2025-12-01'),
      evalEnd:   new Date('2025-12-31'),
      status:    'CLOSED',
    },
  })

  await prisma.performanceCycle.upsert({
    where:  { id: cycle2026H1Id },
    update: { status: 'ACTIVE' },
    create: {
      id:        cycle2026H1Id,
      companyId: krId,
      name:      '2026년 상반기 성과평가',
      year:      2026,
      half:      'H1',
      goalStart: new Date('2026-01-01'),
      goalEnd:   new Date('2026-02-15'),
      evalStart: new Date('2026-06-01'),
      evalEnd:   new Date('2026-06-30'),
      status:    'ACTIVE',
    },
  })

  if (cnId && cycle2025CnId) {
    await prisma.performanceCycle.upsert({
      where:  { id: cycle2025CnId },
      update: { status: 'CLOSED' },
      create: {
        id:        cycle2025CnId,
        companyId: cnId,
        name:      '2025年度绩效考核',
        year:      2025,
        half:      'ANNUAL',
        goalStart: new Date('2025-01-01'),
        goalEnd:   new Date('2025-02-28'),
        evalStart: new Date('2025-12-01'),
        evalEnd:   new Date('2025-12-31'),
        status:    'CLOSED',
      },
    })
  }

  console.log('  ✅ 3 performance cycles (2025-H2 CLOSED, 2026-H1 ACTIVE, CN-2025 CLOSED)')

  // ── Fetch KR active employees ─────────────────────────────
  const krAssignments = await prisma.employeeAssignment.findMany({
    where:  { companyId: krId, isPrimary: true, endDate: null, status: { not: 'TERMINATED' } },
    select: {
      employeeId: true,
      departmentId: true,
      employee:   { select: { employeeNo: true, hireDate: true } },
      department: { select: { code: true } },
    },
  })

  // Filter for 2025-H2: exclude P7 and P4 hired after 2025-07-01
  const CYCLE_START = new Date('2025-07-01')
  const eligibleFor2025H2 = krAssignments.filter(a => {
    const empNo  = a.employee.employeeNo
    const persona = KR_PERSONA[empNo] ?? 'P1'
    if (persona === 'P7') return false  //육아휴직
    if (persona === 'P4' && a.employee.hireDate > CYCLE_START) return false  // 신입 입사 후
    return true
  })

  console.log(`  Eligible KR employees for 2025-H2: ${eligibleFor2025H2.length}`)

  // Build dept → dept code map
  const deptCodeMap: Record<string, string> = {}
  for (const a of krAssignments) {
    if (a.departmentId && a.department?.code) {
      deptCodeMap[a.departmentId] = a.department.code
    }
  }

  // ── STEP B: MBO Goals for 2025-H2 ────────────────────────
  console.log('📌 Seeding MBO goals for 2025-H2...')
  let goalCount2025 = 0

  for (let ei = 0; ei < eligibleFor2025H2.length; ei++) {
    const asgn    = eligibleFor2025H2[ei]
    const empNo   = asgn.employee.employeeNo
    const empId   = asgn.employeeId
    const deptCode = asgn.department?.code ?? 'DEFAULT'
    const templates = DEPT_GOALS[deptCode] ?? DEPT_GOALS['DEFAULT']

    // Normalize weights to exactly 100
    const totalW = templates.reduce((s, t) => s + t.weight, 0)
    let remaining = 100

    for (let gi = 0; gi < templates.length; gi++) {
      const t = templates[gi]
      const isLast = gi === templates.length - 1
      const weight = isLast ? remaining : Math.round((t.weight / totalW) * 100)
      remaining -= isLast ? 0 : weight

      const score = 2.5 + sr(ei * 100 + gi + 1) * 2.5
      const goalId = deterministicUUID('goal', `2025H2:${empNo}:${gi}`)

      const existing = await prisma.mboGoal.findFirst({ where: { id: goalId } })
      if (!existing) {
        await prisma.mboGoal.create({
          data: {
            id:               goalId,
            cycleId:          cycle2025H2Id,
            employeeId:       empId,
            companyId:        krId,
            title:            t.title,
            description:      t.metric,
            weight:           weight,
            targetMetric:     t.metric,
            status:           'APPROVED',
            achievementScore: Math.round(score * 100) / 100,
            approvedBy:       fallbackMgrId || undefined,
            approvedAt:       new Date('2025-08-20'),
          },
        })
        goalCount2025++
      }
    }
  }
  console.log(`  ✅ ${goalCount2025} MBO goals (2025-H2)`)

  // ── STEP C: PerformanceEvaluation for 2025-H2 ────────────
  console.log('📌 Seeding performance evaluations (2025-H2)...')
  let evalCount = 0
  let gradeCount: Record<string, number> = { S: 0, A: 0, Bp: 0, B: 0, C: 0 }

  for (let ei = 0; ei < eligibleFor2025H2.length; ei++) {
    const asgn    = eligibleFor2025H2[ei]
    const empNo   = asgn.employee.employeeNo
    const empId   = asgn.employeeId
    const persona = KR_PERSONA[empNo] ?? 'P1'
    const { grade, score } = getGrade(empNo, persona, ei * 777 + 13)

    // Competency score slightly different from perf score
    const compScore = Math.max(1.0, score + (sr(ei * 333 + 7) - 0.5) * 0.6)
    const block = emsBlock(score, compScore)

    // Self score: slightly inflated
    const selfPerfScore  = Math.min(5.0, score + sr(ei * 111 + 3) * 0.5)
    const selfCompScore  = Math.min(5.0, compScore + sr(ei * 222 + 5) * 0.4)
    const selfComment    = SELF_COMMENTS[ei % SELF_COMMENTS.length]
    const mgrComment     = MANAGER_COMMENTS[ei % MANAGER_COMMENTS.length]
    const selfEvalId     = deterministicUUID('eval', `2025H2:${empNo}:SELF`)
    const mgrEvalId      = deterministicUUID('eval', `2025H2:${empNo}:MANAGER`)

    gradeCount[grade] = (gradeCount[grade] ?? 0) + 1

    // SELF evaluation
    const existingSelf = await prisma.performanceEvaluation.findFirst({ where: { id: selfEvalId } })
    if (!existingSelf) {
      await prisma.performanceEvaluation.create({
        data: {
          id:               selfEvalId,
          cycleId:          cycle2025H2Id,
          employeeId:       empId,
          evaluatorId:      empId, // self
          companyId:        krId,
          evalType:         'SELF',
          performanceScore: Math.round(selfPerfScore * 100) / 100,
          competencyScore:  Math.round(selfCompScore * 100) / 100,
          performanceGrade: grade,
          competencyGrade:  grade,
          emsBlock:         block,
          comment:          selfComment,
          status:           'CONFIRMED',
          submittedAt:      new Date('2025-12-10'),
        },
      })
      evalCount++
    }

    // MANAGER evaluation
    const existingMgr = await prisma.performanceEvaluation.findFirst({ where: { id: mgrEvalId } })
    if (!existingMgr) {
      await prisma.performanceEvaluation.create({
        data: {
          id:               mgrEvalId,
          cycleId:          cycle2025H2Id,
          employeeId:       empId,
          evaluatorId:      fallbackMgrId || empId,
          companyId:        krId,
          evalType:         'MANAGER',
          performanceScore: Math.round(score * 100) / 100,
          competencyScore:  Math.round(compScore * 100) / 100,
          performanceGrade: grade,
          competencyGrade:  grade,
          emsBlock:         block,
          comment:          mgrComment,
          status:           'CONFIRMED',
          submittedAt:      new Date('2025-12-20'),
        },
      })
      evalCount++
    }
  }

  console.log(`  ✅ ${evalCount} evaluations (SELF + MANAGER)`)
  console.log(`  Grade distribution: S=${gradeCount['S'] ?? 0}, A=${gradeCount['A'] ?? 0}, B+=${gradeCount['Bp'] ?? 0}, B=${gradeCount['B'] ?? 0}, C=${gradeCount['C'] ?? 0}`)

  // ── STEP D: MBO Goals for 2026-H1 (mixed status) ─────────
  console.log('📌 Seeding MBO goals for 2026-H1...')
  let goalCount2026 = 0

  // All active employees (including P4 new hires)
  for (let ei = 0; ei < krAssignments.length; ei++) {
    const asgn    = krAssignments[ei]
    const empNo   = asgn.employee.employeeNo
    const empId   = asgn.employeeId
    const persona = KR_PERSONA[empNo] ?? 'P1'
    if (persona === 'P7') continue

    const deptCode  = asgn.department?.code ?? 'DEFAULT'
    const templates = DEPT_GOALS[deptCode] ?? DEPT_GOALS['DEFAULT']
    const totalW    = templates.reduce((s, t) => s + t.weight, 0)
    let remaining   = 100

    for (let gi = 0; gi < templates.length; gi++) {
      const t = templates[gi]
      const isLast = gi === templates.length - 1
      const weight = isLast ? remaining : Math.round((t.weight / totalW) * 100)
      remaining -= isLast ? 0 : weight

      // Status distribution: 60% APPROVED, 25% PENDING, 15% DRAFT
      const rnd = sr(ei * 200 + gi * 13 + 5)
      let goalStatus: GoalStatus
      if (rnd < 0.60) goalStatus = 'APPROVED'
      else if (rnd < 0.85) goalStatus = 'PENDING_APPROVAL'
      else goalStatus = 'DRAFT'

      const goalId = deterministicUUID('goal', `2026H1:${empNo}:${gi}`)
      const existing = await prisma.mboGoal.findFirst({ where: { id: goalId } })
      if (!existing) {
        await prisma.mboGoal.create({
          data: {
            id:          goalId,
            cycleId:     cycle2026H1Id,
            employeeId:  empId,
            companyId:   krId,
            title:       t.title,
            description: t.metric,
            weight:      weight,
            targetMetric:t.metric,
            status:      goalStatus,
            approvedBy:  goalStatus === 'APPROVED' ? (fallbackMgrId || undefined) : undefined,
            approvedAt:  goalStatus === 'APPROVED' ? new Date('2026-02-10') : undefined,
          },
        })
        goalCount2026++
      }
    }
  }
  console.log(`  ✅ ${goalCount2026} MBO goals (2026-H1)`)

  // ── STEP E: CalibrationSession for 2025-H2 ───────────────
  console.log('📌 Seeding calibration session (2025-H2)...')

  const hrEmployee = await prisma.employee.findFirst({ where: { employeeNo: 'CTR-KR-0001' } })
  const creatorId  = hrEmployee?.id ?? fallbackMgrId

  if (creatorId) {
    const calibId = deterministicUUID('calibsess', 'CTR-KR:2025H2:ALL')
    const existing = await prisma.calibrationSession.findFirst({ where: { id: calibId } })
    if (!existing) {
      await prisma.calibrationSession.create({
        data: {
          id:           calibId,
          cycleId:      cycle2025H2Id,
          companyId:    krId,
          name:         '2025 H2 전체 캘리브레이션',
          status:       'CALIBRATION_COMPLETED',
          createdBy:    creatorId,
          completedAt:  new Date('2025-12-28'),
          blockDistribution: {
            SS: gradeCount['S'],
            AA: gradeCount['A'],
            Bp: gradeCount['Bp'],
            BB: gradeCount['B'],
            CC: gradeCount['C'],
          },
          notes: '2025년 하반기 전체 캘리브레이션 완료. 강제배분 기준 내 분포 확인.',
        },
      })
    }
    console.log('  ✅ 1 calibration session')
  }

  // ── Summary ───────────────────────────────────────────────
  const totalCycles = await prisma.performanceCycle.count()
  const totalGoals  = await prisma.mboGoal.count()
  const totalEvals  = await prisma.performanceEvaluation.count()

  console.log('\n======================================')
  console.log('🎯 Performance Seed Complete!')
  console.log('======================================')
  console.log(`  Performance cycles:  ${totalCycles}`)
  console.log(`  MBO goals:           ${totalGoals}`)
  console.log(`    2025-H2 goals:     ${goalCount2025}`)
  console.log(`    2026-H1 goals:     ${goalCount2026}`)
  console.log(`  Evaluations:         ${totalEvals}`)
  console.log(`  Grade dist (2025H2): S=${gradeCount['S'] ?? 0} A=${gradeCount['A'] ?? 0} Bp=${gradeCount['Bp'] ?? 0} B=${gradeCount['B'] ?? 0} C=${gradeCount['C'] ?? 0}`)
  console.log('======================================\n')
}
