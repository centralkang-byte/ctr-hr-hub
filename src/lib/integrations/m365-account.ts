// ═══════════════════════════════════════════════════════════
// CTR HR Hub — M365 Account Provisioning Integration (Mock)
// ═══════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────

export interface M365ProvisionResult {
  success: boolean
  email: string
  actionType: string
  licensesRevoked?: string[]
  errorMessage?: string
}

export interface M365AccountStatus {
  exists: boolean
  enabled: boolean
  licenses: string[]
  lastSignIn: string | null
}

// ─── Available License Types ────────────────────────────

export const M365_LICENSES = [
  { id: 'E3', name: 'Microsoft 365 E3' },
  { id: 'E5', name: 'Microsoft 365 E5' },
  { id: 'F1', name: 'Microsoft 365 F1' },
  { id: 'TEAMS', name: 'Microsoft Teams' },
  { id: 'EXCHANGE', name: 'Exchange Online' },
] as const

// ─── Helpers ────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Provision New M365 Account (Mock) ──────────────────

export async function provisionM365Account(
  email: string,
  displayName: string,
): Promise<M365ProvisionResult> {
  await delay(500)

  return {
    success: true,
    email,
    actionType: 'PROVISION',
  }
}

// ─── Disable M365 Account (Mock) ────────────────────────

export async function disableM365Account(
  email: string,
): Promise<M365ProvisionResult> {
  await delay(500)

  return {
    success: true,
    email,
    actionType: 'DISABLE',
  }
}

// ─── Revoke M365 Licenses (Mock) ────────────────────────

export async function revokeM365Licenses(
  email: string,
  licenses: string[],
): Promise<M365ProvisionResult> {
  await delay(500)

  return {
    success: true,
    email,
    actionType: 'LICENSE_REVOKE',
    licensesRevoked: licenses,
  }
}

// ─── Convert to Shared Mailbox (Mock) ───────────────────

export async function convertToSharedMailbox(
  email: string,
): Promise<M365ProvisionResult> {
  await delay(500)

  return {
    success: true,
    email,
    actionType: 'SHARED_MAILBOX_CONVERT',
  }
}

// ─── Check M365 Account Status (Mock) ───────────────────

export async function getM365AccountStatus(
  email: string,
): Promise<M365AccountStatus> {
  await delay(500)

  return {
    exists: true,
    enabled: true,
    licenses: ['E3', 'TEAMS'],
    lastSignIn: new Date().toISOString(),
  }
}
