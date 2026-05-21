# Phase 3a · Batch 04 — 직원 (Employees)

> **범위**: 직원 영역 4 surface (list / detail / new / directory)
> **작성일**: 2026-05-21 KST
> **작성자**: 가디언 (proto 디자인 SSOT 트랙)
> **base proto SHA**: `HR Hub.html` 동결본 (Session 227 잔여 fix 미반영)
> **base codebase SHA**: `1260a95f` (main 동결)
> **batch ID 컨벤션**: `EM-001` ~ `EM-020` (employees 영역 audit finding)

---

## §0. 1분 요약

- **4 surface, 20 findings** (HIGH 5 / MEDIUM 9 / LOW 6)
- **핵심 결렬**:
  - **/directory surface 부재** — proto는 `data.directory` 데이터만 있고 페이지 없음 → 코드베이스 surface와 SSOT 결렬 (EM-001)
  - **6탭 vs 7탭** — 코드베이스 spec "6탭" vs proto 7탭 (career 분리) (EM-002)
  - **하드코딩 다수** — perf/career 탭, 인스펙터 빠른 통계, 위저드 옵션 등 data.js SSOT 누락 (EM-003/004/007/008/009)
  - **데모 흐름 단절** — 위저드 완료 → directory 합류 안됨 (EM-010)
- **사용자 게이트 의제 Q1-Q7** — proto/코드베이스 SSOT 정렬 + 데모 완결성 + a11y/다크 보강
- **RECORD 후보**: 사용자 게이트 통과 후 5-7건 N+ 시리즈로 promote 권고

---

## §1. Surface 인벤토리

| # | Surface | Route (코드베이스) | Proto 파일 | Lines | 비고 |
|---|---|---|---|---|---|
| 1 | 목록 | `/employees` | `page-employees.jsx` | 329 | Workday "Find Workers" 패턴 |
| 2 | 상세 | `/employees/[id]` | `page-employee-detail.jsx` | 465 | proto **7탭** (summary/job/payroll/attendance/leave/perf/career) |
| 3 | 등록 | `/employees/new` | `wizards.jsx` (HireWorkerWizard) | step 6단 | EmployeesPage 내부에서 invoke |
| 4 | 디렉토리 | `/directory` | **부재** | — | proto에 surface 없음, data만 존재 |

### 1.1 보조 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|---|---|---|
| `EmployeeInspector` | `inspector.jsx` | 우측 슬라이드 빠른 미리보기 (row click) |
| `EmployeeMiniCard` | `inspector.jsx` | 이름 hover 카드 (delay popup) |
| `BulkActionBar` | `inspector.jsx` | 다중 선택 sticky 액션 바 |
| `FilterDropdown` | `page-employees.jsx` 내부 | 부서/고용형태/상태 다중선택 |

---

## §2. Findings (EM-001 ~ EM-020)

### EM-001 [HIGH] /directory surface 부재
- **surface**: directory
- **현상**: proto에 `data.directory` 데이터 명칭만 있고 별도 surface 없음. 코드베이스 `/directory` 와 SSOT 결렬
- **proto vs codebase**: codebase only
- **권고**: Q1 게이트 결정 (신설 vs SSOT 분리) 후 진행. 신설 시 카드 grid + 부서 트리 사이드 + photo grid 패턴 검토

### EM-002 [HIGH] 6탭 vs 7탭 불일치
- **surface**: detail
- **현상**: 코드베이스 spec "6탭", proto는 7탭 (summary/job/payroll/attendance/leave/perf/career)
- **권고**: Q2 게이트 (코드베이스 follow vs proto follow). career 탭 분리는 정보량 분산에 유리하나 코드베이스 동기화 비용 발생

### EM-003 [MEDIUM] perf 탭 하드코딩
- **surface**: detail
- **현상**: MBO 달성 이력 4행, 받은 칭찬 6건, 평가 이력 카드 모두 `page-employee-detail.jsx` 인라인 배열
- **위반**: `CLAUDE.md` "data.js 외 mock 데이터 하드코딩 금지"
- **권고**: `data.employeeDetail.mboHistory[]`, `data.employeeDetail.praises[]` 추가

### EM-004 [MEDIUM] career 탭 전체 하드코딩
- **surface**: detail
- **현상**: 학력 3건 / 자격증 5건 / 교육 5건 / 사내활동 5개 chip 모두 인라인
- **권고**: `data.employeeDetail.education[]`, `certifications[]`, `trainings[]`, `activities[]` 추가

### EM-005 [MEDIUM] AttendanceMiniCalendar 의사난수
- **surface**: detail
- **현상**: `(i * 31) % 100` 으로 30일 패턴 산출. **전 직원 동일 패턴** (강성민 = 정유진 = 한지영)
- **권고**: `data.employeeDetail.attendance30.daily[]` (30 entries) 신설 또는 직원별 시드 적용

### EM-006 [LOW] 인적사항 9개 키 중 6개 빈 상태
- **surface**: detail (summary 탭)
- **현상**: 생년월일/성별/국적/연락처/비상연락처/이메일 (이메일은 fallback 존재) 모두 `empty` 처리
- **모순**: HireWorkerWizard step 0 에서 수집하지만 detail 반영 안됨 → data flow 단절
- **권고**: data.directory 항목에 birth/gender/nationality/phone 추가, fallback 제거

### EM-007 [MEDIUM] EmployeeInspector "빠른 통계" 고정
- **surface**: list (인스펙터)
- **현상**: 잔여연차 12.5일 / 평균 OT 4.2h / 최근 등급 E — 직원과 무관하게 모두 동일
- **권고**: `data.directory[i]` 에 quickStats 키 추가 또는 inspector 안에서 employee.code 로 employeeDetail 조회

### EM-008 [LOW] EmployeeInspector "최근 활동" 하드코딩
- **surface**: list (인스펙터)
- **현상**: 4 entries (`어제 1:1 미팅`, `3일 전 분기 리뷰` 등) 인라인 + 전 직원 동일
- **권고**: `data.directory[i].recentActivity[]` 또는 employeeDetail 확장

### EM-009 [MEDIUM] HireWorkerWizard 옵션 인라인
- **surface**: new (위저드)
- **현상**:
  - step 2: 부서 6개 (개발/영업/인사/재무/품질/생산) — `data.departments` (15개) 와 불일치
  - step 2: 직급 7단 (사원~임원) — proto data.directory 의 직급과 약식
  - step 3: 연봉 밴드 L0-L6/M1/M2 — employeeDetail.payroll.band ("R3") 와 표기 충돌
  - step 4: 온보딩 템플릿 4종 — SSOT 없음
- **권고**: 5개 SSOT 키 신설 (`data.departments` 단일, `ranks`, `salaryBands`, `onboardingTemplates`, `employmentTypes`)

### EM-010 [HIGH] 위저드 완료 → directory 합류 단절
- **surface**: new
- **현상**: submit() 시 토스트만 표시, `data.directory` 미변경 → 새로고침 시 흔적 없음
- **권고**: 데모 흐름 완결을 위해 React state lift + localStorage persist 또는 명시적 "데모 한계" 배너

### EM-011 [MEDIUM] 상태 chip SSOT 미연결
- **surface**: list, detail, 인스펙터
- **현상**: `재직` `휴직` `퇴사예정` 3종 if-else 분기가 **EmployeesPage**, **EmployeeInspector**, **EmployeeDetailPage** 3 곳에 중복
- **권고**: `ui.jsx` 에 `<EmployeeStatusChip status={s} />` SSOT 또는 STATUS_MAP 도입

### EM-012 [LOW] 액션 버튼 dead-link
- **surface**: list
- **현상**: 상단 `일괄 발령`, `엑셀` 버튼 onClick 핸들러 미장착
- **권고**: 토스트 + drawer placeholder 또는 disabled 처리

### EM-013 [LOW] KPI strip 부재
- **surface**: list
- **현상**: page-h 아래 KPI 패턴 (A/B/C/D/E) 미적용. 총 인원 수만 부제에 노출
- **위반**: `DESIGN_RULES.md` "KPI 패턴 중 택 1" — 다만 "E (제거)" 케이스로 정당화 가능
- **권고**: Q3 게이트 (재직/휴직/퇴사예정/입사예정 4 chip → 패턴 B)

### EM-014 [MEDIUM] BulkActionBar 액션 alert() 처리
- **surface**: list
- **현상**: 메시지/엑셀/일괄 발령 모두 `alert()` 폴백. 데모 quality drop
- **권고**: 메시지 → drawer 폼, 엑셀 → toast + progress, 일괄 발령 → 미니 위저드

### EM-015 [LOW] payroll 탭 명세 6개월 룩백 한계
- **surface**: detail (payroll)
- **현상**: `2026-${m === 0 ? 12 : m}` 표현으로 2025 룩백 시 month=0 1건만 12월로, m<0 표현 못함
- **권고**: `data.employeeDetail.payslips[]` 12개월 entry 신설

### EM-016 [HIGH] 탭 키보드 네비 부재
- **surface**: detail
- **현상**: 탭 7개 `<button>` 만 사용. `role="tablist"` / `aria-controls` / `aria-selected` (있음) / ←→ 화살표 키 핸들러 없음
- **위반**: a11y WCAG 2.1 keyboard navigation
- **권고**: tablist 패턴 적용 (Session 227 잔여 F14 a11y 와 합본 권장)

### EM-017 [MEDIUM] EmployeeInspector 모바일 미대응
- **surface**: list
- **현상**: 우측 슬라이드 패널 고정 폭. mobile breakpoint (`< 768px`) reflow 미검증
- **권고**: 모바일에서 full-sheet (bottom sheet) 전환 또는 drawer 패턴 통일

### EM-018 [LOW] 위저드 step indicator 점프 불가
- **surface**: new
- **현상**: `wz-step` 이 `<div>`, 완료된 step 클릭 시 해당 step 이동 없음
- **권고**: 완료된 step 만 `<button>` 으로 변환 + 점프 허용

### EM-019 [MEDIUM] 다크 모드 verification 미실시
- **surface**: detail
- **현상**: `oklch(95% 0.05 25)` 등 light-tinted 배경 다수 (받은 칭찬 ico, perf 등급 카드 등). 다크 lavender / F19 영향 확률
- **권고**: Phase 4 다크 트랙 합본 시 inventory에 포함 (F19/F24/F26 합본 plan)

### EM-020 [HIGH] URL 부재 (proto 한계 명시)
- **surface**: detail
- **현상**: proto의 `setPage("employee-detail")` + `setEmployeeCode(code)` 패턴은 URL 부재 → 새로고침 시 detail 사라짐
- **권고**: 데모 한계로 명시 (코드베이스는 /employees/[id] route 보유). proto 변경 불요

---

## §3. Cross-surface SSOT 결함

| ID | 항목 | 분기 위치 | 권고 |
|---|---|---|---|
| X1 | 상태 chip 3종 | list / detail / inspector 3곳 if-else | `<EmployeeStatusChip>` SSOT |
| X2 | 부서 라벨 | data.departments (15) / wizard step 2 (6) | data.departments 단일 SSOT |
| X3 | 직급 표기 | data.directory.rank (사원~) / wizard 약식 | rank SSOT 키 추가 |
| X4 | 연봉 밴드 표기 | wizard "L0/M1" / detail "R3 (52,000~)" | 양 체계 통일 또는 mapping 명시 |
| X5 | 평가 등급 표기 | perf 탭 카드 "E" (Excellent) / 이력 "A/B+" / praise "리더십/주도성" | 등급 체계 정리 + legend |
| X6 | 직원 이메일 fallback | detail/inspector 양쪽 `kr${code.slice(-4)}@ctr.co.kr` 중복 | utility fn 또는 data 채우기 |
| X7 | 빠른 통계 (잔여연차/OT/등급) | inspector 인라인 고정 | data.directory[i] quickStats 또는 lookup |

---

## §4. Proto vs Codebase Gap

| 항목 | proto | codebase (추정) | gap |
|---|---|---|---|
| /directory surface | ❌ 없음 | ✅ 있을 가능성 | EM-001 |
| 탭 수 | 7 | 6 (spec) | EM-002 |
| URL 라우팅 | 없음 | /employees/[id] | EM-020 (proto 한계) |
| 인적사항 키 6개 | empty fallback | API field 있을 가능성 | EM-006 |
| 위저드 완결성 | 토스트만 | API mutation | EM-010 |

---

## §5. i18n / a11y / 다크 cross-cutting

### i18n
- **한국어 literal 다수** — 탭 라벨, KV 키, 상태 chip, 위저드 step 라벨 등 전부 한국어 literal. 코드베이스 `messages/*.json` 5 locale 정렬 필요시 inventory 작성 트랙 별도

### a11y
- **EM-016**: 탭 키보드 네비 부재 (HIGH)
- **EM-018**: 위저드 step indicator 점프 (LOW)
- **추가 검토**:
  - 테이블 row click → inspector 흐름이 키보드로 가능한가? (현재 `tr` 에 `onClick` 만)
  - BulkActionBar 의 다중 선택 announce (aria-live)
  - FilterDropdown 의 `<input type="checkbox">` 라벨 association

### 다크
- **EM-019**: light-tinted oklch 배경 다수, F19/F24 lavender 연관 가능성 — Phase 4 합본 inventory 에 추가

---

## §6. 사용자 게이트 의제 (Q1-Q7)

> **정합성 검증 결과 (2026-05-21 가디언 grep 검증)**
> DRAFT 추천 **Q4 = 뒤집힘 (A+C → B)**. 다른 추천 = 유지.
> 근거: 위저드 4종(Hire/JobPosting/PerfCycle/OrgRestructure) 패턴 분석,
> KPI 패턴 사용 빈도, drawer 12종 패턴 분석.

### Q1 — /directory SSOT 결정 (EM-001)
- **A** (proto 신설): 카드 grid + 사진 큰 thumbnail, list와 다른 mental model
- **B** (코드베이스 SSOT만): /employees 가 directory 역할 흡수, 카드 grid 토글
- **C** (분리 batch): batch 05 org 와 묶어서 진행
- **추천**: B (단일 surface + 카드 grid 토글) — surface 분기 비용 최소화

### Q2 — 6탭 vs 7탭 정렬 (EM-002)
- **A** (코드베이스 follow, 6탭): perf + career 통합
- **B** (proto follow, 7탭): 코드베이스 spec 변경
- **C** (개별 결정): career 분리 유지 + 다른 4탭 통합
- **추천**: B (career 분리 = 정보 카테고리 명확, 코드베이스 spec 갱신 비용 < UX 손실)

### Q3 — list KPI strip 도입 (EM-013)
- **A** (패턴 B chips, 재직/휴직/퇴사예정/입사예정 4 chip)
- **B** (현행 유지, 부제만)
- **C** (패턴 A stat strip, 총원/신규/이직률/평균 근속)
- **추천**: A (= 패턴 B chips, 재직/휴직/퇴사예정/입사예정 4 chip — 운영 핵심 4 카운트, 디자인 일관성)

### Q4 — 위저드 완결성 (EM-010)
- **A** (localStorage persist + directory 즉시 합류)
- **B** (데모 한계 배너 명시)
- **C** (위저드 완료 후 신규 직원 detail로 자동 이동)
- **추천 (정합성 검증 후 변경)**: **B (데모 한계 배너 명시)**
  - **변경 사유**: 위저드 4종(Hire/JobPosting/PerfCycle/OrgRestructure) 모두 `toast() + onComplete()` 패턴. Hire 단독 `localStorage persist + directory 합류 + auto-navigate` 추가 시 다른 3 위저드와 **비대칭 → proto 일관성 위배**.
  - **grep 증거**:
    ```js
    HireWorker:        toast(`${f.nameKo} 신규 등록 완료`); onComplete();
    JobPosting:        toast(`${f.title} 공고 등록`); onComplete();
    PerfCycle:         toast(`${f.name} 사이클 생성`); onComplete();
    OrgRestructure:    toast("조직 개편 결재 요청 완료"); onComplete();
    ```
  - **이전 DRAFT 추천**: A + C 조합 (가장 임팩트 있는 데모 흐름) — **정합성 검증으로 폐기**

### Q5 — SSOT 통합 트랙 (EM-009, X2, X3, X4)
- **A** (data.js 보강: departments/ranks/salaryBands/onboardingTemplates/employmentTypes 5 SSOT)
- **B** (위저드 옵션 인라인 유지)
- **추천**: A (cascading change 작지 않음, 단 1회로 다수 finding 해소)

### Q6 — BulkActionBar 액션 spec (EM-014)
- 메시지 → drawer 폼 (대상 list / 제목 / 본문 / 발송)
- 엑셀 → toast + progress
- 일괄 발령 → 미니 위저드 (대상 / 발령 종류 / 적용일 / 사유)
- **추천**: drawer 폼 유지 — drawer 12종 모두 `toast()+onClose()` 패턴과 정합

### Q7 — 인스펙터 vs detail 분기 정책 (EM-007, EM-008)
- 현재: row click = inspector, 이름 클릭 = mini card hover, "전체 보기" = detail
- **A** (현행 유지, quickStats SSOT 보강)
- **B** (inspector 폐기, row click = detail 직진)
- **C** (이름 클릭 = inspector, row click = detail)
- **추천**: A (워크플로우 다양성 우위, 단 quickStats SSOT 정합 필수)

---

## §7. RECORD 후보 인벤토리

사용자 게이트 통과 후 N+ 시리즈로 promote 권고. **현재까지 F1~F26 사용, batch 03 에서 추가 미확정**. 다음 SHA 사전 reserve:

| RECORD 후보 | 묶음 finding | 우선 |
|---|---|---|
| **N+17** | EM-001 (directory SSOT) + Q1 결정 | HIGH |
| **N+18** | EM-002 (탭 수) + Q2 결정 | HIGH |
| **N+19** | EM-003 / 004 / 005 / 007 / 008 (data.js SSOT 누락 5건) | MEDIUM |
| **N+20** | EM-009 + Q5 (위저드 옵션 SSOT 통합) | MEDIUM |
| **N+21** | EM-010 + Q4 (위저드 완결성) | HIGH |
| **N+22** | EM-011 + X1 (상태 chip SSOT) | MEDIUM |
| **N+23** | EM-016 (탭 키보드 네비) + Session 227 F14 a11y 합본 | HIGH |

**Phase 4 다크 트랙 합본 후보**:
- EM-019 (oklch light-tinted 배경 다수) → F19/F24/F26 합본 plan inventory 에 추가

---

## §8. 다음 액션 (게이트 통과 후)

1. **Q1-Q7 사용자 게이트 결정 수신** (가디언 ↔ 사용자 1 round)
2. **결정안 batch 04 §7 RECORD 사양화** (각 N+ entry plan body 작성)
3. **CC handover** — phase3a-audit 워크트리에서 docs commit + RECORD batch_card §7 cross-ref
4. **PR-5B 진입 가능 시점** (PR-5A 머지 후) 에 본 카드 RECORD 일부 동반 plan 후보로 검토

---

**상태**: DRAFT (게이트 미 수신, RECORD 미 promote)
**다음 갱신**: 사용자 Q1-Q7 결정 수신 시 RECORD §7 사양 보강
