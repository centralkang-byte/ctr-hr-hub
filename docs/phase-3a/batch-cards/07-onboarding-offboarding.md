# Phase 3a · Batch 07 — 온보딩/오프보딩 (Onboarding / Offboarding)

> **범위**: 온보딩·오프보딩 영역 8 surface (codebase) ↔ proto 1 통합 page
> **작성일**: 2026-05-21 KST
> **작성자**: 가디언 (proto 디자인 SSOT 트랙)
> **base proto SHA**: `HR Hub.html` 동결본
> **base codebase SHA**: `1260a95f` (main 동결)
> **batch ID 컨벤션**: `ON-001` ~ `ON-016`

---

## §0. 1분 요약

- **8 surface (codebase) vs 1 page (proto), 16 findings** (HIGH 3 / MEDIUM 9 / LOW 4)
- **Paradigm**: ⭐ **codebase leader** (batch 05 와 같은 패턴)
  - proto = 통합 1 page (469 lines), 온보딩+오프보딩 + 4 view mode (grid/table/journey/analytics)
  - codebase = 분리 8 surface + 감정 펄스 + 체크인 시스템 + exit interview 통계 + crossboarding (모두 production 운명 유지)
- **핵심 SSOT 적용**: PageHeader 이미 codebase 적용 ✅, wd-stat-strip 4 chips 신규 도입, Hire Card grid + journey view 도입
- **RECORD 후보 N+31~N+36** reserve

---

## §1. Surface 인벤토리

### Codebase 8 surface

| # | Surface | Route | 클라이언트 | 비고 |
|---|---|---|---|---|
| 1 | 온보딩 대시보드 | `/onboarding` | `OnboardingDashboardClient.tsx` | B5 강화 — 법인 필터 + planType 탭 + 감정 펄스 + 지연 하이라이트 |
| 2 | 내 온보딩 | `/onboarding/me` | `OnboardingMeClient.tsx` | 직원 본인 view |
| 3 | 체크인 폼 | `/onboarding/checkin` | `CheckinFormClient.tsx` | 30일/60일/90일 체크인 입력 |
| 4 | 체크인 admin | `/onboarding/checkins` | `CheckinsAdminClient.tsx` | HR 통계 + 회신 검토 |
| 5 | 온보딩 detail | `/onboarding/[id]` | `OnboardingDetailClient.tsx` | 개별 직원 instance |
| 6 | 오프보딩 대시보드 | `/offboarding` | `OffboardingDashboardClient.tsx` | PageHeader 적용 |
| 7 | 오프보딩 detail | `/offboarding/[id]` | `OffboardingDetailClient.tsx` | 개별 직원 instance |
| 8 | Exit Interview 통계 | `/offboarding/exit-interviews` | `ExitInterviewStatsClient.tsx` | 퇴사자 인터뷰 통계 |

### Proto 1 통합 page

`_design-reference/page-onboarding.jsx` (469 lines):
- 단일 `OnboardingPage` — 온보딩 + 오프보딩 통합
- `ONBOARD_STEPS` 6단계 SSOT: DOCUMENT / TRAINING (OJT) / TRAINING (Security) / MEETING (Buddy) / ACCESS (System) / MEETING (Intro)
- 4 view modes: **grid (Hire Cards) / table / journey / analytics**
- KPI 4 chips (wd-stat-strip): 진행 중 / 지연 / 완료 / 이번 주 입사
- pill-tabs 상태 필터: all / progress / done / delay
- 상단 actions: 템플릿 / 버디 일괄 매칭 / 새 프로세스 (btn-primary)
- Hire Card: 배너 status pill + avatar + name + role + meta(joinDate/D-day/buddy) + progress bar + actions(여정 보기 / 강제 완료 or 리마인드)

### API endpoints (codebase, 17개)

```
Onboarding (9 endpoints):
  GET  /api/v1/onboarding/plans
  GET  /api/v1/onboarding/dashboard
  GET  /api/v1/onboarding/crossboarding         (codebase only)
  GET  /api/v1/onboarding/me
  GET/POST  /api/v1/onboarding/templates
  GET  /api/v1/onboarding/templates/[id]
  GET/POST  /api/v1/onboarding/instances
  GET  /api/v1/onboarding/instances/[id]
  POST /api/v1/onboarding/[id]/force-complete
  GET/POST  /api/v1/onboarding/checkin
  GET  /api/v1/onboarding/checkins
  GET  /api/v1/onboarding/checkins/[employeeId]

Offboarding (6 endpoints):
  GET  /api/v1/offboarding/dashboard
  GET  /api/v1/offboarding/me
  GET/POST  /api/v1/offboarding/checklists
  GET  /api/v1/offboarding/checklists/[id]
  GET/POST  /api/v1/offboarding/instances
  GET  /api/v1/offboarding/exit-interviews/statistics
```

### Prisma 모델 (10개)

```
Onboarding:
  OnboardingTemplate              — 템플릿 정의 (회사별)
  OnboardingTask                  — 단계 정의
  EmployeeOnboarding              — 직원 instance
  EmployeeOnboardingTask          — 직원별 task progress

Offboarding:
  OffboardingChecklist            — 체크리스트 정의
  OffboardingTask                 — 단계 정의
  EmployeeOffboarding             — 직원 instance
  OffboardingDocument             — 퇴사 문서
  EmployeeOffboardingTask         — 직원별 task progress
  ExitInterview                   — 퇴사 인터뷰
```

i18n: 75 keys (`onboarding.*` + `offboarding.*` namespace 정합)

---

## §2. Findings (ON-001 ~ ON-016)

### ON-001 [HIGH] 4 view modes (grid/table/journey/analytics) 도입
- **surface**: /onboarding (dashboard)
- **현상**: proto = 4 view mode 토글 (grid Hire Cards / table / journey 여정 / analytics 분석). codebase = list/table 위주, view mode 토글 부재
- **권고**: proto 4 view mode SSOT 도입. batch 05 OrgClient 4 view mode 패턴 (tree/dir/list/grid) 정합

### ON-002 [HIGH] wd-stat-strip 4 chips 도입 (page-h 확장)
- **surface**: /onboarding (header)
- **현상**: proto = page-h + wd-stat-strip 4 chips (진행 중 / 지연 / 완료 / 이번 주 입사). codebase = PageHeader SSOT 이미 적용 (✅) — stat strip 부재
- **위반**: batch 05 N+24 patten 정합 (batch 03/04/05 cross-batch SSOT 공통화 권고)
- **권고**: PageHeader 유지 + StatusChips 또는 신규 wd-stat-strip SSOT 도입 (N+24 SSOT 재사용)

### ON-003 [HIGH] Hire Card grid + journey view 도입
- **surface**: /onboarding (dashboard)
- **현상**: proto Hire Card = 배너 status pill + avatar + name + role + 3-meta(joinDate/D-day/buddy) + progress bar + 2 액션 (여정 보기 + 강제 완료/리마인드). codebase = list/table 위주 (Hire Card grid 부재)
- **권고**: Hire Card grid 컴포넌트 신규 신설 + journey view (직원 단계별 timeline) 도입

### ON-004 [MEDIUM] ONBOARD_STEPS 6단계 SSOT cross-match
- **surface**: 데이터 모델
- **현상**: proto `ONBOARD_STEPS` = 6단계 hardcoded (DOCUMENT/TRAINING/MEETING/ACCESS). codebase `OnboardingTemplate` = 자유 정의 (회사별 변동)
- **권고**: proto 6단계 → default `OnboardingTemplate` seed 적용 + 카테고리 enum (DOCUMENT/TRAINING/MEETING/ACCESS) 정합

### ON-005 [MEDIUM] IA 통합 (proto) vs 분리 (codebase) — Paradigm 결정
- **surface**: /onboarding (메인)
- **현상**: proto = 1 page (온보딩 + 오프보딩 + 4 view mode + 통합 KPI). codebase = 8 surface 분리 (dashboard/me/checkin/checkins/[id] × 2 도메인)
- **권고**: codebase 8 surface SSOT 유지 (production), proto 1 page visual 패턴은 대시보드(`/onboarding`)에만 적용

### ON-006 [MEDIUM] 강제 완료 액션
- **surface**: Hire Card actions
- **현상**: proto = `toast(`${p.name} 강제 완료`)` 단순. codebase = `POST /api/v1/onboarding/[id]/force-complete` 실 API + ApprovalFlow 가능
- **권고**: codebase force-complete API 유지, proto는 visual reference (액션 button 위치/스타일만)

### ON-007 [MEDIUM] 감정 펄스 (Sentiment Pulse) — codebase only, 운명 유지
- **surface**: /onboarding dashboard
- **현상**: codebase = `Smile/Meh/Frown` icons + B5 강화 sentiment 시각화. proto = 부재
- **권고**: codebase production feature **유지** (batch 05 Q6 패턴 정합)

### ON-008 [MEDIUM] 체크인 시스템 (30/60/90일) — codebase only, 운명 유지
- **surface**: /onboarding/checkin + /onboarding/checkins
- **현상**: codebase = full 체크인 폼 + admin 통계 + 회신 검토. proto = 부재
- **권고**: codebase production feature **유지**

### ON-009 [MEDIUM] 버디 일괄 매칭 button (proto)
- **surface**: /onboarding 상단 actions
- **현상**: proto = "버디 일괄 매칭" 사이드 button. codebase = (검증 필요 — buddy 모델 + 매칭 API 부재 가능성)
- **권고**: codebase Buddy 모델/API 존재 여부 확인 → 부재 시 별도 트랙 격상 또는 proto only

### ON-010 [MEDIUM] 알림/리마인드 액션
- **surface**: Hire Card actions
- **현상**: proto = `toast(`${p.name} 알림 발송`)` 단순. codebase = (실 notification API 추정)
- **권고**: codebase 실 notification API 유지 (production)

### ON-011 [MEDIUM] ExitInterview 통계 — codebase only, 운명 유지
- **surface**: /offboarding/exit-interviews
- **현상**: codebase = ExitInterview 모델 + statistics API + UI. proto = 부재
- **권고**: codebase production feature **유지**

### ON-012 [MEDIUM] pill-tabs 상태 필터 (all/progress/done/delay)
- **surface**: /onboarding dashboard 필터
- **현상**: proto = pill-tabs 4 상태. codebase = (StatusBadge 적용 추정)
- **권고**: 정합 보강 (proto 패턴 + count display)

### ON-013 [LOW] 6단계 카테고리 색상 (4 enum)
- **surface**: 시각화
- **현상**: proto = DOCUMENT / TRAINING / MEETING / ACCESS 4 enum (visual category color 추정). codebase = (확인 필요)
- **권고**: Workday wt 토큰 + status SSOT 정합 (N+22 batch 04 cross-ref)

### ON-014 [LOW] crossboarding endpoint — codebase only
- **surface**: /api/v1/onboarding/crossboarding
- **현상**: codebase = crossboarding API. proto = 부재
- **권고**: codebase production feature **유지**, UI 노출 여부 별도 검증

### ON-015 [LOW] 모바일 reflow
- **surface**: 모든 surface
- **현상**: Hire Card grid 모바일 1 col + view mode 토글 가로 overflow 미검증
- **권고**: gstack 모바일 시각 검증 (375px breakpoint)

### ON-016 [LOW] 다크 모드
- **surface**: 모든 surface
- **현상**: proto 인라인 oklch 색상 (`av-hue` CSS 변수, status pill 색상). 다크 변형 미정의
- **권고**: Phase 4 다크 트랙 합본 (F19/F24/F26 + EM-019 + OG-018 + ON-016)

---

## §3. Cross-surface SSOT 결함

| ID | 항목 | 분기 위치 | 권고 |
|---|---|---|---|
| X1 | view mode 명명 | proto grid/table/journey/analytics | codebase에 동일 4 mode 도입 SSOT |
| X2 | 통합 vs 분리 IA | proto 1 page / codebase 8 surface | codebase 분리 유지 (Q1) |
| X3 | OnboardingTemplate 6단계 | proto hardcoded / codebase 자유 | proto 6단계 → default seed |
| X4 | StatusChips SSOT | batch 05 N+24 신설 후보 | cross-batch 공통화 정합 |
| X5 | Hire Card 패턴 | proto only | 신규 컴포넌트 (`OnboardingHireCard`) |
| X6 | Buddy 모델 | proto field, codebase 검증 필요 | 별도 트랙 가능성 |
| X7 | journey view (단계 timeline) | proto only | 신규 컴포넌트 (`OnboardingJourneyView`) |

---

## §4. Proto vs Codebase Gap (batch 05 paradigm 정합)

**codebase에 있고 proto에 없는 항목 = 모두 운명 유지** (production feature):

| 항목 | proto | codebase | 운명 |
|---|---|---|---|
| 감정 펄스 (Sentiment Pulse) | ❌ | ✅ B5 강화 | **유지** |
| 체크인 시스템 (30/60/90일) | ❌ | ✅ 폼 + admin | **유지** |
| ExitInterview 통계 | ❌ | ✅ statistics API | **유지** |
| crossboarding | ❌ | ✅ API | **유지** |
| force-complete API | toast만 | ✅ 실 API | **유지** |
| planType 탭 (B5 강화) | ❌ | ✅ | **유지** |
| 법인 필터 | ❌ (1 법인) | ✅ multi-company | **유지** |
| 지연 하이라이트 (B5 강화) | 단순 status | ✅ 강화 | **유지** |
| 개별 instance detail page | ❌ | ✅ /onboarding/[id] | **유지** |

**proto에 있고 codebase 적용 권고 항목**:

| 항목 | proto | codebase | 적용 권고 |
|---|---|---|---|
| 4 view mode (grid/table/journey/analytics) | ✅ | ❌ | **ON-001 도입** |
| Hire Card grid (배너 + meta + progress + actions) | ✅ | ❌ | **ON-003 신규 컴포넌트** |
| journey view (단계별 timeline) | ✅ | ❌ | **ON-003 신규 컴포넌트** |
| wd-stat-strip 4 chips | ✅ | ❌ (PageHeader만) | **ON-002 도입** |
| ONBOARD_STEPS 6단계 SSOT | ✅ | ❌ (자유 template) | **ON-004 default seed** |
| pill-tabs 상태 필터 4종 | ✅ | 부분 | **ON-012 정합** |
| 버디 일괄 매칭 button | ✅ | 검증 필요 | **ON-009 별도 트랙 검토** |

---

## §5. i18n / a11y / 다크 cross-cutting

### i18n
- `onboarding.*` + `offboarding.*` namespace 정합 (ko.json: 75 keys 확인됨)
- 신규 키 예상 (4 view mode + Hire Card 라벨 + journey + analytics): ~30 entries × 5 locale = **150 entries**

### a11y
- proto `wd-tab-bar` (process tabs) + `pill-tabs` (status filter) + `seg` (view mode) = 수동 tablist 3 surface
- **F14 임계 카운트 변동**: 현재 누적 2 (LeaveClient + MyTasksClient). proto 적용 시 codebase 측에 추가 surface 발생 가능성 — 신중 검증
- ReactFlow/Radix 라이브러리 사용 여부 미적용 영역 → 수동 keyboard 핸들러 필요시 별도 트랙

### 다크
- proto 인라인 `av-hue` CSS 변수 + status pill 색상 → 토큰화 필요
- Phase 4 다크 트랙 합본 entry 추가 (F19/F24/F26/EM-019/OG-018/**ON-016**)

---

## §6. 사용자 게이트 의제 (Q1-Q7)

> **정합성 검증 결과 (2026-05-21 가디언 grep 검증)**
> Codebase 8 surface 분리 패턴 = production B5 강화 결과물 (감정 펄스/체크인/ExitInterview). proto 통합 1 page = mock 한계.
> Paradigm 확정 = **codebase leader** (batch 05 정합).
> 정합성 우선 결정: codebase production feature 전수 유지 + proto visual SSOT 만 적용.

### Q1 — IA 통합 vs 분리 결정 (ON-005 + X2)
- **A** (codebase 8 surface 분리 유지, production feature 보존)
- **B** (proto 1 page 통합 채택, codebase 재작업)
- **C** (hybrid — /onboarding 메인은 통합 dashboard + 나머지 7 surface 유지)
- **추천**: A (production B5 강화 보존, batch 05 Q6 패턴 정합)

### Q2 — 4 view mode 도입 (ON-001 + X1)
- **A** (codebase /onboarding 대시보드에 4 view mode 도입: grid/table/journey/analytics)
- **B** (현행 list/table만 유지)
- **추천**: A (proto SSOT 정합, Hire Card 디자인의 핵심)

### Q3 — Hire Card + journey view 신규 컴포넌트 (ON-003 + X5 + X7)
- **A** (신규 `OnboardingHireCard` + `OnboardingJourneyView` 컴포넌트 신설, proto 정합)
- **B** (현행 list view 유지)
- **추천**: A (proto visual SSOT 핵심 요소)

### Q4 — wd-stat-strip 4 chips 도입 (ON-002 + X4)
- **A** (PageHeader 유지 + StatusChips 신규 SSOT 4 chips: 진행중/지연/완료/이번주입사). **batch 05 N+24 SSOT cross-batch 공통화 활용**
- **B** (현행 PageHeader만 유지)
- **추천**: A (batch 03/04/05 패턴 정합)

### Q5 — codebase only 기능 운명 (ON-007/008/011/014 + §4 전체)
- 모든 codebase only 기능 (감정 펄스 / 체크인 시스템 / ExitInterview 통계 / crossboarding / planType 탭 / 법인 필터 / 지연 하이라이트) **유지** 권고
- proto에 없음 = mock 한계, production은 모두 B5 강화 결과물
- **추천**: 전수 유지 (batch 05 Q6 패턴)

### Q6 — ONBOARD_STEPS 6단계 cross-match (ON-004 + X3)
- **A** (proto 6단계 → default `OnboardingTemplate` seed + 카테고리 enum 4종)
- **B** (codebase 자유 template 유지, proto SSOT 무시)
- **추천**: A (proto SSOT default 활용 + 회사별 customization 여지 보존)

### Q7 — 다크 토큰화 트랙 (ON-016)
- **A** (Phase 4 다크 트랙 합본 inventory에 ON-016 entry 추가, 본 batch 진입 0)
- **B** (본 batch에서 다크 토큰화 동반 진입)
- **추천**: A (Phase 4 다크 트랙은 F19/F24/F26 + EM-019 + OG-018 + ON-016 합본)

---

## §7. RECORD 후보 인벤토리

사용자 게이트 통과 후 N+ 시리즈 promote 권고. **batch 05 사양화 N+24~N+30 사용 후 다음 SHA**:

| RECORD 후보 | 묶음 finding | 우선 |
|---|---|---|
| **N+31** | ON-002 + X4 (wd-stat-strip 4 chips 도입) + Q4 — batch 05 N+24 SSOT cross-batch 활용 | HIGH |
| **N+32** | ON-001 + ON-003 + X1 + X5 + X7 (4 view mode + Hire Card + journey view) + Q2 + Q3 | HIGH |
| **N+33** | ON-004 + X3 (ONBOARD_STEPS 6단계 cross-match default seed) + Q6 | MEDIUM |
| **N+34** | ON-012 (pill-tabs 상태 필터 정합) | MEDIUM |
| **N+35** | ON-006 + ON-010 (강제완료/리마인드 액션 정합 — 실 API + visual reference) | LOW |
| **N+36** | ON-013 (6단계 카테고리 색상 wt 토큰) | LOW |

**Phase 4 다크 트랙 합본 후보**:
- **ON-016** (proto 인라인 `av-hue` + status pill oklch + 다크 변형 부재) → F19/F24/F26 + EM-019 + OG-018 합본 plan inventory entry 1건 추가

**별도 트랙 후보 (신규)**:
- **ON-009 버디 일괄 매칭**: codebase Buddy 모델/API 존재 여부 확인 후 분기 — 부재 시 batch 08+ 격상 후보, 존재 시 N+35에 합본
- **ON-015 모바일 reflow**: Phase 4 모바일 polish 트랙 합본

---

## §8. 다음 액션 (게이트 통과 후)

1. **Q1-Q7 사용자 게이트 결정 수신** (가디언 ↔ 사용자 1 round)
2. **결정안 batch 07 §7 RECORD 사양화** (N+31~N+36 plan body 작성)
3. **Stage 4 pre-flight** — N+31/N+32/N+33/N+35 코드베이스 트랙 사전 audit (batch 04/05 패턴 정합)
4. **PR-5A 머지 후 진입** — N+31 (StatusChips SSOT cross-batch 공통화 후) → N+32 (Hire Card + journey) → N+33 (template seed) → N+34/N+35/N+36 순

---

**상태**: DRAFT (게이트 미 수신, RECORD 미 promote)
**다음 갱신**: 사용자 Q1-Q7 결정 수신 시 RECORD §7 사양 보강
