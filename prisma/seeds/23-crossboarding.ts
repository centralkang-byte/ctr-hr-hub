// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Seed: Crossboarding TRANSFER Templates
// prisma/seeds/22-crossboarding.ts
//
// Creates CROSSBOARDING_DEPARTURE and CROSSBOARDING_ARRIVAL templates
// for the crossboarding (법인 간 이동) flow.
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any

function deterministicUUID(ns: string, key: string): string {
    const crypto = require('crypto')
    const hash = crypto.createHash('sha256').update(`${ns}:${key}`).digest('hex')
    return [
        hash.slice(0, 8),
        hash.slice(8, 12),
        '4' + hash.slice(13, 16),
        ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.slice(18, 20),
        hash.slice(20, 32),
    ].join('-')
}

export async function seedCrossboarding(prisma: PrismaClient) {
    console.log('🔄 Seeding crossboarding templates...')

    // ── CROSSBOARDING_DEPARTURE 템플릿 (출발 법인) ─────────────
    const depTemplateId = deterministicUUID('onb-template', 'global:CROSSBOARDING_DEPARTURE')
    const depTemplate = await prisma.onboardingTemplate.upsert({
        where: { id: depTemplateId },
        update: {},
        create: {
            id: depTemplateId,
            name: '크로스보딩 출발 체크리스트',
            description: '법인 이동 시 출발 법인에서 수행할 체크리스트',
            planType: 'CROSSBOARDING_DEPARTURE',
            targetType: 'TRANSFER',
            companyId: null, // Global
            isActive: true,
        },
    })

    const depTasks = [
        { title: '업무 인수인계 문서 완료', assigneeType: 'EMPLOYEE', dueDays: 7, category: 'DOCUMENT', isRequired: true },
        { title: '팀 이별 미팅', assigneeType: 'MANAGER', dueDays: 3, category: 'INTRODUCTION', isRequired: false },
        { title: '기존 계정 권한 조정', assigneeType: 'IT', dueDays: 1, category: 'SETUP', isRequired: true },
        { title: '출발 법인 문서 서명', assigneeType: 'HR', dueDays: 1, category: 'DOCUMENT', isRequired: true },
    ]

    for (let i = 0; i < depTasks.length; i++) {
        const t = depTasks[i]
        const taskId = deterministicUUID('onb-task', `dep:${i}:${t.title}`)
        await prisma.onboardingTask.upsert({
            where: { id: taskId },
            update: {},
            create: {
                id: taskId,
                templateId: depTemplate.id,
                title: t.title,
                assigneeType: t.assigneeType,
                category: t.category,
                dueDaysAfter: t.dueDays,
                sortOrder: i + 1,
                isRequired: t.isRequired,
            },
        })
    }

    // ── CROSSBOARDING_ARRIVAL 템플릿 (도착 법인) ───────────────
    const arrTemplateId = deterministicUUID('onb-template', 'global:CROSSBOARDING_ARRIVAL')
    const arrTemplate = await prisma.onboardingTemplate.upsert({
        where: { id: arrTemplateId },
        update: {},
        create: {
            id: arrTemplateId,
            name: '크로스보딩 도착 체크리스트',
            description: '법인 이동 시 도착 법인에서 수행할 체크리스트. Sign-off 불필요 (TRANSFER).',
            planType: 'CROSSBOARDING_ARRIVAL',
            targetType: 'TRANSFER',
            companyId: null, // Global
            isActive: true,
        },
    })

    const arrTasks = [
        { title: '기존 계정 이관 확인', assigneeType: 'IT', dueDays: 1, category: 'SETUP', isRequired: true },
        { title: '신규 법인 서류 안내', assigneeType: 'HR', dueDays: 1, category: 'DOCUMENT', isRequired: true },
        { title: '신규 팀 소개', assigneeType: 'MANAGER', dueDays: 7, category: 'INTRODUCTION', isRequired: true },
        { title: '현지 문화 안내', assigneeType: 'BUDDY', dueDays: 7, category: 'INTRODUCTION', isRequired: false },
        { title: '업무 적응 확인', assigneeType: 'EMPLOYEE', dueDays: 30, category: 'OTHER', isRequired: true },
        { title: '1:1 피드백', assigneeType: 'MANAGER', dueDays: 30, category: 'OTHER', isRequired: false },
    ]

    for (let i = 0; i < arrTasks.length; i++) {
        const t = arrTasks[i]
        const taskId = deterministicUUID('onb-task', `arr:${i}:${t.title}`)
        await prisma.onboardingTask.upsert({
            where: { id: taskId },
            update: {},
            create: {
                id: taskId,
                templateId: arrTemplate.id,
                title: t.title,
                assigneeType: t.assigneeType,
                category: t.category,
                dueDaysAfter: t.dueDays,
                sortOrder: i + 1,
                isRequired: t.isRequired,
            },
        })
    }

    console.log(`  ✅ Departure template: ${depTasks.length} tasks`)
    console.log(`  ✅ Arrival template: ${arrTasks.length} tasks (no sign-off — TRANSFER)`)
    console.log('🔄 Crossboarding templates seeded successfully!')
}
