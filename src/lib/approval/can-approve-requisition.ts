// ═══════════════════════════════════════════════════════════
// CTR HR Hub — UI helper: 채용 요청 결재 버튼 노출 가능 여부 (list page only)
//
// list page(RequisitionListClient)에서 approve 버튼을 렌더할지 판단.
// 서버측 권한 검증의 final gate는 isRequisitionApproverAllowed(...)이며,
// 본 helper는 list UI 버튼 노출 정책 SSOT.
//
// detail page는 server-derived `data.canApprove`(route.ts GET 응답)를 직접 사용 —
// SessionUser.role이 단일 JWT pin이라 multi-role employee(HR_ADMIN base + 보조
// MANAGER role 등) 시 본 helper로는 false-deny 발생. validator가 active
// EmployeeRoles로 계산한 server-trusted hint 사용으로 회피.
//
// list가 helper를 계속 쓰는 이유: tab='my' 시 myApprovals 서버 필터(Session 200/206
// matcher SSOT)가 active EmployeeRoles 기반으로 multi-role을 처리해 결과 집합 자체가
// server-verified — passesServerApproverGate=true로 노출 위임 가능. tab='all'/'pending'
// 은 viewer 권한 보유자(HR_ADMIN/SUPER_ADMIN)만 접근하므로 helper의 role-기반 분기로 충분.
//
// 정책:
//   - SUPER_ADMIN: 모든 step 노출 (server bypass 정합)
//   - HR_ADMIN: hr_admin step만 — dept_head/direct_manager step에서 클릭 시
//     server per-step check가 403 반환 → 버튼 노출 자체를 차단해 UX 회귀 방지
//   - 그 외 role(EMPLOYEE/MANAGER/EXECUTIVE): server-verified hint에 일임
//     · list 'my' 탭: myApprovals 서버 필터가 user를 approver로 검증한 결과만 반환
//       → tab='my' 인지가 곧 hint
// ═══════════════════════════════════════════════════════════

export interface CanApproveRequisitionContext {
  /** 사용자 role (`SUPER_ADMIN`/`HR_ADMIN`/`EXECUTIVE`/`MANAGER`/`EMPLOYEE`) */
  role: string
  /** 요청 상태 — 'pending'만 결재 가능 */
  status: string
  /** 현재 step의 결재 record. 없으면 결재 불가. */
  currentRecord: { approverRole: string } | undefined
  /**
   * 호출 컨텍스트가 server-side approver gate를 통과했음을 보장하는가.
   * `true`면 비-HR/비-SUPER 사용자에게도 노출.
   *
   * List page 호출 시: `tab === 'my'` (myApprovals 필터로 server-검증된 결과만 표시).
   *
   * `passesServerApproverGate=true`면서 SUPER_ADMIN/HR_ADMIN인 케이스도 정상 — 어차피
   * 위 두 분기에서 먼저 처리되므로 동작 동일.
   */
  passesServerApproverGate: boolean
}

export function canApproveRequisition(ctx: CanApproveRequisitionContext): boolean {
  if (ctx.status !== 'pending') return false
  if (!ctx.currentRecord) return false

  if (ctx.role === 'SUPER_ADMIN') return true
  if (ctx.role === 'HR_ADMIN' && ctx.currentRecord.approverRole === 'hr_admin') return true
  return ctx.passesServerApproverGate
}
