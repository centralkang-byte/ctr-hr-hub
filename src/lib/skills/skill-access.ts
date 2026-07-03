// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Skills Viewer/Evaluator Access SSOT
// src/lib/skills/skill-access.ts
//
// 역량(EmployeeSkillAssessment) 열람·평가 권한 판정 단일 출처.
// 모델에 companyId 컬럼이 없어(employeeId=글로벌 UUID) 테넌트 격리는
// 대상 직원의 "활성 primary 발령 회사"로 검증한다.
// skills/assessments·radar(읽기)·team-assessments(읽기 로스터·쓰기)가 공유.
//
// 읽기: 본인 · SUPER(전사) · HR_ADMIN/EXECUTIVE/MANAGER(자사) — 스킬 매트릭스
//       드릴다운이 자사 전 직원을 보여주므로 자사 스코프(직속부하 한정 아님).
// 쓰기: SUPER(전사) · HR_ADMIN(자사) · MANAGER(현재 직속부하만) — 평가는
//       finalLevel을 덮어쓰는 파괴적 쓰기라 매니저는 보고라인으로 한정
//       (Codex Gate1 P1: 자사 전 직원 쓰기는 수평 권한상승).
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { ROLE } from '@/lib/constants'
import { isCurrentManagerOf } from '@/lib/performance/peer-access'
import type { Prisma } from '@/generated/prisma/client'

type SkillAccessUser = { employeeId: string | null; role: string; companyId: string }

// 읽기에서 "타인 조회" 허용 role (SUPER는 별도 전사 허용) — 스킬 매트릭스 페이지
// 열람 대상(SUPER_ADMIN/HR_ADMIN/MANAGER/EXECUTIVE)과 정렬.
const READ_SAME_COMPANY_ROLES = new Set<string>([ROLE.HR_ADMIN, ROLE.EXECUTIVE, ROLE.MANAGER])

/**
 * 로스터형 스킬 화면(team-assessments·matrix) 핸들러 게이트 공유 role 목록.
 * EMPLOYEES.VIEW 는 EMPLOYEE 도 보유하므로 라우트별 인라인 목록 대신 이 SSOT 사용
 * (라우트 간 role 목록 drift 방지).
 */
export const SKILL_ROSTER_VIEW_ROLES: readonly string[] = [
  ROLE.SUPER_ADMIN,
  ROLE.HR_ADMIN,
  ROLE.EXECUTIVE,
  ROLE.MANAGER,
]

/**
 * "현재 활성" primary 발령 where — assignments.ts SSOT 창(effectiveDate<=now AND
 * (endDate null | 미래)). `endDate: null` 단독은 예약 조직개편/전출 시 현 발령(미래
 * endDate) 누락 + 미래 발령 조기 포함 (direct-reports.ts·peer-access.ts 와 동일
 * Codex Gate2 P1 클래스 — 미래발령으로 도착 법인 HR 이 조기 read/write 획득 차단).
 */
export function activePrimaryAssignmentWhere(
  companyId?: string,
): Prisma.EmployeeAssignmentWhereInput {
  const now = new Date()
  return {
    isPrimary: true,
    ...(companyId ? { companyId } : {}),
    effectiveDate: { lte: now },
    OR: [{ endDate: null }, { endDate: { gt: now } }],
  }
}

/**
 * MANAGER 직속부하 재필터 형상 (S324 members/announce 패턴): 자사 active primary 발령.
 * getDirectReportIds·isCurrentManagerOf 는 발령 status·companyId 를 거르지 않으므로
 * (오프보딩 진행중 = status 만 변경·endDate null 유지), 직속부하 노출/쓰기 경로는
 * 이 형상으로 재필터해 퇴직 진행중·타법인 직속부하를 제외한다.
 * status 는 denylist — allowlist('ACTIVE'만)는 휴직(ON_LEAVE) 직속부하 평가를 막고
 * legacy status 값을 누락시킨다 (direct-reports.ts 문서화된 함정 + Codex Gate2 P2).
 */
export function activeReportAssignmentWhere(
  companyId: string,
): Prisma.EmployeeAssignmentWhereInput {
  return {
    ...activePrimaryAssignmentWhere(companyId),
    status: { notIn: ['RESIGNED', 'TERMINATED'] },
  }
}

/** 대상 직원이 주어진 회사에 활성 primary 발령을 보유하는가 (테넌트 격리 검증). */
export async function isTargetInCompany(
  targetEmployeeId: string,
  companyId: string,
): Promise<boolean> {
  const hit = await prisma.employee.findFirst({
    where: {
      id: targetEmployeeId,
      assignments: { some: activePrimaryAssignmentWhere(companyId) },
    },
    select: { id: true },
  })
  return !!hit
}

/**
 * 역량 데이터 열람 권한 — 본인 · SUPER(전사) · HR/EXEC/MANAGER(자사).
 * 그 외(EMPLOYEE 등)는 본인만. 자사 스코프는 대상의 활성 primary 발령 회사로 판정.
 */
export async function canReadEmployeeSkills(
  user: SkillAccessUser,
  targetEmployeeId: string,
): Promise<boolean> {
  if (user.employeeId && user.employeeId === targetEmployeeId) return true
  if (user.role === ROLE.SUPER_ADMIN) return true
  if (READ_SAME_COMPANY_ROLES.has(user.role)) {
    return isTargetInCompany(targetEmployeeId, user.companyId)
  }
  return false
}

/**
 * 역량 평가(쓰기) 권한 — SUPER(전사) · HR_ADMIN(자사) · MANAGER(현재 직속부하만).
 * 자기 자신 매니저평가 금지. EXECUTIVE·EMPLOYEE는 쓰기 불가(기존 canEval 집합 유지).
 */
export async function canWriteEmployeeSkills(
  user: SkillAccessUser,
  targetEmployeeId: string,
): Promise<boolean> {
  if (user.employeeId && user.employeeId === targetEmployeeId) return false
  if (user.role === ROLE.SUPER_ADMIN) return true
  if (user.role === ROLE.HR_ADMIN) {
    return isTargetInCompany(targetEmployeeId, user.companyId)
  }
  if (user.role === ROLE.MANAGER) {
    if (!user.employeeId) return false
    // 보고라인 + S324 재필터: 오프보딩 진행중(RESIGNED 등)·타법인 직속부하 평가 차단.
    // team-assessments GET 로스터와 동일 집합 유지 (GET-노출/POST-403 드리프트 방지).
    if (!(await isCurrentManagerOf(user.employeeId, targetEmployeeId))) return false
    const activeReport = await prisma.employee.findFirst({
      where: {
        id: targetEmployeeId,
        assignments: { some: activeReportAssignmentWhere(user.companyId) },
      },
      select: { id: true },
    })
    return !!activeReport
  }
  return false
}
