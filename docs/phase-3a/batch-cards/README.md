# Phase 3a · Batch Cards Index

> Phase 3a audit batch 카드 list. 양식 SSOT = `docs/plans/active/2026-05-18-phase3a-audit.md`.
> Stage 1 우선순위 = `docs/plans/active/2026-05-18-phase3a-audit-stage1.md`.

| Batch | Surface | Status | Commit |
|---|---|---|---|
| 01 | 나의공간 — 휴가 (`/leave`) | done | `6f41d2cf` |
| 02 | 나의공간 — 근태 (`/attendance`) | done | `6632f06b` |
| 03 | 대시보드 (`/home`) | done | `27af20b8` |
| 04 | 직원 (employees) — list/detail/new/directory | done · gate passed · pre-flight done | `9a940408` |
| 05 | 조직도 (`/org`) | done · gate passed · pre-flight done | `ac243446` |
| 06 | 직원 경력 데이터 (Education/Certification/Activity) | Stage 1+2 done · gate passed · pre-flight 대기 | `ff8307fd` |
| 07 | 온보딩/오프보딩 | done · gate passed · pre-flight done | `1cd4a77c` |
| 08 | Tabs a11y (F14 격상) | Stage 1+2 done · gate passed · pre-flight 대기 | `e3e6cb90` |
| 09 | WizardShell SSOT 격상 | Stage 1+2 done · gate passed · pre-flight 대기 | `9289a792` |

## 격상 트랙 신설 근거 (2026-05-21 KST, Session 228 사용자 결재 통과)

### batch 06 (직원 경력 데이터)
- **격상 근거**: batch 04 N+18 pre-flight (`3ef54c7c` — `docs/phase-3a/stage4-preflight/n18-7tab-alignment.md`)
- Prisma 에 `EmployeeEducation` / `EmployeeCertification` / `EmployeeActivity` 모델 0건
- N+18 graceful empty(A) 진입의 UX 회복 트랙
- 진입 시점: N+18 implementation 후 또는 합본 PR
- 상세: `docs/phase-3a/batch-cards/batch-06-employee-career.md`

### batch 08 (Tabs a11y, F14 격상)
- **격상 근거**: batch 07 N+34 pre-flight (`7c62b878` — `docs/phase-3a/stage4-preflight/n34-pill-tabs-filter.md`)
- F14 N+9 임계 카운트 **5/5 정확 도달** (LeaveClient/MyTasksClient/OnboardingFilter/OffboardingFilter/ViewModeToggle)
- 가디언 G4 "현행 유지 확정" 자동 트리거 = 별도 a11y 트랙 진입 임박
- 진입 시점: batch 07 N+32/N+34 implementation 동반 또는 cross-cutting 일괄
- 상세: `docs/phase-3a/batch-cards/batch-08-a11y-tabs.md`

### batch 09 (WizardShell SSOT)
- **격상 근거**: batch 05 N+27 pre-flight (`7875fee6` — `docs/phase-3a/stage4-preflight/n27-restructure-wizard-rework.md`)
- WizardShell SSOT codebase 0건. 4 위저드 (Hire/Job/PerfCycle/Restructure) inline 패턴
- N+27 scope 비대 회피 + cross-batch SSOT 정합
- 진입 시점: SSOT 선행 + N+27 합본 (옵션 C 권고 — 점진 마이그레이션)
- 상세: `docs/phase-3a/batch-cards/batch-09-wizard-shell-ssot.md`

## 진입 순서 (현재 권고)

Stage 4 진입은 PR-5A 머지 (~2026-05-24 02:43 KST) 후.

**현재 가용 RECORD 누적 (cross-batch 20)** — audit [`5e063d37` §9.5](../stage4-implementation/phase-a-entry-audit.md#95-phase-분류-기준-정의-단일-진실-명시) 단일 진실 정정 후:
- proto only **11건** (list 그대로): N+19/N+20/N+21/N+22/N+23/N+25/N+28/N+29/N+33/N+35/N+36
  - ⓘ audit Phase A = **8건** (N+19/N+20/N+21/N+22/N+23/N+25/N+28/N+29). N+33 → Phase B / N+35·N+36 → Phase C 재분류 (audit §9.1·§9.2·§9.3)
- SSOT 신설 1건: N+24 (audit Phase B)
- codebase 8건: N+17/N+26/N+18/N+30/N+27/N+31/N+34/N+32
  - ⓘ audit Phase C 7건 (N+17·N+18·N+26·N+30·N+31·N+32·N+35·N+36) + Phase D N+34 (N+45 합본 PR 흡수)

**격상 트랙 RECORD 후보 (batch 06/08/09, 17건)**:
- batch 06: N+37~N+42 (6건, audit Phase E)
- batch 08: N+43~N+47 (5건, N+43 Phase B / N+44·N+45·N+46·N+47 Phase D)
- batch 09: N+48~N+53 (6건, N+48 Phase B / N+49·N+50·N+53 Phase D / **N+51·N+52 DEFERRED**)

**진입 순서 권고** — audit `5e063d37` §9.5 = **ACTIVE 35 RECORD + DEFERRED 2 (N+51/N+52) = 37 entries** (Phase A 8 / B 4 / C 8 / D 9 / E 6):
1. proto only batch (08 a11y 일부 가능 — surface 별)
2. SSOT cross-batch (N+24/N+48 WizardShell)
3. codebase 트랙 (4 batch implementation)
4. 격상 batch 풀스택 (06 직원 경력)

## 참조

- 양식 SSOT: `../plans/active/2026-05-18-phase3a-audit.md`
- Stage 1: `../plans/active/2026-05-18-phase3a-audit-stage1.md`
- Stage 4 pre-flight: `../stage4-preflight/README.md` (29 RECORD, 6 batch × 누적)
- **Stage 4 implementation 단일 진실**: [`../stage4-implementation/phase-a-entry-audit.md` §9.5](../stage4-implementation/phase-a-entry-audit.md#95-phase-분류-기준-정의-단일-진실-명시) — 5-Phase 분류 (A 8 / B 4 / C 8 / D 9 / E 6) + ACTIVE 35 + DEFERRED 2 = 37 entries. 본 README count 표기와 충돌 시 audit 우선.
- **본 README 보조 결정**: [`../stage4-implementation/n34-n47-phase-assignment.md`](../stage4-implementation/n34-n47-phase-assignment.md) (N+34/N+47 Phase D 채택 결정 trace)
