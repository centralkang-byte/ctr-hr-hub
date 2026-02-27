// 폴란드 노동법 규칙 (CTR Europe Sp. z o.o.) — STEP 2.5
// v3.1에서 eu.ts로 통합했으나, 폴란드 고유 규칙이 많아 pl.ts로 분리

export const PL_LABOR_RULES = {
  country_code: 'PL',
  standard_hours_weekly: 40,
  standard_hours_daily: 8,
  overtime_rates: {
    weekday: 1.5, // 50% 가산
    weekend: 2.0, // 100% 가산
    night: 1.2, // 야간 가산 20%
  },
  leave_types: {
    ANNUAL: {
      // 근속 10년 미만: 20일, 10년 이상: 26일
      days_by_tenure: [
        { min_years: 0, max_years: 10, days: 20 },
        { min_years: 10, max_years: 999, days: 26 },
      ],
      // 학력 기간도 근속에 포함 (대졸 +8년)
      education_credit_years: { high_school: 4, bachelor: 8 },
    },
    SICK: {
      employer_paid_days: 33, // 33일까지 고용주 부담 (80%)
      rate: 0.8,
      after_33_days: 'ZUS', // 이후 사회보험(ZUS)에서 지급
    },
    MATERNITY: { days: 140 }, // 20주 (첫째), 쌍둥이 +6주
    PATERNITY: { days: 14 },
    CHILDCARE: { months: 36 }, // 최대 36개월
    ON_DEMAND: { days: 4 }, // 긴급 휴가 (w trybie na żądanie)
  },
  contract_rules: {
    max_fixed_term_count: 3,
    max_fixed_term_months: 33,
    auto_convert_to_permanent: true,
    probation_max_months: 3,
    notice_period: [
      { tenure_months: 0, period_weeks: 2 }, // 6개월 미만
      { tenure_months: 6, period_months: 1 }, // 6개월~3년
      { tenure_months: 36, period_months: 3 }, // 3년 이상
    ],
  },
  social_insurance: {
    // ZUS (사회보험) 요율
    employer: {
      pension: 0.0976, // 연금 9.76%
      disability: 0.065, // 장애 6.5%
      accident: 0.0167, // 산재 1.67% (업종별 상이)
      labor_fund: 0.0245, // 노동기금 2.45%
      fgsp: 0.001, // 직원보증기금 0.1%
    },
    employee: {
      pension: 0.0976, // 연금 9.76%
      disability: 0.015, // 장애 1.5%
      health: 0.09, // 건강보험 9%
    },
    ppk: {
      employer_min: 0.015, // PPK 고용주 최소 1.5%
      employer_max: 0.04, // PPK 고용주 최대 4%
      employee_min: 0.02, // PPK 직원 최소 2%
      employee_max: 0.04, // PPK 직원 최대 4%
      auto_enroll: true, // 자동 가입 (opt-out 방식)
    },
  },
  record_retention_years: 10, // 근무시간 기록부 10년 보관 의무
  public_holidays_count: 13,
  sunday_work_restriction: true, // 일요일 근무 원칙적 금지
} as const
