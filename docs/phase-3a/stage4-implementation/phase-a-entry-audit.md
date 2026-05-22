# Phase 3a · Stage 4 · Phase A 진입 첫 PR 후보 사전 평가 audit

> **base SHA**: `a147d919` (Stage 4 pre-flight 종결) · **작성일**: 2026-05-22 KST (Session 230)
> **목적**: Phase A (proto only 카나리) 진입 첫 PR 후보 사전 평가 + cross-batch 의존성 단방향 verify + N+21 양쪽 등장 status 결론
> **작업 종류**: read-only audit (src/ / prisma/ / messages/ 변경 0)
> **트리거**: PR-5A #63 머지 직후 implementation 진입 가능 시점

---

## §0. 1분 요약

1. **사양서 "Phase A 12 RECORD" 카운트 정정** → 실제 후보 11건 list (사양서 내 inconsistency) + audit 결과 **Pure Phase A = 8 RECORD**. N+33/N+35/N+36은 codebase 의존으로 Phase B/C 재분류.
2. **Phase A → Phase B SSOT 역의존 0** ✅ 단방향 verify 통과. Phase A 8 RECORD 모두 N+24/N+43/N+44/N+48 SSOT 없이 단독 진입 가능.
3. **N+21 Phase A/B 양쪽 등장 = 정상 분리 PR 의도** (SSOT 신설 측 batch 04 §7 N+21 vs consumer 측 batch 09 §7 N+49 cross-batch 참조). inconsistency 아님.
4. **첫 3 PR 후보**: ① N+21 (DemoLimitBanner SSOT, ~20 LOC, blast 최소) → ② N+19 (data.js 5 SSOT 키, blast 작음) → ③ N+20 (위저드 옵션 5 SSOT, blast 작음).
5. **권고 근거**: ui.jsx SSOT 측 N+21 카나리 우선 → 후속 N+22 EmployeeStatusChip SSOT까지 ui.jsx 신설 패턴 검증 후 data.js 보강(N+19/N+20)으로 페이로드 축적.

---

## §1. Phase A RECORD inventory + 분류 (사양서 정정)

### 1.1 사양서 list vs 실제 정의

| 출처 | 카운트 | RECORD list |
|---|---|---|
| 사양서 ("12 RECORD") | 12 (선언) | — (사양서 본문에 list 없음) |
| 사양서 가드 line ("10건 + N+21") | **11 (실제)** | N+19/N+20/N+21/N+22/N+23/N+25/N+28/N+29/N+33/N+35/N+36 |
| `batch-cards/README.md` ("proto only 11건") | 11 | 위 list 동일 |
| `stage4-preflight/README.md` ("proto only 8건") | 8 | N+19/N+20/N+21/N+22/N+25/N+28/N+29/N+33 (N+23/N+35/N+36 제외) |

**카운트 inconsistency**: 사양서 본문이 "12"라고 선언했으나 실제 list는 11. `stage4-preflight/README.md`는 "Pure proto only"를 좁게 정의해 8건만 인정. → 본 audit이 **단일 진실로 정정**.

### 1.2 본 audit 결과 분류 (정합 정정 후)

#### Phase A — Pure proto only (codebase mutation 0) → **8 RECORD** ✅

| RECORD | batch | 우선 | 트랙 | 비고 |
|---|---|---|---|---|
| **N+21** | 04 | HIGH | proto SSOT 신설 | `<DemoLimitBanner>` ui.jsx (~20 lines), 4 위저드 cross-batch consumer 진입 카나리 |
| **N+19** | 04 | MED | proto data.js | 5 SSOT 키 신설 (mboHistory/praises/education/certifications/trainings/activities + quickStats/recentActivity) |
| **N+20** | 04 | MED | proto data.js | 위저드 옵션 5 SSOT (departments/ranks/salaryBands/onboardingTemplates/employmentTypes) |
| **N+22** | 04 | MED | proto SSOT 신설 | `<EmployeeStatusChip>` ui.jsx (~30 lines, STATUS_MAP 3종), if-else 3 location 통합 |
| **N+23** | 04 | MED | proto only (재분류) | proto tablist a11y 패턴, **코드베이스 작업 0 확정** (`stage4-preflight/n23` = Radix Tabs 정합) |
| **N+25** | 05 | MED | proto only | view tab 3→4 mode 명명 정렬 (codebase 변경 0) |
| **N+28** | 05 | LOW | proto only | EffectiveDatePicker proto button → DatePicker visual reskin |
| **N+29** | 05 | LOW | proto only | zoom controls + 검색 opacity highlight |

→ **Phase A 인벤토리 = 8 RECORD** (batch 04: 5, batch 05: 3, batch 07: 0)

#### Phase A 후보였으나 재분류 (codebase 의존) → 3 RECORD

| RECORD | batch | 본 audit 권고 | 재분류 근거 |
|---|---|---|---|
| **N+33** | 07 | **Phase B** ✅ | DB seed (`prisma/seed.ts` 또는 신규) + proto `data.js` 양면 SSOT 신설. 의존성 0, cross-batch consumer 가능 (§9.1) |
| **N+35** | 07 | **Phase C** ✅ | codebase 미세 정합 (Hire Card actions area), **N+32 선행 필수** — Phase C 내 N+32 머지 후 진입 (§9.2) |
| **N+36** | 07 | **Phase C** ✅ | codebase 토큰화 (4 enum × wt 매핑), **N+32 선행 권고** — Phase C 내 순차 진입 (§9.3) |

→ 사양서가 Phase A에 포함한 batch 07 3건은 모두 codebase/SSOT 트랙. **Phase A에서 제외 + Phase B/C 정확한 할당 확정** (상세 결정 근거: §9).

---

## §2. Phase A 8 RECORD scope estimate (LOC + 파일 + test)

| RECORD | LOC (신규) | 파일 수 | E2E | 시각 회귀 | 예상 PR 크기 |
|---|---|---|---|---|---|
| **N+21** | ~20 (ui.jsx `<DemoLimitBanner>`) + 4 위저드 호출 ~4 lines × 4 = ~36 LOC | 2 (`ui.jsx` + `wizards.jsx`) | 4 시나리오 (4 위저드 완료 + 새로고침 직후 미저장 검증) | 라이트 시각 1축 (proto 갈음) | XS (~40 LOC) |
| **N+19** | data.js 7 키 (mboHistory ~4 / praises ~6 / education ~3 / certifications ~5 / trainings ~5 / activities ~5 / attendance30 ~30 / quickStats per directory entry) ~80~120 LOC, 인라인 array literal 삭제 ~30 LOC | 3 (`data.js` + `page-employee-detail.jsx` + `inspector.jsx`) | N/A (proto only) | 라이트 시각 1축 (직원별 다양화 검증) | S (~100 LOC net) |
| **N+20** | 5 data 키 (~60 LOC) + wizard step 2/3/4 옵션 인라인 → SSOT 참조 (~−30 LOC) | 2 (`data.js` + `wizards.jsx`) | wizard 6 step 통과 + 옵션 dropdown 항목 정합 1 시나리오 | 라이트 시각 1축 | S (~50 LOC net) |
| **N+22** | ui.jsx `<EmployeeStatusChip>` (~30 LOC) + 3 location if-else 분기 → 컴포넌트 호출 (~−40 LOC) | 4 (`ui.jsx` + `page-employees.jsx` + `inspector.jsx` + `page-employee-detail.jsx`) | N/A (proto only) | 라이트 시각 1축 (3 location 색상 정합) | S (~−10 LOC net) |
| **N+23** | proto tablist 패턴 (role/aria/keyboard handler) ~40 LOC. **codebase 작업 0** | 1 (`page-employee-detail.jsx`) | 키보드 ←→ 탭 이동 1 시나리오 (proto playground) | 라이트 시각 1축 | XS (~40 LOC) |
| **N+25** | view tab 라벨 3→4 (~5 LOC) | 1 (`page-org.jsx`) | N/A | 라이트 시각 1축 | XS (~5 LOC) |
| **N+28** | proto button → DatePicker dropdown 형태 (~15 LOC) | 1 (`page-org.jsx`) | N/A | 라이트 시각 1축 | XS (~15 LOC) |
| **N+29** | 4 zoom button polish + search opacity handler (~20 LOC) | 1 (`page-org.jsx`) | N/A | 라이트 시각 1축 | XS (~20 LOC) |

**합산**: ~250~300 LOC net (proto only, codebase 0). 8 PR 또는 합본 단위로 진입 가능.

---

## §3. Cross-batch 의존성 단방향 verify (Phase A → Phase B/C SSOT)

### 3.1 Phase B SSOT 4건 (verify 대상)

| Phase B RECORD | SSOT | batch | Phase A 역의존 |
|---|---|---|---|
| N+24 | `<StatusChips>` + `PageHeader` 적용 | 05 | ❌ 없음 — Phase A는 proto `<EmployeeStatusChip>` SSOT(N+22) 별개 |
| N+43 | `useArrowKeyNavigation` hook | 08 | ❌ 없음 — Phase A는 proto tablist (N+23) 별개 |
| N+44 | MyTasksClient/LeaveClient migration | 08 | ❌ 없음 — codebase 트랙 |
| N+48 | `<WizardShell>` shared SSOT | 09 | ❌ 없음 — Phase A는 proto WizardShell 패턴 별개 |

→ **Phase A → Phase B SSOT 역의존 = 0 확인** ✅ 단방향 verify 통과.

### 3.2 cross-batch consumer 측 (Phase B/C/D가 Phase A에 정방향 의존)

| RECORD | 트랙 | 의존하는 Phase A RECORD |
|---|---|---|
| N+27 (batch 05 codebase RestructureModal) | Phase D | N+21 (DemoLimitBanner SSOT — toast + 배너 + onComplete 정합) |
| N+31 (batch 07 StatusChips 8 surface) | Phase C | N+22 (EmployeeStatusChip SSOT proto 측) + N+24 (codebase SSOT) |
| N+32 (batch 07 view mode + Hire Card + journey) | Phase C | N+25 (view mode 명명) |
| N+49 (batch 09 HireWorker migration) | Phase D | N+21 (cross-batch consumer) |
| N+50 (batch 09 OrgRestructure migration) | Phase D | N+21 (cross-batch consumer, batch 08 N+46 패턴) |
| N+53 (batch 09 BulkUpload migration) | Phase D | N+21 (가능) — wizards.jsx 패턴 정합 |

→ Phase A는 **upstream SSOT layer**. Phase A 머지가 Phase B/C/D 진입 트리거 (특히 N+21 / N+22).

### 3.3 cross-batch 단방향 그래프

```
Phase A (proto SSOT layer)
   ├─ N+21 (DemoLimitBanner) ──────→ N+27 / N+49 / N+50 / N+53 (위저드 4종 consumer)
   ├─ N+22 (EmployeeStatusChip) ───→ N+31 (StatusChips 8 surface codebase 측)
   ├─ N+19 / N+20 (data.js SSOT) ──→ Phase A 후속 + 후속 N+18/N+30 매핑 의존
   ├─ N+23 / N+25 / N+28 / N+29 ──→ (proto only, downstream 없음)
   ↓
Phase B (SSOT 신설 codebase)
   ├─ N+24 (StatusChips + PageHeader) ─→ N+31 cross-batch
   ├─ N+43 (useArrowKeyNavigation hook) ─→ N+44 / N+45 / N+46
   ├─ N+44 (MyTasks + Leave migration) ─→ N+45 / N+46 합본
   └─ N+48 (WizardShell SSOT) ─→ N+49 / N+50 / N+53
   ↓
Phase C/D/E (codebase 적용)
```

**단방향성 확인**: Phase A → Phase B → C/D/E. 역방향 의존 0.

---

## §4. N+21 Phase A/B 양쪽 등장 status 결론

### 4.1 두 등장 지점

| 등장 위치 | 역할 | 작업 종류 |
|---|---|---|
| **batch 04 §7 N+21** | proto SSOT 신설 측 (`<DemoLimitBanner>` ui.jsx 컴포넌트) | Phase A — proto only, ~20 LOC |
| **batch 09 §7 N+49** | codebase consumer 측 (HireWorkerWizard에서 `<DemoLimitBanner>` 사용) | Phase D — codebase migration, ~−75 LOC net |

### 4.2 결론

**= 분리 PR 의도 (정상 패턴), inconsistency 아님** ✅

근거:
1. RECORD 번호 자체는 **단일** (N+21). batch 09 §7는 별도 번호 N+49로 추적.
2. batch 04 §7 N+21 = SSOT **신설** (`_design-reference/ui.jsx`에 새 컴포넌트 추가).
3. batch 09 §7 N+49 = SSOT **consumer** (HireWorker 코드베이스 wizard에서 cross-batch 참조).
4. `stage4-preflight/README.md`에 명시: `N+49 ... batch 04 N+21 DemoLimitBanner cross-batch`.

### 4.3 핸드오버 doc 정정 권고

- `HANDOVER_PHASE3A.md` 파일 자체는 본 audit 시점 (`a147d919`) 부재 — 사양서 정정 필요 ("§2 Phase A-E 순서 + §3 cross-batch 의존성 그래프" 참조처가 실제 `stage4-preflight/README.md` + `batch-cards/README.md` 합산).
- `batch-cards/README.md` "proto only 11건"과 `stage4-preflight/README.md` "proto only 8건" 카운트 inconsistency 정정 권고 → 본 인덱스 README 가 단일 진실.

→ **본 audit 내 별도 turn**: HANDOVER 부재 + 카운트 inconsistency 두 건은 본 turn 미해소 (가드 §6 명시).

---

## §5. 위험도 평가 + 회귀 risk profile

| RECORD | 위험도 | 회귀 risk | 비고 |
|---|---|---|---|
| **N+21** | LOW | 4 위저드 정합성 (Hire/Job/PerfCycle/Restructure) — 한 곳 누락 시 cross-batch consumer 회귀 가능 | 카나리로 첫 PR 적격 — blast 최소, 후속 N+27/N+49/N+50/N+53 cross-batch 검증 인입로 |
| **N+19** | LOW | data.js 키 명명 conflict 위험 (인라인 → SSOT 참조 누락 시 빈 렌더) | grep 검증으로 인라인 array 0건 자동화 가능 |
| **N+20** | LOW~MED | departments 15 ↔ wizard 6 인라인 conflict, employmentTypes 정합 | 5 SSOT cascading 1회로 다수 finding 해소, X2/X3/X4 cross-surface 별도 트랙 영향 |
| **N+22** | LOW | 3 location 색상 정합 (시각 회귀 1축) | 코드베이스 shadcn `<Badge>` variant 매핑 별도 트랙 |
| **N+23** | LOW | proto only, codebase 0 — Playwright proto playground 시나리오만 | F14 임계치(5/5) 영향 0 (코드베이스 미터치) |
| **N+25** | LOW | view tab 라벨 4 — codebase 정합 검증만 | proto only |
| **N+28** | LOW | visual placeholder, dialog 구현 mock 한계 | proto only |
| **N+29** | LOW | proto eye/shield button 폐기 정합 | proto only |

**전체 Phase A risk profile**: ⭐ **LOW** (8 RECORD 모두 LOW, codebase mutation 0).

회귀 위험은 후속 Phase B/C/D 진입 시 Phase A SSOT 정합 검증으로 흡수.

---

## §6. 권고 진입 순서 + 첫 3 PR 후보

### 6.1 권고 진입 순서 (Phase A 8 RECORD)

```
1. N+21 (DemoLimitBanner SSOT, ~20 LOC, blast 최소)  ⭐ 카나리 첫 PR
2. N+19 (data.js 7 SSOT 키, ~100 LOC net)             ⭐ 후속 SSOT 키 보강
3. N+20 (위저드 옵션 5 SSOT, ~50 LOC net)              ⭐ data.js 패턴 정합
4. N+22 (EmployeeStatusChip SSOT ui.jsx, ~−10 LOC)
5. N+23 (proto tablist a11y, ~40 LOC)
6. N+25 (view tab 명명, ~5 LOC)
7. N+28 (EffectiveDatePicker visual, ~15 LOC)
8. N+29 (zoom + opacity, ~20 LOC)
```

권고 근거:
- **ui.jsx SSOT 우선** (N+21 → N+22): cross-batch consumer 진입의 토대. 후속 Phase D 위저드 마이그레이션 4건(N+27/N+49/N+50/N+53)의 정합 게이트.
- **data.js SSOT 보강** (N+19 → N+20): cascading 1회로 다수 finding 해소. proto only이라 회귀 위험 격리.
- **proto polish 마무리** (N+25/N+28/N+29): visual 정합만 필요, 블라스트 최소.

### 6.2 첫 3 PR 후보 ⭐

#### ① N+21 — DemoLimitBanner SSOT 카나리 (블라스트 최소)

- **PR 제목**: `feat(proto): DemoLimitBanner SSOT — 4 위저드 데모 한계 일관성`
- **branch**: `feat/proto-demo-limit-banner` (또는 `claude/phase3a-stage4-n21`)
- **scope**: `_design-reference/ui.jsx` + `_design-reference/wizards.jsx`
- **검증**: 4 위저드 완료 화면 배너 시각 + 새로고침 후 디렉토리 미변경 4 시나리오 (Playwright proto playground 또는 시각 갈음)
- **선택 근거**:
  1. Phase A 8건 중 **유일한 HIGH** 우선 RECORD (Q4 reversal 결정 구현)
  2. cross-batch consumer 4건 (N+27/N+49/N+50/N+53) **upstream 진입 의무**
  3. ~40 LOC net 최소 블라스트 — 카나리 적격
  4. codebase mutation 0, 회귀 위험 격리

#### ② N+19 — data.js 5건 SSOT 키 보강

- **PR 제목**: `feat(proto): data.js SSOT — perf/career/attendance 인라인 → mock SSOT`
- **branch**: `feat/proto-data-js-ssot`
- **scope**: `_design-reference/data.js` + `_design-reference/page-employee-detail.jsx` + `_design-reference/inspector.jsx`
- **검증**: 인라인 array literal 0건 grep + 직원별 quickStats/recentActivity 다양화 시각
- **선택 근거**:
  1. N+21 후속 — proto SSOT 패턴 검증 트랙 연속
  2. 5 SSOT 키 cascading 1회로 EM-003/004/005/007/008 5 finding 해소
  3. proto only, codebase 회귀 0

#### ③ N+20 — 위저드 옵션 5 SSOT 통합

- **PR 제목**: `feat(proto): wizard options SSOT — departments/ranks/salaryBands/onboardingTemplates/employmentTypes`
- **branch**: `feat/proto-wizard-options-ssot`
- **scope**: `_design-reference/data.js` + `_design-reference/wizards.jsx`
- **검증**: HireWorker 위저드 6 step 통과 + 옵션 dropdown 항목 정합 시나리오
- **선택 근거**:
  1. N+19 직후 — data.js SSOT 패턴 연속
  2. departments 15 ↔ wizard 6 인라인 conflict 해소
  3. cross-surface X2/X3/X4 (Q5=A) cascading 진입

### 6.3 진입 순서 거버넌스

- **카나리 진입 = N+21 단독 PR**. Codex Gate 1+2 + 시각 1축 PASS 후 N+19 진입.
- **N+22는 N+21 → N+19 → N+20 후**: SSOT 패턴 정합 검증 후 ui.jsx 신규 SSOT 추가 진입.
- **N+23/N+25/N+28/N+29는 합본 가능**: visual polish 4건 묶음 PR (`feat/proto-visual-polish-batch1`)도 옵션.

---

## §7. 가드 (본 audit 준수)

- ❌ src/ / prisma/ / messages/ 변경 0 (readonly audit)
- ❌ 기존 batch 카드 / RECORD / Stage 4 pre-flight 23 파일 미터치
- ❌ 새 RECORD 번호 reserve 0
- ❌ Phase B/C/D/E 후보 audit 0 (Phase A 만)
- ❌ main / PR-4 / PR-5A 무관
- ❌ HANDOVER_PHASE3A.md 정정 0 (별도 turn — 파일 부재 정정 + 카운트 inconsistency 정정)
- ✅ Phase A 8 RECORD scope estimate (재분류 3건 별도 표)
- ✅ Phase B SSOT 4건 의존성 단방향 verify (역의존 0)
- ✅ N+21 양쪽 등장 status 결론 (분리 PR 의도)
- ✅ phase3a-audit 워크트리 single commit + origin push

---

## §8. Out of scope (별도 turn)

- **Phase B/C/D/E RECORD audit** (각 phase 별 entry audit 추가 문서)
- **실 implementation** (N+21 카나리 진입 후속 PR 자체)
- **새 batch 후보** (J 알림+업무 / H 인사이트 — batch 07 차순위 §4)
- **HANDOVER_PHASE3A.md 정정** (파일 부재 + 카운트 inconsistency 정정)
- **STATUS.md Session 230 헤더 업데이트** (PR-4/PR-5A 머지 기록)

---

## §9. batch 07 N+33/N+35/N+36 Phase 재분류 결정 근거 (surgical 정정)

> 본 §9는 §1.2 표의 추정 표기 ("Phase B 또는 Phase C")를 사양 본문 read 후 정확한 Phase 할당으로 정정한 결정 trace.
> 정정 trigger: Session 230 HOLD 슬롯 surgical 정정 turn. wizards.jsx 후속 PR과 doc 영역 분리 (충돌 0).

### 9.1 N+33 → Phase B 확정 (SSOT 신설)

**사양 근거** (`batch-cards/07-onboarding-offboarding.md` §7 line 371-394):

- 트랙: DB seed + proto `data.js` (양면 SSOT 신설)
- 우선: MEDIUM
- **의존성: 0 (독립 진입 가능)**
- Stage 4 입력: `prisma/seed.ts` 또는 `prisma/seed-onboarding-default.ts` 신규 + 6단계 `OnboardingTemplate` default + 4 카테고리 enum 정합 + 12 법인 idempotent
- proto `data.js` `ONBOARD_STEPS` SSOT 정합

**Phase B 분류 근거**:

1. **SSOT 신설** (DB seed + proto data 양면 SSOT) — Phase B 정의 "SSOT 신설 / codebase 카나리" 정합
2. **의존성 0** — 단독 진입 가능 (Phase B 특성, N+24/N+43/N+48과 동일 패턴)
3. **cross-batch consumer 가능** — `OnboardingTemplate` default seed가 다른 RECORD/feature에서 default 참조 가능 (cross-batch upstream)
4. **LOC 작음** — DB seed 스크립트 + proto data SSOT 정합만, ~30 LOC + 12 법인 idempotent seed
5. **카나리 적합** — 의존성 0 + cross-batch SSOT 신설 = Phase B 카나리 entry 정합

→ **N+33 = Phase B** ✅ ("Phase B 또는 Phase C" 추정 표기 → **Phase B 확정**)

### 9.2 N+35 → Phase C 확정 (N+32 선행 필수)

**사양 근거** (`batch-cards/07-onboarding-offboarding.md` §7 line 415-430):

- 트랙: codebase 미세 정합 (Hire Card actions)
- 우선: LOW
- **의존성: N+32 선행 필수** (Hire Card 컴포넌트 안의 actions area)
- Stage 4 입력: force-complete API 재사용 (기존) + 리마인드 action notification API + delay status 시 force-complete, 그 외 status 시 리마인드

**Phase C 분류 근거**:

1. **codebase 적용** — codebase 미세 정합 (force-complete + 리마인드 액션, 기존 API 재사용)
2. **소~중 블라스트** — Hire Card actions area 한정 (작음)
3. **N+32 선행 필수** — Hire Card 컴포넌트 자체가 N+32 신설 산물. Phase C 내에서 **N+32 머지 후 N+35 진입** (Phase 내 순차)
4. **SSOT 신설 0** — 기존 force-complete API 재사용 + 액션 분기. Phase B 적합성 부재
5. **권한 가드** — HR_ADMIN / EXECUTIVE 분기, ApprovalFlow 통합

→ **N+35 = Phase C** ✅ ("Phase C with N+32 선행 의존" → **Phase C 확정, N+32 선행 필수 명시**)

### 9.3 N+36 → Phase C 확정 (N+32 선행 권고)

**사양 근거** (`batch-cards/07-onboarding-offboarding.md` §7 line 433-450):

- 트랙: codebase 토큰화
- 우선: LOW
- **의존성: N+32 선행 권고** (Hire Card + journey view 안의 카테고리 색상)
- Stage 4 입력: 4 enum × wt-1~8 매핑 + status SSOT cross-ref (N+22 EmployeeStatusChip)
- 다크 known-deferred → ON-016 / Phase 4 합본

**Phase C 분류 근거**:

1. **codebase 적용** — 토큰화 (4 enum × wt 토큰 매핑 layer)
2. **소 블라스트** — 색상 매핑 layer만 (작음, 인라인 hex 0건)
3. **N+32 선행 권고** — Hire Card + journey view 안의 카테고리 색상은 N+32 컴포넌트 후 토큰 적용. Phase C 내 순차 진입
4. **SSOT cross-ref 정방향** — N+22 EmployeeStatusChip SSOT 측 cross-ref만 (역의존 0, §3.3 단방향 그래프 정합)

→ **N+36 = Phase C** ✅ ("Phase C with N+32 선행 의존" → **Phase C 확정, N+32 선행 권고 명시**)

### 9.4 N+32 정합 결정 — (c) audit 표기 정합 유지

**사양서 §3 의제**: "HANDOVER §2 = N+32 가 Phase D 명시 → audit '`Phase C with N+32 선행`' 표기 = N+32 도 Phase C 이동 권고인지 또는 audit 표기 오류인지 확인"

**검증 결과**:

1. **HANDOVER_PHASE3A.md 파일 부재** (Stage 4 pre-flight 종결 SHA `a147d919` 시점에 미존재). 사양서의 "HANDOVER §2" 인용 = **phantom doc**.
2. **audit README §2 (`docs/phase-3a/stage4-implementation/README.md`) = N+32 Phase C 명시** (Phase C "codebase 적용 소~중 블라스트" 대표 RECORD: "N+32 (view mode + Hire Card + journey)")
3. **audit §6 (본문) = "Phase C with N+32 선행"** — audit README §2와 정합 ✅
4. **충돌 없음**: 사양서 §3 단언은 phantom doc 인용. audit README §2 + audit §6 본문은 일관되게 N+32 Phase C 명시.

**(a) N+32 Phase D 이동 권고 — 거부**:
- N+32 사이즈만 보면 (~270 LOC + 신규 컴포넌트 2종 + i18n ~50 entries) Phase D 급
- 하지만 **Phase 분류 기준 = entry/SSOT 의존 순서 (LOC 사이즈 아님, §9.5 참조)**
- N+32 = cross-batch consumer 진입의 핵심 컴포넌트 신설 (Hire Card + journey view) — entry 순서상 Phase C 정합
- Phase D ("위저드 4종 migration 등 SSOT consumer 합본") 와 성격 다름

**(b) audit 표기 오류 — 거부**:
- audit README §2 + audit §6 본문 둘 다 일관되게 N+32 Phase C — 표기 오류 없음

**(c) audit 표기 정합 유지 + Phase 분류 기준 명시 — 채택** ✅:
- N+32 = Phase C 유지 (audit README §2 + audit §6 정합 그대로)
- §9.5 신설로 Phase 분류 기준 (entry 순서 vs LOC 사이즈) 단일 진실 명시
- 사양서 §3 phantom doc 인용은 가디언 dictate에서 정정 (§9.6)

→ **N+32 = Phase C 유지** ✅. audit README + audit 본문 정정 0.

### 9.5 Phase 분류 기준 정의 (단일 진실 명시)

본 audit이 정의하는 5-Phase 분류 기준 = **entry/SSOT 의존 순서** (LOC 사이즈 아님):

| Phase | 기준 | 대표 RECORD |
|---|---|---|
| **Phase A** | proto only (codebase mutation 0) | N+19/N+20/N+21/N+22/N+23/N+25/N+28/N+29 (8건) |
| **Phase B** | SSOT 신설 / 카나리 (의존성 0, cross-batch upstream) | N+24 · N+33 · N+43 · N+48 |
| **Phase C** | codebase 적용 (cross-batch consumer 진입, 소~중 블라스트, Phase 내 순차 가능) | N+17 · N+18 · N+26 · N+30 · N+31 · N+32 · N+35 · N+36 |
| **Phase D** | codebase 대 블라스트 (위저드 4종 migration 등 SSOT consumer 합본 + a11y 합본 PR) | N+27 · N+44 · N+45/N+46 · N+49/N+50/N+53 |
| **Phase E** | 격상 batch 풀스택 (DB schema migration 동반) | N+37~N+42 (batch 06) |

**핵심 단언**:
- Phase 분류 = **entry/SSOT 의존 순서** 기준 (carrier 의존성 그래프 단방향)
- N+32 LOC가 Phase D 급이나 entry 순서상 Phase C (cross-batch consumer 진입의 핵심 컴포넌트 신설)
- Phase C 내 순차 진입 가능 (N+32 머지 → N+35 → N+36 또는 N+35/N+36 합본)

### 9.6 가디언 측 HANDOVER §2 정정용 인용 dictate

가디언 측 인계 prompt에 다음 정정 인용 합류 권고:

```text
HANDOVER §2 (현재 부재 또는 phantom doc) → audit README §2 + audit phase-a-entry-audit.md §9 단일 진실 참조 정정

확정 사항:
- N+32 = Phase C (audit README §2 대표 RECORD 명시, audit §6 "Phase C with N+32 선행" 정합 — §9.4 참조)
- N+33 = Phase B (audit §9.1, SSOT 신설 + 의존성 0, cross-batch upstream)
- N+35 = Phase C (audit §9.2, N+32 선행 필수, Phase C 내 순차)
- N+36 = Phase C (audit §9.3, N+32 선행 권고, Phase C 내 순차)

Phase 분류 기준 (§9.5) = entry/SSOT 의존 순서 (LOC 사이즈 아님). 5-Phase 정의 참조.

HANDOVER §2 신설 시 위 4 RECORD 정확한 Phase 할당 + §9.5 분류 기준 cross-link 권고.
```

---

**상태**: ACTIVE (Phase A 진입 input SSOT + §9 재분류 결정 SSOT)
**다음 갱신**: Phase A 첫 PR (N+21) 진입 후 추후 RECORD 진입 시점에 cross-ref 갱신
**책임 단언**: 본 audit이 Phase A 카운트 / scope / 권고 순서 + N+33/N+35/N+36 Phase 할당 + 5-Phase 분류 기준의 **단일 진실**. 다른 문서와 충돌 시 본 audit 우선.
