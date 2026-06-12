# Sidebar IA Re-categorization Proposal — match the proto's deliberate menu redesign

> **CEO intent (2026-06-12)**: the proto sidebar is NOT a simplified mock — its menus were
> **deliberately re-categorized to improve usability**. Adopt it as the target IA.
>
> **Resolution principle**: the proto's philosophy = **sidebar = lean top-level categories; detail/
> secondary pages live inside hubs**. So live's "extra" items are **re-homed (demoted to hub tabs),
> NOT deleted**. RBAC role-gating (which the single-persona proto can't express) stays as an
> additive layer on top of the proto structure. Validated by the proto itself:
> `_design-reference/page-wrappers.jsx:53` — "평가/성장 통합 (목표 + 분기 리뷰 + 역량 자기평가)".
>
> **Frozen-file note**: `src/config/navigation.ts` + `Sidebar.tsx` + `MobileDrawer.tsx` are PROTECTED.
> This proposal is the artifact to approve BEFORE any edit. ⚠ A demotion is NOT just a nav.ts delete —
> the parent hub page must surface the demoted child (tab/link) or the page is orphaned. That hub
> wiring is the real work + the real risk.

---

## ✅ DECISIONS LOCKED (CEO, 2026-06-12)

1. **정합 원칙**: where the proto is simpler because it's a single-persona mock (no RBAC / no real
   workflow), KEEP live; adopt the proto's deliberate UX improvements. (live 우세 유지)
2. **범위**: frontend proto-fidelity first (~86 adopt/re-home + quick wins). Big IA rebuilds
   (S1 onboarding Option 3, S2 insights 15→1) and new-backend builds (announcements, compliance
   score, career-history, etc.) split out as SEPARATE later features.
3. **Sidebar = ALL 4 demotions applied** (CEO chose maximal lean-rail): 분기리뷰(self)+스킬→평가/성장,
   분기리뷰(admin)→성과 관리, 근태마감+이상검토→급여 관리, **AND** 조건부 셀프서비스(연말정산/나의 온보딩/
   나의 퇴직처리)→허브. Plus 휴가/휴직 merge, 컴플라이언스→인사 관리, ~8 relabels, 이직=keep "분석".
   ⚠ Conditional self-service parent-hub landing TBD at proposal-finalize (연말정산→급여 영역;
   온보딩/퇴직→My Space context) — must not orphan an active onboarding/offboarding flow.
4. **착수**: employees-org first → attendance → my-space → recruitment → performance/payroll
   (demotion hub-wiring here) → team → settings → nav.ts cleanup + quick wins.

**Implementation rule**: demotion = parent hub exposes child FIRST (no orphan) → then nav.ts (frozen)
isolated single commit → i18n add-only → Pixel Gate + multi-role dogfood (super + employee) → Codex G1/G2.

---

## Proto sidebar = target (from `_design-reference/shell.jsx` NAV)

대시보드 · 알림 (flat) · then groups: 나의 공간(10) · 팀 관리(5) · 인사 관리(7) · 채용(5) ·
성과/보상(5) · 급여(6) · 인사이트(8) · 설정(1). No role-gating (single HR persona).

---

## Proposed live sidebar (proto-aligned, RBAC preserved)

### 홈 (ALL) — unchanged
대시보드 · 알림

### 나의 공간 (ALL) — 12+3 → 10
| Keep | 나의 업무 · 출퇴근 · 급여명세서 · 복리후생 · 문서/증명서 · 내 프로필 |
|---|---|
| **Merge** | 휴가 신청 + 휴직 신청 → **휴가/휴직** (one entry; hub handles both — proto `loa-req` is hub-routed) |
| **Relabel** | 목표/평가 → **평가/성장** · 나의 교육 → **내 교육** · 리코그니션 → **칭찬/인정** |
| **Demote → 평가/성장 hub** | 분기 리뷰(self) · 스킬 자기평가 *(proto: page-wrappers.jsx hub)* |
| **Judgment (conditional)** | 연말정산(self) · 나의 온보딩 · 나의 퇴직처리 — proto routes these via hub/급여-area, not the My Space rail. **Rec: demote to contextual/hub.** |

### 팀 관리 (MANAGER_UP) — 5, matches
팀 현황 · 팀 근태/휴가 · 팀 목표/성과 · 1:1 미팅 · **업무 위임** (relabel from 위임 설정)

### 인사 관리 (HR_UP) — 6 → 7
직원 관리 · 조직 관리 · 근태 관리 · 휴가/휴직 관리 · 온보딩/오프보딩 · 징계/포상 ·
**컴플라이언스** ← **MOVE in from 설정**

### 채용 (HR_UP) — 5, matches
채용 공고 · 채용 대시보드 · 칸반 보드 · 인재 풀 · 사내 채용

### 성과/보상 (HR_UP) — 6 → 5
성과 관리 · 캘리브레이션 · 보상 관리 · 비정기 조정 · 복리후생 관리
**Judgment — Demote → 성과 관리 hub**: 분기 리뷰(admin). **Rec: demote** (proto group has no admin QR entry).

### 급여 (HR_UP) — 8 → 6
**급여 관리** (relabel from 급여 대시보드) · 수동 조정 · 글로벌 급여 · 급여 시뮬레이션 ·
**이체 관리** (relabel from 이체 내역) · 연말정산
**Judgment — Demote → 급여 관리 run-flow**: 근태 마감 · 이상 검토. **Rec: demote into the run/close
flow** (proto 급여 has no separate rail entries; these are payroll-prep steps). ⚠ Confirm the run hub
exposes them before removing from rail.

### 인사이트 (MANAGER_UP) — 8, matches with relabels
Executive Summary · 인력 분석 · 급여 분석 · 성과 분석 · **근태 분석** (from 근태/휴가 분석) ·
**이직 예측** (from 이직 분석 — ⚠ only if backend actually predicts; else keep 분석 to avoid over-promise) ·
**팀 헬스** (from 팀 건강) · AI 리포트

### 설정 (HR_UP) — 2 → 1
설정 *(컴플라이언스 moved to 인사 관리)*

---

## Change summary

- **Merges (1)**: 휴가 신청 + 휴직 신청 → 휴가/휴직.
- **Moves (1)**: 컴플라이언스 설정 → 인사 관리.
- **Relabels (~8, safe)**: 목표/평가→평가/성장, 나의 교육→내 교육, 리코그니션→칭찬/인정, 위임 설정→업무 위임,
  급여 대시보드→급여 관리, 이체 내역→이체 관리, 근태/휴가 분석→근태 분석, 팀 건강→팀 헬스.
  - ⚠ **1 conditional relabel**: 이직 분석→이직 예측 only if the backend predicts; else keep "분석".
- **Demotions (rail → hub)** — the real work + orphan risk, each needs the parent hub to expose the child:
  1. 분기 리뷰(self) + 스킬 자기평가 → 평가/성장 hub *(proto-confirmed)*
  2. 분기 리뷰(admin) → 성과 관리 hub *(judgment, rec demote)*
  3. 근태 마감 + 이상 검토 → 급여 관리 run-flow *(judgment, rec demote; confirm hub surfaces them)*
  4. 연말정산(self) / 나의 온보딩 / 나의 퇴직처리 → contextual/hub vs keep conditional *(judgment)*

## RBAC note
Role-gating is preserved and is orthogonal to the proto (which has none). Mapping: 홈/나의 공간 = ALL ·
팀 관리/인사이트 = MANAGER_UP · 인사 관리/채용/성과·보상/급여/설정 = HR_UP. No change.

## Implementation sequence (when approved)
1. For each demotion, FIRST ensure the parent hub page exposes the child (tab/link) — verify no orphan.
2. THEN edit the frozen `navigation.ts` (merge/move/relabel/remove) in one isolated commit.
3. Update `Sidebar.tsx`/`MobileDrawer.tsx` only if grouping logic needs it (likely none — data-driven).
4. Update i18n nav labels (add new keys; never edit/delete frozen keys).
5. Playwright visual snapshot + multi-role dogfood (super + employee-a) — sidebar is the past-incident hot spot.
