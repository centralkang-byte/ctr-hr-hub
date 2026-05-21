# Phase 3a · Batch 05 — 조직도 (Org)

> **범위**: 조직 영역 1 surface (`/org`) + Restructure wizard + Detail panel + Directory view
> **작성일**: 2026-05-21 KST
> **작성자**: 가디언 (proto 디자인 SSOT 트랙)
> **base proto SHA**: `HR Hub.html` 동결본
> **base codebase SHA**: `1260a95f` (main 동결)
> **batch ID 컨벤션**: `OG-001` ~ `OG-018`

---

## §0. 1분 요약

- **1 surface (`/org`), 18 findings** (HIGH 4 / MEDIUM 9 / LOW 5)
- **핵심 패턴 (batch 04와 정반대)**:
  - **코드베이스 >>> proto** — 코드베이스 = ReactFlow + dagre + B3I dotted-line matrix + multi-company + snapshots + change-history + DnD studio. proto = 122-line simple tree + 3 view tab (2 placeholder)
  - **운명카드 (다 = 코드만) 다수** — 모두 **유지 권고** (production feature, proto 한계 ≠ 결함)
  - **proto visual SSOT만 적용** — page-h + wd-status-chips + 발효일 button visual + 조직 개편 wizard 단계 인터랙션
- **B3I (Dotted-line matrix)** 이미 완성 (Completed Features), proto에 없음 — 운명 유지
- **사용자 게이트 의제 Q1-Q7** — view mode 정렬 + wizard vs modal 정합 + tree node 시각 토큰화 + visual SSOT 도입 범위
- **RECORD 후보 N+24~N+30** reserve

---

## §1. Surface 인벤토리

| # | Surface | Route (코드베이스) | Proto 파일 | Lines | 비고 |
|---|---|---|---|---|---|
| 1 | 조직도 메인 | `/org` | `page-org.jsx` | 122 | 1 page + 3 view tab (proto는 tree만 구현, dir/card placeholder) |
| 2 | 조직 개편 위저드 | RestructureModal (drawer) | `OrgRestructureWizard` (`wizards.jsx:622`) | ~205 | proto = WizardShell full-screen, 6 step. codebase = drawer 모달 |
| 3 | 부서 detail panel | RestructureDiffView + DetailPanel | (proto 부재) | — | codebase only |
| 4 | DnD studio | `org-studio/DraggableOrgTree` + `ImpactAnalysisPanel` | (proto 부재) | — | codebase only, B8-2 era 카나리 |

### 1.1 보조 컴포넌트

| 컴포넌트 | 위치 | 역할 |
|---|---|---|
| `DeptFlowNode` | `src/components/org/DeptFlowNode.tsx` | ReactFlow 커스텀 노드 (B3I dotted-line) |
| `DetailPanel` | `src/components/org/DetailPanel.tsx` | 우측 슬라이드 부서 상세 |
| `DirectoryView` | `src/components/org/DirectoryView.tsx` | 디렉토리 모드 (DeptFlowNode와 별도) |
| `RestructureModal` | `src/components/org/RestructureModal.tsx` | 조직 개편 모달 |
| `RestructureDiffView` | `src/components/org/RestructureDiffView.tsx` | 변경 사항 diff 시각화 |
| `EffectiveDatePicker` | `src/components/shared/EffectiveDatePicker.tsx` | 발효일 dropdown picker |
| `DraggableOrgTree` | `src/components/org-studio/` | DnD 조직 트리 (B8-2) |
| `ImpactAnalysisPanel` | `src/components/org-studio/` | 영향 분석 패널 (B8-2) |

### 1.2 API endpoint inventory (codebase only)

```
GET  /api/v1/org/tree                      — 트리 구조
GET  /api/v1/org/matrix-edges              — 점선 매트릭스 엣지 (B3I)
GET  /api/v1/org/snapshots                 — 조직 스냅샷 list
GET  /api/v1/org/restructure-plans         — 개편 plan list
POST /api/v1/org/restructure-plans         — plan 생성
GET  /api/v1/org/restructure-plans/[id]    — plan detail
PATCH/api/v1/org/restructure-plans/[id]    — plan update
POST /api/v1/org/restructure-plans/[id]/apply — plan 적용 (DB 반영)
POST /api/v1/org/restructure               — 즉시 개편
GET  /api/v1/org/departments               — 부서 list
GET  /api/v1/org/departments/[id]          — 부서 detail
GET  /api/v1/org/change-history            — 변경 이력
GET  /api/v1/org/companies                 — 법인 list (multi-company 필터용)
```

### 1.3 Prisma 모델

```
model Department          (line 1028)
model OrgChangeHistory    (line 1261)
model OrgRestructurePlan  (line 1281)
model OrgSnapshot         (line 4287)
```

---

## §2. Findings (OG-001 ~ OG-018)

### OG-001 [HIGH] View mode 명명 — proto card ↔ codebase grid
- **surface**: org 메인 toolbar
- **현상**: proto = `["tree", "dir", "card"]`, codebase = `["tree", "directory", "list", "grid"]`. 같은 의미 "카드 = grid" 인데 키 다름. codebase는 4 mode (proto 3 mode + list 추가). i18n `viewGrid: "카드"` 로 라벨은 정합
- **권고**: codebase 4 mode SSOT 유지 (production = list 모드 실수요). proto의 3 mode → 4 mode로 갱신 권고. 키 명명 = codebase (Q1)

### OG-002 [HIGH] OrgRestructureWizard 전체화면 vs RestructureModal 드로어 — 패턴 충돌
- **surface**: 조직 개편 진입
- **현상**: proto `OrgRestructureWizard` (`wizards.jsx:622-826`) = WizardShell full-screen, 4 step (변경유형→내용→영향→결재선). codebase `RestructureModal` = 드로어 패턴 (Sheet)
- **위반**: proto 위저드 4종 (Hire/Job/PerfCycle/Org) 모두 WizardShell full-screen 패턴. codebase Modal은 drawer 12종 패턴과 정합하지만 proto 위저드 4종과 비대칭
- **권고**: Q2 게이트 — (A) proto full-screen 유지 / (B) codebase drawer 유지 (위저드 4종 vs drawer 12종 — 어느 패턴 우선?) / (C) hybrid (full-screen WizardShell 안에 drawer 단계?)
- **batch 04 Q4 정합성 검증 패턴 재사용**: 위저드 4종 grep 결과 모두 `WizardShell`+full-screen. RestructureModal은 4종 패턴 위반 → **(A) proto full-screen 권고**

### OG-003 [HIGH] Tree node 시각 SSOT — proto OrgNode 인라인 vs codebase DeptFlowNode (B3I)
- **surface**: 트리 view
- **현상**: proto `OrgNode` (`page-org.jsx:88-120`) = 인라인 컴포넌트, oklch 색상 인라인 (보라색 `oklch(60% 0.18 263)`, root accent, mine green `oklch(95% 0.05 155)`). codebase `DeptFlowNode` = B3I dotted-line 지원 + Workday navy 토큰
- **위반**: proto 색상 인라인 (Phase 1 토큰화 위반). codebase DeptFlowNode SSOT 우위
- **권고**: codebase `DeptFlowNode` SSOT 유지. proto OrgNode → DeptFlowNode 시각 정렬 (highlighted root + mine green 토큰화 + dotted-line edge)

### OG-004 [HIGH] page-h + wd-status-chips 미적용 (Workday SSOT 위반)
- **surface**: org 메인 상단
- **현상**: proto = `page-h` + `wd-status-chips` 4건 (root + dept count + 내 팀 + 발효일). codebase = `<h1>` + `flex flex-wrap items-center gap-3` 인라인 toolbar (status chips 없음)
- **위반**: `DESIGN_RULES.md` "KPI 5패턴 중 wd-status-chips 권고", batch 03 dashboard와 정합
- **권고**: codebase에 page-h + wd-status-chips 4건 도입 (root 법인 + 부서 카운트 + 내 팀 + 발효일)

### OG-005 [MEDIUM] EffectiveDatePicker vs proto 발효일 button placeholder
- **surface**: org 메인 toolbar
- **현상**: proto = 단순 button (onClick 미구현, placeholder). codebase = full EffectiveDatePicker (DateDropdown + future/past 선택 + label)
- **권고**: codebase EffectiveDatePicker SSOT 유지 (production = 실수요). proto는 visual reference만, button → DatePicker 형태 정합 필요 (드롭다운 아이콘 + 날짜 표시)

### OG-006 [MEDIUM] 조직 개편 button — Hammer icon (proto) vs codebase 위치/icon
- **surface**: org 메인 toolbar 우측
- **현상**: proto = `<Icons.Hammer>` + "조직 개편" + btn-primary (proto). codebase = (검증 필요 — RestructureModal trigger 위치)
- **권고**: proto Hammer icon + btn-primary 정합 권고. 위치 = 우측 toolbar 끝

### OG-007 [MEDIUM] Tree zoom controls — proto 4 button vs ReactFlow Controls
- **surface**: 트리 view
- **현상**: proto = custom 4 button (zoom in/out/eye/shield) 좌측하단. codebase = `<ReactFlow Controls>` (ReactFlow 라이브러리 내장: zoom in/out/fit/lock 4 button)
- **권고**: codebase ReactFlow Controls SSOT 유지 (검증된 a11y + 키보드 지원). proto의 eye/shield button 의미 불명 → 폐기 후보. Q3

### OG-008 [MEDIUM] 발효일 dialog 미구현 (proto)
- **surface**: 발효일 button click
- **현상**: proto 발효일 button onClick 핸들러 0, dialog 0. codebase = EffectiveDatePicker DateDropdown
- **권고**: proto 한계 (실제 dialog 부재). codebase 패턴 유지

### OG-009 [MEDIUM] 검색 결과 시각화 — proto 미구현 vs codebase opacity 0.2 highlight
- **surface**: 트리 view 검색
- **현상**: proto = search input only (검색 처리 핸들러 0). codebase = `filteredTreeNodes` opacity 0.2 (matched만 풀 opacity, 나머지 fade)
- **권고**: codebase opacity 패턴 유지. proto에 동일 패턴 도입 권고 (visual reference)

### OG-010 [MEDIUM] 위저드 단계 구성 — proto 4 step vs RestructureModal 구조
- **surface**: 조직 개편
- **현상**: proto = 4 step (`ORG_STEPS`: 변경유형 / 변경내용 / 영향분석 / 결재선). 변경유형 6종 (merge/split/new/move/close/rename). codebase RestructureModal = (별도 검증 필요)
- **권고**: proto 4 step + 6 changeType SSOT 유지 (UX 정합). codebase는 plan 모델 기반 → 매핑 layer 검토 (changeType → restructure-plan 변환)

### OG-011 [MEDIUM] 다중 view mode (`tree | directory | list | grid`) — proto 3 mode (`tree | dir | card`)
- **surface**: view tab
- **현상**: codebase = 4 mode 모두 구현. proto = 3 mode (dir/card placeholder, JSX 미구현)
- **권고**: codebase 4 mode SSOT 유지. proto → 4 mode 시각 정합 (visual reskin만)

### OG-012 [MEDIUM] Matrix toggle (점선 매트릭스, B3I) — proto 부재 (운명 유지)
- **surface**: 트리 view
- **현상**: codebase = matrix toggle (`showMatrix` state) → matrix-edges API → dotted edge 추가. proto = 부재
- **권고**: codebase B3I 유지 (Completed Features). proto = mock 한계, visual reference 0

### OG-013 [MEDIUM] Multi-company 필터 — proto 1 법인 hardcoded (운명 유지)
- **surface**: org toolbar
- **현상**: codebase = `companies` props + 법인 select + tree fetch param. proto = `data.orgTree.root.name` 1 법인만
- **권고**: codebase multi-company SSOT 유지. proto = mock 한계

### OG-014 [LOW] Status chips 색상 — proto 4 variant (success/accent/zero) vs codebase 미적용
- **surface**: page-h
- **현상**: proto = `.sc` / `.sc.accent` / `.sc.success` / `.sc.zero` 4 variant. codebase = 미적용 (OG-004 종속)
- **권고**: OG-004 도입 시 4 variant 정합 (Workday wt 토큰)

### OG-015 [LOW] HR team 강조 색상 — proto green oklch(95% 0.05 155)
- **surface**: 트리 (HR team 노드)
- **현상**: proto = mine flag → green tint. codebase = 미적용 또는 다른 색상
- **권고**: codebase DeptFlowNode에 mine highlight 추가 (Q3 종속)

### OG-016 [LOW] OrgRestructureWizard 단계별 i18n 부재 (proto only)
- **surface**: 위저드
- **현상**: proto = step 라벨 한국어 literal (변경유형/변경내용/영향분석/결재선). codebase i18n 정합 필요시 5 locale 신설
- **권고**: codebase RestructureModal i18n 검증 후 보정 (별도 트랙)

### OG-017 [LOW] 모바일 reflow — proto + codebase 양쪽 검증 미수행
- **surface**: 트리 view 모바일
- **현상**: ReactFlow 모바일 터치 인터랙션 (zoom/pan)은 라이브러리 지원. 다만 wd-tab-bar + page-h reflow는 미검증
- **권고**: gstack 모바일 시각 검증 (375px breakpoint)

### OG-018 [LOW] 다크 모드 — proto 색상 인라인 oklch 다수, 토큰화 부재
- **surface**: OrgNode (proto) + 위저드 internal
- **현상**: `oklch(60% 0.18 263)` (purple), `oklch(95% 0.05 155)` (mine green) 등 인라인. 다크 변형 미정의
- **권고**: Phase 4 다크 트랙 합본 (F19/F24/F26 + EM-019 inventory에 OG-018 entry 1건 추가)

---

## §3. Cross-surface SSOT 결함

| ID | 항목 | 분기 위치 | 권고 |
|---|---|---|---|
| X1 | View mode 명명 | proto card / codebase grid | codebase 키 (`viewGrid`) SSOT |
| X2 | 위저드 vs 모달 패턴 | proto WizardShell full-screen / codebase RestructureModal drawer | 위저드 4종 정합 = full-screen (Q2) |
| X3 | Tree node 시각 | proto OrgNode 인라인 / codebase DeptFlowNode | DeptFlowNode SSOT |
| X4 | 부서 데이터 구조 | proto orgTree.{root, departments, hrTeam} flat / codebase recursive tree | codebase recursive SSOT |
| X5 | i18n org namespace | 양쪽 정합 (orgChart/viewTree/viewDirectory/effectiveDate 등) | codebase 키 SSOT |
| X6 | 발효일 라벨 | proto = "발효일" / codebase = "발효일" (ko.json:4108) / "적용일" (ko.json:3730) / "시행일" (ko.json:3830,7970) | **i18n 결렬** — 별도 트랙 inventory entry 후보 |
| X7 | changeType 6종 | proto = merge/split/new/move/close/rename / codebase OrgRestructurePlan 모델 | codebase model field 검증 후 매핑 layer |

---

## §4. Proto vs Codebase Gap (batch 04 와 정반대 패턴)

**codebase에 있고 proto에 없는 항목 = 모두 운명 유지** (production feature, mock 한계 ≠ 결함):

| 항목 | proto | codebase | 운명 |
|---|---|---|---|
| ReactFlow + dagre layout | ❌ | ✅ (B8-1) | **유지** |
| B3I dotted-line matrix | ❌ | ✅ (Completed Features) | **유지** |
| Multi-company 필터 | ❌ | ✅ | **유지** |
| OrgSnapshot 모델 + API | ❌ | ✅ | **유지** |
| OrgChangeHistory 모델 + API | ❌ | ✅ | **유지** |
| OrgRestructurePlan 모델 + API + apply | ❌ | ✅ | **유지** |
| DirectoryView 모드 | placeholder | ✅ 풀구현 | **유지** |
| DetailPanel (부서 상세) | ❌ | ✅ | **유지** |
| DnD studio (DraggableOrgTree + ImpactAnalysisPanel) | ❌ | ✅ (B8-2) | **유지** |
| EffectiveDatePicker | placeholder | ✅ 풀구현 | **유지** |
| Search opacity 0.2 highlight | ❌ | ✅ | **유지** + proto 정렬 |

**proto에 있고 codebase에 부분 적용 또는 부재 항목**:

| 항목 | proto | codebase | 적용 권고 |
|---|---|---|---|
| page-h + wd-status-chips 4건 | ✅ | ❌ | **OG-004 도입** |
| OrgNode mine green 색상 | ✅ | ❌ (또는 미확인) | **OG-015 토큰화** |
| OrgRestructureWizard full-screen | ✅ | ❌ (drawer modal) | **OG-002 패턴 정합 — Q2** |
| 4 step 위저드 + 6 changeType | ✅ | ? (검증 필요) | **OG-010 매핑** |

---

## §5. i18n / a11y / 다크 cross-cutting

### i18n
- **org.* namespace 풍부**: orgChart / viewTree / viewDirectory / viewList / viewGrid / effectiveDate / showMatrix 등 (messages/ko.json:4072-4121)
- **X6 발효일 라벨 결렬**: ko.json 안에 "발효일"(:4108), "적용일"(:3730), "시행일"(:3830, :7970, :8079, :8223, :8274) 3 변형. 별도 i18n 정합 트랙 후보

### a11y
- **wd-tab-bar 수동 tablist (proto)** — OG-001 view tab 영역, role="tablist" 부재. F14 임계 추가 surface 가능성
- **ViewModeButton (codebase)** — TAB_STYLES.trigger 사용 + `data-state="active|inactive"` 패턴. **role="tab" 부재** (informal button group). aria-label="View mode" 만 있음 → F14 비호환 (formal tablist 미적용)
  - **F14 임계 카운트**: 누적 2 (LeaveClient + MyTasksClient) → **변동 0** (ViewModeButton은 formal tablist 미적용 surface, 별도 카운트)
- **ReactFlow a11y**: 라이브러리 내장 (Controls 키보드 지원). DeptFlowNode 자체 a11y는 별도 검증

### 다크
- **proto 인라인 oklch 다수**: OrgNode 보라색 / mine green / accent — 토큰화 필요
- **OG-018**: Phase 4 다크 트랙 합본 후보 (F19/F24/F26 + EM-019와 동반)

---

## §6. 사용자 게이트 의제 (Q1-Q7)

> **정합성 검증 결과 (2026-05-21 가디언 grep 검증)**
> 위저드 4종 패턴 (Hire/JobPosting/PerfCycle/OrgRestructure) 모두 WizardShell full-screen 사용 확인.
> `RestructureModal` (drawer) 은 codebase 단독 패턴, proto와 결렬.
> **Q2 추천 = proto full-screen** (4종 정합).

### Q1 — View mode 명명 정렬 (OG-001 + X1)
- **A** (codebase 키 SSOT `tree/directory/list/grid` 유지, proto 갱신)
- **B** (proto 키 `tree/dir/card` 채택, codebase 변경)
- **C** (4 mode 유지 + proto 키 매핑 layer)
- **추천**: A (codebase 4 mode production 실수요, i18n 키 이미 정합)

### Q2 — Restructure 위저드 vs 모달 패턴 정합 (OG-002 + X2) ⭐
- **A** (proto WizardShell full-screen 채택, codebase RestructureModal 재작업)
- **B** (codebase drawer modal 유지, proto 재정의)
- **C** (hybrid — drawer 안에 multi-step)
- **추천 (정합성 검증)**: **A** — 위저드 4종 모두 full-screen 패턴 (정합성 grep 결과). RestructureModal 단독 drawer는 비대칭. **batch 04 Q4와 같은 정합성 우선 결정**.

### Q3 — Tree node 시각 SSOT (OG-003 + X3 + OG-015)
- **A** (codebase DeptFlowNode SSOT 유지 + proto 색상 토큰화 (mine green + root highlight))
- **B** (proto OrgNode SSOT 채택, DeptFlowNode 재작업)
- **C** (DeptFlowNode 유지 + B3I dotted-line 제거 후 proto 정렬)
- **추천**: A (DeptFlowNode = B3I production SSOT, 색상만 proto 정합)

### Q4 — 발효일 UX (OG-005 + OG-008)
- **A** (codebase EffectiveDatePicker 유지, proto button → DatePicker visual reskin)
- **B** (proto 단순 button placeholder 유지, codebase DatePicker → button 단순화)
- **추천**: A (production 실수요, proto = mock 한계)

### Q5 — page-h + wd-status-chips 도입 (OG-004 + OG-014)
- **A** (codebase에 page-h + wd-status-chips 4건 도입 — Workday SSOT 정합)
- **B** (현행 codebase toolbar 유지)
- **추천**: A (batch 03 dashboard / batch 04 employees와 정합 패턴)

### Q6 — codebase only 기능 운명 (OG-012/013 + §4 전체)
- 모든 codebase only 기능 (Matrix/Snapshot/ChangeHistory/RestructurePlan/DnD studio/Multi-company/DirectoryView/DetailPanel) **유지** 권고
- proto에 없음 = mock 한계, production은 모두 실수요
- **추천**: 전수 유지

### Q7 — 다크 토큰화 트랙 (OG-018)
- **A** (Phase 4 다크 트랙 합본 inventory에 OG-018 entry 추가, 본 batch 진입 0)
- **B** (본 batch에서 다크 토큰화 동반 진입)
- **추천**: A (Phase 4 다크 트랙은 F19/F24/F26 + EM-019 합본, OG-018도 동일 처리)

---

## §7. RECORD 후보 인벤토리

사용자 게이트 통과 후 N+ 시리즈 promote 권고. **batch 04 사양화 N+17~N+23 사용 후 다음 SHA**:

| RECORD 후보 | 묶음 finding | 우선 |
|---|---|---|
| **N+24** | OG-004 + OG-014 (page-h + wd-status-chips 도입) + Q5 | HIGH |
| **N+25** | OG-001 + X1 (View mode 명명 정렬) + Q1 | MEDIUM |
| **N+26** | OG-003 + OG-015 + X3 (Tree node 시각 토큰화 — DeptFlowNode + proto SSOT 정합) + Q3 | HIGH |
| **N+27** | OG-002 + X2 (Restructure 위저드 vs 모달 패턴 정합 — full-screen 채택) + Q2 | HIGH |
| **N+28** | OG-005 + OG-008 (EffectiveDatePicker proto visual reskin) + Q4 | LOW |
| **N+29** | OG-007 + OG-009 (zoom controls + 검색 opacity highlight 정합) | LOW |
| **N+30** | OG-010 + X7 (4 step + 6 changeType — proto 위저드 ↔ codebase OrgRestructurePlan 매핑 layer) | MEDIUM |

**Phase 4 다크 트랙 합본 후보**:
- OG-018 (proto OrgNode oklch 인라인 + 다크 변형 부재) → F19/F24/F26 + EM-019와 합본 plan inventory

**별도 i18n 트랙 후보**:
- X6 "발효일/적용일/시행일" 3 라벨 결렬 → i18n 정합 트랙 inventory entry 1건

---

## §8. 다음 액션 (게이트 통과 후)

1. **Q1-Q7 사용자 게이트 결정 수신** (가디언 ↔ 사용자 1 round)
2. **결정안 batch 05 §7 RECORD 사양화** (각 N+24~N+30 entry plan body 작성)
3. **CC handover** — phase3a-audit 워크트리에서 docs commit + RECORD cross-ref
4. **Stage 4 pre-flight (codebase 트랙 4건)** — 본 audit 결과 N+24/N+26/N+27/N+30이 코드베이스 변경 트랙. pre-flight 진행 후 implementation
5. **PR-5A 머지 후 진입** — 본 카드 RECORD 일부 동반 plan 후보 (PR-5B/5C/...)

---

**상태**: DRAFT (게이트 미 수신, RECORD 미 promote)
**다음 갱신**: 사용자 Q1-Q7 결정 수신 시 RECORD §7 사양 보강
