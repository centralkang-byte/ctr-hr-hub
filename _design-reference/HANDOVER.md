# CTR HR Hub — Claude Code 핸드오버 문서

> **목적**: 이 프로젝트를 Claude Code 환경에서 이어받아 작업할 때 필요한 모든 컨텍스트를 한 곳에 정리.
> **범위**: 아키텍처 · 파일 구조 · 컨벤션 · 데이터 · 최근 변경 이력 · 남은 작업 · 함정.

---

## 1. 프로젝트 개요

**CTR HR Hub** 는 Workday 스타일의 한국형 통합 인사관리 시스템 (HRIS) 고충실도 프로토타입입니다.

- **사용자 페르소나**: HR_ADMIN (`window.HR_DATA.me`, "한지영", 인사담당선임)
- **대상 회사**: CTR (글로벌 + 6개 법인 — 한국·중국·베트남·스페인·러시아·일본, 총 67명)
- **언어**: 한국어 UI · 친근 톤 (`~예요/돼요`)
- **컬러 스킴**: `data-style="workday"` (딥 네이비 액센트 + 오렌지 워크데이 시그니처)
- **사이드바**: `sidebarStyle="modern"` (60px 레일 + 220px 슬라이드 패널)

총 **30+ 페이지** · **9개 인사이트 서브 페이지** · **5개 위저드** · **6개 드로어** · **2개 통합 래퍼**.

---

## 2. 아키텍처

### 2.1 빌드 시스템 — 없음 (Babel-in-browser)

이 프로젝트는 **빌드 도구가 없습니다.** 모든 JSX 는 `@babel/standalone` 으로 브라우저에서 직접 트랜스파일됩니다.

```html
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"></script>

<!-- 데이터 -->
<script src="data.js"></script>

<!-- 모든 JSX 파일 -->
<script type="text/babel" src="ui.jsx"></script>
<script type="text/babel" src="wd-drawer.jsx"></script>
<!-- ... 30+ JSX 파일 ... -->
<script type="text/babel" src="app.jsx"></script>
```

**시사점:**
- npm/yarn/vite 등 빌드 단계 **없음** — 파일 저장 = 새로고침으로 즉시 반영
- `import` 문 사용 안 함 — 모든 컴포넌트는 `Object.assign(window, { ... })` 로 전역에 노출
- 각 JSX 파일은 `/* global ... */` 주석으로 전역 의존성을 선언
- React 훅은 각 파일에서 `const { useState: useStateXX, useContext: useCtxXX } = React;` 로 별칭 추출 (충돌 방지)

### 2.2 진입점

- **`HR Hub.html`** — 단일 진입점 HTML. `<script>` 태그 순서로 로딩 순서 보장
- **`app.jsx`** — React 루트. `<App>` 컴포넌트가 `page` state 로 라우팅
- **`window.HR_DATA`** — `data.js` 가 등록한 전역 mock 데이터 객체

### 2.3 상태 관리

- React `useState` + `useContext` 만 사용. Redux/Zustand 없음.
- `ToastContext` (`ui.jsx`) — 전역 토스트
- `__escStack` (`ui.jsx`) — 모달 ESC 우선순위 스택. `useEscClose(open, onClose)` 훅으로 사용
- Tweaks 패널 state — `useTweaks(TWEAK_DEFAULTS)` (`tweaks-panel.jsx`)

### 2.4 페이지 라우팅

`app.jsx` 의 `pages` 객체로 매핑:

```jsx
const pages = {
  dashboard: <DashboardWorkday data={data} ... />,
  "my-tasks": <MyTasksPage data={data} />,
  // ... 50+ 페이지 ID
};
```

페이지 ID 는 `PAGE_LABELS` (`shell.jsx`) 와 일치해야 함 — 토픽바 breadcrumb 가 이 맵에서 표시.

---

## 3. 파일 맵

### 3.1 코어

| 파일 | 역할 |
|---|---|
| `HR Hub.html` | 진입점 — 모든 스크립트 로드 순서 |
| `app.jsx` | App 루트 + 라우터 + Tweaks 패널 + 전역 모달 마운트 |
| `data.js` | `window.HR_DATA` 등록 — 모든 mock 데이터 |
| `styles.css` | 단일 통합 스타일시트 (~5500 줄) |

### 3.2 공용 컴포넌트

| 파일 | 노출 |
|---|---|
| `ui.jsx` | `Icons` (커스텀 SVG 약 90종), `Avatar`, `Card`, `CardHead`, `Sparkline`, `ToastHost/Context`, `EmptyState`, `useEscClose`, 포맷 헬퍼 (`fmtKDate`, `fmtWon`, `tenureFromISO` 등) |
| `wd-drawer.jsx` | `WdDrawer` 표준 슬라이드 폼 + `WdField`, `WdRow`, `WdSectionH`, `WdNote` |
| `drawers.jsx` | `OneOnOneDrawer`, `LoaRequestDrawer`, `CertRequestDrawer`, `BenefitRequestDrawer`, `NewTaskDrawer` |
| `wizards.jsx` | `WizardShell` + `HireWorkerWizard`, `JobPostingWizard`, `PerfCycleWizard`, `OrgRestructureWizard` |
| `inspector.jsx` | `EmployeeMiniCard` (hover 팝오버), `EmployeeInspector` (슬라이드 상세), `BulkActionBar` |
| `cmdk.jsx` | `CommandPalette` — ⌘K 글로벌 검색 |
| `tweaks-panel.jsx` | Tweaks 패널 인프라 (외부 starter component) |
| `shell.jsx` | `Sidebar` (Classic + Modern), `Topbar`, `PAGE_LABELS` |

### 3.3 페이지 (페이지 카테고리별 그룹화)

**대시보드**
- `page-dashboard.jsx` — Hub
- `page-dashboard-console.jsx`, `page-dashboard-reports.jsx`, `page-dashboard-workday.jsx` — 3가지 스타일

**HR 관리**
- `page-employees.jsx` — 직원 관리 (Find Workers)
- `page-employee-detail.jsx` — 직원 상세 (worker profile banner + 7탭)
- `page-org.jsx` — 조직 관리
- `page-attendance.jsx` — 근태 관리
- `page-leave.jsx` — 휴가 관리
- `page-onboarding.jsx` — 온보딩/오프보딩

**My Space (자가서비스 9개 페이지) — `page-my-space.jsx`**
- `AttendanceMyPage`, `LeaveReqPage`, `LoaReqPage`, `PayslipMyPage`, `BenefitsMyPage`, `SkillsAssessPage`, `EduMyPage`, `KudosMyPage`, `DocsMyPage`
- `page-my-profile.jsx` — 내 프로필 (직원 상세와 같은 구조, isSelf 컨텍스트)

**팀 관리 — `page-team-space.jsx` + `page-team-hub.jsx`**
- `TeamAttnPage`, `TeamGoalsPage`, `Team1on1Page`, `TeamDelegPage`, `TeamHubPage` (매니저 허브)

**채용** (`page-jobs.jsx` + `page-round1.jsx` + `page-round3.jsx`)
- `JobsPage`, `OffCyclePage`, `KanbanBoardPage`, `TalentPoolPage`, `InternalRecruitPage`, `RecruitDashPage`

**성과/보상**
- `page-perf-cycle.jsx` — 성과 사이클 (PerfCyclePage)
- `page-round1.jsx` — `CalibrationPage`
- `page-placeholder-real.jsx` — `CompMgmtPage`
- `page-round3.jsx` — `BenefitsAdminPage`, `ManualAdjustPage`

**급여**
- `page-placeholder-real.jsx` — `PayrollMgmtPage`, `ComplianceMgmtPage`
- `page-round2.jsx` — `YearEndPage`, `GlobalPayrollPage`
- `page-payroll-sim.jsx` — `PayrollSimPage`

**인사이트 (`page-insights.jsx`)** — 단일 파일에 9개 컴포넌트
- `InsightsPage` (라우터), `ExecutiveSummary`, `AttendanceAnalytics`, `TeamHealth`, `PeopleAnalytics`, `PayAnalytics`, `PerfAnalytics`, `ChurnAnalytics`, `AIReport`
- 차트 헬퍼: `LineChart`, `BarChart`, `Funnel`, `Gauge`

**기타**
- `page-mytasks.jsx` — 나의 업무 (결재 큐)
- `page-alerts.jsx` — 활동 피드
- `page-settings.jsx` — 설정 허브 (6 카테고리 49탭)
- `page-leave-modal.jsx` — 휴가 신청 모달
- `page-round4.jsx` — `MyGoalsPage`, `QuarterlyReviewPage`, `MyOnboardingPage`, `DisciplinePage`
- `page-wrappers.jsx` — `LeaveAbsenceWrapper`, `PerfGrowthWrapper` (사이드바 통합용 탭 래퍼)
- `page-placeholder.jsx` — 일반 placeholder

### 3.4 문서

| 파일 | 역할 |
|---|---|
| `DESIGN_RULES.md` | **반드시 먼저 읽기.** 디자인 시스템 컨벤션 (구조·KPI·탭·컬러·인터랙션·톤) |
| `REVIEW_REPORT.md` | 30+ 페이지 통합 리뷰 + 우선순위 분류 (P0-P4) |
| `HANDOVER.md` | 이 문서 |
| `CLAUDE.md` | Claude Code 자동 로드 운영 가이드 |

---

## 4. 핵심 컨벤션

### 4.1 페이지 골격 — `DESIGN_RULES.md` 참고

```jsx
<div className="content">
  <div className="page-h">
    <div><h1>{제목}</h1><div className="greet-sub">{부제}</div></div>
    <div className="right">{액션}</div>
  </div>
  {/* KPI 패턴 A/B/C/D/E 중 택 1 */}
  <div className="wd-tab-bar">{탭}</div>
  {/* 본문 */}
</div>
```

### 4.2 KPI 표시 패턴 (5가지)

| 패턴 | 클래스 | 사용 시점 |
|---|---|---|
| **A. 통계 스트립 (4장)** | `.wd-stat-strip` | 4지표 모두 운영 핵심 (휴가/근태/온보딩 등) |
| **B. 인라인 칩** | `.wd-status-chips` | 2-4개 단순 카운트, 탭별 보조 지표 |
| **C. 요약 문장** | `.wd-summary-lead` | 진행 상태 서술 (성과 사이클) |
| **D. Hero 카드** | 페이지별 | 1개 dominant 지표 + chips (컴플라이언스) |
| **E. 제거** | 헤더만 | KPI 가 의미 없는 페이지 |

**금지**: 4지표 카테고리가 너무 이질적, 분포(%) 4개 (→ stacked bar), 1개 dominant (→ hero) — `DESIGN_RULES.md` 의 "KPI 스트립을 쓰지 말아야 할 신호" 참고.

### 4.3 카피 톤

- **친근 톤** 통일 — `~예요/돼요`. 격식체(`~합니다/입니다/됩니다`) 금지
- 단, **사용자 입력 mock** (예: 휴가 사유) 은 격식체 허용 (현실성)
- 숫자에는 항상 단위 (`6명`, `7건`, `D-12`)
- 영문 약어 그대로 (`MBO`, `OT`, `LOA`, `eNPS`)

### 4.4 주 액션 버튼 라벨 패턴

| 패턴 | 예시 |
|---|---|
| `새 X` | `새 공고`, `새 사이클`, `새 정책`, `새 업무`, `새 위임` |
| `X 등록` | `직원 등록`, `공고 등록` |
| `X 신청` | `휴가 신청`, `휴직 신청`, `복리후생 신청` |
| `X 보내기` | `칭찬 보내기`, `자료 안내 발송` |
| `X 예약` | `1:1 예약` |

**금지**: 같은 액션에 페이지마다 다른 라벨 (`신규 직원 등록` vs `직원 등록`).

### 4.5 빈 상태 — `<EmptyState />` 사용

```jsx
<EmptyState title="결과가 없어요" />
<EmptyState icon={Icons.Heart} title="..." sub="추가 설명" />
<EmptyState size="lg" standalone title="..." />     // 카드 밖 단독
<EmptyState title="..." action={<button className="btn btn-primary">시작</button>} />
```

호환을 위해 기존 `<div className="empty">` 직접 사용도 유지. `.empty.standalone` (카드 밖 배경 부여), `.empty.lg/.sm` 변형 클래스 지원.

### 4.6 React 훅 별칭

각 JSX 파일은 자체 별칭으로 훅을 추출 — 한 파일에서 `useState` 가 다른 의미로 쓰이지 않도록:

```jsx
// page-employees.jsx
const { useState: useStateEM, useMemo: useMemoEM } = React;
```

새 페이지 추가 시 같은 패턴 따라야 함.

### 4.7 전역 노출

각 파일 끝에 `Object.assign(window, { ... })` 로 노출.

```jsx
Object.assign(window, { MyNewPage });
```

`app.jsx` 의 `/* global ... */` 주석에 추가 + `pages` 객체에 라우팅 + `PAGE_LABELS` (`shell.jsx`) 에 라벨 + 사이드바 `NAV` (`shell.jsx`) 에 메뉴.

### 4.8 styles.css — 단일 파일

모든 스타일은 `styles.css` 하나. 약 5500줄. 섹션 주석 (`/* ─── ... ─── */`) 으로 구분. 새 컴포넌트는 자체 섹션 추가.

---

## 5. 시그니처 컴포넌트

| 컴포넌트 | 용도 |
|---|---|
| `wd-worker-banner` | 직원 상세·내 프로필 페이지 헤더 |
| `wd-stat-strip` (`.ss-card`) | 4지표 KPI 스트립 |
| `wd-status-chips` (`.sc`) | 인라인 메타 칩 |
| `wd-tab-bar` | 페이지 탭 (`.count` 배지 포함) |
| `wd-stepper` | 사이클·다단계 프로세스 |
| `wd-action-card` | 처리 대기 큐 |
| `wd-bell-popover` | 탑바 알림 인박스 미리보기 |
| `wd-bulk-bar` | 다중 선택 sticky 하단 액션 바 |
| `wd-worklets` (`.wd-tile.t1~t8`) | 대시보드 앱 런처 |
| `wd-time-grid` | 근태 주간 그리드 |
| `wd-calendar` | 휴가 캘린더 |
| `WdDrawer` | 우측 슬라이드 입력 폼 |
| `WizardShell` | 풀-페이지 다단계 위저드 (토픽바 자동 숨김 — `:has()` CSS) |
| `EmployeeInspector` | 우측 슬라이드 직원 빠른 미리보기 |
| `EmployeeMiniCard` | 이름 hover 시 작은 팝오버 |
| `CommandPalette` | ⌘K 글로벌 검색 |

---

## 6. 데이터 구조 (`window.HR_DATA`)

```
HR_DATA
├── me                — 현재 로그인 사용자 (한지영)
├── company           — 회사 정보 (CTR · 67명)
├── alerts            — 상단 알림 카운트
├── kpis              — 대시보드 KPI (headcount, pendingApprovals 등)
├── approvalQueue     — 결재 대기 (15+ 항목)
├── notifications     — 활동 피드 알림 (46건)
├── directory         — 전체 직원 명부 (67명)
├── departments       — 부서 리스트
├── employmentTypes   — 고용형태 리스트
├── statuses          — 재직상태 리스트
├── employeeDetail    — 직원 상세 mock (1명)
├── attendanceToday   — 오늘 출근 현황
├── leaveSummary      — 휴가 요약
├── perfCycle         — 성과 사이클 진행
├── managerHub        — 매니저 허브 데이터 (헬스 점수·1:1)
├── teamAttn          — 팀 근태
├── oneOnOne          — 1:1 미팅
├── onboarding/offboarding — 진행 케이스
├── kudos             — 칭찬 피드
├── myCerts           — 내 증명서 발급 이력
├── payslips          — 내 급여명세
├── skillsAssess      — 역량 자기평가
├── education         — 내 교육
├── insights          — 인사이트 페이지별 데이터
└── ...
```

**규칙**: 모든 mock 은 `data.js` 에 집중. 페이지 내 하드코딩 금지 (인사이트 페이지 일부 예외 — 향후 이전 필요, P4).

---

## 7. 진행 완료 작업 (이번 라운드)

`REVIEW_REPORT.md` 의 P0–P4 우선순위에 따라 진행됨:

### P0 — 즉시 수정 (3건 ✅)
1. **통합 페이지 자식 헤더 중복** — `InlineNoPageH` 가 자식의 `.page-h` + 첫 `.wd-stat-strip` 흡수. wrapper 에 통합 status-chips 추가
2. **내 프로필 ↔ 직원 상세 라벨 통일** — 배너 주 액션 평행 구조 (`정보 편집` / `정보 수정 요청`), card-head `편집` 버튼 추가
3. **위저드 헤더 충돌** — `.main:has(.wd-wizard) > .tb { display: none; }` CSS 로 토픽바 자동 숨김

### P1 — 일관성 (4건 ✅)
4. **KPI 일관성** — 팀허브 activity·성과 goals·results·컴플라이언스 overview 의 strip 정리. `DESIGN_RULES.md` 에 5가지 패턴 명문화
5. **카피 톤 통일** — 27개 파일 + data.js 일괄 친근 톤 변환 (30+ 패턴)
6. **빈 상태 통일** — `<EmptyState />` 공용 컴포넌트 + `.empty.standalone` 변형, 4건 인라인 border 통일
7. **버튼 라벨 통일** — 7개 라벨 통일, 5가지 패턴 컨벤션 명문화

### P2 — 콘텐츠 (2건 ✅)
8. **인사이트 차트 보강** — 근태 분석에 부서별 연차 사용률 + 휴가 유형별 stacked bar / 팀 헬스에 12개월 추이 + eNPS + 1:1 vs 이직 위험 산점도
10. **나의 공간 콘텐츠** — 칭찬 보낸/받은 풀 피드, 증명서 발급 이력 테이블 (6건), 보관 문서 8건

### P3 — 인터랙션 (5건 ✅)
11. **⌘K 글로벌 검색** — `CommandPalette` (직원/페이지/액션 3카테고리 fuzzy)
12. **인스펙터 슬라이드** — `EmployeeInspector` 우측 480px 패널 (직원 행 클릭)
13. **모바일 카드 reflow** — `.tbl-as-cards` 클래스 (직원 테이블에 적용)
14. **호버 미니카드** — `EmployeeMiniCard` (이름에 mouseenter)
15. **벌크 액션 바** — `BulkActionBar` + 체크박스 컬럼 (직원 테이블)

### P4 — 폴리시 (3건 ✅, 1건 스킵)
- **활동 피드 처리 이력** — 더미 → ID·카테고리·채널 기반 동적 timeline
- **드로어 ESC 우선순위** — `useEscClose` 모달 스택 훅, wd-drawer/cmdk/inspector 마이그레이션
- **Modern 사이드바 모바일** — 레일(60px) + 패널(220px) 동시 표시 CSS
- ~~인사이트 데이터 page → data.js 이전~~ — refactor-only, 스킵

### 회귀 수정
- 휴가/휴직 wrapper 에서 자식 page-h 가 숨겨지면서 신청 버튼이 사라지는 회귀 수정 — wrapper-level 탭 인지 액션 버튼 추가 + wrapper-level `LoaRequestDrawer` 인스턴스

---

## 8. 남은 작업 (P2 #9 만)

**설정 페이지 placeholder 잔존 — 44탭**:
- 시스템 (3): 알림 규칙, 언어/타임존, 데이터 보존 — *REVIEW_REPORT.md 가 명시*
- 조직 (10), 근태/휴가 (10), 급여/보상 (8), 성과/평가 (7), 채용/온보딩 (6)

이미 구현된 시스템 탭: 알림 채널, 역할/권한, 결재 플로우, 연동, 감사 로그 (5)

**진행 전략**:
- **Option A** — 시스템 3탭 + 카테고리당 대표 1탭 = 8탭 우선
- **Option B** — 전체 44탭 풀 구현

각 탭은 `page-settings.jsx` 의 `SettingPlaceholder` 컴포넌트로 폴백 중. 새 컴포넌트는 같은 파일 내 함수로 추가하고 `SettingsCategory` 의 라우팅 분기에 추가하면 됨.

---

## 9. 함정 / 주의사항

### 9.1 Babel-in-browser 제약

- **`import` 사용 금지** — 모든 의존성은 전역으로
- **다중 파일 간 변수 공유** — `Object.assign(window, ...)` 가 유일한 방법
- **`const styles = {}` 같은 흔한 이름의 전역 객체 금지** — 다른 파일과 충돌 가능

### 9.2 React 훅 충돌

`const { useState } = React;` 를 여러 파일에서 같은 이름으로 선언하면 마지막 declaration 이 win 함. 각 파일은 **고유 별칭** 사용 필수:
- `useStateEM` (employees), `useStateOB` (onboarding), `useCtxPC` (perfCycle) 등

### 9.3 페이지 추가 체크리스트

새 페이지를 추가할 때:
1. JSX 파일 생성 (또는 기존에 추가)
2. `Object.assign(window, { MyPage })` 끝에 추가
3. `HR Hub.html` 의 `<script>` 태그에 등록 (순서 주의 — UI 헬퍼 뒤, app.jsx 앞)
4. `app.jsx` 의 `/* global ... */` 에 컴포넌트명 추가
5. `app.jsx` 의 `pages` 객체에 라우팅 추가
6. `shell.jsx` 의 `PAGE_LABELS` 에 breadcrumb 추가
7. `shell.jsx` 의 `NAV` 에 사이드바 아이템 추가 (필요 시)

### 9.4 ESC 처리

새 모달/드로어는 반드시 `useEscClose(open, onClose)` 사용. 직접 `document.addEventListener("keydown", ...)` 금지 — 모달 스택 위계가 깨짐.

### 9.5 위저드와 토픽바

`.wd-wizard` 가 main 안에 렌더되면 토픽바 (`.tb`) 가 `:has()` CSS 로 자동 숨김. 위저드를 풀스크린으로 렌더하지 마세요 — `<div className="main"><WizardShell>...</WizardShell></div>` 패턴이 정확.

### 9.6 InlineNoPageH

`LeaveAbsenceWrapper`, `PerfGrowthWrapper` 가 자식의 page-h + 첫 wd-stat-strip 을 숨김. 자식 페이지의 액션 버튼이 사라지면 **wrapper 의 page-h `.right` 에 탭별로 다시 추가** 해야 함.

### 9.7 `wd-emp-table` 셀의 data-label

모바일 카드 reflow (`.tbl-as-cards`) 가 작동하려면 각 `<td>` 에 `data-label="..."` 필요. 새 직원-스타일 테이블 추가 시 동일 패턴.

### 9.8 EmptyState 와 기존 .empty

새 코드는 `<EmptyState />` 우선. 기존 `<div className="empty">` 30+ 인스턴스는 호환을 위해 유지. 일괄 마이그레이션 시 sub 텍스트 처리 주의 (별도 `<div>` → `<EmptyState sub="..." />`).

### 9.9 ⌘K 검색 인덱스

`cmdk.jsx` 의 `PAGES_INDEX` 와 `ACTIONS_INDEX` 가 검색 대상. 새 페이지/액션 추가 시 인덱스도 업데이트.

---

## 10. Tweaks (디자인 토글)

`app.jsx` 의 `TWEAK_DEFAULTS` :

```js
{
  theme: "light",          // 다크모드 미구현
  tone: "friendly",        // friendly | pro
  style: "workday",        // default | console | reports | workday
  sidebarStyle: "modern",  // classic | modern
  density: "normal",       // compact | normal | spacious
  rowDensity: "normal",    // compact | normal
  sidebar: "expanded",     // expanded | collapsed
}
```

Tweaks 토글은 우상단 토픽바의 **Tweaks** 버튼으로 열림. 변경 시 `document.documentElement` 의 `data-*` 속성에 반영 → CSS 가 자동 적용.

---

## 11. 디자인 시스템 컬러 토큰

`styles.css` 상단의 `:root` 변수:

- `--accent`: 딥 네이비 `oklch(38% 0.08 230)`
- `--wd-orange`: 오렌지 `oklch(68% 0.16 50)` (배지·태그)
- `--success/warning/danger/info` — 표준 상태
- `--wt-1 ~ --wt-8` — 워클릿 8색 팔레트
- `--accent-soft`, `--bg-elev`, `--bg-sunk`, `--fg`, `--fg-muted`, `--fg-faint`, `--border` 등

**컬러는 변수 사용 우선.** 직접 `#hex` 또는 `oklch(...)` 인라인 사용은 차트·시각화에 한정.

---

## 12. 시작 체크리스트 (Claude Code 첫 진입)

1. ✅ `HR Hub.html` 을 브라우저에서 열어 동작 확인
2. ✅ `DESIGN_RULES.md` 통독
3. ✅ `REVIEW_REPORT.md` 통독 (P0-P4 컨텍스트)
4. ✅ 이 `HANDOVER.md` 통독
5. ✅ `CLAUDE.md` 자동 적용 (Claude Code 가 읽음)
6. ✅ `data.js` 의 `window.HR_DATA` 스키마 훑어보기
7. ✅ `app.jsx` 의 라우팅 + `shell.jsx` 의 NAV 구조 파악
8. ✅ `ui.jsx` 의 공용 컴포넌트 (특히 `Icons`, `EmptyState`, `useEscClose`) 파악

---

## 13. 권장 다음 작업 (사용자 결정 필요)

1. **P2 #9 설정 placeholder 채우기** (Option A: 8탭 / Option B: 44탭 전체)
2. **인사이트 데이터 → data.js 이전** (refactor)
3. **추가 페이지** — 가족수당 관리, 4대보험 관리 등 (현재 미구현)
4. **다크모드** — `theme: "dark"` 변형 (CSS 변수는 이미 분리됨)
5. **i18n** — 한국어 외 언어 (현재 KO 하드코딩)
6. **API 연동** — 현재 mock → 실제 백엔드 호출 (`window.HR_DATA` 를 fetch 결과로 교체)

---

마지막 업데이트: 2026-05-18.
