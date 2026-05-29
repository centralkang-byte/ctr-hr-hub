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
| 2 | 조직 개편 위저드 | RestructureModal (centered-overlay 3-step wizard) | `OrgRestructureWizard` (`wizards.jsx:622`) | ~205 | proto = WizardShell full-screen, 6 step. codebase = 이미 centered-overlay 3-step wizard (Step `'edit'\|'diff'\|'confirm'`, custom StepIndicator, inline footer, `MODAL_STYLES.container`) — drawer 아님 |
| 3 | 부서 detail panel | RestructureDiffView + DetailPanel | (proto 부재) | — | codebase only |
| 4 | DnD studio | `org-studio/DraggableOrgTree` + `ImpactAnalysisPanel` | (proto 부재) | — | codebase only, B8-2 era 카나리 |

### 1.1 보조 컴포넌트

| 컴포넌트 | 위치 | 역할 |
|---|---|---|
| `DeptFlowNode` | `src/components/org/DeptFlowNode.tsx` | ReactFlow 커스텀 노드 (B3I dotted-line) |
| `DetailPanel` | `src/components/org/DetailPanel.tsx` | 우측 슬라이드 부서 상세 |
| `DirectoryView` | `src/components/org/DirectoryView.tsx` | 디렉토리 모드 (DeptFlowNode와 별도) |
| `RestructureModal` | `src/components/org/RestructureModal.tsx` | 조직 개편 centered-overlay 3-step wizard (drawer 아님) |
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

### OG-002 [HIGH] OrgRestructureWizard 전체화면 vs RestructureModal — wizard 패턴 정합
- **surface**: 조직 개편 진입
- **현상**: proto `OrgRestructureWizard` (`wizards.jsx:622-826`) = WizardShell full-screen, 4 step (변경유형→내용→영향→결재선). codebase `RestructureModal` = **이미 centered-overlay 3-step wizard** (Step `'edit'\|'diff'\|'confirm'` L365, custom StepIndicator L367, inline footer 이전/다음/취소/즉시적용 L631-672, root = `MODAL_STYLES.container` fixed inset-0 flex items-center justify-center). **drawer 아님**
- **정정**: "drawer vs full-screen 패턴 충돌" 전제는 코드상 무의미 — 코드가 이미 centered-overlay wizard. 남는 작업은 WizardShell SSOT(N+48, `src/components/shared/WizardShell.tsx`)로 wrap 정합뿐 (N+50)
- **권고**: N+50 — RestructureModal을 WizardShell SSOT로 wrap (N+49 HireWorker #85 모델). drawer 회귀 불가, N+27 구조작업 불필요

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
| X2 | 위저드 패턴 정합 | proto WizardShell full-screen / codebase RestructureModal = 이미 centered-overlay 3-step wizard (drawer 아님) | WizardShell SSOT(N+48)로 wrap (N+50) |
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
| OrgRestructureWizard full-screen | ✅ | ✅ (이미 centered-overlay 3-step wizard, drawer 아님) | **OG-002 — WizardShell SSOT wrap (N+50)** |
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

> **정합성 검증 결과 (2026-05-21 가디언 grep 검증 — Session 235 정정)**
> 위저드 4종 패턴 (Hire/JobPosting/PerfCycle/OrgRestructure) 모두 WizardShell full-screen 사용 확인.
> ~~`RestructureModal` (drawer) 은 codebase 단독 패턴, proto와 결렬.~~ → **정정: `RestructureModal` 은 drawer가 아니라 이미 centered-overlay 3-step wizard.** WizardShell SSOT(N+48)로 wrap만 하면 4종 정합 (N+50).
> **Q2 추천 = WizardShell SSOT wrap** (drawer 재작업 불요).

> **Stage 3 게이트 통과 (2026-05-21)** — 사용자 가디언 추천안 **전체 채택 확정**.
> **Paradigm**: batch 04 (proto leader) 와 정반대 — batch 05 = **codebase leader** (production 보존 default).
> | Q | 결정 | Stage 4 입력 |
> |---|---|---|
> | Q1 | **A** | codebase 4 mode 키 SSOT 유지, proto 갱신 |
> | Q2 | **A** | proto WizardShell full-screen 채택, RestructureModal 재작업 ⭐ |
> | Q3 | **A** | DeptFlowNode SSOT 유지, proto 색상만 토큰화 |
> | Q4 | **A** | codebase EffectiveDatePicker 유지, proto button reskin |
> | Q5 | **A** | codebase에 page-h + wd-status-chips 4건 도입 |
> | Q6 | **전수 유지** | Matrix/Snapshot/ChangeHistory/RestructurePlan/DnD/Multi-company/Directory/DetailPanel |
> | Q7 | **A** | Phase 4 다크 트랙 합본 (F19/F24/F26/EM-019/OG-018) |

### Q1 — View mode 명명 정렬 (OG-001 + X1)
- **A** (codebase 키 SSOT `tree/directory/list/grid` 유지, proto 갱신)
- **B** (proto 키 `tree/dir/card` 채택, codebase 변경)
- **C** (4 mode 유지 + proto 키 매핑 layer)
- **추천**: A (codebase 4 mode production 실수요, i18n 키 이미 정합)

### Q2 — Restructure 위저드 형태 정합 (OG-002 + X2) ⭐
> **정정 (Session 235)**: 아래 선택지의 "drawer" 전제는 코드상 무의미 — RestructureModal은 이미 centered-overlay 3-step wizard. 실제 결정 = WizardShell SSOT(N+48)로 wrap (N+50, N+49 #85 모델). 아래 배경은 보존.
- **A** (~~proto WizardShell full-screen 채택, codebase RestructureModal 재작업~~ → WizardShell SSOT wrap, 형태 재작업 불요)
- **B** (~~codebase drawer modal 유지, proto 재정의~~ — 코드가 drawer 아님, 무효)
- **C** (~~hybrid — drawer 안에 multi-step~~ — 무효)
- **추천 (정합성 검증, 정정)**: **A** — 위저드 4종 모두 WizardShell SSOT 소비로 정합. RestructureModal은 이미 wizard라 drawer 회귀 불가, 순수 wrap. **batch 04 Q4와 같은 정합성 우선 결정**.

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

## §7. RECORD N+24~N+30 plan body 사양화

**Stage 3 게이트 통과 후 promote 완료 (2026-05-21).** 각 entry = Stage 4 작업계획 SSOT.

---

### N+24 — page-h + wd-status-chips 도입 (OG-004 + OG-014 + Q5=A) [HIGH]

- **결정**: OrgClient toolbar (`<h1>` + flex flex-wrap) → page-h + wd-status-chips 4건 (root 법인 + 부서 카운트 + 내 팀 + 발효일). batch 03/04 SSOT 정합.
- **영향**:
  - `src/app/(dashboard)/org/OrgClient.tsx` toolbar 영역 (~60 lines) → page-h 패턴
  - 신규 또는 기존 SSOT 컴포넌트 재사용 (batch 03/04 page-h 패턴 grep 후 결정)
  - 4 chips 데이터 source: existing state (`tree`/`departments`/`hrTeam`/`effectiveDate`)
- **수락 기준**:
  - page-h 가로 정렬 batch 03/04 정합
  - 4 chips 데이터 binding 검증 (실시간 부서 카운트, 발효일 동기)
  - 모바일 reflow (chips wrap, 가로 overflow 0)
  - 다크 known-deferred (Phase 4 합본)
- **우선**: HIGH (production 첫 surface)
- **E2E**: page-h 렌더 + 4 chips 데이터 정합 + 모바일 reflow
- **블로커**: PR-5A 머지 후 진입

---

### N+25 — View mode 명명 정렬 (OG-001 + X1 + Q1=A) [MEDIUM, proto only]

- **결정**: codebase 4 mode 키 SSOT 유지 (`tree/directory/list/grid`), proto 3 mode → 4 mode 갱신
- **영향**:
  - `_design-reference/page-org.jsx` view tab 3 → 4 (directory/list/grid)
  - codebase 변경 0
  - codebase i18n 이미 정합 (`org.viewTree/viewDirectory/viewList/viewGrid` 5 locale 확정)
- **수락 기준**:
  - proto 4 view tab 시각 정합
  - dir/list/grid view 본문 placeholder OK (mock 한계)
- **우선**: MEDIUM (proto only)
- **E2E**: N/A (proto only, 시각 검증)

---

### N+26 — Tree node 시각 토큰화 (OG-003 + OG-015 + X3 + Q3=A) [HIGH]

- **결정**: codebase DeptFlowNode SSOT 유지 (B3I production), proto OrgNode 색상 인라인 → 토큰화 + mine highlight 정합
- **영향**:
  - `_design-reference/page-org.jsx` OrgNode (L88-120): 인라인 `oklch(60% 0.18 263)` / `oklch(95% 0.05 155)` / `var(--accent)` → CSS 변수 정합
  - `src/components/org/DeptFlowNode.tsx`: mine prop (사용자 본인 팀 highlight) 추가 — proto 정합 (Q3=A "proto 색상만 토큰화")
  - tailwind config wt token 검증 (wt-success / wt-accent / wt-primary)
- **수락 기준**:
  - DeptFlowNode mine highlight visual = proto green tint 정합
  - root highlight = wt-primary 토큰
  - proto OrgNode 인라인 oklch 0건 (전수 토큰화)
  - 다크 known-deferred → OG-018 entry, Phase 4 합본
- **우선**: HIGH (B3I production surface visual 강화)
- **E2E**: DeptFlowNode render visual 회귀 (light/dark)
- **블로커**: PR-5A 머지 후 진입

---

> **⚠️ 정정 (Session 235, 2026-05-29 — 6-agent workflow 코드 검증 + Codex Gate 1 HIGH 반영)**
> 본 문서의 N+27/N+50 전제가 실제 코드와 불일치하여 정정합니다 (기존 결정 배경은 아래 본문에 보존):
> - **`src/components/org/RestructureModal.tsx` 는 drawer가 아니라 이미 centered-overlay 3-step wizard** (Step 타입 `'edit'|'diff'|'confirm'`, custom StepIndicator, inline footer, `MODAL_STYLES.container`). "drawer → full-screen wizard 재작업" 전제는 코드상 무의미.
> - **WizardShell SSOT는 N+48이 `src/components/shared/WizardShell.tsx` 에 신설·머지(#83 `90c88ac1`)** — N+27이 `src/components/wizards/` 에 자체 신설한다는 계획은 superseded.
> - **N+27 charter = A (순수 형태 정합, 거의 no-op → N+50 WizardShell wrap에 흡수)**. 기능 항목(`split` changeType / `CHANGE_TYPE_LABELS` i18n 추출 / N+30 mapping layer)은 폐기가 아니라 **별도 feature 트랙으로 재분류**.
> - 따라서 **N+50은 N+27 머지 의존 없이 순수 WizardShell wrap으로 진입 가능** (N+49 #85 모델). 실제 작업 = string-union step → numeric currentStep 매핑 + dual-action(저장 초안/즉시 적용) custom footer.
> 근거: workflow 판정 insufficient-evidence → 코드 검증 (RestructureModal.tsx:365/367/631-672, modal.ts:3), Codex Gate 1 HIGH(수정 범위) 반영. 정정 트랙 = `docs/n27-n50-drift-fix`.

### N+27 — Restructure 위저드 형태 정합 (OG-002 + X2 + Q2=A) [HIGH]

> **정정 (Session 235)**: 아래 "drawer → full-screen 재작업" 전제는 코드상 무의미 (RestructureModal은 이미 centered-overlay 3-step wizard). N+27 charter = A (순수 형태 정합, 거의 no-op) → **N+50 WizardShell wrap에 흡수**. 기능 항목(`split` changeType / `CHANGE_TYPE_LABELS` i18n 추출 / N+30 mapping layer)은 **별도 feature 트랙으로 재분류**. 아래 결정 배경은 보존.

- **결정 (정정 전 배경, 보존)**: proto WizardShell full-screen 채택, codebase RestructureModal drawer → full-screen wizard 재작업. **위저드 4종 패턴 SSOT 정합** (정합성 grep 우선 결정, batch 04 Q4 reversal 같은 패턴). → **실제로는 코드가 이미 wizard라 재작업 불요, N+50 wrap으로 흡수.**
- **영향 (정정)**:
  - `src/components/org/RestructureModal.tsx`: 이미 centered-overlay 3-step wizard — 형태 재작업 불요. N+50에서 WizardShell SSOT로 wrap만
  - WizardShell SSOT = `src/components/shared/WizardShell.tsx` (N+48 신설·머지 #83). 자체 신설 불요
  - 4 step (변경유형 / 변경내용 / 영향분석 / 결재선) + 6 changeType (merge/split/new/move/close/rename) 정합 → **별도 feature 트랙**
  - toast + onComplete + 데모 한계 배너 (N+21 SSOT) 정합
- **수락 기준**:
  - 위저드 4종 (Hire/Job/PerfCycle/Restructure) 동일 WizardShell SSOT 소비 (N+49 #85 모델)
  - changeType 6종 모두 step 1에서 button grid 선택 → **별도 feature 트랙**
  - step 3 영향분석 = restructure-plans API preview 연동 (production)
  - step 4 결재선 = ApprovalFlow 정합 (codebase 기존 패턴)
- **우선**: HIGH (정합성 우선)
- **E2E**: 4 step 통과 + 6 changeType 각각 + toast + onComplete + API 연동 (e2e/flows/restructure-wizard.spec.ts)
- **블로커**: 없음 — 코드가 이미 wizard라 N+50 독립 진입 가능 (N+27 선행/N+30 선행 불요)

---

### N+28 — EffectiveDatePicker proto visual reskin (OG-005 + OG-008 + Q4=A) [LOW, proto only]

- **결정**: codebase EffectiveDatePicker 유지 (production), proto button placeholder → DatePicker visual reskin
- **영향**:
  - `_design-reference/page-org.jsx` 발효일 button → DatePicker dropdown 형태 (드롭다운 아이콘 + 날짜 표시)
  - codebase 변경 0
- **수락 기준**:
  - proto button visual = codebase EffectiveDatePicker 형태 정합
  - dialog 구현은 proto 한계로 placeholder 유지
- **우선**: LOW (proto only, mock 한계)
- **E2E**: N/A

---

### N+29 — Zoom controls + 검색 opacity highlight (OG-007 + OG-009) [LOW, proto only]

- **결정**: codebase 패턴 유지 (ReactFlow Controls + opacity 0.2 highlight), proto 정합
- **영향**:
  - `_design-reference/page-org.jsx`:
    - 4 custom zoom button (zoom in/out/eye/shield) → ReactFlow Controls 4 button (zoom in/out/fit/lock) 시각 정합
    - search input onChange 핸들러 추가 → 매칭 노드만 풀 opacity, 나머지 opacity 0.2
  - codebase 변경 0
- **수락 기준**:
  - proto eye/shield button 폐기 또는 의미 명시 (codebase 동등 기능 부재 시 폐기)
  - proto search 결과 opacity 0.2 시각 정합
- **우선**: LOW (proto only)
- **E2E**: N/A

---

### N+30 — 위저드 매핑 layer (OG-010 + X7) [MEDIUM]

- **결정**: proto 4 step + 6 changeType (merge/split/new/move/close/rename) ↔ codebase `OrgRestructurePlan` 모델 매핑 pure functions 신설
- **영향**:
  - 신규 `src/lib/org/restructure-mapping.ts` (pure functions):
    - `mapChangeTypeToPlanAction(changeType)` → OrgRestructurePlan.action enum
    - `mapChangeTypeToFields(changeType, formData)` → plan fields (sourceDept/targetDept/newName/newParent 등)
    - reverse mapping (plan → wizard form) for edit case
  - `prisma/schema.prisma` OrgRestructurePlan 모델 검증 (action enum 6 cases 정합 여부)
    - 부재 시 schema migration 동반 (별도 사전 합의 게이트)
  - i18n: 6 changeType 라벨 5 locale (기존 `org.*` namespace 확장)
- **수락 기준**:
  - 6 changeType 매핑 완전 (모든 case OrgRestructurePlan 표현 가능)
  - unit test (pure function) — `vitest src/lib/org/restructure-mapping.test.ts`
  - i18n 6 키 × 5 locale = 30 entries
- **우선**: MEDIUM (별도 feature 트랙으로 재분류 — N+27/N+50 형태 정합과 분리)
- **E2E**: N+50 wizard 통합 시 (별도 E2E 0)
- **블로커**: 없음 — 매핑 layer는 독립 진입 가능. N+50(WizardShell wrap)은 순수 형태 정합이라 N+30 매핑 선행 불요 (기능 항목은 별도 트랙)

---

### Phase 4 다크 트랙 합본 후보 (별도)

- **OG-018** (proto OrgNode oklch 인라인 + 다크 변형 부재) → F19/F24/F26 + EM-019 합본 plan inventory entry 1건 추가
- **별도 트랙**: 본 batch 진입 0, Phase 4 다크 트랙 일괄 처리 시 cross-ref만 보장

### 별도 i18n 트랙 후보 (신규)

- **X6 "발효일/적용일/시행일" 3 라벨 결렬**: ko.json 안에 동시 공존 (line 3730/3830/4108/7970/8079/8223/8274). 별도 i18n 정합 트랙 inventory entry 1건 — batch 05 진입 0, Stage 4 후속

---

## §8. 다음 액션 (게이트 통과 후)

1. **Q1-Q7 사용자 게이트 결정 수신** (가디언 ↔ 사용자 1 round)
2. **결정안 batch 05 §7 RECORD 사양화** (각 N+24~N+30 entry plan body 작성)
3. **CC handover** — phase3a-audit 워크트리에서 docs commit + RECORD cross-ref
4. **Stage 4 pre-flight (codebase 트랙 4건)** — 본 audit 결과 N+24/N+26/N+27/N+30이 코드베이스 변경 트랙. pre-flight 진행 후 implementation
5. **PR-5A 머지 후 진입** — 본 카드 RECORD 일부 동반 plan 후보 (PR-5B/5C/...)

---

**상태**: ACTIVE (Stage 3 게이트 통과 2026-05-21, RECORD N+24~N+30 사양화 완료)
**다음 갱신**: Stage 4 구현 진입 시 (PR-5A 머지 ~2026-05-24 02:43 KST 이후).
**Paradigm**: batch 05 = codebase leader (production 보존 default, proto visual SSOT 만 적용).
**Stage 4 진입 순서 권고**:
1. **N+25** (view tab 4 mode, proto only) — 가장 작은 블라스트
2. **N+28** (DatePicker visual, proto only) — 작음
3. **N+29** (zoom + opacity, proto only) — 작음
4. **N+24** (page-h + chips, **production 첫 surface**) — 카나리 1번 (codebase)
5. **N+26** (DeptFlowNode 토큰화, **codebase**) — B3I production surface 카나리
6. **N+30** (위저드 매핑 layer, **codebase**) — 별도 feature 트랙 (N+50 형태 정합과 분리, 독립 진입)
7. **N+50** (RestructureModal을 WizardShell SSOT로 wrap, **codebase**) — 순수 형태 정합 (N+49 #85 모델). N+27 머지/N+30 선행 의존 없이 독립 진입 가능 (코드가 이미 wizard라 drawer 재작업 불요)

**Stage 4 pre-flight 권고 (별도 turn) — Session 235 정정**:
- 코드베이스 트랙: N+24/N+26 (visual) + N+50 (WizardShell wrap) + N+30 (매핑, 별도 feature 트랙)
- ~~N+27 schema migration 여부~~ → N+50은 형태 정합(string-union step → numeric currentStep 매핑 + dual-action custom footer)이라 schema migration 무관. `split` changeType / `OrgRestructurePlan.action` enum 정합은 **별도 feature 트랙** 사전 검토 항목
