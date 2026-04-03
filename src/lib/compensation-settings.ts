// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation Settings Helpers (Server-Only)
// Async variants that read from CompanyProcessSetting.
// Separated from compensation.ts to avoid server-only
// import contamination in client components.
// ═══════════════════════════════════════════════════════════

import 'server-only'

import { getCompaRatioThresholds } from '@/lib/settings/get-setting'
import type { CompaColumn } from '@/lib/compensation'

/** Async variant — reads thresholds from CompanyProcessSetting */
export async function getCompaColumnFromSettings(
  compaRatio: number,
  companyId?: string | null,
): Promise<CompaColumn> {
  const thresholds = await getCompaRatioThresholds(companyId)
  if (compaRatio < thresholds.belowBandThreshold) return 'BELOW'
  if (compaRatio <= thresholds.aboveBandThreshold) return 'AT'
  return 'ABOVE'
}

/** Async variant of merit-matrix getComparatioBand */
export async function getComparatioBandFromSettings(
  comparatio: number,
  companyId?: string | null,
): Promise<'LOW' | 'MID' | 'HIGH'> {
  const thresholds = await getCompaRatioThresholds(companyId)
  if (comparatio < thresholds.belowBandThreshold) return 'LOW'
  if (comparatio > thresholds.aboveBandThreshold) return 'HIGH'
  return 'MID'
}
