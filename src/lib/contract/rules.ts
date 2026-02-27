// 국가별 계약 관리 비즈니스 로직 (STEP 2.5)

export interface ContractRule {
  country_code: string
  max_fixed_term_count: number // 최대 기간제 횟수 (0 = 무제한)
  max_fixed_term_months: number // 최대 기간제 기간 (개월, 0 = 무제한)
  auto_convert_to_permanent: boolean // 초과 시 무기계약 자동 전환 여부
  probation_range: { min_days: number; max_days: number } // 수습 범위
}

export const CONTRACT_RULES: Record<string, ContractRule> = {
  KR: {
    country_code: 'KR',
    max_fixed_term_count: 0, // 무제한 (but 24개월 후 전환)
    max_fixed_term_months: 24,
    auto_convert_to_permanent: true,
    probation_range: { min_days: 90, max_days: 90 },
  },
  CN: {
    country_code: 'CN',
    max_fixed_term_count: 2,
    max_fixed_term_months: 0, // 무제한 (횟수 기준)
    auto_convert_to_permanent: true,
    probation_range: { min_days: 30, max_days: 180 },
  },
  RU: {
    country_code: 'RU',
    max_fixed_term_count: 0, // 무제한
    max_fixed_term_months: 60,
    auto_convert_to_permanent: false,
    probation_range: { min_days: 90, max_days: 180 },
  },
  VN: {
    country_code: 'VN',
    max_fixed_term_count: 2,
    max_fixed_term_months: 72, // 36×2
    auto_convert_to_permanent: true,
    probation_range: { min_days: 6, max_days: 180 },
  },
  MX: {
    country_code: 'MX',
    max_fixed_term_count: 0, // 무제한
    max_fixed_term_months: 0, // 무제한
    auto_convert_to_permanent: false,
    probation_range: { min_days: 30, max_days: 180 },
  },
  US: {
    country_code: 'US',
    max_fixed_term_count: 0, // 무제한 (At-will)
    max_fixed_term_months: 0,
    auto_convert_to_permanent: false,
    probation_range: { min_days: 90, max_days: 90 },
  },
  PL: {
    country_code: 'PL',
    max_fixed_term_count: 3,
    max_fixed_term_months: 33,
    auto_convert_to_permanent: true,
    probation_range: { min_days: 0, max_days: 90 },
  },
}

export function getContractRule(countryCode: string): ContractRule {
  return CONTRACT_RULES[countryCode] ?? CONTRACT_RULES['KR']
}

export function shouldAutoConvert(
  countryCode: string,
  fixedTermCount: number,
  totalFixedTermMonths: number,
): boolean {
  const rule = getContractRule(countryCode)
  if (!rule.auto_convert_to_permanent) return false
  if (rule.max_fixed_term_count > 0 && fixedTermCount >= rule.max_fixed_term_count) return true
  if (rule.max_fixed_term_months > 0 && totalFixedTermMonths >= rule.max_fixed_term_months)
    return true
  return false
}

export const CONTRACT_NOTIFICATION_EVENTS = [
  'CONTRACT_EXPIRING_90D',
  'CONTRACT_EXPIRING_30D',
  'CONTRACT_EXPIRING_7D',
  'CONTRACT_AUTO_CONVERT',
  'PROBATION_ENDING_14D',
  'PROBATION_ENDING_7D',
] as const

export const WORK_PERMIT_NOTIFICATION_EVENTS = [
  'WORK_PERMIT_EXPIRING_90D',
  'WORK_PERMIT_EXPIRING_60D',
  'WORK_PERMIT_EXPIRING_30D',
  'WORK_PERMIT_EXPIRED',
] as const
