// ================================================================
// CTR HR Hub — GP#4 Seed: Performance Pipeline Foundation
// prisma/seeds/18-performance-pipeline.ts
//
// Creates:
//   STEP A: EmployeeLevelMapping (KR + US) — L1~L5 + EXEC
//   STEP B: Merit Matrix seed data (4 grades × 3 bands = 12 rows per company)
//   STEP C: PerformanceReview records for 2026-H1 cycle
// ================================================================

import { PrismaClient, ReviewStatus } from '../../src/generated/prisma/client'

function deterministicUUID(namespace: string, key: string): string {
    const str = `${namespace}:${key}`
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + chr
        hash |= 0
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0')
    return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(1, 4)}-${hex.padEnd(12, '0').slice(0, 12)}`
}

export async function seedPerformancePipeline(prisma: PrismaClient) {
    console.log('\n🎯 GP#4: Seeding performance pipeline foundation...\n')

    // ─── Find companies ────────────────────────────────────
    const krCo = await prisma.company.findFirst({ where: { code: 'CTR' } })
    const usCo = await prisma.company.findFirst({ where: { code: 'CTR-US' } })
    if (!krCo) {
        console.log('  ⚠️  CTR-KR not found, skipping GP#4 seed')
        return
    }

    // ═══ STEP A: EmployeeLevelMapping ═══════════════════════
    console.log('📌 STEP A: EmployeeLevelMapping...')

    // KR grade codes: G1 (사원) ~ G6 (임원)
    const krMappings = [
        { code: 'G6', level: 'L1', mbo: null, bei: null },   // 사원 — use cycle default
        { code: 'G5', level: 'L2', mbo: null, bei: null },   // 대리
        { code: 'G4', level: 'L3', mbo: null, bei: null },   // 과장
        { code: 'G3', level: 'L4', mbo: null, bei: null },   // 차장
        { code: 'G2', level: 'L5', mbo: null, bei: null },   // 부장
        { code: 'G1', level: 'EXEC', mbo: 70, bei: 30 },     // 임원 — result-oriented
    ]

    let krLevelCount = 0
    for (const m of krMappings) {
        try {
            await prisma.employeeLevelMapping.upsert({
                where: {
                    companyId_jobGradeCode: {
                        companyId: krCo.id,
                        jobGradeCode: m.code,
                    },
                },
                update: {
                    levelCode: m.level,
                    mboWeight: m.mbo,
                    beiWeight: m.bei,
                },
                create: {
                    companyId: krCo.id,
                    jobGradeCode: m.code,
                    levelCode: m.level,
                    mboWeight: m.mbo,
                    beiWeight: m.bei,
                },
            })
            krLevelCount++
        } catch { /* skip if grade code doesn't exist */ }
    }
    console.log(`  ✅ KR level mappings: ${krLevelCount}`)

    // US grade codes (S1~S6 based on existing seed data)
    if (usCo) {
        const usMappings = [
            { code: 'S6', level: 'L1', mbo: null, bei: null },
            { code: 'S5', level: 'L2', mbo: null, bei: null },
            { code: 'S4', level: 'L3', mbo: null, bei: null },
            { code: 'S3', level: 'L4', mbo: null, bei: null },
            { code: 'S2', level: 'L5', mbo: null, bei: null },
            { code: 'S1', level: 'EXEC', mbo: 70, bei: 30 },
        ]

        let usLevelCount = 0
        for (const m of usMappings) {
            try {
                await prisma.employeeLevelMapping.upsert({
                    where: {
                        companyId_jobGradeCode: {
                            companyId: usCo.id,
                            jobGradeCode: m.code,
                        },
                    },
                    update: {
                        levelCode: m.level,
                        mboWeight: m.mbo,
                        beiWeight: m.bei,
                    },
                    create: {
                        companyId: usCo.id,
                        jobGradeCode: m.code,
                        levelCode: m.level,
                        mboWeight: m.mbo,
                        beiWeight: m.bei,
                    },
                })
                usLevelCount++
            } catch { /* skip */ }
        }
        console.log(`  ✅ US level mappings: ${usLevelCount}`)
    }

    // ═══ STEP B: Merit Matrix ═══════════════════════════════
    console.log('\n📌 STEP B: Merit Matrix (4 grades × 3 bands)...')

    // Design spec v1.1 Section 13 — default merit matrix
    const meritData = [
        { grade: 'E', band: 'LOW', min: 8, max: 10, rec: 9 },
        { grade: 'E', band: 'MID', min: 6, max: 8, rec: 7 },
        { grade: 'E', band: 'HIGH', min: 4, max: 6, rec: 5 },
        { grade: 'M_PLUS', band: 'LOW', min: 5, max: 7, rec: 6 },
        { grade: 'M_PLUS', band: 'MID', min: 4, max: 6, rec: 5 },
        { grade: 'M_PLUS', band: 'HIGH', min: 3, max: 5, rec: 4 },
        { grade: 'M', band: 'LOW', min: 3, max: 5, rec: 4 },
        { grade: 'M', band: 'MID', min: 2, max: 4, rec: 3 },
        { grade: 'M', band: 'HIGH', min: 1, max: 3, rec: 2 },
        { grade: 'B', band: 'LOW', min: 0, max: 2, rec: 1 },
        { grade: 'B', band: 'MID', min: 0, max: 1, rec: 0.5 },
        { grade: 'B', band: 'HIGH', min: 0, max: 0, rec: 0 },
    ]

    let meritCount = 0
    for (const row of meritData) {
        const id = `merit-${krCo.id}-${row.grade}-${row.band}`
        try {
            await prisma.salaryAdjustmentMatrix.upsert({
                where: { id },
                update: {
                    meritMinPct: row.min,
                    meritMaxPct: row.max,
                    meritRecommendedPct: row.rec,
                },
                create: {
                    id,
                    companyId: krCo.id,
                    emsBlock: `MERIT_${row.grade}_${row.band}`,
                    recommendedIncreasePct: row.rec,
                    gradeKey: row.grade,
                    comparatioBand: row.band,
                    meritMinPct: row.min,
                    meritMaxPct: row.max,
                    meritRecommendedPct: row.rec,
                },
            })
            meritCount++
        } catch { /* skip */ }
    }
    console.log(`  ✅ KR merit matrix rows: ${meritCount}`)

    // ═══ STEP C: PerformanceReview for 2026-H1 ═════════════
    console.log('\n📌 STEP C: PerformanceReview records for 2026-H1...')

    // Find the existing 2026-H1 cycle
    const cycle2026H1Id = deterministicUUID('cycle', 'CTR-KR:2026:H1')
    const cycle = await prisma.performanceCycle.findUnique({
        where: { id: cycle2026H1Id },
    })

    if (!cycle) {
        console.log('  ⚠️  2026-H1 cycle not found, skipping PerformanceReview seed')
    } else {
        // Find KR active employees
        const krEmployees = await prisma.employee.findMany({
            where: {
                deletedAt: null,
                assignments: {
                    some: {
                        companyId: krCo.id,
                        isPrimary: true,
                        endDate: null,
                        status: 'ACTIVE',
                    },
                },
            },
            select: { id: true, employeeNo: true },
            take: 80,
        })

        // Create reviews with varied statuses for testing
        const statuses: ReviewStatus[] = [
            'GOAL_SETTING', 'GOAL_SETTING', 'GOAL_SETTING', 'GOAL_SETTING',  // 50% in goal setting
            'SELF_EVAL', 'SELF_EVAL',   // 25% in self eval
            'MANAGER_EVAL',              // 12.5%
            'NOT_STARTED',               // 12.5%
        ]

        let reviewCount = 0
        for (let i = 0; i < krEmployees.length; i++) {
            const emp = krEmployees[i]
            const status = statuses[i % statuses.length]

            try {
                await prisma.performanceReview.upsert({
                    where: {
                        cycleId_employeeId: {
                            cycleId: cycle.id,
                            employeeId: emp.id,
                        },
                    },
                    update: { status },
                    create: {
                        cycleId: cycle.id,
                        employeeId: emp.id,
                        companyId: krCo.id,
                        status,
                        overdueFlags: status === 'NOT_STARTED'
                            ? ['GOAL_LATE_5D']
                            : [],
                    },
                })
                reviewCount++
            } catch { /* skip */ }
        }
        console.log(`  ✅ PerformanceReview records: ${reviewCount}`)
    }

    // ═══ Summary ═══════════════════════════════════════════
    console.log('\n======================================')
    console.log('🎯 GP#4 Performance Pipeline Seed Complete!')
    console.log('======================================')
    console.log(`  LevelMappings:     ${krLevelCount}+ `)
    console.log(`  MeritMatrix:       ${meritCount}`)
    console.log('======================================\n')
}
