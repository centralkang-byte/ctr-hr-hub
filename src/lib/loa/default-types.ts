// ═══════════════════════════════════════════════════════════
// CTR HR Hub — LOA Default Types (국내 공통규정)
// 한국 노동법 기반 8개 기본 휴직유형
// prisma/seeds/43-loa-types.ts 와 동일한 데이터 (SSOT)
// ═══════════════════════════════════════════════════════════

export interface LoaTypeDefault {
  code: string
  name: string
  nameEn: string
  category: 'STATUTORY' | 'CONTRACTUAL'
  maxDurationDays: number | null
  payType: string
  payRate: number | null
  paySource: string | null
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

export const KR_LOA_DEFAULTS: LoaTypeDefault[] = [
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
