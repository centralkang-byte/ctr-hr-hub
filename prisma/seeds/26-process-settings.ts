// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Seed: Process Settings Defaults (H-2c)
// Seeds hardcoded policy values into CompanyProcessSetting
// companyId: null = global default
// ═══════════════════════════════════════════════════════════

import type { PrismaClient, Prisma } from '../../src/generated/prisma/client'

interface SettingDef {
  settingType: string
  settingKey: string
  settingValue: Prisma.InputJsonValue
  description: string
}

const SETTINGS: SettingDef[] = [
  // ─── PAYROLL: KR Social Insurance (4대보험) ─────────────
  {
    settingType: 'PAYROLL',
    settingKey: 'kr-social-insurance',
    description: '한국 4대보험 요율 (2025년 기준)',
    settingValue: {
      pensionRate: 0.045,
      pensionCeiling: 5_900_000,
      healthRate: 0.03545,
      longTermCareRate: 0.1281,
      employmentRate: 0.009,
      effectiveYear: 2025,
    },
  },
  // ─── PAYROLL: KR Tax Brackets (소득세 구간) ─────────────
  {
    settingType: 'PAYROLL',
    settingKey: 'kr-tax-brackets',
    description: '한국 종합소득세 세율표 (2025년 8구간)',
    settingValue: {
      effectiveYear: 2025,
      brackets: [
        { min: 0, max: 14_000_000, rate: 0.06, deduction: 0 },
        { min: 14_000_000, max: 50_000_000, rate: 0.15, deduction: 1_260_000 },
        { min: 50_000_000, max: 88_000_000, rate: 0.24, deduction: 5_760_000 },
        { min: 88_000_000, max: 150_000_000, rate: 0.35, deduction: 15_440_000 },
        { min: 150_000_000, max: 300_000_000, rate: 0.38, deduction: 19_940_000 },
        { min: 300_000_000, max: 500_000_000, rate: 0.40, deduction: 25_940_000 },
        { min: 500_000_000, max: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
        { min: 1_000_000_000, max: null, rate: 0.45, deduction: 65_940_000 },
      ],
      localIncomeTaxRate: 0.10,
    },
  },
  // ─── PAYROLL: KR Non-taxable Limits (비과세 한도) ────────
  {
    settingType: 'PAYROLL',
    settingKey: 'kr-nontaxable-limits',
    description: '한국 비과세 한도 (소득세법 §12 ②)',
    settingValue: {
      meal_allowance: 200_000,
      vehicle_allowance: 200_000,
      childcare: 100_000,
      effectiveYear: 2025,
    },
  },
  // ─── PAYROLL: US Deductions ─────────────────────────────
  {
    settingType: 'PAYROLL',
    settingKey: 'us-deductions',
    description: 'US Social Security, Medicare, 401k rates (2025)',
    settingValue: {
      effectiveYear: 2025,
      rates: {
        socialSecurityRate: 0.062,
        ssWageBase: 168_600,
        medicareRate: 0.0145,
        default401kRate: 0.06,
      },
      taxBrackets: [
        { max: 11_600, rate: 0.10 },
        { max: 47_150, rate: 0.12 },
        { max: 100_525, rate: 0.22 },
        { max: 191_950, rate: 0.24 },
        { max: 243_725, rate: 0.32 },
        { max: 609_350, rate: 0.35 },
        { max: null, rate: 0.37 },
      ],
    },
  },
  // ─── PAYROLL: CN Deductions (五险一金) ──────────────────
  {
    settingType: 'PAYROLL',
    settingKey: 'cn-deductions',
    description: 'CN 五险一金 + 个人所得税 rates (2025)',
    settingValue: {
      effectiveYear: 2025,
      rates: {
        pensionRate: 0.08,
        medicalRate: 0.02,
        unemploymentRate: 0.005,
        housingFundRate: 0.12,
      },
      exemptAmount: 5000,
      taxBrackets: [
        { max: 3_000, rate: 0.03, deduction: 0 },
        { max: 12_000, rate: 0.10, deduction: 210 },
        { max: 25_000, rate: 0.20, deduction: 1_410 },
        { max: 35_000, rate: 0.25, deduction: 2_660 },
        { max: 55_000, rate: 0.30, deduction: 4_410 },
        { max: 80_000, rate: 0.35, deduction: 7_160 },
        { max: null, rate: 0.45, deduction: 15_160 },
      ],
    },
  },
  // ─── PAYROLL: VN Deductions (BHXH/BHYT/BHTN) ──────────
  {
    settingType: 'PAYROLL',
    settingKey: 'vn-deductions',
    description: 'VN BHXH + BHYT + BHTN + PIT rates (2025)',
    settingValue: {
      effectiveYear: 2025,
      rates: {
        bhxhRate: 0.08,
        bhytRate: 0.015,
        bhtnRate: 0.01,
      },
      exemptAmount: 11_000_000,
      taxBrackets: [
        { max: 5_000_000, rate: 0.05 },
        { max: 10_000_000, rate: 0.10 },
        { max: 18_000_000, rate: 0.15 },
        { max: 32_000_000, rate: 0.20 },
        { max: 52_000_000, rate: 0.25 },
        { max: 80_000_000, rate: 0.30 },
        { max: null, rate: 0.35 },
      ],
    },
  },
  // ─── PAYROLL: RU Deductions ──────────────────────────────
  {
    settingType: 'PAYROLL',
    settingKey: 'ru-deductions',
    description: 'RU NDFL flat rate (2025)',
    settingValue: {
      effectiveYear: 2025,
      rates: { ndflRate: 0.13 },
    },
  },
  // ─── PAYROLL: MX Deductions ──────────────────────────────
  {
    settingType: 'PAYROLL',
    settingKey: 'mx-deductions',
    description: 'MX IMSS + ISR rates (2025)',
    settingValue: {
      effectiveYear: 2025,
      rates: { imssRate: 0.025 },
      taxBrackets: [
        { max: 746.04, rate: 0.0192, base: 0 },
        { max: 6_332.05, rate: 0.064, base: 14.32 },
        { max: 11_128.01, rate: 0.1088, base: 371.83 },
        { max: 12_935.82, rate: 0.16, base: 893.63 },
        { max: 15_487.71, rate: 0.1792, base: 1_182.88 },
        { max: 31_236.49, rate: 0.2136, base: 1_640.18 },
        { max: 49_233.00, rate: 0.2352, base: 5_004.12 },
        { max: 93_993.90, rate: 0.30, base: 9_236.89 },
        { max: 125_325.20, rate: 0.32, base: 22_665.17 },
        { max: 375_975.61, rate: 0.34, base: 32_691.18 },
        { max: null, rate: 0.35, base: 117_912.32 },
      ],
    },
  },
  // ─── PAYROLL: Anomaly Detection Thresholds ──────────────
  {
    settingType: 'PAYROLL',
    settingKey: 'anomaly-thresholds',
    description: '급여 이상 탐지 허용 오차 설정',
    settingValue: {
      momChangePercent: 30,
      momAmountThreshold: 50_000,
      bandTolerancePercent: 3,
      monthlyOtLimitHours: 52,
      prorateMinRatio: 20,
      grossChangePercent: 20,
      overtimeBaseRatio: 50,
    },
  },
  // ─── PAYROLL: Approval Chains ───────────────────────────
  {
    settingType: 'PAYROLL',
    settingKey: 'approval-chains',
    description: '법인별 급여 승인 체계',
    settingValue: {
      chains: {
        'CTR-KR': ['HR_MANAGER', 'CFO'],
        'CTR-CN': ['GENERAL_MANAGER'],
        'CTR-US': ['CONTROLLER'],
        'CTR-RU': ['COUNTRY_HEAD'],
        'CTR-VN': ['COUNTRY_HEAD'],
        'CTR-MX': ['COUNTRY_HEAD'],
        DEFAULT: ['HR_ADMIN'],
      },
    },
  },
  // ─── PAYROLL: Bank Codes ────────────────────────────────
  {
    settingType: 'PAYROLL',
    settingKey: 'bank-codes',
    description: '한국 표준 금융기관 코드',
    settingValue: {
      banks: {
        '국민은행': '004',
        '신한은행': '088',
        '우리은행': '020',
        '하나은행': '081',
        '농협': '011',
        'IBK기업': '003',
        'SC제일': '023',
        '카카오뱅크': '090',
        '토스뱅크': '092',
        'KDB산업': '002',
        '수출입은행': '008',
        '부산은행': '032',
        '경남은행': '039',
        '광주은행': '034',
        '전북은행': '037',
        '제주은행': '035',
        '씨티은행': '027',
        '새마을금고': '045',
      },
    },
  },
  // ─── PAYROLL: Pay Schedule ──────────────────────────────
  {
    settingType: 'PAYROLL',
    settingKey: 'pay-schedule',
    description: '급여 지급일/마감일 설정',
    settingValue: {
      payDay: 25,
      closingDay: null,
    },
  },
  // ─── PAYROLL: Account Mapping ───────────────────────────
  {
    settingType: 'PAYROLL',
    settingKey: 'account-mapping',
    description: '계정과목 매핑 테이블',
    settingValue: {
      급여: { code: '5110', name: '급여' },
      상여: { code: '5120', name: '상여' },
      국민연금_회사: { code: '5210', name: '복리후생비-국민연금' },
      건강보험_회사: { code: '5220', name: '복리후생비-건강보험' },
      고용보험_회사: { code: '5230', name: '복리후생비-고용보험' },
      산재보험: { code: '5240', name: '복리후생비-산재보험' },
      퇴직급여: { code: '5310', name: '퇴직급여 충당' },
      식대: { code: '5410', name: '복리후생비-식대' },
      교통비: { code: '5420', name: '복리후생비-교통비' },
    },
  },
  // ─── ATTENDANCE: Work Hour Thresholds ───────────────────
  {
    settingType: 'ATTENDANCE',
    settingKey: 'work-hour-thresholds',
    description: '주간 근무 시간 경고 임계값',
    settingValue: {
      caution: 44,
      warning: 48,
      blocked: 52,
    },
  },
  // ─── ATTENDANCE: Work Hour Limits ──────────────────────
  {
    settingType: 'ATTENDANCE',
    settingKey: 'work-hour-limits',
    description: '법정 근로시간 한도',
    settingValue: {
      maxWeeklyHours: 52,
      standardWeeklyHours: 40,
      maxOvertimeHours: 12,
      monthlyStandardHours: 209,
    },
  },
  // ─── ATTENDANCE: Minimum Wage ──────────────────────────
  {
    settingType: 'ATTENDANCE',
    settingKey: 'min-wage',
    description: '최저시급 (KR 2025년 기준)',
    settingValue: {
      hourlyWage: 10_030,
      effectiveYear: 2025,
      currency: 'KRW',
    },
  },
  // ─── ATTENDANCE: Overtime Rules ─────────────────────────
  {
    settingType: 'ATTENDANCE',
    settingKey: 'overtime-rules',
    description: '초과근무 관리 규칙',
    settingValue: {
      requiresApproval: true,
      multipliers: {
        weekdayOt: 1.5,
        weekend: 1.5,
        holiday: 2.0,
        night: 0.5,
      },
      nightStartHour: 22,
      nightEndHour: 6,
    },
  },
  // ─── ATTENDANCE: Leave Accrual ──────────────────────────
  {
    settingType: 'ATTENDANCE',
    settingKey: 'leave-accrual',
    description: '연차 부여 규칙 (근로기준법 §60)',
    settingValue: {
      firstYearMonthlyMax: 11,
      baseAnnualDays: 15,
      maxAnnualDays: 25,
      additionalDaysPerTwoYears: 1,
      startYearForAdditional: 3,
    },
  },
  // ─── ATTENDANCE: Leave Promotion ────────────────────────
  {
    settingType: 'ATTENDANCE',
    settingKey: 'leave-promotion',
    description: '연차 사용 촉진 설정',
    settingValue: {
      enabled: true,
      alertStartMonth: 11,
      alertStartDay: 1,
      alertEndMonth: 12,
      alertEndDay: 25,
      intervalDays: 7,
      maxAlerts: 3,
      minRemainingDays: 3,
    },
  },
  // ─── PERFORMANCE: Calibration Distribution ──────────────
  {
    settingType: 'PERFORMANCE',
    settingKey: 'calibration-distribution',
    description: '성과 보정 분포 가이드라인',
    settingValue: {
      enforced: false,
      advisory: true,
      deviationThreshold: 5,
      distribution: {
        S: { min: 5, max: 10, recommended: 7 },
        A: { min: 15, max: 25, recommended: 20 },
        B: { min: 40, max: 55, recommended: 50 },
        C: { min: 15, max: 25, recommended: 18 },
        D: { min: 2, max: 8, recommended: 5 },
      },
    },
  },
  // ─── PERFORMANCE: Grade Scale ───────────────────────────
  {
    settingType: 'PERFORMANCE',
    settingKey: 'grade-scale',
    description: '성과 등급 체계',
    settingValue: {
      scale: 5,
      grades: [
        { code: 'S', label: '탁월', minScore: 4.5, maxScore: 5.0, color: '#9C27B0' },
        { code: 'A', label: '우수', minScore: 3.5, maxScore: 4.49, color: '#00C853' },
        { code: 'B', label: '보통', minScore: 2.5, maxScore: 3.49, color: '#FFD600' },
        { code: 'C', label: '미흡', minScore: 1.5, maxScore: 2.49, color: '#FF9800' },
        { code: 'D', label: '부진', minScore: 0, maxScore: 1.49, color: '#F44336' },
      ],
    },
  },
  // ─── PERFORMANCE: Bias Detection Thresholds ─────────────
  {
    settingType: 'PERFORMANCE',
    settingKey: 'bias-thresholds',
    description: '성과 평가 편향 탐지 임계값',
    settingValue: {
      centralTendency: { warning: 60, critical: 70 },
      leniency: { warning: 70, critical: 80 },
      strictness: { warning: 50, critical: 60 },
      sameGradeRatio: { warning: 40, critical: 50 },
    },
  },
  // ─── PERFORMANCE: EMS 9-Block Config ────────────────────
  {
    settingType: 'PERFORMANCE',
    settingKey: 'ems-config',
    description: 'EMS 9-Block 성과-역량 매트릭스 구간 설정',
    settingValue: {
      performanceThresholds: [0, 2.33, 3.67, 5.01],
      competencyThresholds: [0, 2.33, 3.67, 5.01],
    },
  },
  // ─── SYSTEM: Exchange Rates ─────────────────────────────
  {
    settingType: 'SYSTEM',
    settingKey: 'exchange-rates',
    description: 'KRW 기준 환율 (2026 기준)',
    settingValue: {
      baseCurrency: 'KRW',
      effectiveDate: '2026-01-01',
      rates: {
        KRW: 1,
        USD: 1_350,
        CNY: 190,
        VND: 0.055,
        RUB: 14.5,
        MXN: 78,
        EUR: 1_450,
        JPY: 9.2,
      },
    },
  },
  // ─── SYSTEM: Data Retention ─────────────────────────────
  {
    settingType: 'SYSTEM',
    settingKey: 'data-retention',
    description: '데이터 보존 정책',
    settingValue: {
      defaultRetentionDays: 730,
      piiMaskingEnabled: true,
      auditLogRetentionDays: 1095,
    },
  },
  // ─── SYSTEM: Benchmark Rates ────────────────────────────
  {
    settingType: 'SYSTEM',
    settingKey: 'benchmark-rates',
    description: '산업 벤치마크 수치',
    settingValue: {
      turnoverRate: 4.5,
      engagementScore: 3.5,
    },
  },
  // ─── ORGANIZATION: Assignment Rules (H-2d) ─────────────
  {
    settingType: 'ORGANIZATION',
    settingKey: 'assignment-rules',
    description: '발령 유형별 승인 규칙',
    settingValue: {
      rules: [
        { code: 'PROMOTION', label: '승진', desc: '직급 상향 변경', requiresApproval: true },
        { code: 'TRANSFER', label: '전보', desc: '부서 이동', requiresApproval: true },
        { code: 'ROTATION', label: '순환보직', desc: '직무 순환 배치', requiresApproval: true },
        { code: 'SECONDMENT', label: '파견', desc: '타 법인/기관 파견', requiresApproval: true },
        { code: 'CONCURRENT', label: '겸직', desc: '2개 이상 직무 겸임', requiresApproval: true },
        { code: 'LEAVE_OF_ABSENCE', label: '휴직', desc: '육아/병가 등 장기 휴직', requiresApproval: true },
        { code: 'REINSTATEMENT', label: '복직', desc: '휴직 후 복귀', requiresApproval: false },
        { code: 'DEMOTION', label: '강등', desc: '직급 하향 변경', requiresApproval: true },
      ],
    },
  },
  // ─── RECRUITMENT: Pipeline Stages (H-2d) ───────────────
  {
    settingType: 'RECRUITMENT',
    settingKey: 'pipeline-stages',
    description: '채용 파이프라인 단계',
    settingValue: {
      stages: [
        { id: '1', name: '서류접수', nameEn: 'Application', color: '#8181A5' },
        { id: '2', name: '서류심사', nameEn: 'Screening', color: '#5E81F4' },
        { id: '3', name: 'AI 스크리닝', nameEn: 'AI Screening', color: '#7C5CFC' },
        { id: '4', name: '1차 면접', nameEn: '1st Interview', color: '#00C48C' },
        { id: '5', name: '2차 면접', nameEn: '2nd Interview', color: '#00C48C' },
        { id: '6', name: '처우 협의', nameEn: 'Offer', color: '#FF9F43' },
        { id: '7', name: '최종합격', nameEn: 'Hired', color: '#00C48C' },
        { id: '8', name: '불합격', nameEn: 'Rejected', color: '#FF6B6B' },
      ],
    },
  },
  // ─── RECRUITMENT: AI Screening (H-2d) ──────────────────
  {
    settingType: 'RECRUITMENT',
    settingKey: 'ai-screening',
    description: 'AI 기반 서류 심사 자동화 설정',
    settingValue: {
      enabled: true,
      minScore: 60,
      features: [
        { key: 'resume_parse', label: '이력서 자동 파싱', desc: 'PDF/Word 이력서에서 경력/학력/스킬 자동 추출', enabled: true },
        { key: 'jd_match', label: 'JD 매칭 점수', desc: '채용공고 요구사항과 지원자 프로필 매칭률 산출', enabled: true },
        { key: 'bias_filter', label: '편향 필터', desc: '나이/성별/출신교 등 편향 요소 자동 마스킹', enabled: true },
        { key: 'skill_gap', label: '스킬 갭 분석', desc: '필수 스킬 대비 지원자 보유 스킬 갭 분석', enabled: false },
      ],
    },
  },
  // ─── RECRUITMENT: Interview Form (H-2d) ────────────────
  {
    settingType: 'RECRUITMENT',
    settingKey: 'interview-form',
    description: '면접 평가항목 기본 템플릿',
    settingValue: {
      categories: [
        { category: '직무역량', items: ['전문지식', '문제해결력', '실무경험'] },
        { category: '조직적합성', items: ['팀워크', '가치관 부합', '커뮤니케이션'] },
        { category: '성장잠재력', items: ['학습의지', '자기개발', '비전/목표'] },
        { category: '리더십 (관리직)', items: ['조직관리', '의사결정', '코칭'] },
      ],
    },
  },
  // ─── SYSTEM: Locale (H-2d) ─────────────────────────────
  {
    settingType: 'SYSTEM',
    settingKey: 'locale',
    description: '법인별 기본 언어 및 타임존 설정',
    settingValue: {
      defaultLocale: 'ko',
      defaultTimezone: 'Asia/Seoul',
      supportedLocales: ['ko', 'en', 'zh', 'ru', 'vi', 'es'],
    },
  },
  // ─── SYSTEM: Notification Channels (H-2d) ──────────────
  {
    settingType: 'SYSTEM',
    settingKey: 'notification-channels',
    description: '알림 채널 설정',
    settingValue: {
      channels: [
        { key: 'email', label: '이메일', iconKey: 'email', enabled: true },
        { key: 'push', label: '앱 푸시', iconKey: 'push', enabled: true },
        { key: 'teams', label: 'Microsoft Teams', iconKey: 'teams', enabled: false },
        { key: 'slack', label: 'Slack', iconKey: 'slack', enabled: false },
      ],
    },
  },
]

export async function seedProcessSettings(p: PrismaClient) {
  console.log('  🔧 Seeding process settings defaults...')

  let created = 0
  let updated = 0

  for (const def of SETTINGS) {
    const existing = await p.companyProcessSetting.findFirst({
      where: {
        settingType: def.settingType,
        settingKey: def.settingKey,
        companyId: null,
      },
    })

    if (existing) {
      await p.companyProcessSetting.update({
        where: { id: existing.id },
        data: {
          settingValue: def.settingValue,
          description: def.description,
        },
      })
      updated++
    } else {
      await p.companyProcessSetting.create({
        data: {
          settingType: def.settingType,
          settingKey: def.settingKey,
          settingValue: def.settingValue,
          description: def.description,
          companyId: null,
        },
      })
      created++
    }
  }

  console.log(`  ✅ Process settings: ${created} created, ${updated} updated (${SETTINGS.length} total)`)
}
