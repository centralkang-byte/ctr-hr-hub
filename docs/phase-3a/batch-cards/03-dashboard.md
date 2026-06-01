# Batch 카드 #03 — 대시보드 (`/home`) — 추정 우선순위 **P0**

> Phase 3a Stage 2. 양식 = `01-myspace-leave.md` 6섹션 + §7 검증 패턴 재사용.
> 선행 결정 SSOT: `01-myspace-leave.md §7` + PR-5A `#63` (`742dab35`,
> #63 OPEN, 머지 게이트 2026-05-24 02:43+ KST).
> 1st principle = 프로토타입 디자인 충실 반영(위반=교정, 결함=정정 not 복제).
> 스크린샷: `docs/phase-3a/screenshots/dashboard/` (TBD, 사용자 보강 자료
> 인용 — Workday warm orange 변형 그라데이션 + 추가 섹션 3건 발견).
> 코드 근거 = `feat/hr-admin-dashboard-workday` (`742dab35`, 9 commits)
> + `claude/phase3a-audit` (`3c6df292`, F24/F25/F26 RECORD 반영).

---

## 1. 페이지 매핑

| 레퍼런스 (`_design-reference/`) | 현 코드베이스 (`src/`) | 라우트 | 관계 |
|---|---|---|---|
| `page-dashboard-workday.jsx:DashboardWorkday` (L105–455) | `components/home/HrAdminHomeV2.tsx` (486 lines, PR-5A 적용) | `/home` (HR_ADMIN/SUPER_ADMIN) | **1:1 부분 정본** — PR-5A 카나리 3 섹션 적용. 누락 4 섹션 (공지/권장/활동피드/Quick Actions row) = 후속 PR 후보 |
| `page-dashboard.jsx` (3 변형: console/reports/workday) | `components/home/{Employee,Manager,Executive}HomeV2.tsx` | `/home` (각 역할) | **N:N 분기** — V2 = role-gated. ManagerHomeV2/ExecutiveHomeV2/EmployeeHomeV2 각자 HeroCard 사용 |
| (없음) | `components/home/HrAdminHome.tsx` (V1, 별도 파일) | `/home-preview/hr-admin` (env-gated) | **V1 잔존** — PR-5A V2와 공존, env + role gate. 운명 카드 후보 |

> 🚩 **핵심 IA 특이사항**: PR-5A는 V2 layout만 재구성. V1(`HrAdminHome.tsx`)은
> 별도 라우트(`/home-preview/hr-admin`) 잔존. V2 production 안정화 후 V1 폐기
> 필요 — 게이트 **Q1** 후속.

## 2. 기능 inventory

| ID | 기능 | 분류 | 등급 | 의존 SSOT / 비고 |
|---|---|---|---|---|
| DH-001 | WorkdayHero — navy 그라데이션 + greeting + sub copy + CTA 2 + 우측 3-KPI + HeroScene SVG | 가 | 고 | **PR-5A `742dab35` 적용 완료**. Hero gradient = proto `oklch(38% 0.08 230)` navy ↔ 사용자 보강 디자인 = warm orange (불일치, Q2) |
| DH-002 | WorkletGrid 8 distinct color 타일 (직원/채용/근태/휴가/성과/급여/조직/분석) | 가 | 고 | **PR-5A 적용 완료**. info 신규 토큰 도입 (`#0ea5e9`, ID 8 analytics). 다크 light only |
| DH-003 | ApprovalPreview top 4 카드 (urgency border + "검토" Link) | 가 | 고 | **PR-5A 적용 완료** (mutation 0, Link only). PR-5B에서 즉석 승인 mutation 도입 후보 |
| DH-004 | StatCard ×4 KPI (전사 인원/결재 대기/이직률/채용중) | 가 | 고 | 기존 유지 (PR-5A 미수정). primitive `StatCard.tsx` |
| DH-005 | ListCard ×2 (온보딩/오프보딩 진행) | 가 | 중 | 기존 유지 (PR-5A 미수정). primitive `ListCard.tsx` |
| DH-006 | InsightStrip 조건부 (urgent / orphan hires) | 가 | 중 | 기존 유지 (PR-5A 미수정). primitive `InsightStrip.tsx` |
| DH-007 | Quick Actions row (5 pill 버튼: 직원등록/급여실행/분석리포트/채용공고/온보딩시작) | 나 (proto만, 코드 부재) | 중 | proto `page-dashboard-workday.jsx:215-237` (wd-quick-row). PR-5A 의도적 제거 (워클릿이 대체). 사용자 보강 디자인은 유지 → Q3 운명 결정 |
| DH-008 | 공지사항 카드 ×2 (성과·휴가 캠페인 cover image + tag + title + sub + by-author) | 나 (proto만, 코드 부재) | 저 | proto `:310-360`. cover SVG + Avatar. **PR-5B/5C 후보 트랙**. 데이터 모델 = Notice/Announcement 신규 검토 |
| DH-009 | 이번 주 권장 작업 (AI 자동 감지 — 번아웃/온보딩지연/MBO마감) | 나 (proto만, 코드 부재) | 저 | proto `:370+`. AI 신호 기반 카드 3건. **PR-5C+ 후보 트랙**. 백엔드 = burnout-risk / onboarding-delay / mbo-deadline 신호 집계 API |
| DH-010 | 활동 피드 + 온보딩 진행 6명 (좌/우 분할) | 나 (proto만, 코드 부재) | 저 | proto `:420+`. ListCard 확장 (현 DH-005 2건 → 활동 피드 5건 + 온보딩 6명). **PR-5B 후보** (ListCard 확장 또는 신규 primitive) |
| DH-011 | 상단 헤더 "Tweaks" 버튼 | 나 (proto만, 코드 부재) | 저 | proto `:1` 상단 utility. 사용자 디자인 시스템 토글 UI 추정. **운명 미확정** — Q4 |
| DH-012 | role-gated 분기 (HR_ADMIN/SUPER_ADMIN ↔ MANAGER ↔ EXECUTIVE ↔ EMPLOYEE) | 가 | 고 | 기존 유지. 각 역할별 HomeV2 컴포넌트 분기 (DO NOT TOUCH 가드) |
| DH-013 | summary API (HR/SuperAdmin attendanceToday + topPendingApprovals) | 가 | 고 | **PR-5A `742dab35` 적용 완료**. P2-1 fix 적용 (`workDate` range query). F25 가이드라인 준수 |

## 3. 컴포넌트 매핑

- **이미 SSOT 적용 (PR-5A `742dab35`)**: WorkdayHero / WorkletGrid / ApprovalPreview / `info` 토큰 + i18n 5 locale
- **기존 유지 (PR-5A 미수정)**: StatCard / ListCard / InsightStrip / DashboardHomeShell / HomeGrid (DO NOT TOUCH 가드)
- **다크 known-deferred (F24 N+14)**: WorkdayHero `from-primary to-primary-dim` 다크에서 lavender 노출. Phase 4 다크 트랙 일괄 (F19/F24/F26 합본)
- **i18n date format (F26 N+16)**: `Intl.DateTimeFormat(locale)` 적용. Phase 4 i18n 트랙에서 `formatToTz` Korean literal 의존 컴포넌트 일괄 마이그레이션
- **누락 컴포넌트 (proto 부재 — PR-5B/5C 후보)**:
  - Quick Actions row (DH-007) — pill 버튼 row 단순 (~30 lines)
  - AnnounceCard (DH-008) — cover SVG + tag + title + sub + author (~150 lines)
  - WeeklyRecommendCard (DH-009) — AI 신호 카드 3건 (~120 lines + 신호 API)
  - ActivityFeed (DH-010) — 활동 피드 5건 (~100 lines + 활동 API 또는 기존 notifications 재사용)
- **사용자 보강 디자인 갭 (proto vs claude design)**:
  - WorkdayHero 색상: proto navy ↔ 보강 warm orange. proto styles.css는 navy (`oklch(38% 0.08 230)`) — PR-5A 정합. 보강 디자인 채택 시 별도 토큰 `--wd-hero-from`/`to` 정의 + 다크 변형 (F24와 연계). **별도 디자인 SSOT 결정 필요** — 게이트 Q2

## 4. N1/N2 표준 적용 계획

**N1 7레이어 audit (`/home` HrAdminHomeV2 기준, PR-5A 후 상태)**

| 레이어 | 분류 | 근거 |
|---|---|---|
| UI | 가 (PR-5A 적용) | WorkdayHero + WorkletGrid + ApprovalPreview 신규 + StatCard/ListCard/InsightStrip 기존 유지 |
| 상태 | 가 | loading/error/empty 모든 컴포넌트 자체 처리 (Skeleton/EmptyState/toast) |
| API | 가 (PR-5A 확장) | `/api/v1/home/summary` HR_ADMIN 분기 attendanceToday + topPendingApprovals 추가 (P2-1 range query 정합) |
| DB | 가 | Attendance + LeaveRequest 읽기, 무변경 |
| 권한 | 가 | `withPermission perm(MODULE.EMPLOYEES, ACTION.VIEW)` (summary/route.ts:189) |
| i18n | 가 (PR-5A 확장) | `home.hrAdmin.v2` ns 신규 ~40 키 × 5 locale (ko 정식, en 영문, es/vi/zh placeholder) |
| e2e | 가-얕음 | `e2e/flows/home-hr-admin.spec.ts` 미작성 (PR-5A는 신규 e2e 0 — PR-5B/PR-5C에서 통합) |

**N2 E2E 시나리오 후보** (`e2e/flows/home-hr-admin.spec.ts` 신설 후보):
- S1: WorkdayHero 렌더 + 3-KPI 표시 (HR_ADMIN 로그인 후 `/home`)
- S2: WorkletGrid 8 타일 모두 표시 + 각 Link href 정합
- S3: ApprovalPreview top 4 카드 표시 + urgency 분류 (overdue/today/queued)
- S4: 가디언 회귀 — 에러바운더리 0 + 콘솔 에러 0 (Vercel CSP 제외)
- S5: 모바일 375px reflow (3-KPI 숨김, WorkletGrid grid-cols-2)
- S6: 다른 역할 (MANAGER/EMPLOYEE) `/home` 진입 시 HrAdminHomeV2 미렌더 (role guard)

**M3 시각 회귀 3축** (PR-5A 검증 완료, 본 batch는 후속 트랙용):
- color: WorkletGrid 8 distinct + WorkdayHero navy (proto SSOT) — F24 다크 known-deferred
- spacing: HomeGrid cols=4 (desktop) / 2 (sm) / 1 (mobile) reflow
- typography: TYPOGRAPHY 토큰 (heroGreeting/cardTitle/displaySm/statLabel) — 인라인 font 0

## 5. 운명 카드 (다 = 코드만, 프로토타입 부재)

### [/home-preview/hr-admin] HrAdminHome V1 (env+role gated) — 운명 제안: **숨김→PR-5A 안정화 후 제거**

- 현 상태: `HrAdminHome.tsx` 별도 파일, `/home-preview/hr-admin` env-gated 라우트
- 프로토타입 부재 사유 추정: PR-5A V2 마이그레이션 초기 안전망 (V1↔V2 비교 가능)
- 제안 근거: V2가 production 진입 후 V1 = 죽은 코드. env `NEXT_PUBLIC_HOME_PREVIEW` + role gate로 가시성 0 → 유지 비용만 발생
- 영향: PR-5A 머지 + 1주 안정화 관찰 → V1 폐기 (별도 cleanup PR)

### [DashboardHomeShell] HR_ADMIN 외 역할 (MANAGER/EXECUTIVE/EMPLOYEE) V2 — 운명: **DO NOT TOUCH 가드 유지**

- 현 상태: 각 역할별 HomeV2 파일 (PR-5A는 HR_ADMIN만 수정, 나머지 3건 미터치)
- 사유: PR-5A 가드 명시. HeroCard 4개 역할 공용 import 유지
- 영향: 별도 PR (PR-5B / PR-5D 등)에서 각 역할별 리스킨 가능

## 6. 사용자 게이트 항목 (Stage 3 — OK / 정정 / 보류 / 제거)

- **Q1 우선순위**: 대시보드 = **P0** (HR_ADMIN 첫 화면, 매일 접근 = 매일 핵심).
  → OK / 정정(P1·P2)?
- **Q2 디자인 SSOT 확정 (1순위)**: proto styles.css `wd-hero` navy 그라데이션
  vs 사용자 보강 디자인 warm orange:
  - (1) proto styles.css 유지 = navy (PR-5A 정합, 변경 0)
  - (2) 사용자 보강 디자인 채택 = warm orange (별도 토큰 + WorkdayHero 재작업)
  - (3) 라이트=warm orange / 다크=navy (F24 연계, 토큰 분리)
- **Q3 DH-007 Quick Actions row**: 운명 결정
  - (1) 구현 (proto + 사용자 보강 디자인 정합, ~30 lines 신규 primitive)
  - (2) 워클릿이 대체 (PR-5A 의도, 미구현)
  - (3) 별도 트랙 (PR-5B/5D)
- **Q4 DH-008/DH-009/DH-010 후속 트랙 분리**:
  - 공지사항/권장작업/활동피드 3 섹션 = PR-5B (단일 PR) vs PR-5B/5C/5D (분할)?
  - 데이터 모델 신설 (Notice/Burnout-signal/Activity) 백엔드 합의 필요
- **Q5 DH-011 Tweaks 버튼**: 운명 결정 (사용자 디자인 시스템 토글 = 사용자 의도 확인 필요)
- **Q6 V1 폐기 시점**: PR-5A 머지 후 (1) 즉시 / (2) 1주 안정화 후 / (3) 보류
- **Q7 다른 역할 (Manager/Executive/Employee) 리스킨 trajectory**:
  - (1) 동일 patterns (WorkdayHero + WorkletGrid + ApprovalPreview)
  - (2) 역할별 차별화 (각 페르소나 우선순위 반영)
  - (3) Phase 3a batch 04 (manager-home) / 05 (employee-home) / 06 (executive-home) 분할

---

## 7. Stage 3 게이트 결정 (확정 대기 — Stage 4 입력 SSOT)

> 사용자 게이트 응답 후 채울 영역. Stage 4 작업계획·구현은 본 절을 입력으로 함.
> 본 카드 작성 시점 = PR-5A 진행 중 (#63 OPEN, 머지 게이트 2026-05-24
> 02:43+ KST). Stage 3 결정은 PR-5A 머지 후 또는 게이트 도래 전 가디언 사전
> 결정 가능.

| Q | 결정 | Stage 4 적용 |
|---|---|---|
| Q1 | TBD | — |
| Q2 | TBD | — |
| Q3 | TBD | — |
| Q4 | TBD | — |
| Q5 | TBD | — |
| Q6 | TBD | — |
| Q7 | TBD | — |

**M. 모바일 reflow** (PR-5A 검증 완료): WorkdayHero 3-KPI 숨김 / WorkletGrid grid-cols-2 / ApprovalPreview 좌측 icon 숨김 / 가로 overflow 0 — 모두 PASS.

**B. 브랜치**: PR-5A 머지 후 후속 트랙 분리:
- `feat/home-quick-actions` (DH-007)
- `feat/home-announce` (DH-008)
- `feat/home-weekly-recommend` (DH-009)
- `feat/home-activity-feed` (DH-010)
- `feat/home-v1-cleanup` (DH-002 운명 카드 후속)

---

## 8. PR-5A 누적 RECORD 인용 (cross-reference)

본 카드 작성 시점 (claude/phase3a-audit `3c6df292`) phase3a §7 RECORD 3건:

| N | F | 내용 | 본 batch 적용 |
|---|---|---|---|
| N+14 | F24 | WorkdayHero F19 신규 위반 (다크 lavender) | DH-001 본 batch 명시 (다크 known-deferred), 후속 Phase 4 트랙 |
| N+15 | F25 | P2-1 Attendance range query 가이드라인 | DH-013 본 batch 정합 (PR-5A patch 적용 완료) |
| N+16 | F26 | P2-2 i18n date format 일관성 | DH-001 본 batch 정합 (PR-5A patch 적용 완료) |

PR-5+ 카나리 진입 시 본 batch 카드 + RECORD 3건 + handover §7 inventory
합본 → Phase 4 다크 트랙 / Phase 4 i18n 트랙 마이그레이션 plan 사전 자료.
