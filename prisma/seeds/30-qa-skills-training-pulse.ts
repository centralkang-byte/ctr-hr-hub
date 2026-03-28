// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Seed: Skills + Training + Pulse Survey (QF-Final)
// Fills 3 empty modules that cause blank pages in QA
//
// Phase 2a: Skills (CompetencyCategory, Competency, EmployeeSkillAssessment)
//           Training (TrainingCourse, TrainingEnrollment)
//           Pulse Survey (PulseSurvey, PulseQuestion, PulseResponse)
// Phase 2b: Cross-module test states (5-1, 5-4, 5-6, 5-8, 5-9)
//
// Idempotent: all upserts use unique keys
// FKs: all via findFirst (no hardcoded UUIDs)
// ═══════════════════════════════════════════════════════════

import type { PrismaClient } from '../../src/generated/prisma/client'

// Deterministic UUID helper (same pattern as seed.ts)
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

export async function seedQASkillsTrainingPulse(prisma: PrismaClient) {
  console.log('\n========================================')
  console.log('📌 SEED: Skills + Training + Pulse Survey')
  console.log('========================================')

  // ──────────────────────────────────────────────────────────────────
  // PART A: Skills — CompetencyCategory + Competency + EmployeeSkillAssessment
  // ──────────────────────────────────────────────────────────────────
  console.log('\n📌 PART A: Skills (CompetencyCategory + Competency)...')

  const categoryDefs = [
    { code: 'TECH_IT',    name: '기술/IT',         nameEn: 'Technology / IT',      order: 1 },
    { code: 'LEADERSHIP', name: '리더십',           nameEn: 'Leadership',           order: 2 },
    { code: 'COMM',       name: '커뮤니케이션',     nameEn: 'Communication',        order: 3 },
    { code: 'DOMAIN',     name: '전문역량',         nameEn: 'Domain Expertise',     order: 4 },
    { code: 'LANGUAGE',   name: '언어',             nameEn: 'Language',             order: 5 },
    { code: 'QUALITY',    name: '안전/품질',        nameEn: 'Safety / Quality',     order: 6 },
  ]

  const categoryIds: Record<string, string> = {}
  for (const cat of categoryDefs) {
    const id = deterministicUUID('comp-category', cat.code)
    await prisma.competencyCategory.upsert({
      where: { code: cat.code },
      update: { name: cat.name, nameEn: cat.nameEn, displayOrder: cat.order },
      create: { id, code: cat.code, name: cat.name, nameEn: cat.nameEn, displayOrder: cat.order, isActive: true },
    })
    categoryIds[cat.code] = id
  }
  console.log(`  ✅ ${categoryDefs.length} competency categories`)

  // Competency definitions per category
  const competencyDefs = [
    // 기술/IT
    { code: 'PYTHON',      cat: 'TECH_IT',    name: 'Python',                    nameEn: 'Python',                   order: 1 },
    { code: 'TYPESCRIPT',  cat: 'TECH_IT',    name: 'JavaScript/TypeScript',     nameEn: 'JavaScript / TypeScript',  order: 2 },
    { code: 'SQL',         cat: 'TECH_IT',    name: 'SQL / 데이터베이스',        nameEn: 'SQL / Database',           order: 3 },
    { code: 'CLOUD',       cat: 'TECH_IT',    name: 'AWS/클라우드',              nameEn: 'AWS / Cloud',              order: 4 },
    { code: 'DATA_ANAL',   cat: 'TECH_IT',    name: '데이터 분석',               nameEn: 'Data Analysis',            order: 5 },
    { code: 'SAP',         cat: 'TECH_IT',    name: 'SAP ERP',                   nameEn: 'SAP ERP',                  order: 6 },
    { code: 'AUTOCAD',     cat: 'TECH_IT',    name: 'AutoCAD / CAD',             nameEn: 'AutoCAD / CAD',            order: 7 },
    // 리더십
    { code: 'TEAM_MGMT',   cat: 'LEADERSHIP', name: '팀 매니지먼트',             nameEn: 'Team Management',          order: 1 },
    { code: 'DECISION',    cat: 'LEADERSHIP', name: '의사결정',                  nameEn: 'Decision Making',          order: 2 },
    { code: 'CONFLICT',    cat: 'LEADERSHIP', name: '갈등 해결',                 nameEn: 'Conflict Resolution',      order: 3 },
    { code: 'COACHING',    cat: 'LEADERSHIP', name: '코칭/멘토링',               nameEn: 'Coaching / Mentoring',     order: 4 },
    { code: 'STRATEGY',    cat: 'LEADERSHIP', name: '전략적 사고',               nameEn: 'Strategic Thinking',       order: 5 },
    // 커뮤니케이션
    { code: 'PRESENT',     cat: 'COMM',       name: '프레젠테이션',              nameEn: 'Presentation',             order: 1 },
    { code: 'BIZ_EN',      cat: 'COMM',       name: '비즈니스 영어',             nameEn: 'Business English',         order: 2 },
    { code: 'TECH_WRITE',  cat: 'COMM',       name: '기술 문서 작성',            nameEn: 'Technical Writing',        order: 3 },
    { code: 'NEGOTIATION', cat: 'COMM',       name: '협상',                      nameEn: 'Negotiation',              order: 4 },
    // 전문역량
    { code: 'QC',          cat: 'DOMAIN',     name: '품질관리(QC)',              nameEn: 'Quality Control',          order: 1 },
    { code: 'PROCESS_IMP', cat: 'DOMAIN',     name: '공정개선',                  nameEn: 'Process Improvement',     order: 2 },
    { code: 'MOLD_DESIGN', cat: 'DOMAIN',     name: '금형설계',                  nameEn: 'Mold Design',             order: 3 },
    { code: 'SIX_SIGMA',   cat: 'DOMAIN',     name: '6시그마',                   nameEn: 'Six Sigma',               order: 4 },
    // 언어
    { code: 'LANG_EN',     cat: 'LANGUAGE',   name: '영어',                      nameEn: 'English',                  order: 1 },
    { code: 'LANG_ZH',     cat: 'LANGUAGE',   name: '중국어',                    nameEn: 'Chinese',                  order: 2 },
    { code: 'LANG_VI',     cat: 'LANGUAGE',   name: '베트남어',                  nameEn: 'Vietnamese',               order: 3 },
    // 안전/품질
    { code: 'ISO_9001',    cat: 'QUALITY',    name: 'ISO 9001 품질경영',        nameEn: 'ISO 9001 Quality Mgmt',    order: 1 },
    { code: 'SAFETY_MGT',  cat: 'QUALITY',    name: '안전관리',                  nameEn: 'Safety Management',        order: 2 },
    { code: 'LEAN_MFG',    cat: 'QUALITY',    name: '린 생산방식',               nameEn: 'Lean Manufacturing',       order: 3 },
  ]

  const competencyIds: Record<string, string> = {}
  for (const comp of competencyDefs) {
    const catId = categoryIds[comp.cat]
    if (!catId) continue
    const id = deterministicUUID('competency', comp.code)
    await prisma.competency.upsert({
      where: { categoryId_code: { categoryId: catId, code: comp.code } },
      update: { name: comp.name, nameEn: comp.nameEn, displayOrder: comp.order },
      create: {
        id,
        categoryId: catId,
        code: comp.code,
        name: comp.name,
        nameEn: comp.nameEn,
        displayOrder: comp.order,
        isActive: true,
      },
    })
    competencyIds[comp.code] = id
  }
  console.log(`  ✅ ${competencyDefs.length} competencies`)

  // EmployeeSkillAssessment: assign skills to 20+ KR employees
  const allEmployees = await prisma.employee.findMany({
    where: { assignments: { some: { isPrimary: true, endDate: null } } },
    select: { id: true, name: true },
    take: 30,
  })

  const managerEmp = await prisma.employee.findFirst({
    where: { assignments: { some: { isPrimary: true, endDate: null } } },
    select: { id: true },
    skip: 5,
  })

  const period = '2025-H2'
  const assessmentsToCreate = [
    // 기술 직군 직원들
    { empIdx: 0,  codes: ['PYTHON', 'SQL', 'DATA_ANAL'],          levels: [4, 3, 4] },
    { empIdx: 1,  codes: ['TYPESCRIPT', 'SQL', 'CLOUD'],           levels: [4, 4, 3] },
    { empIdx: 2,  codes: ['SAP', 'SQL'],                           levels: [5, 4] },
    { empIdx: 3,  codes: ['AUTOCAD', 'MOLD_DESIGN', 'QC'],        levels: [4, 3, 4] },
    { empIdx: 4,  codes: ['TEAM_MGMT', 'COACHING', 'DECISION'],   levels: [4, 4, 3] },
    { empIdx: 5,  codes: ['PRESENT', 'BIZ_EN', 'NEGOTIATION'],    levels: [3, 4, 3] },
    { empIdx: 6,  codes: ['QC', 'PROCESS_IMP', 'SIX_SIGMA'],      levels: [5, 4, 4] },
    { empIdx: 7,  codes: ['PYTHON', 'DATA_ANAL', 'CLOUD'],        levels: [3, 3, 2] },
    { empIdx: 8,  codes: ['SAP', 'PRESENT', 'BIZ_EN'],            levels: [4, 3, 3] },
    { empIdx: 9,  codes: ['LEAN_MFG', 'QC', 'SAFETY_MGT'],       levels: [4, 3, 5] },
    { empIdx: 10, codes: ['TEAM_MGMT', 'STRATEGY', 'DECISION'],   levels: [5, 4, 5] },
    { empIdx: 11, codes: ['LANG_EN', 'LANG_ZH', 'NEGOTIATION'],   levels: [4, 5, 4] },
    { empIdx: 12, codes: ['TYPESCRIPT', 'PYTHON', 'SQL'],          levels: [3, 4, 3] },
    { empIdx: 13, codes: ['COACHING', 'PRESENT', 'CONFLICT'],      levels: [4, 4, 3] },
    { empIdx: 14, codes: ['ISO_9001', 'QC', 'PROCESS_IMP'],       levels: [5, 5, 4] },
    { empIdx: 15, codes: ['MOLD_DESIGN', 'AUTOCAD', 'SIX_SIGMA'], levels: [3, 4, 3] },
    { empIdx: 16, codes: ['LANG_VI', 'LANG_EN'],                   levels: [5, 3] },
    { empIdx: 17, codes: ['DATA_ANAL', 'SQL', 'PYTHON'],           levels: [2, 3, 2] },
    { empIdx: 18, codes: ['SAFETY_MGT', 'LEAN_MFG'],               levels: [4, 3] },
    { empIdx: 19, codes: ['BIZ_EN', 'PRESENT', 'TECH_WRITE'],     levels: [3, 3, 4] },
    { empIdx: 20, codes: ['SAP', 'PROCESS_IMP'],                   levels: [3, 4] },
    { empIdx: 21, codes: ['TEAM_MGMT', 'CONFLICT', 'STRATEGY'],   levels: [3, 4, 3] },
    { empIdx: 22, codes: ['CLOUD', 'SQL', 'DATA_ANAL'],            levels: [2, 3, 2] },
    { empIdx: 23, codes: ['ISO_9001', 'SAFETY_MGT'],               levels: [4, 4] },
    { empIdx: 24, codes: ['LANG_ZH', 'NEGOTIATION'],               levels: [4, 3] },
  ]

  let assessCount = 0
  for (const asgn of assessmentsToCreate) {
    const emp = allEmployees[asgn.empIdx]
    if (!emp) continue
    for (let i = 0; i < asgn.codes.length; i++) {
      const code = asgn.codes[i]
      const compId = competencyIds[code]
      if (!compId) continue
      const selfLevel  = asgn.levels[i]
      const mgLevel    = Math.max(1, Math.min(5, selfLevel + (Math.random() > 0.5 ? 1 : 0)))
      await prisma.employeeSkillAssessment.upsert({
        where: { employeeId_competencyId_assessmentPeriod: { employeeId: emp.id, competencyId: compId, assessmentPeriod: period } },
        update: { selfLevel, managerLevel: mgLevel, finalLevel: mgLevel, assessedById: managerEmp?.id },
        create: {
          id: deterministicUUID('skill-asgn', `${emp.id}:${code}:${period}`),
          employeeId: emp.id,
          competencyId: compId,
          assessmentPeriod: period,
          selfLevel,
          managerLevel: mgLevel,
          finalLevel: mgLevel,
          assessedById: managerEmp?.id ?? null,
          assessedAt: new Date('2025-12-10'),
        },
      })
      assessCount++
    }
  }
  console.log(`  ✅ ${assessCount} employee skill assessments (period: ${period})`)

  // ──────────────────────────────────────────────────────────────────
  // PART B: Training Courses + Enrollments
  // ──────────────────────────────────────────────────────────────────
  console.log('\n📌 PART B: Training Courses + Enrollments...')

  const ctrKr = await prisma.company.findFirst({ where: { code: 'CTR' }, select: { id: true } })
  const ctrKrId = ctrKr?.id ?? null

  const courses = [
    // COMPLIANCE (필수교육)
    {
      code: 'TRN-PRIV-001', title: '개인정보보호 교육', titleEn: 'Personal Info Protection',
      cat: 'COMPLIANCE', format: 'online', mandatory: true, hours: 1, validity: 12,
      provider: '법정교육원', desc: '개인정보보호법에 따른 연간 의무교육',
    },
    {
      code: 'TRN-HRSS-001', title: '직장 내 괴롭힘 예방 교육', titleEn: 'Workplace Harassment Prevention',
      cat: 'COMPLIANCE', format: 'online', mandatory: true, hours: 2, validity: 12,
      provider: '법정교육원', desc: '근로기준법 76조의3 의무교육',
    },
    {
      code: 'TRN-SAFE-001', title: '산업안전보건 교육', titleEn: 'Occupational Safety & Health',
      cat: 'SAFETY_TRAINING', format: 'offline', mandatory: true, hours: 4, validity: 6,
      provider: '한국산업안전보건공단', desc: '산안법 제29조 근로자 정기교육',
    },
    // TECHNICAL (직무교육)
    {
      code: 'TRN-SAP-001',  title: 'SAP ERP 실무', titleEn: 'SAP ERP Fundamentals',
      cat: 'TECHNICAL', format: 'offline', mandatory: false, hours: 16, validity: null,
      provider: '삼성SDS 교육센터', desc: 'SAP S/4HANA 경영지원 실무',
    },
    {
      code: 'TRN-DATA-001', title: 'Python 데이터 분석', titleEn: 'Python Data Analysis',
      cat: 'TECHNICAL', format: 'online', mandatory: false, hours: 20, validity: null,
      provider: '패스트캠퍼스', desc: '판다스, 넘파이, 시각화 실무과정',
    },
    {
      code: 'TRN-QC-001',   title: '품질관리 실무(QC)', titleEn: 'Quality Control Practices',
      cat: 'TECHNICAL', format: 'offline', mandatory: false, hours: 8, validity: null,
      provider: '품질경영원', desc: 'ISO 9001 기반 QC 절차 및 7가지 도구',
    },
    // LEADERSHIP (리더십교육)
    {
      code: 'TRN-NMG-001', title: '신임 관리자 과정', titleEn: 'New Manager Bootcamp',
      cat: 'LEADERSHIP', format: 'offline', mandatory: false, hours: 24, validity: null,
      provider: '한국능률협회', desc: '팀장으로 처음 발령 시 이수 권장',
    },
    {
      code: 'TRN-PFB-001', title: '성과 피드백 스킬', titleEn: 'Performance Feedback Skills',
      cat: 'LEADERSHIP', format: 'online', mandatory: false, hours: 4, validity: null,
      provider: '내부 HRD팀', desc: 'SBI 피드백 모델 및 코칭 대화',
    },
    // SAFETY_TRAINING (안전교육)
    {
      code: 'TRN-CHEM-001', title: '화학물질 취급 안전', titleEn: 'Chemical Handling Safety',
      cat: 'SAFETY_TRAINING', format: 'offline', mandatory: true, hours: 4, validity: 12,
      provider: '한국환경공단', desc: '산업안전보건법 화학물질 취급 법정교육',
    },
    {
      code: 'TRN-EMRG-001', title: '비상 대응 훈련', titleEn: 'Emergency Response Drill',
      cat: 'SAFETY_TRAINING', format: 'offline', mandatory: true, hours: 2, validity: 12,
      provider: '내부 안전관리팀', desc: '화재/재난 시 비상대응 체계 훈련',
    },
    // OTHER (자기개발)
    {
      code: 'TRN-BEZ-001', title: '비즈니스 영어 회화', titleEn: 'Business English Conversation',
      cat: 'OTHER', format: 'online', mandatory: false, hours: 40, validity: null,
      provider: '시원스쿨 기업교육', desc: '화상회의, 이메일, 프레젠테이션 영어',
    },
    {
      code: 'TRN-PRES-001', title: '프레젠테이션 스킬', titleEn: 'Presentation Skills',
      cat: 'OTHER', format: 'online', mandatory: false, hours: 8, validity: null,
      provider: '내부 HRD팀', desc: '스토리텔링 구조, 슬라이드 디자인, Q&A 대응',
    },
  ]

  const courseIds: Record<string, string> = {}
  for (const c of courses) {
    const id = deterministicUUID('training-course', c.code)
    await prisma.trainingCourse.upsert({
      where: { id },
      update: { title: c.title, isActive: true },
      create: {
        id,
        code: c.code,
        companyId: ctrKrId,
        title: c.title,
        titleEn: c.titleEn,
        description: c.desc,
        category: c.cat as Parameters<typeof prisma.trainingCourse.create>[0]['data']['category'],
        format: c.format,
        isMandatory: c.mandatory,
        durationHours: c.hours,
        validityMonths: c.validity ?? null,
        provider: c.provider,
        isActive: true,
      },
    })
    courseIds[c.code] = id
  }
  console.log(`  ✅ ${courses.length} training courses`)

  // Enrollments: realistic mix with various statuses
  const enrollees = allEmployees.slice(0, 25)
  const mandatoryCodes = ['TRN-PRIV-001', 'TRN-HRSS-001']
  const safetyCodes    = ['TRN-SAFE-001', 'TRN-CHEM-001', 'TRN-EMRG-001']

  const enrollmentData: Array<{
    empIdx: number
    courseCode: string
    status: 'ENROLLED' | 'IN_PROGRESS' | 'ENROLLMENT_COMPLETED' | 'DROPPED'
    enrolledAt: Date
    completedAt?: Date
    score?: number
  }> = []

  // 필수교육 (개인정보, 괴롭힘 예방): 대부분 완료
  for (let i = 0; i < Math.min(enrollees.length, 20); i++) {
    for (const code of mandatoryCodes) {
      const completed = i < 15 // 75% 완료
      enrollmentData.push({
        empIdx: i, courseCode: code,
        status: completed ? 'ENROLLMENT_COMPLETED' : (i < 18 ? 'IN_PROGRESS' : 'ENROLLED'),
        enrolledAt: new Date('2026-01-05'),
        completedAt: completed ? new Date('2026-01-20') : undefined,
        score: completed ? 80 + (i % 20) : undefined,
      })
    }
  }

  // 안전교육: 생산직 위주
  for (let i = 0; i < 10; i++) {
    for (const code of safetyCodes) {
      const completed = i < 7
      enrollmentData.push({
        empIdx: i + 5, courseCode: code,
        status: completed ? 'ENROLLMENT_COMPLETED' : 'IN_PROGRESS',
        enrolledAt: new Date('2026-02-01'),
        completedAt: completed ? new Date('2026-02-15') : undefined,
        score: completed ? 75 + (i * 3) : undefined,
      })
    }
  }

  // 직무교육: 관련 부서
  const techEnrollments = [
    { empIdx: 0, courseCode: 'TRN-DATA-001', status: 'ENROLLMENT_COMPLETED' as const, enrolledAt: new Date('2025-11-01'), completedAt: new Date('2025-12-15'), score: 92 },
    { empIdx: 1, courseCode: 'TRN-DATA-001', status: 'IN_PROGRESS' as const,          enrolledAt: new Date('2026-01-15') },
    { empIdx: 2, courseCode: 'TRN-SAP-001',  status: 'ENROLLMENT_COMPLETED' as const, enrolledAt: new Date('2025-10-01'), completedAt: new Date('2025-10-20'), score: 88 },
    { empIdx: 7, courseCode: 'TRN-SAP-001',  status: 'ENROLLED' as const,             enrolledAt: new Date('2026-02-20') },
    { empIdx: 3, courseCode: 'TRN-QC-001',   status: 'ENROLLMENT_COMPLETED' as const, enrolledAt: new Date('2025-09-01'), completedAt: new Date('2025-09-10'), score: 95 },
    { empIdx: 6, courseCode: 'TRN-QC-001',   status: 'IN_PROGRESS' as const,          enrolledAt: new Date('2026-02-01') },
    { empIdx: 4, courseCode: 'TRN-NMG-001',  status: 'ENROLLMENT_COMPLETED' as const, enrolledAt: new Date('2025-07-01'), completedAt: new Date('2025-07-25'), score: 85 },
    { empIdx: 10,courseCode: 'TRN-NMG-001',  status: 'ENROLLED' as const,             enrolledAt: new Date('2026-03-01') },
    { empIdx: 8, courseCode: 'TRN-PFB-001',  status: 'ENROLLMENT_COMPLETED' as const, enrolledAt: new Date('2025-11-15'), completedAt: new Date('2025-11-20'), score: 90 },
    { empIdx: 11,courseCode: 'TRN-BEZ-001',  status: 'IN_PROGRESS' as const,          enrolledAt: new Date('2026-01-01') },
    { empIdx: 5, courseCode: 'TRN-PRES-001', status: 'ENROLLMENT_COMPLETED' as const, enrolledAt: new Date('2025-12-01'), completedAt: new Date('2025-12-08'), score: 87 },
    { empIdx: 19,courseCode: 'TRN-PRES-001', status: 'DROPPED' as const,              enrolledAt: new Date('2026-01-10') },
  ]
  enrollmentData.push(...techEnrollments)

  let enrollCount = 0
  for (const e of enrollmentData) {
    const emp = enrollees[e.empIdx]
    if (!emp) continue
    const courseId = courseIds[e.courseCode]
    if (!courseId) continue
    const id = deterministicUUID('training-enrollment', `${emp.id}:${e.courseCode}`)
    try {
      await prisma.trainingEnrollment.upsert({
        where: { courseId_employeeId: { courseId, employeeId: emp.id } },
        update: { status: e.status },
        create: {
          id,
          courseId,
          employeeId: emp.id,
          status: e.status,
          source: 'manual',
          enrolledAt: e.enrolledAt,
          completedAt: e.completedAt ?? null,
          score: e.score ?? null,
        },
      })
      enrollCount++
    } catch {
      // Skip duplicate if already exists
    }
  }
  console.log(`  ✅ ${enrollCount} training enrollments (mixed statuses)`)

  // ──────────────────────────────────────────────────────────────────
  // PART C: Pulse Surveys
  // ──────────────────────────────────────────────────────────────────
  console.log('\n📌 PART C: Pulse Surveys + Questions + Responses...')

  if (!ctrKrId) {
    console.log('  ⚠️  CTR-KR not found, skipping pulse surveys')
  } else {
    const hrAdmin = await prisma.employee.findFirst({
      where: { assignments: { some: { isPrimary: true, endDate: null, company: { code: 'CTR' } } } },
      select: { id: true },
    })

    if (!hrAdmin) {
      console.log('  ⚠️  No HR admin found, skipping pulse surveys')
    } else {
      const surveys = [
        {
          id: deterministicUUID('pulse-survey', '2025-Q4-engagement'),
          title: '2025 Q4 조직 몰입도 조사',
          description: '2025년 4분기 전사 조직 몰입도 및 핵심가치 실천 현황 조사',
          scope: 'ALL'  as const,
          anonymity: 'FULL_ANONYMOUS' as const,
          openAt: new Date('2025-10-01'),
          closeAt: new Date('2025-10-10'),
          status: 'PULSE_CLOSED' as const,
        },
        {
          id: deterministicUUID('pulse-survey', '2026-Q1-satisfaction'),
          title: '2026 Q1 직원 만족도 조사',
          description: '2026년 1분기 직원 만족도 및 리더십 팀 피드백 조사',
          scope: 'ALL' as const,
          anonymity: 'FULL_ANONYMOUS' as const,
          openAt: new Date('2026-01-15'),
          closeAt: new Date('2026-01-22'),
          status: 'PULSE_CLOSED' as const,
        },
        {
          id: deterministicUUID('pulse-survey', '2026-Q1-culture'),
          title: '2026 Q1 팀 문화 진단',
          description: '2026년 1분기 팀 심리적 안전감 및 협업 문화 진단',
          scope: 'ALL' as const,
          anonymity: 'FULL_DIVISION' as const,
          openAt: new Date('2026-03-01'),
          closeAt: new Date('2026-03-31'),
          status: 'PULSE_ACTIVE' as const,
        },
      ]

      const questionsBysurvey: Record<string, Array<{ id: string; text: string; type: 'LIKERT' | 'TEXT'; order: number; options?: object }>> = {
        [surveys[0].id]: [
          { id: deterministicUUID('pq', 'q4-1'), text: '나는 회사의 비전과 미션에 공감한다.', type: 'LIKERT', order: 1 },
          { id: deterministicUUID('pq', 'q4-2'), text: '나는 내 업무가 회사의 목표에 기여하고 있다고 느낀다.', type: 'LIKERT', order: 2 },
          { id: deterministicUUID('pq', 'q4-3'), text: '나는 현재 직장을 지인에게 추천할 의향이 있다.', type: 'LIKERT', order: 3 },
          { id: deterministicUUID('pq', 'q4-4'), text: '회사/팀에서 개선이 필요한 점을 자유롭게 작성해 주세요.', type: 'TEXT', order: 4 },
        ],
        [surveys[1].id]: [
          { id: deterministicUUID('pq', 'q1-sat-1'), text: '현재 업무에 전반적으로 만족하고 있습니까?', type: 'LIKERT', order: 1 },
          { id: deterministicUUID('pq', 'q1-sat-2'), text: '직속 상사의 리더십에 만족하십니까?', type: 'LIKERT', order: 2 },
          { id: deterministicUUID('pq', 'q1-sat-3'), text: '회사의 성장 가능성에 대해 어떻게 생각하십니까?', type: 'LIKERT', order: 3 },
          { id: deterministicUUID('pq', 'q1-sat-4'), text: '워라밸이 적절하다고 느끼십니까?', type: 'LIKERT', order: 4 },
          { id: deterministicUUID('pq', 'q1-sat-5'), text: '동료에게 이 회사를 추천하시겠습니까? (1~5점)', type: 'LIKERT', order: 5 },
        ],
        [surveys[2].id]: [
          { id: deterministicUUID('pq', 'q1-cul-1'), text: '팀에서 의견을 자유롭게 말할 수 있습니까?', type: 'LIKERT', order: 1 },
          { id: deterministicUUID('pq', 'q1-cul-2'), text: '실수를 했을 때 비난 없이 논의할 수 있습니까?', type: 'LIKERT', order: 2 },
          { id: deterministicUUID('pq', 'q1-cul-3'), text: '팀원 간 협업이 원활하게 이루어지고 있습니까?', type: 'LIKERT', order: 3 },
          { id: deterministicUUID('pq', 'q1-cul-4'), text: '팀 문화 개선을 위한 제안이 있다면 작성해 주세요.', type: 'TEXT', order: 4 },
        ],
      }

      // Upsert surveys
      let surveyCount = 0
      for (const s of surveys) {
        const exists = await prisma.pulseSurvey.findUnique({ where: { id: s.id } })
        if (!exists) {
          await prisma.pulseSurvey.create({
            data: {
              id: s.id,
              companyId: ctrKrId,
              title: s.title,
              description: s.description,
              targetScope: s.scope,
              anonymityLevel: s.anonymity,
              openAt: s.openAt,
              closeAt: s.closeAt,
              status: s.status,
              createdById: hrAdmin.id,
              minRespondentsForReport: 5,
            },
          })
          surveyCount++
        }
      }

      // Upsert questions
      let qCount = 0
      for (const [surveyId, qs] of Object.entries(questionsBysurvey)) {
        for (const q of qs) {
          const exists = await prisma.pulseQuestion.findUnique({ where: { id: q.id } })
          if (!exists) {
            await prisma.pulseQuestion.create({
              data: {
                id: q.id,
                surveyId,
                questionText: q.text,
                questionType: q.type,
                sortOrder: q.order,
                isRequired: true,
              },
            })
            qCount++
          }
        }
      }

      // Responses for completed surveys (Q4-2025 + Q1-2026)
      const likertScores = [3, 4, 5, 4, 3, 5, 4, 3, 4, 5, 2, 4, 5, 3, 4]
      let respCount = 0
      const completedSurveys = [surveys[0], surveys[1]]
      for (const survey of completedSurveys) {
        const qs = questionsBysurvey[survey.id]
        const respondents = allEmployees.slice(0, 12)
        let scoreIdx = 0
        for (const emp of respondents) {
          for (const q of qs) {
            if (q.type === 'TEXT') continue
            const respId = deterministicUUID('pulse-response', `${survey.id}:${q.id}:${emp.id}`)
            const exists = await prisma.pulseResponse.findUnique({ where: { id: respId } })
            if (!exists) {
              await prisma.pulseResponse.create({
                data: {
                  id: respId,
                  surveyId: survey.id,
                  questionId: q.id,
                  companyId: ctrKrId,
                  respondentId: null, // anonymous
                  answerValue: String(likertScores[scoreIdx % likertScores.length]),
                  submittedAt: new Date(survey.closeAt.getTime() - 2 * 24 * 60 * 60 * 1000),
                },
              })
              scoreIdx++
              respCount++
            }
          }
        }
      }

      console.log(`  ✅ ${surveyCount} pulse surveys (upserted/created)`)
      console.log(`  ✅ ${qCount} pulse questions`)
      console.log(`  ✅ ${respCount} pulse responses`)
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // PART D: Cross-Module Test States
  // ──────────────────────────────────────────────────────────────────
  console.log('\n📌 PART D: Cross-Module Test States...')

  // ── 5-1용: FINAL 단계 지원자 (입사 전환 가능) ──
  const existingFinal = await prisma.application.findFirst({
    where: { stage: 'FINAL' },
  })
  if (!existingFinal) {
    const posting = await prisma.jobPosting.findFirst({ select: { id: true } })
    if (posting) {
      const applicantId = deterministicUUID('applicant', 'qa-final-candidate')
      const appId       = deterministicUUID('application', 'qa-final-app')
      const existingApp = await prisma.applicant.findUnique({ where: { id: applicantId } })
      if (!existingApp) {
        await prisma.applicant.create({
          data: {
            id: applicantId,
            name: '테스트 합격자',
            email: 'test.hired@example.com',
            phone: '010-9999-8888',
            source: 'REFERRAL',
          },
        })
        await prisma.application.create({
          data: {
            id: appId,
            postingId: posting.id,
            applicantId,
            stage: 'FINAL',
            appliedAt: new Date('2026-02-15'),
          },
        })
        console.log('  ✅ 5-1: FINAL 지원자 생성 (convert-to-employee 테스트용)')
      }
    }
  } else {
    console.log('  ✅ 5-1: FINAL 지원자 이미 존재 — skip')
  }

  // ── 5-4용: FINALIZED 성과 사이클 + 등급 확정 ──
  const finalizedCycle = await prisma.performanceCycle.findFirst({ where: { status: 'FINALIZED' } })
  if (!finalizedCycle) {
    // Find CLOSED or CALIBRATION cycle to update
    const calibrCycle = await prisma.performanceCycle.findFirst({
      where: { status: { in: ['CALIBRATION', 'CLOSED', 'EVAL_OPEN', 'ACTIVE'] } },
      orderBy: { createdAt: 'asc' },
    })
    if (calibrCycle) {
      await prisma.performanceCycle.update({
        where: { id: calibrCycle.id },
        data: { status: 'FINALIZED' },
      })
      console.log(`  ✅ 5-4: PerformanceCycle "${calibrCycle.id.slice(0, 8)}" → FINALIZED`)

      // Set finalGradeEnum for reviews linked to this cycle
      const reviews = await prisma.performanceReview.findMany({
        where: { cycleId: calibrCycle.id },
        take: 8,
        select: { id: true },
      })
      const gradeDistribution: Array<'E' | 'M_PLUS' | 'M' | 'B'> = ['E', 'M_PLUS', 'M_PLUS', 'M', 'M', 'M', 'M', 'B']
      for (let i = 0; i < reviews.length; i++) {
        await prisma.performanceReview.update({
          where: { id: reviews[i].id },
          data: { finalGrade: gradeDistribution[i % gradeDistribution.length] },
        })
      }
      console.log(`  ✅ 5-4: ${reviews.length} reviews graded (E/M+/M/B distribution)`)
    }
  } else {
    console.log('  ✅ 5-4: FINALIZED 사이클 이미 존재 — skip')
  }

  // ── 5-8용: PENDING_APPROVAL 상태 PayrollRun (이벤트 cascade 테스트) ──
  const pendingApprovalRun = await prisma.payrollRun.findFirst({
    where: { status: 'PENDING_APPROVAL' },
  })
  if (!pendingApprovalRun) {
    // Find a REVIEW run to escalate, or ADJUSTMENT
    const reviewRun = await prisma.payrollRun.findFirst({
      where: { status: { in: ['REVIEW', 'ADJUSTMENT'] } },
      orderBy: { yearMonth: 'desc' },
    })
    if (reviewRun) {
      await prisma.payrollRun.update({
        where: { id: reviewRun.id },
        data: { status: 'PENDING_APPROVAL' },
      })
      console.log(`  ✅ 5-8: PayrollRun (${reviewRun.yearMonth}) → PENDING_APPROVAL`)
    } else {
      console.log('  ⚠️  5-8: No REVIEW PayrollRun found — skip')
    }
  } else {
    console.log('  ✅ 5-8: PENDING_APPROVAL PayrollRun 이미 존재 — skip')
  }

  // ── 5-9용: CTR-CN 직원 수 확인 ──
  const ctrCn = await prisma.company.findFirst({ where: { code: 'CTR-CN' }, select: { id: true } })
  if (ctrCn) {
    const cnEmpCount = await prisma.employee.count({
      where: { assignments: { some: { companyId: ctrCn.id, isPrimary: true, endDate: null } } },
    })
    console.log(`  ✅ 5-9: CTR-CN 직원 수 = ${cnEmpCount}명 ${cnEmpCount >= 5 ? '(충분 ✅)' : '(부족 ⚠️)'}`)
  }

  // ── 5-6용: Task Hub 소스별 PENDING 확인 ──
  const pendingLeave  = await prisma.leaveRequest.count({ where: { status: 'PENDING' } })
  const pendingPayrun = await prisma.payrollRun.count({ where: { status: 'PENDING_APPROVAL' } })
  console.log(`  ✅ 5-6 Task Hub check:`)
  console.log(`       LeaveRequest PENDING: ${pendingLeave}`)
  console.log(`       PayrollRun PENDING_APPROVAL: ${pendingPayrun}`)

  console.log('\n========================================')
  console.log('✅ Seed QA: Skills + Training + Pulse COMPLETE')
  console.log('========================================\n')
}
