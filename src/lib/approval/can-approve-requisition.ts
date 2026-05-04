// ═══════════════════════════════════════════════════════════
// CTR HR Hub — UI helper: 채용 요청 결재 버튼 노출 가능 여부
//
// 클라이언트 컴포넌트(list/detail)에서 approve 버튼을 렌더할지 판단.
// 서버측 권한 검증의 final gate는 isRequisitionApproverAllowed(...)이며,
// 본 helper는 UI 버튼 노출 정책 SSOT — 두 곳(list/detail)에서 동일 규칙 적용.
//
// 정책:
//   - SUPER_ADMIN: 모든 step 노출 (server bypass 정합)
//   - HR_ADMIN: hr_admin step만 — dept_head/direct_manager step에서 클릭 시
//     server per-step check가 403 반환 → 버튼 노출 자체를 차단해 UX 회귀 방지
//   - 그 외 role(EMPLOYEE/MANAGER/EXECUTIVE): server-verified hint에 일임
//     · list 'my' 탭: myApprovals 서버 필터(Session 200)가 user를 approver로 검증한
//       결과만 반환 → tab='my' 인지가 곧 hint
//     · detail: GET이 viewer OR requester OR current approver만 통과시킴
//       (Session 202) → non-viewer가 도달했고 requester가 아니면 approver 확정
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
   * 호출자별 계산:
   *   - List page: `tab === 'my'` (myApprovals 필터로 server-검증된 결과만 표시)
   *   - Detail page: `!canViewAll && !isRequester` (Session 202 GET 통과 시 approver 확정)
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
