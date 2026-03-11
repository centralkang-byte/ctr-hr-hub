// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Country-Specific Asset Deduction Rules
// src/lib/labor/asset-deduction.ts
//
// E-2: GP#2 Offboarding Pipeline
// Per spec B10: Labor law compliance for unreturned asset deductions
// ═══════════════════════════════════════════════════════════

export interface AssetDeductionCheck {
    canDeduct: boolean
    maxDeductionRatio: number | null // e.g., 0.20 for Russia (20% of monthly salary)
    requiresConsent: boolean
    reason?: string // Why deduction is not possible
}

/**
 * Check if an unreturned asset can be deducted from final settlement.
 * Rules vary by country per labor law.
 *
 * @param countryCode - ISO country code (KR, US, CN, RU, VN, MX)
 * @param consentDocExists - Whether employee pre-signed asset deduction consent
 * @param residualValue - Current residual value after depreciation
 * @param monthlySalary - Employee's monthly salary (needed for capped countries like RU)
 */
export function canDeductUnreturnedAsset(
    countryCode: string,
    consentDocExists: boolean,
    residualValue: number,
    monthlySalary?: number,
): AssetDeductionCheck {
    const code = countryCode.toUpperCase()

    switch (code) {
        // ─── KR: 한국 (근로기준법) ────────────────────────────
        // 사전 서면 동의가 있으면 공제 가능. 상한 없음.
        // Settings-connected: country-specific deduction rules (statutory defaults)
        case 'KR':
            if (!consentDocExists) {
                return {
                    canDeduct: false,
                    maxDeductionRatio: null,
                    requiresConsent: true,
                    reason: '근로기준법: 사전 서면 동의 없이 급여에서 공제할 수 없습니다. 민사 청구로 전환하세요.',
                }
            }
            return {
                canDeduct: true,
                maxDeductionRatio: null,
                requiresConsent: true,
            }

        // ─── US: 미국 (varies by state) ───────────────────────
        // Default: consent-based. Some states (CA, NY) restrict deductions.
        // Settings-connected: country-specific deduction rules (statutory defaults) — state-level configuration needed
        case 'US':
            if (!consentDocExists) {
                return {
                    canDeduct: false,
                    maxDeductionRatio: null,
                    requiresConsent: true,
                    reason: 'US: Written consent required for wage deductions. Process via civil claim.',
                }
            }
            return {
                canDeduct: true,
                maxDeductionRatio: null,
                requiresConsent: true,
            }

        // ─── CN: 중국 ─────────────────────────────────────────
        // Limited deduction cases — consent + documented damage evidence required.
        // Settings-connected: country-specific deduction rules (statutory defaults)
        case 'CN':
            if (!consentDocExists) {
                return {
                    canDeduct: false,
                    maxDeductionRatio: null,
                    requiresConsent: true,
                    reason: 'CN: 서면 동의 및 손해 증명 필요. 민사 청구로 전환하세요.',
                }
            }
            return {
                canDeduct: true,
                maxDeductionRatio: 0.2, // Generally capped
                requiresConsent: true,
            }

        // ─── RU: 러시아 ───────────────────────────────────────
        // Capped at 20% of monthly salary per deduction cycle.
        // Settings-connected: country-specific deduction rules (statutory defaults)
        case 'RU':
            if (!monthlySalary || monthlySalary <= 0) {
                return {
                    canDeduct: false,
                    maxDeductionRatio: 0.2,
                    requiresConsent: false,
                    reason: 'RU: Monthly salary required to calculate 20% cap.',
                }
            }
            const maxAmount = monthlySalary * 0.2
            if (residualValue > maxAmount) {
                return {
                    canDeduct: true,
                    maxDeductionRatio: 0.2,
                    requiresConsent: false,
                    reason: `RU: 공제 가능하나 월급의 20% (${maxAmount.toLocaleString()}) 상한 적용. 잔액은 분할 또는 민사 청구.`,
                }
            }
            return {
                canDeduct: true,
                maxDeductionRatio: 0.2,
                requiresConsent: false,
            }

        // ─── VN: 베트남 ───────────────────────────────────────
        // Uncertain / restrictive. Default: cannot deduct → civil claim.
        // Settings-connected: country-specific deduction rules (statutory defaults)
        case 'VN':
            return {
                canDeduct: false,
                maxDeductionRatio: null,
                requiresConsent: true,
                reason: 'VN: 노동법상 급여 공제 불확실. 민사 청구로 처리하세요.',
            }

        // ─── MX: 멕시코 ───────────────────────────────────────
        // Uncertain / restrictive. Default: cannot deduct → civil claim.
        // Settings-connected: country-specific deduction rules (statutory defaults)
        case 'MX':
            return {
                canDeduct: false,
                maxDeductionRatio: null,
                requiresConsent: true,
                reason: 'MX: 급여 공제 불확실. 민사 청구로 처리하세요.',
            }

        // ─── Default: Unknown country ─────────────────────────
        default:
            return {
                canDeduct: false,
                maxDeductionRatio: null,
                requiresConsent: true,
                reason: `${code}: 국가별 공제 규정이 설정되지 않았습니다. 법무팀 확인 후 민사 청구로 처리하세요.`,
            }
    }
}

/**
 * Calculate actual deduction amount considering country caps.
 */
export function calculateDeductionAmount(
    check: AssetDeductionCheck,
    residualValue: number,
    monthlySalary?: number,
): number {
    if (!check.canDeduct) return 0

    if (check.maxDeductionRatio !== null && monthlySalary) {
        const cap = monthlySalary * check.maxDeductionRatio
        return Math.min(residualValue, cap)
    }

    return residualValue
}
