# Modal → WdDrawer (우측 슬라이드) 전환 — 결정 확인 + 인벤토리

> Created 2026-06-10 (S275 말미, CEO 지적: 근태 보정 다이얼로그가 팝업으로 뜸).
> Status: **옵션 ② 실행 완료 (2026-06-10, S276)** — CEO가 "명문화 + 근태보정 카나리" 선택.
> - 명문화: `DESIGN.md` §5.4 컨테이너 결정표(WdDrawer/WizardShell/Dialog/Inspector) + `rules/design.md` Form 섹션·Forbidden Patterns
> - 카나리: `AttendanceAdminClient.tsx` 보정 폼 Dialog→WdDrawer 전환 (eyebrow+title, WdRow 2열, note 게이트)
> - WdDrawer 확장(additive): `closeDisabled`(제출 중 ESC/overlay/X 차단) · `WdField.htmlFor`(label-컨트롤 a11y) · `secondary.disabled` · WdRow 모바일 1열 reflow
> - 검증: tsc 0 · lint 0 · e2e 7/7(신규 드로어 플로우 가드 포함, setup fail-fast+원복) · Pixel Gate(프로토 OneOnOneDrawer side-by-side) · 멀티롤(EMPLOYEE 차단·375px 풀폭) · Codex G1 P1 4건/G2 P1 1·P2 2건 반영
> - 잔여: 아래 인벤토리 **20곳**(1번 완료) → 옵션 ③ Wave 1+ 페이지별 전환 시 처리.

## 결정 근거 (확인 완료)

- **프로토 SSOT**: `_design-reference/HANDOVER.md:261` — `WdDrawer` = "우측 슬라이드 입력 폼" 표준. `drawers.jsx`에 표준 입력 드로어 5종(OneOnOne·LoaRequest·CertRequest·BenefitRequest·NewTask). `wd-drawer.jsx` = WdDrawer + WdField/WdRow/WdSectionH/WdNote.
- CLAUDE.md Phase 2 핵심 컴포넌트 목록에 WdDrawer 포함.
- **예외 (CEO 기억 "입력칸 많은 2~3개"와 부합)**: 다단계·대형 입력 = 위저드(중앙 Dialog) 유지 — 구현측 `WizardShell`(채용 hire-wizard·조직개편 restructure)이 해당. 확인/경고성 다이얼로그(confirm류)도 Dialog 유지.

## 현재 상태 (실측)

- [WdDrawer.tsx](../../src/components/shared/WdDrawer.tsx) **구현 완료** (Phase 2 P1, Radix Sheet 래퍼, sheet.tsx 무수정). 다크 모드 = known-deferred.
- 채택 = **1곳**: `leave/LeaveClient.tsx` (Stage 4 LV-003 카나리에서 멈춤).
- **드리프트 근본 원인**: 이 규칙이 `DESIGN.md`·`rules/design.md`에 미명문화 → UI 편집 시 자동 주입 규칙에 안 걸려 신규 코드가 계속 Dialog로 작성됨 ([[hrhub-design-wave-campaign]] "하우스 룰이 프로토를 덮어씀"과 동일 클래스).

## 전환 대상 인벤토리 — 입력 폼인데 중앙 Dialog인 곳 (21, 실측 grep)

`src/app/(dashboard)/` :
1. `attendance/admin/AttendanceAdminClient.tsx` — **근태 보정 (CEO 지적 트리거, 카나리 1순위 후보)**
2. `attendance/shift-calendar/ShiftCalendarClient.tsx`
3. `employees/[id]/EmployeeDetailClient.tsx`
4. `employees/[id]/contracts/ContractsClient.tsx`
5. `employees/[id]/work-permits/WorkPermitsClient.tsx`
6. `employees/me/ProfileSelfServiceClient.tsx`
7. `leave-of-absence/LoaClient.tsx` (프로토 LoaRequestDrawer 직접 대응!)
8. `leave/admin/LeaveAdminClient.tsx`
9. `leave/team/LeaveTeamClient.tsx`
10. `offboarding/OffboardingDashboardClient.tsx`
11. `onboarding/OnboardingDashboardClient.tsx`
12. `onboarding/[id]/OnboardingDetailClient.tsx`
13. `payroll/bank-transfers/BankTransfersClient.tsx`
14. `recruitment/[id]/interviews/InterviewListClient.tsx`
15. `settings/attendance/tabs/DesignatedLeaveTab.tsx`

`src/components/` :
16. `employees/ProfileChangeRequestDialog.tsx`
17. `employees/dialogs/AddConcurrentDialog.tsx`
18. `employees/dialogs/EndConcurrentDialog.tsx`
19. ~~`payroll/PayrollAdjustDialog.tsx`~~ (dead code — Wave 1 run-pages PR에서 삭제됨, 소비처 0 grep 확인)
20. `payroll/PayrollCreateDialog.tsx`
21. `performance/quarterly-review/BulkCreateDialog.tsx`

추가 후보(보수 분류로 PLAIN 처리됐으나 FormField 래퍼 사용 가능성): compliance/* Form 9곳·training 2·succession 2·recruitment/InterviewCalendarScheduler — 착수 시 재분류.
**제외 확정**: `shared/WizardShell.tsx`(위저드 예외)·confirm/경고류·`SaveScenarioDialog` 등 단일 입력 confirm성.

## 진행 옵션 (CEO 결정 대기)

1. **규칙 명문화만 즉시** — DESIGN.md + rules/design.md에 "입력 폼 = WdDrawer, 예외 = 위저드(WizardShell)·확인 다이얼로그" 추가. 신규 드리프트 차단, 기존 21곳은 Wave에서.
2. **명문화 + 근태 보정 카나리** — 1 + AttendanceAdminClient 보정 폼을 WdDrawer로 전환 (#143 직후라 기능 검증 환경 그대로).
3. **Wave 1 통째 합류** — 명문화 + 21곳을 Wave 1+ 페이지 reskin 시 페이지별로 전환 ([[hrhub-design-wave-campaign]] 인벤토리에 등재).

> 모바일 Dialog→Sheet(bottom) 규칙(DESIGN.md §7 Tier 1)과는 별개 축 — 데스크톱 기본형 결정임. WdDrawer는 좁은 화면 자동 풀폭이라 충돌 없음.
