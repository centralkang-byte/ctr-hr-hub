// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Approval Chain Configuration
// src/lib/payroll/approval-chains.ts
//
// Refactored (H-2c): async variants added that read from Settings.
// ═══════════════════════════════════════════════════════════

import { getPayrollSetting } from '@/lib/settings/get-setting'
// 급여 승인 체인은 ApprovalFlow SSOT로 이전됨 — resolveApprovalFlow('payroll', companyId).
// submit-for-approval이 단계 생성, approve가 검증(회사 단위 role 보유), approval-status가
// 미리보기까지 모두 flow 기반. 레거시 PAYROLL_APPROVAL_CHAINS / getApprovalChain /
// getApprovalChainFromSettings (전부 미사용)는 #10(전결 SoD) 마이그레이션에서 제거.
// 규정 매핑 근거: docs/regulation-audit/A1-gap-analysis.md (G1).

// ─── 은행 코드 (이체 파일용) ─────────────────────────────────

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

/**
 * Async — reads bank codes from Settings
 */
export async function getBankCodesFromSettings(
    companyId?: string | null,
): Promise<Record<string, string>> {
    const settings = await getPayrollSetting<Record<string, string>>(
        'bank-codes',
        companyId,
    )
    return settings ?? BANK_CODES
}

export const DEFAULT_PAY_DAY = 25

/**
 * Async — reads pay day from Settings
 */
export async function getPayDayFromSettings(
    companyId?: string | null,
): Promise<number> {
    const settings = await getPayrollSetting<{ payDay: number }>(
        'pay-schedule',
        companyId,
    )
    return settings?.payDay ?? DEFAULT_PAY_DAY
}
