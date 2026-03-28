// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Profile Utilities
// 프로필 표시 권한 판별 + 조직 계층 추출
// ═══════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────

type DeptNode = {
  id: string
  name: string
  level: number
  parent?: DeptNode | null
} | null | undefined

// ─── Department Hierarchy ────────────────────────────────────

/**
 * Department 계층에서 level-2 조상(본부/DIV) 이름 반환.
 * 구조: level 0=ROOT, 1=BU, 2=DIV(본부), 3=SEC, 4=TM(팀)
 * 직원의 소속 부서(level 4)부터 위로 탐색해 level 2를 찾는다.
 */
export function getDivisionName(dept: DeptNode): string | null {
  if (!dept) return null
  if (dept.level === 2) return dept.name
  if (dept.level > 2 && dept.parent) return getDivisionName(dept.parent)
  return null
}

// ─── Profile Visibility (RBAC) ───────────────────────────────

/**
 * 직급(grade) 열람 권한 판별.
 * Tier 2 접근: SUPER_ADMIN, HR_ADMIN, 본인, 직속 상사
 */
export function canViewGrade(
  viewerRole: string,
  viewerEmployeeId: string,
  subjectEmployeeId: string,
  managerId: string | null,
): boolean {
  return (
    viewerRole === 'SUPER_ADMIN' ||
    viewerRole === 'HR_ADMIN' ||
    viewerEmployeeId === subjectEmployeeId ||
    (managerId !== null && viewerEmployeeId === managerId)
  )
}

/**
 * 민감 정보(비상연락처, 고용형태) 열람 권한 판별.
 * 동일한 Tier 2 규칙 적용.
 */
export const canViewSensitive = canViewGrade
