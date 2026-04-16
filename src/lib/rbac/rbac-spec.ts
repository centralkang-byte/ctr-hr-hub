// ═══════════════════════════════════════════════════════════
// CTR HR Hub — RBAC Single Source of Truth
//
// 역할 그룹, 라우트 ACL 중앙 정의.
// middleware.ts, navigation.ts, page guard, 테스트 모두 여기서 import.
//
// ⚠️ Pure data only — UI/Prisma/Next runtime import 금지
// ═══════════════════════════════════════════════════════════

import type { RoleCode } from '@/lib/constants'

// ─── Role Groups ─────────────────────────────────────────

export const ROLE_GROUPS = {
  /** 모든 인증된 사용자 */
  ALL_ROLES: ['EMPLOYEE', 'MANAGER', 'EXECUTIVE', 'HR_ADMIN', 'SUPER_ADMIN'],
  /** 매니저 이상 (EXECUTIVE 포함) — 팀 관리 + 전략적 역할 */
  MANAGER_UP: ['MANAGER', 'EXECUTIVE', 'HR_ADMIN', 'SUPER_ADMIN'],
  /** 직속 팀 관리자만 (EXECUTIVE 제외) — manager-hub 등 직속 보고 라인 기능 */
  MANAGER_ONLY: ['MANAGER', 'HR_ADMIN', 'SUPER_ADMIN'],
  /** HR 관리자 이상 */
  HR_UP: ['HR_ADMIN', 'SUPER_ADMIN'],
} as const satisfies Record<string, readonly RoleCode[]>

// ─── Route ACL ───────────────────────────────────────────
// path prefix → 허용 역할 매핑.
// Order matters: 더 specific한 prefix가 먼저 와야 함.
// 여기에 없는 라우트는 인증만 필요 (모든 역할 허용).

export interface RouteRule {
  prefix: string
  allowedRoles: readonly string[]
}

export const ROUTE_ACL: readonly RouteRule[] = [
  // ── HR_ADMIN+ only sections ──────────────────────────
  // Settings (section 10)
  { prefix: '/settings', allowedRoles: ROLE_GROUPS.HR_UP },
  // Payroll admin (section 7) — but /payroll/me is employee self-service
  { prefix: '/payroll/me', allowedRoles: ROLE_GROUPS.ALL_ROLES },
  { prefix: '/payroll', allowedRoles: ROLE_GROUPS.HR_UP },
  // Compliance (section 9)
  { prefix: '/compliance', allowedRoles: ROLE_GROUPS.HR_UP },
  // HR Management (section 4)
  { prefix: '/employees', allowedRoles: ROLE_GROUPS.HR_UP },
  { prefix: '/directory', allowedRoles: ROLE_GROUPS.ALL_ROLES },
  { prefix: '/org', allowedRoles: ROLE_GROUPS.ALL_ROLES },
  { prefix: '/attendance/admin', allowedRoles: ROLE_GROUPS.HR_UP },
  { prefix: '/leave/admin', allowedRoles: ROLE_GROUPS.HR_UP },
  { prefix: '/onboarding/me', allowedRoles: ROLE_GROUPS.ALL_ROLES },
  { prefix: '/onboarding', allowedRoles: ROLE_GROUPS.HR_UP },
  { prefix: '/offboarding/exit-interviews', allowedRoles: ROLE_GROUPS.HR_UP },
  { prefix: '/discipline', allowedRoles: ROLE_GROUPS.HR_UP },
  // Recruitment (section 5)
  { prefix: '/recruitment', allowedRoles: ROLE_GROUPS.HR_UP },
  { prefix: '/talent', allowedRoles: ROLE_GROUPS.HR_UP },
  // Performance & Compensation admin (section 6)
  { prefix: '/performance/admin', allowedRoles: ROLE_GROUPS.HR_UP },
  { prefix: '/performance/goals', allowedRoles: ROLE_GROUPS.MANAGER_UP },
  { prefix: '/performance/quarterly-reviews', allowedRoles: ROLE_GROUPS.HR_UP },
  { prefix: '/performance/calibration', allowedRoles: ROLE_GROUPS.HR_UP },
  { prefix: '/performance/results', allowedRoles: ROLE_GROUPS.HR_UP },
  { prefix: '/performance/peer-review', allowedRoles: ROLE_GROUPS.MANAGER_UP },
  { prefix: '/compensation', allowedRoles: ROLE_GROUPS.HR_UP },
  { prefix: '/benefits', allowedRoles: ROLE_GROUPS.HR_UP },

  // ── MANAGER+ sections ────────────────────────────────
  // Team management (section 3) — manager-hub는 MANAGER_ONLY (EXECUTIVE 제외)
  { prefix: '/manager-hub', allowedRoles: ROLE_GROUPS.MANAGER_ONLY },
  { prefix: '/attendance/team', allowedRoles: ROLE_GROUPS.MANAGER_UP },
  { prefix: '/leave/team', allowedRoles: ROLE_GROUPS.MANAGER_UP },
  { prefix: '/performance/team-goals', allowedRoles: ROLE_GROUPS.MANAGER_UP },
  { prefix: '/performance/manager-eval', allowedRoles: ROLE_GROUPS.MANAGER_UP },
  { prefix: '/performance/one-on-one', allowedRoles: ROLE_GROUPS.MANAGER_UP },
  { prefix: '/delegation', allowedRoles: ROLE_GROUPS.MANAGER_UP },
  // Insights (section 8)
  { prefix: '/analytics', allowedRoles: ROLE_GROUPS.MANAGER_UP },

  // ── API routes mirroring page ACL ────────────────────
  { prefix: '/api/v1/settings', allowedRoles: ROLE_GROUPS.HR_UP },
  { prefix: '/api/v1/payroll/me', allowedRoles: ROLE_GROUPS.ALL_ROLES },
  { prefix: '/api/v1/payroll', allowedRoles: ROLE_GROUPS.HR_UP },
  { prefix: '/api/v1/compliance', allowedRoles: ROLE_GROUPS.HR_UP },
  // manager-hub API도 MANAGER_ONLY (Codex HIGH: 페이지와 동일 정책 적용)
  { prefix: '/api/v1/manager-hub', allowedRoles: ROLE_GROUPS.MANAGER_ONLY },
  // Recruitment: internal-jobs available to all (self-service internal mobility)
  { prefix: '/api/v1/recruitment/internal-jobs', allowedRoles: ROLE_GROUPS.ALL_ROLES },
  // Recruitment: interviews available to all (handler filters by interviewerId for non-HR)
  { prefix: '/api/v1/recruitment/interviews', allowedRoles: ROLE_GROUPS.ALL_ROLES },
  // Recruitment: postings + applicants readable by managers (hiring managers)
  { prefix: '/api/v1/recruitment/postings', allowedRoles: ROLE_GROUPS.MANAGER_UP },
  { prefix: '/api/v1/recruitment/applicants', allowedRoles: ROLE_GROUPS.MANAGER_UP },
  { prefix: '/api/v1/recruitment', allowedRoles: ROLE_GROUPS.HR_UP },
  { prefix: '/api/v1/year-end/hr', allowedRoles: ROLE_GROUPS.HR_UP },
  { prefix: '/api/v1/analytics', allowedRoles: ROLE_GROUPS.MANAGER_UP },
]

// ─── Public API Routes (intentionally unprotected) ──────
// 감사용 문서 상수. middleware PUBLIC_PATHS와 별도 관리.
// Batch 3 라우트 감사 기준: 599 라우트 중 9건만 의도적 public.

export const PUBLIC_API_ROUTES = [
  { path: '/api/health', reason: 'Uptime monitoring' },
  { path: '/api/v1/monitoring/health', reason: 'Detailed health check (DB/Redis)' },
  { path: '/api/auth', reason: 'NextAuth callback handler' },
  { path: '/api/v1/locale', reason: 'Pre-login i18n locale switching' },
  { path: '/api/v1/tenant-settings/brand-colors', reason: 'Pre-login brand theming' },
  { path: '/api/v1/teams/bot', reason: 'MS Teams bot (signature-verified)' },
  { path: '/api/v1/teams/webhook', reason: 'MS Teams webhook (HMAC-verified)' },
  { path: '/api/v1/teams/recognition', reason: 'MS Teams recognition (signature-verified)' },
  { path: '/api/v1/employees/bulk-upload', reason: 'Deprecated — returns 410 Gone' },
] as const

// ─── Helper ──────────────────────────────────────────────

export function findRouteRule(pathname: string): RouteRule | null {
  for (const rule of ROUTE_ACL) {
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix + '/')) {
      return rule
    }
  }
  return null
}
