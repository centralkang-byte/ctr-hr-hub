// ================================================================
// CTR HR Hub — Seed Data: Session A — Recruitment
// prisma/seeds/10-recruitment.ts
//
// Creates:
//   STEP A: 6 JobPostings (CTR 4, CTR-CN 2)
//   STEP B: ~31 Applicants
//   STEP C: ~31 Applications spread across pipeline stages
// ================================================================

import { PrismaClient, PostingStatus, ApplicationStage, ApplicantSource, EmploymentType } from '../../src/generated/prisma/client'

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

function daysAgo(n: number): Date {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d
}

// ── KR Applicant pool ────────────────────────────────────────
const KR_NAMES = [
    '김지훈', '이수연', '박민준', '최유진', '정다은',
    '강현우', '윤서영', '임재원', '한소희', '조민기',
    '신예진', '오태양', '류지원', '문성호', '배나연',
    '홍준혁', '유다혜', '남기범', '안지은', '권태호',
]
const KR_EMAILS = KR_NAMES.map((n, i) => `applicant.kr${i + 1}@example.com`)

// ── CN Applicant pool ────────────────────────────────────────
const CN_NAMES = ['王伟', '李娜', '张磊', '刘芳', '陈强', '杨洋', '赵静', '黄明', '周丽', '吴刚']
const CN_EMAILS = CN_NAMES.map((_, i) => `applicant.cn${i + 1}@example.com`)

// ── Posting definitions ──────────────────────────────────────
interface PostingDef {
    key: string
    title: string
    description: string
    requirements: string
    companyCode: string
    deptCode: string
    status: PostingStatus
    employmentType: EmploymentType
    headcount: number
    appCount: number
    salaryMin: number
    salaryMax: number
    currency: string
}

const POSTINGS: PostingDef[] = [
    {
        key: 'KR-PROD-ENG',
        title: '생산기술 엔지니어',
        description: '생산공정 최적화 및 품질 향상을 위한 생산기술 엔지니어를 모집합니다.',
        requirements: '기계공학 또는 관련 학과 학사 이상, 생산설비 경험 3년 이상 우대',
        companyCode: 'CTR',
        deptCode: 'MFG',
        status: 'OPEN',
        employmentType: 'FULL_TIME',
        headcount: 2,
        appCount: 8,
        salaryMin: 40_000_000,
        salaryMax: 60_000_000,
        currency: 'KRW',
    },
    {
        key: 'KR-QA-MGR',
        title: '품질관리 담당자',
        description: '제품 품질 검사 및 품질 관리 시스템 운영을 담당할 인재를 모집합니다.',
        requirements: 'ISO 9001 관련 경험, 품질검사 실무 2년 이상',
        companyCode: 'CTR',
        deptCode: 'QA',
        status: 'OPEN',
        employmentType: 'FULL_TIME',
        headcount: 1,
        appCount: 5,
        salaryMin: 35_000_000,
        salaryMax: 50_000_000,
        currency: 'KRW',
    },
    {
        key: 'KR-MGMT-STAFF',
        title: '경영지원 사원',
        description: '경영지원본부 업무를 지원할 신입/경력 사원을 모집합니다.',
        requirements: '경영학 관련 학과 졸업, MS Office 활용 능숙',
        companyCode: 'CTR',
        deptCode: 'HR',
        status: 'OPEN',
        employmentType: 'FULL_TIME',
        headcount: 1,
        appCount: 6,
        salaryMin: 28_000_000,
        salaryMax: 38_000_000,
        currency: 'KRW',
    },
    {
        key: 'KR-RND-RESEARCHER',
        title: 'R&D 연구원',
        description: '신소재 및 공정 연구개발 담당 연구원을 모집합니다.',
        requirements: '이공계 석사 이상, 연구개발 경험 2년 이상 우대',
        companyCode: 'CTR',
        deptCode: 'RANDD',
        status: 'CLOSED',
        employmentType: 'FULL_TIME',
        headcount: 1,
        appCount: 4,
        salaryMin: 45_000_000,
        salaryMax: 65_000_000,
        currency: 'KRW',
    },
    {
        key: 'CN-QA-ENG',
        title: '质量工程师',
        description: '负责产品质量检验及质量管理体系的运营维护。',
        requirements: '质量管理相关专业，具有2年以上质量检验经验，熟悉ISO 9001标准。',
        companyCode: 'CTR-CN',
        deptCode: 'QA',
        status: 'OPEN',
        employmentType: 'FULL_TIME',
        headcount: 1,
        appCount: 5,
        salaryMin: 120_000,
        salaryMax: 180_000,
        currency: 'CNY',
    },
    {
        key: 'CN-PROD-SUP',
        title: '生产主管',
        description: '负责生产线管理及生产效率提升工作。',
        requirements: '机械或相关专业，具有5年以上生产管理经验，具备团队管理能力。',
        companyCode: 'CTR-CN',
        deptCode: 'MFG',
        status: 'OPEN',
        employmentType: 'FULL_TIME',
        headcount: 1,
        appCount: 3,
        salaryMin: 150_000,
        salaryMax: 220_000,
        currency: 'CNY',
    },
]

// Application stage pipeline (deterministic by index)
const STAGE_PIPELINE: ApplicationStage[] = [
    'APPLIED', 'SCREENING', 'INTERVIEW_1', 'INTERVIEW_2', 'FINAL', 'OFFER', 'HIRED', 'REJECTED',
]

function getStage(seed: number, postingStatus: PostingStatus): ApplicationStage {
    // CLOSED posting: more HIRED/REJECTED
    if (postingStatus === 'CLOSED') {
        const r = sr(seed)
        if (r < 0.25) return 'HIRED'
        if (r < 0.75) return 'REJECTED'
        return 'FINAL'
    }
    // OPEN posting: spread across stages
    const stages: ApplicationStage[] = ['APPLIED', 'SCREENING', 'INTERVIEW_1', 'INTERVIEW_2', 'OFFER', 'REJECTED']
    return stages[Math.floor(sr(seed) * stages.length)]
}

// ────────────────────────────────────────────────────────────
export async function seedRecruitment(prisma: PrismaClient): Promise<void> {
    console.log('\n🎯 Session A: Seeding recruitment data...\n')

    // ── Company IDs ──────────────────────────────────────────
    const krCo = await prisma.company.findFirst({ where: { code: 'CTR' } })
    const cnCo = await prisma.company.findFirst({ where: { code: 'CTR-CN' } })
    if (!krCo) { console.error('  ❌ CTR-KR not found'); return }
    const krId = krCo.id
    const cnId = cnCo?.id

    // ── HR creator employee (used as createdById) ──────────────
    const hrEmp = await prisma.employee.findFirst({ where: { employeeNo: 'CTR-KR-0001' } })
    if (!hrEmp) { console.error('  ❌ HR employee CTR-KR-0001 not found'); return }
    const hrId = hrEmp.id

    // CN HR creator fallback to first CN employee
    const cnEmp = await prisma.employee.findFirst({
        where: { employeeNo: { startsWith: 'CTR-CN' } },
    })
    const cnCreatorId = cnEmp?.id ?? hrId

    // ── Department map (code -> id) ──────────────────────────
    // TODO: Move to Settings (Recruitment) — dept code mapping per company
    const deptRows = await prisma.department.findMany({
        where: { companyId: { in: [krId, ...(cnId ? [cnId] : [])] } },
        select: { id: true, code: true, companyId: true },
    })
    const deptMap: Record<string, string> = {}
    for (const d of deptRows) {
        deptMap[`${d.companyId}:${d.code}`] = d.id
    }

    // ── STEP A: JobPostings ──────────────────────────────────
    console.log('📌 STEP A: Creating job postings...')
    let postingCount = 0
    const postingIds: Record<string, string> = {}

    for (const p of POSTINGS) {
        const companyId = p.companyCode === 'CTR-CN' ? cnId : krId
        if (!companyId) continue

        const deptKey = `${companyId}:${p.deptCode}`
        const departmentId = deptMap[deptKey] ?? null

        const postingId = deterministicUUID('posting', p.key)
        postingIds[p.key] = postingId

        const existing = await prisma.jobPosting.findFirst({ where: { id: postingId } })
        if (!existing) {
            const postedAt = p.status !== 'DRAFT' ? daysAgo(30) : null
            const closedAt = p.status === 'CLOSED' ? daysAgo(5) : null
            const deadlineDate = p.status === 'OPEN' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null

            await prisma.jobPosting.create({
                data: {
                    id: postingId,
                    companyId,
                    departmentId,
                    title: p.title,
                    description: p.description,
                    requirements: p.requirements,
                    employmentType: p.employmentType,
                    headcount: p.headcount,
                    salaryRangeMin: p.salaryMin,
                    salaryRangeMax: p.salaryMax,
                    salaryHidden: false,
                    workMode: 'OFFICE',
                    status: p.status,
                    createdById: p.companyCode === 'CTR-CN' ? cnCreatorId : hrId,
                    postedAt,
                    closedAt,
                    deadlineDate,
                },
            })
            postingCount++
        }
    }
    console.log(`  ✅ ${postingCount} job postings created`)

    // ── STEP B+C: Applicants + Applications ─────────────────
    console.log('📌 STEP B+C: Creating applicants and applications...')
    let applicantCount = 0
    let appCount = 0

    for (let pi = 0; pi < POSTINGS.length; pi++) {
        const p = POSTINGS[pi]
        const postingId = postingIds[p.key]
        if (!postingId) continue

        const isCn = p.companyCode === 'CTR-CN'
        const names = isCn ? CN_NAMES : KR_NAMES
        const emails = isCn ? CN_EMAILS : KR_EMAILS

        for (let ai = 0; ai < p.appCount; ai++) {
            const nameIdx = (pi * 7 + ai * 3) % names.length
            const applicantName = names[nameIdx]
            // Make email unique per posting by adding posting key suffix
            const applicantEmail = emails[nameIdx].replace('@', `+${p.key}@`)

            // Applicant
            const applicantId = deterministicUUID('applicant', `${p.key}:${ai}`)
            const phone = isCn
                ? `1${3 + (ai % 5)}${String(Math.abs(deterministicUUID('phone', applicantId).charCodeAt(0) * 1000000 + ai)).padStart(8, '0').slice(0, 8)}`
                : `010-${String(1000 + ai * 37).padStart(4, '0')}-${String(1000 + pi * 31 + ai * 17).padStart(4, '0')}`

            const sources: ApplicantSource[] = ['DIRECT', 'JOB_BOARD', 'REFERRAL', 'AGENCY']
            const source = sources[(pi + ai) % sources.length]

            let applicant = await prisma.applicant.findFirst({ where: { email: applicantEmail } })
            if (!applicant) {
                applicant = await prisma.applicant.create({
                    data: {
                        id: applicantId,
                        name: applicantName,
                        email: applicantEmail,
                        phone,
                        source,
                        resumeKey: `resumes/${p.key}/${applicantId}.pdf`,
                    },
                })
                applicantCount++
            }

            // Application
            const stage = getStage(pi * 100 + ai * 13 + 7, p.status)
            const appliedAt = daysAgo(20 + ai * 2)

            // AI screening score for SCREENING+ stages
            const stageOrdinal = STAGE_PIPELINE.indexOf(stage)
            const aiScore = stageOrdinal >= 1
                ? 60 + Math.floor(sr(pi * 50 + ai * 23 + 11) * 35)
                : null
            const aiSummary = aiScore
                ? `지원자 역량 점수: ${aiScore}점. ${aiScore >= 80 ? '우수 지원자' : '추가 검토 필요'}.`
                : null

            const offeredSalary = stage === 'OFFER' || stage === 'HIRED'
                ? Math.round(p.salaryMin + sr(pi * 17 + ai) * (p.salaryMax - p.salaryMin) * 0.5)
                : null
            const rejectionReason = stage === 'REJECTED'
                ? ['경력 부족', '기술 역량 미달', '처우 협의 실패'][ai % 3]
                : null

            const existingApp = await prisma.application.findFirst({
                where: { postingId, applicantId: applicant.id },
            })
            if (!existingApp) {
                await prisma.application.create({
                    data: {
                        id: deterministicUUID('application', `${p.key}:${ai}`),
                        postingId,
                        applicantId: applicant.id,
                        stage,
                        aiScreeningScore: aiScore,
                        aiScreeningSummary: aiSummary,
                        rejectionReason,
                        offeredSalary,
                        appliedAt,
                    },
                })
                appCount++
            }
        }
    }
    console.log(`  ✅ ${applicantCount} applicants, ${appCount} applications`)

    // ── Summary ──────────────────────────────────────────────
    const totalPostings = await prisma.jobPosting.count()
    const totalApplicants = await prisma.applicant.count()
    const totalApps = await prisma.application.count()

    console.log('\n======================================')
    console.log('🎯 Recruitment Seed Complete!')
    console.log('======================================')
    console.log(`  Job Postings:  ${totalPostings}`)
    console.log(`  Applicants:    ${totalApplicants}`)
    console.log(`  Applications:  ${totalApps}`)
    console.log('======================================\n')
}
