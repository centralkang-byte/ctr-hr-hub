// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Approval Chain Configuration
// src/lib/payroll/approval-chains.ts
//
// Refactored (H-2c): async variants added that read from Settings.
// ═══════════════════════════════════════════════════════════

import { getPayrollSetting } from '@/lib/settings/get-setting'

// ─── Default approval chains (fallback) ──────────────────

export const PAYROLL_APPROVAL_CHAINS: Record<string, string[]> = {
    'CTR-KR': ['HR_MANAGER', 'CFO'],
    'CTR-CN': ['GENERAL_MANAGER'],
    'CTR-US': ['CONTROLLER'],
    'CTR-RU': ['COUNTRY_HEAD'],
    'CTR-VN': ['COUNTRY_HEAD'],
    'CTR-MX': ['COUNTRY_HEAD'],
    'DEFAULT': ['HR_ADMIN'],
}

/**
 * Synchronous version (backward-compatible)
 */
export function getApprovalChain(companyCode: string | null): string[] {
    if (!companyCode) return PAYROLL_APPROVAL_CHAINS.DEFAULT
    return PAYROLL_APPROVAL_CHAINS[companyCode] ?? PAYROLL_APPROVAL_CHAINS.DEFAULT
}

/**
 * Async version — reads from Settings, falls back to defaults
 */
export async function getApprovalChainFromSettings(
    companyCode: string | null,
    companyId?: string | null,
): Promise<string[]> {
    const settings = await getPayrollSetting<Record<string, string[]>>(
        'approval-chains',
        companyId,
    )

    if (settings && companyCode && settings[companyCode]) {
        return settings[companyCode]
    }

    if (!companyCode) return PAYROLL_APPROVAL_CHAINS.DEFAULT
    return PAYROLL_APPROVAL_CHAINS[companyCode] ?? PAYROLL_APPROVAL_CHAINS.DEFAULT
}

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
