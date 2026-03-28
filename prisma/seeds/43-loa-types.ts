// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Seed: Leave of Absence Types per Company
// 13개 법인별 휴직유형 시드 (한국 노동법 + 각국 규정 기반)
//
// 국내 7개: CTR-HOLD, CTR, CTR-MOB, CTR-ECO, CTR-ROB, CTR-ENR, CTR-FML → 공통규정 적용
// 해외 6개: CTR-CN, CTR-US, CTR-VN, CTR-RU, CTR-EU → 각국 법정 기준
// ═══════════════════════════════════════════════════════════

import type { PrismaClient } from '../../src/generated/prisma/client'

interface LoaTypeSeed {
  code: string
  name: string
  nameEn: string
  category: 'STATUTORY' | 'CONTRACTUAL'
  maxDurationDays: number | null
  payType: 'PAID' | 'UNPAID' | 'PARTIAL' | 'INSURANCE' | 'MIXED'
  payRate: number | null
  paySource: 'EMPLOYER' | 'GOVERNMENT' | 'INSURANCE' | 'MIXED' | null
  eligibilityMonths: number | null
  countsAsService: boolean
  countsAsAttendance: boolean
  splittable: boolean
  maxSplitCount: number | null
  requiresProof: boolean
  proofDescription: string | null
  advanceNoticeDays: number | null
  reinstatementGuaranteed: boolean
  sortOrder: number
}

interface CompanyLoaTypes {
  companyCode: string
  types: LoaTypeSeed[]
}

const DOMESTIC_COMPANIES = [
  'CTR-HQ', 'CTR-KR', 'CTR-MOB', 'CTR-ECO', 'CTR-ROB', 'CTR-ENG', 'FML',
]

// ═══════════════════════════════════════════════════════════
// 국내 공통규정 — 한국 노동법 기반 8개 유형
// ═══════════════════════════════════════════════════════════
const KR_LOA_TYPES: LoaTypeSeed[] = [
  {
    code: 'PARENTAL',
    name: '육아휴직',
    nameEn: 'Parental Leave',
    category: 'STATUTORY',
    maxDurationDays: 365,
    payType: 'INSURANCE',
    payRate: 80,
    paySource: 'GOVERNMENT',
    eligibilityMonths: 6,
    countsAsService: true,
    countsAsAttendance: true,
    splittable: true,
    maxSplitCount: 2,
    requiresProof: true,
    proofDescription: '자녀 출생증명서 또는 가족관계증명서',
    advanceNoticeDays: 30,
    reinstatementGuaranteed: true,
    sortOrder: 1,
  },
  {
    code: 'MATERNITY',
    name: '출산전후휴가',
    nameEn: 'Maternity Leave',
    category: 'STATUTORY',
    maxDurationDays: 90,
    payType: 'MIXED',
    payRate: 100,
    paySource: 'MIXED',
    eligibilityMonths: null,
    countsAsService: true,
    countsAsAttendance: true,
    splittable: false,
    maxSplitCount: null,
    requiresProof: true,
    proofDescription: '의사 진단서, 출산 예정일 확인서',
    advanceNoticeDays: null,
    reinstatementGuaranteed: true,
    sortOrder: 2,
  },
  {
    code: 'FAMILY_CARE',
    name: '가족돌봄휴직',
    nameEn: 'Family Care Leave',
    category: 'STATUTORY',
    maxDurationDays: 90,
    payType: 'UNPAID',
    payRate: null,
    paySource: null,
    eligibilityMonths: 6,
    countsAsService: true,
    countsAsAttendance: false,
    splittable: true,
    maxSplitCount: 3,
    requiresProof: true,
    proofDescription: '가족관계증명서, 의료 진단서 등',
    advanceNoticeDays: 30,
    reinstatementGuaranteed: true,
    sortOrder: 3,
  },
  {
    code: 'MEDICAL',
    name: '질병휴직',
    nameEn: 'Medical Leave',
    category: 'CONTRACTUAL',
    maxDurationDays: 180,
    payType: 'UNPAID',
    payRate: null,
    paySource: null,
    eligibilityMonths: null,
    countsAsService: false,
    countsAsAttendance: false,
    splittable: false,
    maxSplitCount: null,
    requiresProof: true,
    proofDescription: '의사 진단서',
    advanceNoticeDays: null,
    reinstatementGuaranteed: false,
    sortOrder: 4,
  },
  {
    code: 'WORK_INJURY',
    name: '업무상재해 휴직',
    nameEn: 'Work Injury Leave',
    category: 'STATUTORY',
    maxDurationDays: null,
    payType: 'INSURANCE',
    payRate: 70,
    paySource: 'INSURANCE',
    eligibilityMonths: null,
    countsAsService: true,
    countsAsAttendance: true,
    splittable: false,
    maxSplitCount: null,
    requiresProof: true,
    proofDescription: '산재 인정 결정서',
    advanceNoticeDays: null,
    reinstatementGuaranteed: true,
    sortOrder: 5,
  },
  {
    code: 'MILITARY',
    name: '병역휴직',
    nameEn: 'Military Service Leave',
    category: 'STATUTORY',
    maxDurationDays: 548,
    payType: 'UNPAID',
    payRate: null,
    paySource: null,
    eligibilityMonths: null,
    countsAsService: true,
    countsAsAttendance: false,
    splittable: false,
    maxSplitCount: null,
    requiresProof: true,
    proofDescription: '입영통지서',
    advanceNoticeDays: null,
    reinstatementGuaranteed: true,
    sortOrder: 6,
  },
  {
    code: 'PERSONAL',
    name: '개인사유 휴직',
    nameEn: 'Personal Leave',
    category: 'CONTRACTUAL',
    maxDurationDays: 365,
    payType: 'UNPAID',
    payRate: null,
    paySource: null,
    eligibilityMonths: 12,
    countsAsService: false,
    countsAsAttendance: false,
    splittable: false,
    maxSplitCount: null,
    requiresProof: false,
    proofDescription: null,
    advanceNoticeDays: 30,
    reinstatementGuaranteed: false,
    sortOrder: 7,
  },
  {
    code: 'STUDY',
    name: '학업휴직',
    nameEn: 'Study Leave',
    category: 'CONTRACTUAL',
    maxDurationDays: 730,
    payType: 'UNPAID',
    payRate: null,
    paySource: null,
    eligibilityMonths: 24,
    countsAsService: false,
    countsAsAttendance: false,
    splittable: false,
    maxSplitCount: null,
    requiresProof: true,
    proofDescription: '입학허가서 또는 재학증명서',
    advanceNoticeDays: 30,
    reinstatementGuaranteed: false,
    sortOrder: 8,
  },
]

// ═══════════════════════════════════════════════════════════
// 해외 법인별 규정
// ═══════════════════════════════════════════════════════════
const OVERSEAS_LOA_TYPES: CompanyLoaTypes[] = [
  // ── CTR-CN: 중국 (쑤저우/장자강, 장쑤성 규정) ──────────
  {
    companyCode: 'CTR-CN',
    types: [
      {
        code: 'MATERNITY', name: '产假', nameEn: 'Maternity Leave',
        category: 'STATUTORY', maxDurationDays: 158, payType: 'INSURANCE', payRate: 100,
        paySource: 'INSURANCE', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: true,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: '医院诊断证明',
        advanceNoticeDays: null, reinstatementGuaranteed: true, sortOrder: 1,
      },
      {
        code: 'PATERNITY', name: '陪产假', nameEn: 'Paternity Leave',
        category: 'STATUTORY', maxDurationDays: 15, payType: 'PAID', payRate: 100,
        paySource: 'EMPLOYER', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: true,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: '出生证明',
        advanceNoticeDays: null, reinstatementGuaranteed: true, sortOrder: 2,
      },
      {
        code: 'PARENTAL', name: '育儿假', nameEn: 'Parental Leave',
        category: 'STATUTORY', maxDurationDays: 10, payType: 'PAID', payRate: 100,
        paySource: 'EMPLOYER', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: true,
        splittable: true, maxSplitCount: null,
        requiresProof: true, proofDescription: '户口本或出生证明',
        advanceNoticeDays: null, reinstatementGuaranteed: true, sortOrder: 3,
      },
      {
        code: 'MEDICAL', name: '病假', nameEn: 'Medical Leave',
        category: 'STATUTORY', maxDurationDays: 730, payType: 'PARTIAL', payRate: 60,
        paySource: 'EMPLOYER', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: false,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: '医院病假条',
        advanceNoticeDays: null, reinstatementGuaranteed: false, sortOrder: 4,
      },
      {
        code: 'WORK_INJURY', name: '工伤假', nameEn: 'Work Injury Leave',
        category: 'STATUTORY', maxDurationDays: null, payType: 'INSURANCE', payRate: 100,
        paySource: 'INSURANCE', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: true,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: '工伤认定书',
        advanceNoticeDays: null, reinstatementGuaranteed: true, sortOrder: 5,
      },
      {
        code: 'PERSONAL', name: '事假', nameEn: 'Personal Leave',
        category: 'CONTRACTUAL', maxDurationDays: 365, payType: 'UNPAID', payRate: null,
        paySource: null, eligibilityMonths: null,
        countsAsService: false, countsAsAttendance: false,
        splittable: false, maxSplitCount: null,
        requiresProof: false, proofDescription: null,
        advanceNoticeDays: 3, reinstatementGuaranteed: false, sortOrder: 6,
      },
    ],
  },

  // ── CTR-VN: 베트남 ─────────────────────────────────────
  {
    companyCode: 'CTR-VN',
    types: [
      {
        code: 'MATERNITY', name: 'Nghỉ thai sản', nameEn: 'Maternity Leave',
        category: 'STATUTORY', maxDurationDays: 180, payType: 'INSURANCE', payRate: 100,
        paySource: 'INSURANCE', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: true,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Giấy chứng sinh',
        advanceNoticeDays: null, reinstatementGuaranteed: true, sortOrder: 1,
      },
      {
        code: 'PATERNITY', name: 'Nghỉ cho cha', nameEn: 'Paternity Leave',
        category: 'STATUTORY', maxDurationDays: 7, payType: 'INSURANCE', payRate: 100,
        paySource: 'INSURANCE', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: true,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Giấy chứng sinh',
        advanceNoticeDays: null, reinstatementGuaranteed: true, sortOrder: 2,
      },
      {
        code: 'MEDICAL', name: 'Nghỉ ốm', nameEn: 'Sick Leave',
        category: 'STATUTORY', maxDurationDays: 60, payType: 'INSURANCE', payRate: 75,
        paySource: 'INSURANCE', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: false,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Giấy nghỉ ốm của bệnh viện',
        advanceNoticeDays: null, reinstatementGuaranteed: false, sortOrder: 3,
      },
      {
        code: 'WORK_INJURY', name: 'Tai nạn lao động', nameEn: 'Work Injury Leave',
        category: 'STATUTORY', maxDurationDays: null, payType: 'INSURANCE', payRate: 100,
        paySource: 'INSURANCE', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: true,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Biên bản tai nạn lao động',
        advanceNoticeDays: null, reinstatementGuaranteed: true, sortOrder: 4,
      },
      {
        code: 'PERSONAL', name: 'Nghỉ việc riêng', nameEn: 'Personal Leave',
        category: 'CONTRACTUAL', maxDurationDays: 365, payType: 'UNPAID', payRate: null,
        paySource: null, eligibilityMonths: 12,
        countsAsService: false, countsAsAttendance: false,
        splittable: false, maxSplitCount: null,
        requiresProof: false, proofDescription: null,
        advanceNoticeDays: 15, reinstatementGuaranteed: false, sortOrder: 5,
      },
    ],
  },

  // ── CTR-US: 미국 ───────────────────────────────────────
  {
    companyCode: 'CTR-US',
    types: [
      {
        code: 'FMLA', name: 'FMLA Leave', nameEn: 'FMLA Leave',
        category: 'STATUTORY', maxDurationDays: 84, payType: 'UNPAID', payRate: null,
        paySource: null, eligibilityMonths: 12,
        countsAsService: true, countsAsAttendance: false,
        splittable: true, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Medical certification or qualifying reason documentation',
        advanceNoticeDays: 30, reinstatementGuaranteed: true, sortOrder: 1,
      },
      {
        code: 'MATERNITY', name: 'Maternity Leave', nameEn: 'Maternity Leave',
        category: 'STATUTORY', maxDurationDays: 84, payType: 'UNPAID', payRate: null,
        paySource: null, eligibilityMonths: 12,
        countsAsService: true, countsAsAttendance: false,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Birth certificate or medical documentation',
        advanceNoticeDays: 30, reinstatementGuaranteed: true, sortOrder: 2,
      },
      {
        code: 'MILITARY', name: 'USERRA Leave', nameEn: 'Military Leave (USERRA)',
        category: 'STATUTORY', maxDurationDays: 1825, payType: 'UNPAID', payRate: null,
        paySource: null, eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: false,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Military orders',
        advanceNoticeDays: null, reinstatementGuaranteed: true, sortOrder: 3,
      },
      {
        code: 'MEDICAL', name: 'Medical Leave', nameEn: 'Medical Leave',
        category: 'CONTRACTUAL', maxDurationDays: 180, payType: 'UNPAID', payRate: null,
        paySource: null, eligibilityMonths: 6,
        countsAsService: false, countsAsAttendance: false,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Physician certification',
        advanceNoticeDays: null, reinstatementGuaranteed: false, sortOrder: 4,
      },
      {
        code: 'PERSONAL', name: 'Personal Leave', nameEn: 'Personal Leave',
        category: 'CONTRACTUAL', maxDurationDays: 180, payType: 'UNPAID', payRate: null,
        paySource: null, eligibilityMonths: 12,
        countsAsService: false, countsAsAttendance: false,
        splittable: false, maxSplitCount: null,
        requiresProof: false, proofDescription: null,
        advanceNoticeDays: 30, reinstatementGuaranteed: false, sortOrder: 5,
      },
    ],
  },

  // ── CTR-RU: 러시아 ─────────────────────────────────────
  {
    companyCode: 'CTR-RU',
    types: [
      {
        code: 'MATERNITY', name: 'Декретный отпуск', nameEn: 'Maternity Leave',
        category: 'STATUTORY', maxDurationDays: 140, payType: 'INSURANCE', payRate: 100,
        paySource: 'INSURANCE', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: true,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Больничный лист',
        advanceNoticeDays: null, reinstatementGuaranteed: true, sortOrder: 1,
      },
      {
        code: 'PARENTAL', name: 'Отпуск по уходу за ребёнком', nameEn: 'Parental Leave',
        category: 'STATUTORY', maxDurationDays: 1095, payType: 'PARTIAL', payRate: 40,
        paySource: 'INSURANCE', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: false,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Свидетельство о рождении',
        advanceNoticeDays: null, reinstatementGuaranteed: true, sortOrder: 2,
      },
      {
        code: 'MEDICAL', name: 'Больничный лист', nameEn: 'Sick Leave',
        category: 'STATUTORY', maxDurationDays: null, payType: 'INSURANCE', payRate: 80,
        paySource: 'INSURANCE', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: false,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Листок нетрудоспособности',
        advanceNoticeDays: null, reinstatementGuaranteed: false, sortOrder: 3,
      },
      {
        code: 'MILITARY', name: 'Военная служба', nameEn: 'Military Service',
        category: 'STATUTORY', maxDurationDays: 365, payType: 'UNPAID', payRate: null,
        paySource: null, eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: false,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Повестка из военкомата',
        advanceNoticeDays: null, reinstatementGuaranteed: true, sortOrder: 4,
      },
      {
        code: 'PERSONAL', name: 'Отпуск без содержания', nameEn: 'Unpaid Leave',
        category: 'CONTRACTUAL', maxDurationDays: 365, payType: 'UNPAID', payRate: null,
        paySource: null, eligibilityMonths: null,
        countsAsService: false, countsAsAttendance: false,
        splittable: false, maxSplitCount: null,
        requiresProof: false, proofDescription: null,
        advanceNoticeDays: 14, reinstatementGuaranteed: false, sortOrder: 5,
      },
    ],
  },

  // ── CTR-MX: 멕시코 ──────────────────────────────────────
  {
    companyCode: 'CTR-MX',
    types: [
      {
        code: 'MATERNITY', name: 'Licencia de maternidad', nameEn: 'Maternity Leave',
        category: 'STATUTORY', maxDurationDays: 84, payType: 'INSURANCE', payRate: 100,
        paySource: 'INSURANCE', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: true,
        splittable: true, maxSplitCount: 2,
        requiresProof: true, proofDescription: 'Certificado médico del IMSS',
        advanceNoticeDays: null, reinstatementGuaranteed: true, sortOrder: 1,
      },
      {
        code: 'PATERNITY', name: 'Licencia de paternidad', nameEn: 'Paternity Leave',
        category: 'STATUTORY', maxDurationDays: 5, payType: 'PAID', payRate: 100,
        paySource: 'EMPLOYER', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: true,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Acta de nacimiento',
        advanceNoticeDays: null, reinstatementGuaranteed: true, sortOrder: 2,
      },
      {
        code: 'MEDICAL', name: 'Incapacidad', nameEn: 'Medical Leave (IMSS)',
        category: 'STATUTORY', maxDurationDays: 364, payType: 'INSURANCE', payRate: 60,
        paySource: 'INSURANCE', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: false,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Certificado de incapacidad del IMSS',
        advanceNoticeDays: null, reinstatementGuaranteed: false, sortOrder: 3,
      },
      {
        code: 'WORK_INJURY', name: 'Riesgo de trabajo', nameEn: 'Work Injury Leave',
        category: 'STATUTORY', maxDurationDays: 364, payType: 'INSURANCE', payRate: 100,
        paySource: 'INSURANCE', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: true,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Dictamen de riesgo de trabajo IMSS',
        advanceNoticeDays: null, reinstatementGuaranteed: true, sortOrder: 4,
      },
      {
        code: 'PERSONAL', name: 'Permiso personal', nameEn: 'Personal Leave',
        category: 'CONTRACTUAL', maxDurationDays: 180, payType: 'UNPAID', payRate: null,
        paySource: null, eligibilityMonths: 12,
        countsAsService: false, countsAsAttendance: false,
        splittable: false, maxSplitCount: null,
        requiresProof: false, proofDescription: null,
        advanceNoticeDays: 15, reinstatementGuaranteed: false, sortOrder: 5,
      },
    ],
  },

  // ── CTR-EU: 폴란드 ─────────────────────────────────────
  {
    companyCode: 'CTR-EU',
    types: [
      {
        code: 'MATERNITY', name: 'Urlop macierzyński', nameEn: 'Maternity Leave',
        category: 'STATUTORY', maxDurationDays: 140, payType: 'INSURANCE', payRate: 100,
        paySource: 'INSURANCE', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: true,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Akt urodzenia dziecka',
        advanceNoticeDays: null, reinstatementGuaranteed: true, sortOrder: 1,
      },
      {
        code: 'PARENTAL', name: 'Urlop rodzicielski', nameEn: 'Parental Leave',
        category: 'STATUTORY', maxDurationDays: 287, payType: 'INSURANCE', payRate: 70,
        paySource: 'INSURANCE', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: false,
        splittable: true, maxSplitCount: 5,
        requiresProof: true, proofDescription: 'Akt urodzenia dziecka',
        advanceNoticeDays: 21, reinstatementGuaranteed: true, sortOrder: 2,
      },
      {
        code: 'PATERNITY', name: 'Urlop ojcowski', nameEn: 'Paternity Leave',
        category: 'STATUTORY', maxDurationDays: 14, payType: 'INSURANCE', payRate: 100,
        paySource: 'INSURANCE', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: true,
        splittable: true, maxSplitCount: 2,
        requiresProof: true, proofDescription: 'Akt urodzenia dziecka',
        advanceNoticeDays: 7, reinstatementGuaranteed: true, sortOrder: 3,
      },
      {
        code: 'MEDICAL', name: 'Zwolnienie lekarskie', nameEn: 'Sick Leave',
        category: 'STATUTORY', maxDurationDays: 182, payType: 'INSURANCE', payRate: 80,
        paySource: 'MIXED', eligibilityMonths: null,
        countsAsService: true, countsAsAttendance: false,
        splittable: false, maxSplitCount: null,
        requiresProof: true, proofDescription: 'Zwolnienie lekarskie (e-ZLA)',
        advanceNoticeDays: null, reinstatementGuaranteed: false, sortOrder: 4,
      },
      {
        code: 'PERSONAL', name: 'Urlop bezpłatny', nameEn: 'Unpaid Leave',
        category: 'CONTRACTUAL', maxDurationDays: null, payType: 'UNPAID', payRate: null,
        paySource: null, eligibilityMonths: null,
        countsAsService: false, countsAsAttendance: false,
        splittable: false, maxSplitCount: null,
        requiresProof: false, proofDescription: null,
        advanceNoticeDays: null, reinstatementGuaranteed: false, sortOrder: 5,
      },
    ],
  },
]

// ═══════════════════════════════════════════════════════════
// Seed 실행
// ═══════════════════════════════════════════════════════════

export async function seedLoaTypes(p: PrismaClient) {
  console.log('  🏥 Seeding leave of absence types per company...')

  const companies = await p.company.findMany({ select: { id: true, code: true } })
  const codeToId = new Map(companies.map((c) => [c.code, c.id]))

  let created = 0
  let skipped = 0

  // 국내 7개 법인에 공통규정 적용
  for (const companyCode of DOMESTIC_COMPANIES) {
    const companyId = codeToId.get(companyCode)
    if (!companyId) {
      console.log(`    ⚠️  Company ${companyCode} not found, skipping`)
      continue
    }
    for (const lt of KR_LOA_TYPES) {
      const result = await upsertLoaType(p, companyId, lt)
      if (result === 'created') created++
      else skipped++
    }
  }

  // 해외 법인에 개별 규정 적용
  for (const companyDef of OVERSEAS_LOA_TYPES) {
    const companyId = codeToId.get(companyDef.companyCode)
    if (!companyId) {
      console.log(`    ⚠️  Company ${companyDef.companyCode} not found, skipping`)
      continue
    }
    for (const lt of companyDef.types) {
      const result = await upsertLoaType(p, companyId, lt)
      if (result === 'created') created++
      else skipped++
    }
  }

  console.log(`  ✅ LOA types: ${created} created, ${skipped} already exist`)
}

async function upsertLoaType(
  p: PrismaClient,
  companyId: string,
  lt: LoaTypeSeed,
): Promise<'created' | 'skipped'> {
  const existing = await p.leaveOfAbsenceType.findFirst({
    where: { companyId, code: lt.code },
  })

  if (existing) return 'skipped'

  await p.leaveOfAbsenceType.create({
    data: {
      companyId,
      code: lt.code,
      name: lt.name,
      nameEn: lt.nameEn,
      category: lt.category,
      maxDurationDays: lt.maxDurationDays,
      payType: lt.payType,
      payRate: lt.payRate,
      paySource: lt.paySource,
      eligibilityMonths: lt.eligibilityMonths,
      countsAsService: lt.countsAsService,
      countsAsAttendance: lt.countsAsAttendance,
      splittable: lt.splittable,
      maxSplitCount: lt.maxSplitCount,
      requiresProof: lt.requiresProof,
      proofDescription: lt.proofDescription,
      advanceNoticeDays: lt.advanceNoticeDays,
      reinstatementGuaranteed: lt.reinstatementGuaranteed,
      sortOrder: lt.sortOrder,
      isActive: true,
    },
  })
  return 'created'
}

// Standalone execution
if (require.main === module) {
  import('dotenv').then(dotenv => {
    import('path').then(path => {
      dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') })
      dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })

      import('../../src/generated/prisma/client').then(({ PrismaClient }) => {
        import('@prisma/adapter-pg').then(({ PrismaPg }) => {
          const connectionString = process.env.DATABASE_URL
          if (!connectionString) throw new Error('DATABASE_URL is not set')
          const adapter = new PrismaPg({ connectionString })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const prisma = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] }) as InstanceType<typeof PrismaClient>
          seedLoaTypes(prisma)
            .then(() => prisma.$disconnect())
            .catch((e: unknown) => {
              console.error(e)
              prisma.$disconnect()
              process.exit(1)
            })
        })
      })
    })
  })
}
