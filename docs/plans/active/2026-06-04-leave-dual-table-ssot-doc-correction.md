# [백로그] Dual Leave Table — 진짜 SSOT 확정 후 전 문서 일괄 정정

> 생성: 2026-06-04 (리포 정리 Phase 1a 파생). **정리 트랙과 분리된 독립 task** — 정리 PR(SHARED 은퇴)에서 의도적으로 제외함.

## 문제
`EmployeeLeaveBalance` vs `LeaveYearBalance` 역할이 문서마다 **역전 서술**됨:
- `README.md` Architecture Decisions(§5) + (은퇴된) `context/SHARED.md`: "EmployeeLeaveBalance = Usage tracking SSOT / LeaveYearBalance = output only / intentional not a bug"
- **코드·커밋 방향은 반대**: `src/lib/leave/balance-renewal.ts:5`(`@deprecated`), `src/lib/leave/eventBasedLeave.ts:5`("LeaveYearBalance로 잔액 추적"), 커밋 #102·#120("legacy 잔액 → **SSOT LeaveYearBalance** 전환"), 메모리 `hrhub-leave-balance-dual-table`("LeaveYearBalance 신·SSOT / EmployeeLeaveBalance 구·레거시").

## 왜 정리 PR에서 제외했나
- **contested content** — "어느 게 SSOT냐"는 코드 재확인이 필요한 사실 판단이지 파일 정리가 아님.
- **범위 오염** — 정리 PR에 아키텍처 정정이 섞이면 리뷰·롤백이 흐려짐.
- README 외 `docs/handover`·`docs/specs` 등에도 같은 역전이 퍼졌을 가능성 → "한 파일 수정"이 아니라 "전 문서 일괄".

## 할 일 (독립 트랙)
1. 코드로 dual table 중 **현재 진짜 SSOT 확정** (마이그레이션 완료 여부 포함 — Phase 5/6 미완 상태 확인).
2. 확정된 진실로 **전 문서 일괄 정정** — `git grep -n "EmployeeLeaveBalance"` 로 오염 문서 전수 후.
3. 근거: 메모리 `hrhub-leave-balance-dual-table`, 커밋 #102/#120, `src/lib/leave/*`.
