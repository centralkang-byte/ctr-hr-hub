// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Approval Chain Configuration
// src/lib/payroll/approval-chains.ts
// ═══════════════════════════════════════════════════════════

// TODO: Move to Settings (Payroll) — 법인별 급여 승인 체계 (역할 코드 목록)
// 각 체인의 역할은 employee_roles.role.code 기준
export const PAYROLL_APPROVAL_CHAINS: Record<string, string[]> = {
    'CTR-KR': ['HR_MANAGER', 'CFO'],      // HR담당 → HR팀장 → CFO (3-step including requester)
    'CTR-CN': ['GENERAL_MANAGER'],         // HR담당 → 总经理 (2-step)
    'CTR-US': ['CONTROLLER'],              // HR → Controller (2-step)
    'CTR-RU': ['COUNTRY_HEAD'],            // HR담당 → 총괄 (2-step)
    'CTR-VN': ['COUNTRY_HEAD'],            // HR담당 → 법인장 (2-step)
    'CTR-MX': ['COUNTRY_HEAD'],            // HR담당 → 법인장 (2-step)
    'DEFAULT': ['HR_ADMIN'],               // fallback: HR담당 → HR관리자 1단계
}

/**
 * 법인 코드(entity code)로 승인 체인을 조회.
 * companyId 또는 회사 코드로 검색.
 */
export function getApprovalChain(companyCode: string | null): string[] {
    if (!companyCode) return PAYROLL_APPROVAL_CHAINS.DEFAULT
    // 정확히 일치하는 체인이 없으면 DEFAULT 반환
    return PAYROLL_APPROVAL_CHAINS[companyCode] ?? PAYROLL_APPROVAL_CHAINS.DEFAULT
}

// ─── 은행 코드 (이체 파일용) ─────────────────────────────────

// TODO: Move to Settings (Payroll) — 은행 코드 목록 (한국 표준 금융기관 코드)
export const BANK_CODES: Record<string, string> = {
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
}

// TODO: Move to Settings (Payroll) — 급여 지급일 (기본: 매월 25일)
export const DEFAULT_PAY_DAY = 25
