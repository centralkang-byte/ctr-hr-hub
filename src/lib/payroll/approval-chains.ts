// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Approval Chain Configuration
// src/lib/payroll/approval-chains.ts
//
// Refactored (H-2c): async variants added that read from Settings.
// ═══════════════════════════════════════════════════════════

import { getPayrollSetting } from '@/lib/settings/get-setting'
import { resolveApprovalFlow } from '@/lib/approval/resolve-approval-flow'

// ─── Default approval chains (fallback) ──────────────────
// 규정 참조: CP-A-03-04 전결관리규정 Rev13 + 부표#1 업무전결권한기준표
// Gap: 아래 역할명(HR_MANAGER, CFO 등)은 규정 직급(본부장, 대표)과 매핑 필요
// → docs/regulation-audit/A1-gap-analysis.md 참조

export const PAYROLL_APPROVAL_CHAINS: Record<string, string[]> = {
    'CTR': ['HR_MANAGER', 'CFO'],
    'CTR-CN': ['GENERAL_MANAGER'],
    'CTR-US': ['CONTROLLER'],
    'CTR-RU': ['COUNTRY_HEAD'],
    'CTR-VN': ['COUNTRY_HEAD'],
    'CTR-EU': ['COUNTRY_HEAD'],
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
 * ApprovalFlow 기반 체인 조회 (Settings > 결재 플로우에서 설정)
 * 우선순위: ApprovalFlow(법인) > ApprovalFlow(글로벌) > Settings 테이블 > 하드코딩
 */
export async function getApprovalChainFromSettings(
    companyCode: string | null,
    companyId?: string | null,
): Promise<string[]> {
    // 1. ApprovalFlow에서 payroll 모듈 플로우 조회 (공용 resolver 사용)
    const steps = await resolveApprovalFlow('payroll', companyId ?? null)
    if (steps.length > 0) {
        return steps.map(s => s.approverRole ?? 'HR_ADMIN')
    }

    // 2. Settings 테이블 fallback
    const settings = await getPayrollSetting<Record<string, string[]>>(
        'approval-chains',
        companyId,
    )

    if (settings && companyCode && settings[companyCode]) {
        return settings[companyCode]
    }

    // 3. 하드코딩 fallback
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
