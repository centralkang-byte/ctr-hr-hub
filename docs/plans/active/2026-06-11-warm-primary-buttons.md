# Warm Primary Buttons — 주 액션 버튼 전역 오렌지 전환

> **Date**: 2026-06-11 · **Session**: S282 후속 · **CEO 결정**: "참조 이미지와 동일하게" (#150 플래그에 대한 응답)
> **근거**: 프로토 기본 톤 `data-tone="friendly"`(`styles.css:4194`)가 `.btn-primary`를 `--warm`으로 오버라이드 — 렌더된 프로토(픽셀 SSOT)의 모든 주 액션 버튼은 warm 오렌지.
> **Stack**: `design/wave1-payroll-hub`(#150) 위에 스택 — PayrollClient 충돌 방지.

## 토큰 (프로토 실측 변환)

| Token | Proto | 변환 (HSL triplet) | hex |
|---|---|---|---|
| `--warm` (light) | `oklch(68% 0.16 40)` | `16 78% 59%` | #e87045 |
| `--warm` (dark) | `oklch(75% 0.14 40)` | `16 91% 69%` | #f88d67 |

기존 `--wd-orange`(hue 50, #e4762c)와 **다른 색** — 별도 토큰. hover = 프로토 `filter: brightness(0.95)` → `hover:brightness-95`.

**텍스트 = white (프로토 `.btn-primary { color: white }`)**. 대비 3.07:1 — AA(4.5:1) 미달, 대형 텍스트 기준(3:1)만 통과. **픽셀 SSOT 우선(CEO 지시)으로 수용, 편차 기록**. dark ink 대안(5.35:1 통과)은 토큰 1줄로 전환 가능.

## 변경 (중앙 SSOT 3 + 토큰 2 + 명문화 2 + 스트래글러 sweep)

1. `src/app/globals.css` — `--warm` light/dark 추가
2. `tailwind.config.ts` — `warm: 'hsl(var(--warm))'`
3. `src/components/ui/button.tsx` — default variant `bg-primary` → `bg-warm` (hover:brightness-95 기존)
4. `src/lib/styles/button.ts` — `BUTTON_VARIANTS.primary` `bg-primary`→`bg-warm`, `hover:bg-primary/90`→`hover:brightness-95` (105 파일 소비 — 자동 전파)
5. `src/components/shared/WdDrawer.tsx` — primary foot 버튼 동일 스왑
6. **raw `bg-primary` 스트래글러 124곳 분류 sweep** (workflow 팬아웃): **CTA 버튼/Link만** in-place 스왑(`bg-primary`→`bg-warm`, `hover:bg-primary/8x·90`→`hover:brightness-95`). 비버튼(스텝 인디케이터·아바타·선택일·뱃지·차트)은 불변. BUTTON_VARIANTS 정규화는 별도 리팩터 트랙(이 PR은 색 스왑만 — 최소 diff)
7. `DESIGN.md` — §버튼: 주 액션 = warm + AA 편차 기록 (명문화 = 드리프트 차단)
8. `.claude/rules/design.md` — 체크리스트 갱신 (UI 편집 자동 주입)

## 제외 (명시)

- 동결 파일(Sidebar/MobileDrawer/navigation.ts) — 파일 무수정 (토큰 효과는 자동 반영)
- 컨텍스트 오버라이드(히어로 white CTA·BulkActionBar) — 프로토도 오버라이드, 기존 유지
- `chip.warning` friendly 변형 — 시맨틱 warning 패밀리 유지 (별 축)
- destructive/outline/ghost/secondary variant — 불변
- 다크모드 페이지 대응(Phase 4) — 토큰만 선반영

## Codex Gate 1 반영 (2026-06-11, P0 0·P1 4·P2 5 — 전부 수용)

| # | Finding | Resolution |
|---|---------|-----------|
| P1-1 | variantless `<Button>`(default) 전수 audit 필요 — 비-CTA(페이지네이션·아이콘·토글)가 의미 없이 오렌지化 | 워크플로 팬아웃으로 variantless Button 전 사용처 분류. 명백한 시맨틱 미스매치(비-CTA가 default)는 variant 교정, 모호하면 유지(전역 컨버전 수용 — proto friendly도 전 .btn-primary 적용) |
| P1-2 | `bg-primary/NN`·`hover:bg-primary`·`dark:bg-primary`·`from-primary`·`data-[state]:bg-primary` 제외는 불안전 | sweep grep 확장 — 버튼 CTA 상태 클래스 전부 분류 대상 포함 |
| P1-3 | a11y 예외를 owner/scope 있는 공식 기록으로 | DESIGN.md에 **Accessibility Exception 항목** 신설: scope=주 액션 버튼 fill+white label, 근거=픽셀 SSOT CEO 지시(2026-06-11), 대비 3.07:1, 재검토=런칭 후 a11y 트랙, 전환 비용=토큰 1줄. 다크 페어링은 Phase 4에서 결정(white-on-#f88d67 더 낮음) |
| P1-4 | 전수 베이스라인 재생성이 무관 회귀 은폐 + 브랜치 순서 의존 | 베이스라인 재생성을 **별도 커밋**(코드 커밋 뒤 마지막)으로 분리 — 리뷰에서 코드/스냅샷 격리. #150 스택 유지 |
| P2-5 | brightness hover는 filter 스택 컨텍스트·transition-colors는 filter 미애니메이트 | `BUTTON_VARIANTS.primary`는 `transition-all` ✓. ui/button.tsx는 hover:brightness-95가 **기존부터** 존재 — 신규 회귀 아님, 그대로 |
| P2-6 | 상태별(호버·포커스·disabled·loading) 정적 스냅샷 한계 | UI QA에서 인터랙티브 상태 스폿 체크 (호버·focus-visible·disabled) |
| P2-7 | 비전환(유지=네이비) allowlist 명시 | 워크플로 분류 결과(유지 목록)를 본 문서 부록으로 박제 — 향후 sweep의 의도 구분 기준 |
| P2-8 | 토큰 opacity modifier 지원 | `warm: 'hsl(var(--warm) / <alpha-value>)'` 형식 채택 |
| P2-9 | `warm` 명명이 presentation 지향 — semantic 권고 | **proto SSOT 어휘 유지**(--warm 그대로 추적성; wd-orange 선례). DESIGN.md에 "버튼 액션 전용 — 장식 재사용 금지" 명문화로 오남용 차단 (권고 기각 사유 기록) |

## 검증

- tsc 0 · lint 0 · build
- e2e: 기존 flows 스모크 (버튼 셀렉터 텍스트 기반이라 영향 없음 예상 — 색 클래스 의존 spec grep)
- Pixel Gate: payroll 허브 + 홈 + 직원 등 3페이지 proto side-by-side (버튼 색 일치)
- **visual 베이스라인 전수 재생성** (버튼 전역 변경 = wave-scale, 웨이브당 1회 원칙의 해당 갱신) — #150 스택 위라 payroll 포함 일관
- 멀티롤: hr@ + employee-a@ (셀프서비스 버튼)
- Codex Gate 1 / Gate 2
## Codex Gate 2 반영 (2026-06-11, P2 1 — 수용)

| # | Finding | Resolution |
|---|---------|-----------|
| P2-1 | 선택 상태 컨트롤 2파일이 오분류로 warm 전환 (ManagerEval 점수·등급 선택, Pulse Likert) — 선택 상태는 CTA 아님 | 두 파일 전체 원복(`bg-primary` 유지) — 부록 A allowlist에 추가. ManagerEvaluationClient의 3 hunk는 진짜 CTA(저장/제출)로 확인, 유지 |

> 워크플로 적대검증 21파일 샘플은 통과했으나 Codex가 비샘플 파일에서 오분류 2건 적발 — 독립 게이트 중복의 가치 실증.

### 부록 A — KEEP allowlist (네이비 유지 118곳 + Gate 2 추가 3곳, 워크플로 분류 2026-06-11)

- **Gate 2 추가 (선택 상태 컨트롤)**: `app/(dashboard)/performance/manager-eval/ManagerEvalClient.tsx:359,386` · `app/(dashboard)/performance/pulse/[id]/respond/PulseRespondClient.tsx:140`

- **progress/chart fill** (46): `app/(dashboard)/analytics/ai-report/AiReportClient.tsx:296` · `app/(dashboard)/analytics/gender-pay-gap/GenderPayGapClient.tsx:282` · `app/(dashboard)/analytics/performance/PerformanceClient.tsx:127` · `app/(dashboard)/analytics/turnover/TurnoverClient.tsx:261` · `app/(dashboard)/attendance/AttendanceClient.tsx:443` · `app/(dashboard)/hr/bulk-movements/BulkMovementsClient.tsx:100` · `app/(dashboard)/hr/bulk-movements/BulkMovementsClient.tsx:99` · `app/(dashboard)/my/MySpaceClient.tsx:176` · `app/(dashboard)/my/benefits/MyBenefitsClient.tsx:357` · `app/(dashboard)/my/offboarding/MyOffboardingClient.tsx:300` · `app/(dashboard)/my/skills/MySkillsClient.tsx:240` · `app/(dashboard)/onboarding/OnboardingDashboardClient.tsx:206` · `app/(dashboard)/onboarding/[id]/OnboardingDetailClient.tsx:344` · `app/(dashboard)/onboarding/me/OnboardingMeClient.tsx:235` · `app/(dashboard)/payroll/[runId]/publish/PayrollPublishDashboardClient.tsx:78` · `app/(dashboard)/payroll/simulation/CompaRatioTab.tsx:203` · `app/(dashboard)/payroll/year-end/YearEndHRClient.tsx:527` · `app/(dashboard)/performance/PerformanceClient.tsx:354` · `app/(dashboard)/performance/PerformanceClient.tsx:416` · `app/(dashboard)/performance/PerformanceClient.tsx:455` · `app/(dashboard)/performance/PerformanceClient.tsx:531` · `app/(dashboard)/performance/PerformanceClient.tsx:576` · `app/(dashboard)/performance/admin/AdminResultsClient.tsx:152` · `app/(dashboard)/performance/cycles/[id]/CycleDetailClient.tsx:166` · `app/(dashboard)/performance/goals/GoalsClient.tsx:254` · `app/(dashboard)/performance/my-checkins/MyCheckinsClient.tsx:218` · `app/(dashboard)/performance/my-goals/MyGoalsClient.tsx:309` · `app/(dashboard)/performance/my-peer-review/MyPeerReviewClient.tsx:206` · `app/(dashboard)/performance/peer-review/results/[cycleId]/PeerReviewResultsClient.tsx:133` · `app/(dashboard)/performance/team-goals/TeamGoalsClient.tsx:390` · `app/(dashboard)/recruitment/cost-analysis/CostAnalysisClient.tsx:324` · `components/attendance/ScheduleAdjustmentModal.tsx:105` · `components/compensation/PayBandChart.tsx:50` · `components/compliance/gdpr/PiiAccessDashboard.tsx:105` · `components/compliance/kr/MandatoryTrainingTab.tsx:188` · `components/compliance/kr/WorkHoursChart.tsx:31` · `components/compliance/kr/WorkHoursChart.tsx:35` · `components/home/EmployeeHomeV2.tsx:403` · `components/org/DeptFlowNode.tsx:99` · `components/payroll/PayStubBreakdown.tsx:97` · `components/performance/EmployeeInsightPanel.tsx:161` · `components/performance/quarterly-review/GoalProgressSection.tsx:77` · `components/recruitment/ConvertToEmployeeButton.tsx:146` · `components/recruitment/ConvertToEmployeeButton.tsx:147` · `components/shared/WizardShell.tsx:98` · `components/training/MandatoryConfigTab.tsx:273`
- **segmented/toggle/tab active** (32): `app/(dashboard)/approvals/attendance/AttendanceApprovalClient.tsx:216` · `app/(dashboard)/approvals/attendance/AttendanceApprovalClient.tsx:238` · `app/(dashboard)/approvals/inbox/ApprovalInboxClient.tsx:561` · `app/(dashboard)/dashboard/compare/CompareClient.tsx:251` · `app/(dashboard)/dashboard/compare/CompareClient.tsx:260` · `app/(dashboard)/hr/bulk-movements/components/TypeSelector.tsx:88` · `app/(dashboard)/my/settings/notifications/NotificationPreferenceClient.tsx:175` · `app/(dashboard)/my/tasks/ApprovalTabContent.tsx:265` · `app/(dashboard)/my/tasks/MyTasksClient.tsx:461` · `app/(dashboard)/notifications/NotificationsClient.tsx:174` · `app/(dashboard)/onboarding/OnboardingDashboardClient.tsx:256` · `app/(dashboard)/payroll/import/PayrollImportClient.tsx:231` · `app/(dashboard)/payroll/simulation/PayrollSimulationClient.tsx:400` · `app/(dashboard)/payroll/simulation/ScenarioListSheet.tsx:172` · `app/(dashboard)/payroll/simulation/ScenarioListSheet.tsx:241` · `app/(dashboard)/performance/calibration/CalibrationClient.tsx:437` · `app/(dashboard)/performance/notifications/NotificationsClient.tsx:176` · `app/(dashboard)/performance/pulse/PulseSurveyClient.tsx:304` · `app/(dashboard)/performance/recognition/RecognitionClient.tsx:49` · `app/(dashboard)/performance/recognition/RecognitionClient.tsx:51` · `app/(dashboard)/settings/system/tabs/ApprovalFlowsTab.tsx:156` · `app/(dashboard)/settings/system/tabs/NotificationChannelsTab.tsx:63` · `components/compliance/gdpr/RetentionPolicyForm.tsx:171` · `components/compliance/gdpr/RetentionPolicyForm.tsx:185` · `components/compliance/ru/KedoDocumentsTab.tsx:260` · `components/compliance/ru/MilitaryRegistrationTab.tsx:278` · `components/employees/EmployeeFilterPanel.tsx:207` · `components/employees/EmployeeFilterPanel.tsx:220` · `components/home/primitives/PreviewToolbar.tsx:94` · `components/teams/TeamsSettingsPage.tsx:261` · `components/teams/TeamsWebhookSection.tsx:242` · `components/ui/switch.tsx:14`
- **step/indicator/dot** (20): `app/(dashboard)/attendance/shift-calendar/ShiftCalendarClient.tsx:457` · `app/(dashboard)/hr/bulk-movements/BulkMovementsClient.tsx:91` · `app/(dashboard)/my/documents/MyDocumentsClient.tsx:187` · `app/(dashboard)/my/offboarding/MyOffboardingClient.tsx:334` · `app/(dashboard)/my/offboarding/MyOffboardingClient.tsx:342` · `app/(dashboard)/my/offboarding/MyOffboardingClient.tsx:346` · `app/(dashboard)/my/offboarding/MyOffboardingClient.tsx:350` · `app/(dashboard)/my/profile/MyProfileClient.tsx:577` · `app/(dashboard)/my/year-end/YearEndWizardClient.tsx:188` · `app/(dashboard)/onboarding/checkins/CheckinsAdminClient.tsx:418` · `app/(dashboard)/payroll/me/PayrollMeClient.tsx:133` · `components/attendance/ShiftRosterBoard.tsx:442` · `components/attendance/ShiftRosterBoard.tsx:519` · `components/attendance/ShiftRosterBoard.tsx:635` · `components/layout/NotificationBell.tsx:179` · `components/org-studio/DraggableOrgTree.tsx:431` · `components/performance/CycleTimeline.tsx:99` · `components/recruitment/CandidateTimeline.tsx:150` · `components/settings/ApprovalFlowEditor.tsx:59` · `components/shared/WdStatusChips.tsx:47`
- **decorative/context** (7): `app/(dashboard)/my/profile/MyProfileClient.tsx:262` · `app/(dashboard)/onboarding/me/OnboardingMeClient.tsx:192` · `app/(dashboard)/settings/performance/tabs/GradeScaleTab.tsx:39` · `components/analytics/AiInsightBanner.tsx:57` · `components/analytics/KpiCard.tsx:68` · `components/org/DeptFlowNode.tsx:105` · `components/ui/tooltip.tsx:23`
- **selection/form control** (6): `app/(dashboard)/performance/calibration/components/CalibrationBlockGrid.tsx:170` · `app/(dashboard)/performance/one-on-one/OneOnOneClient.tsx:401` · `app/(dashboard)/performance/one-on-one/[id]/OneOnOneDetailClient.tsx:193` · `app/(dashboard)/performance/peer-review/evaluate/[nominationId]/PeerEvalFormClient.tsx:101` · `app/(dashboard)/performance/self-eval/SelfEvalClient.tsx:282` · `app/(dashboard)/performance/self-eval/SelfEvalClient.tsx:334`
- **badge/count** (3): `app/(dashboard)/delegation/settings/DelegationSettingsClient.tsx:227` · `app/(dashboard)/my/tasks/MyTasksClient.tsx:431` · `app/(dashboard)/payroll/simulation/ScenarioCompareView.tsx:213`
- **calendar cell** (2): `app/(dashboard)/approvals/attendance/AttendanceApprovalClient.tsx:412` · `components/ui/calendar.tsx:204`
- **etc** (1): `app/(dashboard)/performance/calibration/components/CalibrationBlockGrid.tsx:322`
- **frozen/context-override** (1): `components/shared/BulkActionBar.tsx:73`

### 부록 B — variantless Button 시맨틱 미스매치 (이연 — 색 결정 범위 밖, 별도 UX 패스 후보)

- `components/employees/EmployeeFilterPanel.tsx:233` [utility-control] → variant="ghost" or variant="outline" — Apply button in mobile filter sheet is a utility control, not a primary
- `app/(dashboard)/attendance/AttendanceClient.tsx:380` [destructive-confirm] → variant="destructive" — Clock Out ends the work session (irreversible state change); currently styled as warm 
- `components/training/EnrollmentsTab.tsx:131` [utility-control] → variant="outline" or variant="ghost" — Status-change buttons (진행중, 완료, 탈락) in table row are utility controls, 
- `app/(dashboard)/my/offboarding/MyOffboardingClient.tsx:144` [utility-control] → variant="outline" — Mark Complete task button is secondary/optional user action, not a primary CTA
- `app/(dashboard)/analytics/attrition/AttritionRiskClient.tsx:196` [utility-control] → variant="outline" — Recalculate refresh button is a utility/toggle action, not a primary CTA
- `components/layout/NotificationBell.tsx:136` [utility-control] → variant="ghost" — Mark all read in notification popover is a lightweight utility, not primary
- `components/employees/tabs/AssignmentHistoryTab.tsx:188` [destructive-confirm] → variant="destructive" — End assignment is irreversible; currently using warm orange default which understates 
- `app/(dashboard)/my/training/MyTrainingClient.tsx:267` [utility-control] → variant="outline" or variant="ghost" — this is a course enrollment action in a small button, not a primary CTA
- `app/(dashboard)/settings/organization/tabs/PositionsTab.tsx:146` [utility-control] → variant="outline" — 'Add New' action in a header, supporting secondary action. Size sm with icon suggests outl
- `app/(dashboard)/hr/bulk-movements/components/ExecutionConfirm.tsx:162` [destructive-confirm] → variant="destructive" — this is a bulk movement execution that irreversibly updates employee data. The action 
- `components/teams/TeamsSettingsPage.tsx:307` [utility-control] → variant="outline" — generic save button in a settings form that is not a critical primary action. Outline woul
- `components/shared/approval/RejectReasonModal.tsx:87` [destructive-confirm] → variant="destructive"
- `app/(dashboard)/offboarding/OffboardingDashboardClient.tsx:630` [destructive-confirm] → variant="destructive"
- `app/(dashboard)/settings/attendance/tabs/LoaTypesTab.tsx:243` [utility-control] → variant="outline" or variant="secondary" — this is a toggle to show/hide add form (text label + Plus icon), no
- `app/(dashboard)/settings/attendance/tabs/LoaTypesTab.tsx:302` [utility-control] → variant="secondary" or variant="outline" — this is a submit button inside an inline form panel (not a dialog p

> 일부 제안은 과잉(예: 퇴근 버튼 destructive) — 적용 시 개별 판단 필요. 이 PR에서는 미적용.
