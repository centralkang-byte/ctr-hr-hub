// ================================================================
// CTR HR Hub — Seed Data: Session B.2 — Succession Planning
// prisma/seeds/14-succession.ts
//
// Creates:
//   5 SuccessionPlans (CTR 3, CTR-CN 2)
//   ~10 SuccessionCandidates
// ================================================================

import { PrismaClient, Criticality, PlanStatus, Readiness } from '../../src/generated/prisma/client'

function deterministicUUID(ns: string, key: string): string {
    const str = `${ns}:${key}`
    let h = 0
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0 }
    const hex = Math.abs(h).toString(16).padStart(8, '0')
    return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(0, 3)}-${hex.padEnd(12, '0').slice(0, 12)}`
}

function sr(seed: number): number {
    const x = Math.sin(seed * 9301 + 49297) * 233280
    return x - Math.floor(x)
}

interface PlanDef {
    key: string
    positionTitle: string
    companyCode: string
    deptCode: string | null
    criticality: Criticality
    status: PlanStatus
    holderEmpNo: string | null
    notes: string
    candidateEmpNos: { empNo: string; readiness: Readiness; note: string; ranking: number }[]
}

// TODO: Move to Settings (Talent > Succession) — succession plan configuration
const PLANS: PlanDef[] = [
    {
        key: 'KR-PROD-HEAD',
        positionTitle: '생산본부장',
        companyCode: 'CTR',
        deptCode: 'MFG',
        criticality: 'CRITICAL',
        status: 'PLAN_ACTIVE',
        holderEmpNo: 'CTR-KR-2001',  // G2 production dept
        notes: '현 본부장 정년 3년 남음. 내부 육성 우선 전략.',
        candidateEmpNos: [
            { empNo: 'CTR-KR-3001', readiness: 'READY_1_2_YEARS', note: '생산관리 경험 10년, 리더십 역량 우수', ranking: 1 },
            { empNo: 'CTR-KR-3002', readiness: 'READY_3_PLUS_YEARS', note: '기술 전문성 높음, 관리 경험 보완 필요', ranking: 2 },
            { empNo: 'CTR-KR-3003', readiness: 'READY_3_PLUS_YEARS', note: '성장 가능성 높음, 리더십 멘토링 중', ranking: 3 },
        ],
    },
    {
        key: 'KR-QA-LEAD',
        positionTitle: '품질관리팀장',
        companyCode: 'CTR',
        deptCode: 'QA',
        criticality: 'HIGH',
        status: 'PLAN_ACTIVE',
        holderEmpNo: 'CTR-KR-2002',
        notes: '현 팀장 이직 위험 중간. 핵심 포지션 공백 대비 필요.',
        candidateEmpNos: [
            { empNo: 'CTR-KR-3010', readiness: 'READY_NOW', note: 'ISO 전문가, 즉시 대체 가능', ranking: 1 },
            { empNo: 'CTR-KR-3011', readiness: 'READY_1_2_YEARS', note: 'QA 실무 경험 보유, 관리 역량 개발 중', ranking: 2 },
        ],
    },
    {
        key: 'KR-RND-CENTER',
        positionTitle: 'R&D센터장',
        companyCode: 'CTR',
        deptCode: 'RANDD',
        criticality: 'HIGH',
        status: 'PLAN_DRAFT',
        holderEmpNo: null,
        notes: '신설 포지션 대비 승계 계획 초안 작성 중.',
        candidateEmpNos: [
            { empNo: 'CTR-KR-3015', readiness: 'READY_3_PLUS_YEARS', note: '박사급 연구원, 장기 육성 대상', ranking: 1 },
            { empNo: 'CTR-KR-3016', readiness: 'READY_3_PLUS_YEARS', note: '기술 특허 보유, 추가 리더십 교육 필요', ranking: 2 },
        ],
    },
    {
        key: 'CN-GM',
        positionTitle: '总经理 (General Manager)',
        companyCode: 'CTR-CN',
        deptCode: null,
        criticality: 'CRITICAL',
        status: 'PLAN_ACTIVE',
        holderEmpNo: null,
        notes: '현지 법인 최고 책임자 후계자 준비. 본사 파견 또는 현지 승진 검토 중.',
        candidateEmpNos: [
            { empNo: 'CTR-CN-1001', readiness: 'READY_1_2_YEARS', note: '현지 네트워크 강점, 본사 연수 필요', ranking: 1 },
            { empNo: 'CTR-CN-1002', readiness: 'READY_3_PLUS_YEARS', note: '재무/법무 전문성 보유, 전략 경험 부족', ranking: 2 },
        ],
    },
    {
        key: 'CN-HR-MGR',
        positionTitle: '人事经理 (HR Manager)',
        companyCode: 'CTR-CN',
        deptCode: null,
        criticality: 'MEDIUM',
        status: 'PLAN_ACTIVE',
        holderEmpNo: null,
        notes: '현지 HR 역량 내재화를 위한 승계 계획.',
        candidateEmpNos: [
            { empNo: 'CTR-CN-1003', readiness: 'READY_1_2_YEARS', note: '인사관리 실무 경험 3년, 리더십 역량 개발 중', ranking: 1 },
        ],
    },
]

// ────────────────────────────────────────────────────────────
export async function seedSuccession(prisma: PrismaClient): Promise<void> {
    console.log('\n🏆 Session B.2: Seeding succession planning data...\n')

    const krCo = await prisma.company.findFirst({ where: { code: 'CTR' } })
    const cnCo = await prisma.company.findFirst({ where: { code: 'CTR-CN' } })
    if (!krCo) { console.error('  ❌ CTR-KR not found'); return }
    const krId = krCo.id
    const cnId = cnCo?.id

    // HR creator
    const hrEmp = await prisma.employee.findFirst({ where: { employeeNo: 'CTR-KR-0001' } })
    if (!hrEmp) { console.error('  ❌ HR employee not found'); return }
    const hrId = hrEmp.id

    // CN creator fallback
    const cnEmp = await prisma.employee.findFirst({
        where: { employeeNo: { startsWith: 'CTR-CN' } },
    })
    const cnCreatorId = cnEmp?.id ?? hrId

    // Dept map
    const deptRows = await prisma.department.findMany({
        where: { companyId: { in: [krId, ...(cnId ? [cnId] : [])] } },
        select: { id: true, code: true, companyId: true },
    })
    const deptMap: Record<string, string> = {}
    for (const d of deptRows) deptMap[`${d.companyId}:${d.code}`] = d.id

    let planCount = 0
    let candidateCount = 0

    for (const p of PLANS) {
        const companyId = p.companyCode === 'CTR-CN' ? cnId : krId
        if (!companyId) continue

        // Resolve department
        const departmentId = p.deptCode ? deptMap[`${companyId}:${p.deptCode}`] : undefined

        // Resolve current holder
        let currentHolderId: string | null = null
        if (p.holderEmpNo) {
            const holder = await prisma.employee.findFirst({ where: { employeeNo: p.holderEmpNo } })
            currentHolderId = holder?.id ?? null
        }

        const planId = deterministicUUID('succplan', p.key)
        const existing = await prisma.successionPlan.findFirst({ where: { id: planId } })

        if (!existing) {
            await prisma.successionPlan.create({
                data: {
                    id: planId,
                    positionTitle: p.positionTitle,
                    companyId,
                    departmentId: departmentId ?? null,
                    criticality: p.criticality,
                    status: p.status,
                    currentHolderId,
                    notes: p.notes,
                    createdBy: p.companyCode === 'CTR-CN' ? cnCreatorId : hrId,
                },
            })
            planCount++
        }

        // Candidates
        for (const c of p.candidateEmpNos) {
            const candidateEmp = await prisma.employee.findFirst({ where: { employeeNo: c.empNo } })
            if (!candidateEmp) {
                console.log(`    ⚠ ${c.empNo} not found, skipping candidate`)
                continue
            }

            const candId = deterministicUUID('succcand', `${p.key}:${c.empNo}`)
            const existsCand = await prisma.successionCandidate.findFirst({ where: { id: candId } })
            if (!existsCand) {
                await prisma.successionCandidate.create({
                    data: {
                        id: candId,
                        planId,
                        employeeId: candidateEmp.id,
                        readiness: c.readiness,
                        developmentAreas: { focus: ['리더십', '전략 기획', '변화관리'] },
                        notes: c.note,
                        ranking: c.ranking,
                        developmentNote: c.note,
                        nominatedBy: p.companyCode === 'CTR-CN' ? cnCreatorId : hrId,
                    },
                })
                candidateCount++
            }
        }
    }

    const totalPlans = await prisma.successionPlan.count()
    const totalCands = await prisma.successionCandidate.count()

    console.log('\n======================================')
    console.log('🏆 Succession Seed Complete!')
    console.log('======================================')
    console.log(`  SuccessionPlans:      ${totalPlans} (new: ${planCount})`)
    console.log(`  SuccessionCandidates: ${totalCands} (new: ${candidateCount})`)
    console.log('======================================\n')
}
