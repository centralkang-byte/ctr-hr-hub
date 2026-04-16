# Phase 4: Design System Overhaul + UX Polish

## Context

Phase 3 (Security Audit) 완료 후, "Kinetic Atelier" 디자인 시스템을 실전 가이드로 전면 개편. CEO와 브레인스토밍 세션(2026-04-09~10)에서 모든 디자인 결정 확정. 목업: `.superpowers/brainstorm/37647-1775744584/content/`

---

## Part 1: Design Decisions

### 1.1 DESIGN.md 구조
- `DESIGN.md` ≤150줄: 3줄 디렉션 + 토큰 테이블
- `.claude/rules/design.md` 보강: 페이지 레이아웃 패턴, 컴포넌트 조합, 상태 처리
- AI-슬롭 네이밍 전부 제거 ("Kinetic Atelier", "Asymmetric Energy", "Soft Lift" 등)

### 1.2 팔레트 (Indigo → Violet)
| Token | Old | New |
|-------|-----|-----|
| primary | #4a40e0 | **#6366f1** |
| primary-dim | #3d30d4 | **#4f46e5** |
| primary-container | #9795ff | **#a5b4fc** |
| tertiary (success) | #006947 | **#16a34a** |
| tertiary-container | #69f6b8 | **#86efac** |
| error | #b41340 | **#e11d48** |
| secondary | #6249b2 | **#64748b** |
| warning | #B45309 | #f59e0b (유지) |

변경: `globals.css` CSS 변수 수정 → 전체 cascade.

### 1.3 폰트
| Role | Old | New |
|------|-----|-----|
| Display (영문/숫자 4xl+) | Inter | **Outfit** |
| Body (한영 혼합) | Pretendard | 유지 |
| Mono (숫자/코드) | Geist Mono | 유지 |

### 1.4 아이콘
- 시스템 이모지 **전면 금지** — 모든 UI에서
- Lucide 단색: 비활성 Slate(#94a3b8), 활성 white on gradient
- stroke-width 1.5px

### 1.5 구조적 결정 (유지)
Tonal Layering, 3-tier radius, Density 3단계, 4px spacing, Glassmorphism 2곳만

### 1.6 앱 쉘
**사이드바:** bg #fafafe, gradient 활성 아이템, 검색창 이동, 카드형 프로필, Lucide 아이콘
**헤더:** bg-white/80 blur(12px), shadow-sm, Violet 브레드크럼, pill 법인셀렉터, 52px 높이
**로고:** Violet gradient, Outfit 800

### 1.7 대시보드 — V3 "2-Zone"
Action Zone(해야 할 것) + Monitor Zone(현황). 4개 역할별 정보 구성:
- HR Admin: 전사 결재+급여이상+퀵액션 / 5 KPI+온보딩트래커+일정+인사이트
- Manager: 팀 결재+평가+1:1 / 팀원 아바타+팀 성과+근태+온보딩(조건부)
- Employee: 내 신청+평가+교육 / 출근 히트맵+일정+급여예상+온보딩(조건부)
- Executive: 전략 인사이트+고위 결재 / 법인별 비교+인건비 추이+승계 파이프라인

### 1.8 온보딩/오프보딩 위젯 (조건부)
| 역할 | 위치 | 조건 | 없을 때 |
|------|------|------|---------|
| HR Admin | Monitor Zone | 항상 | — |
| Manager | Monitor Zone | 팀에 해당자 ≥1 | 팀 성과 차지 |
| Employee | Action Zone 최상단 | 입사 30일 이내 OR 퇴사 확정 | "내 할 일" 전체 |
| Executive | — | 미표시 | — |

### 1.9 테이블 3종
| 용도 | 스타일 |
|------|--------|
| 직원/휴가/승인 (기본) | **Tonal Layering** — border 0, 배경색 차이, 통합 toolbar |
| 급여/근태/감사 (데이터 밀도) | **Zebra Stripe** — 짝수행 배경, compact density |
| 디렉토리/채용/인재 풀 | **Card Row** — 독립 카드, hover lift |

이름 셀: 기본=한 줄+hover tooltip(A), 디렉토리=2줄 압축(D)

### 1.10 폼 표준
| 요소 | 규칙 |
|------|------|
| 레이블 | 항상 상단. 11px semibold |
| 필수 | 빨간 * |
| 에러 | 인라인 (입력 아래 + 빨간 테두리 + XCircle 아이콘) |
| 입력 | border 1.5px, rounded-lg, 포커스 Violet ring |
| 레이아웃 | 2열 기본, 짧은 폼 1열 |
| 버튼 | 우측: 취소(ghost) → 임시저장(outline) → 제출(primary pill) |
| 구현 | shadcn/ui FormField 래퍼 필수 |

2유형: 표준 폼(등록/수정, 섹션 카드) + 컴팩트 폼(승인/빠른 액션)

### 1.11 모바일 전략 — B (반응형 + Tier 1 최적화)
**Tier 1 (모바일 전용 뷰):** 출퇴근 기록, 연차 신청(Bottom Sheet), 결재 승인(카드+Swipe), 알림, 대시보드
**Tier 2 (반응형만):** 팀 현황, 프로필, 일정, 교육
**Tier 3 (데스크톱 전용):** 직원 등록, 급여 처리, 평가 작성, 분석, 설정, 조직도, 벌크, DnD
**Bottom Tab Bar:** 홈/근태/휴가/알림/더보기 (md:hidden)

### 1.12 상태 뱃지 — 6 카테고리
| 카테고리 | 색상 | 용도 |
|---------|------|------|
| success | #16a34a | 승인, 완료, 재직, PAID, HIRED |
| warning | #b45309 | 대기, 수습, PENDING, REVIEW |
| error | #e11d48 | 반려, 퇴직, 결근, REJECTED, FAILED |
| info | #6366f1 | 진행중, 휴가, 면접, ACTIVE |
| neutral | #64748b | 초안, 취소, DRAFT |
| accent | #7c3aed (신규) | 오퍼, 휴직, 출장 |

Badge 컴포넌트에 `whitespace-nowrap` 필수. StatusBadge 컴포넌트로 status→카테고리 자동 매핑. 렌더링은 항상 pill 형태.

### 1.13 페이지 레이아웃 5종
| 유형 | 컨테이너 | 헤더 | 본문 |
|------|----------|------|------|
| List | p-6 space-y-6 | 아이콘+제목+CTA | 필터 pills → 테이블 |
| Detail | p-6 space-y-6 | 뒤로가기+프로필 | 2열: 프로필(240px)+탭 콘텐츠 |
| Dashboard | p-8 space-y-6 | 인사+컨텍스트 | V3 Action+Monitor Zone |
| Settings | p-6 bg-muted | 아이콘+제목 | 2열: 카테고리(200px)+탭 |
| Form | p-6 max-w-4xl | 뒤로가기+Step | 섹션 카드, StickyActionBar |

공통: PageHeader 컴포넌트 통일, space-y-6, 뒤로가기는 Detail/Form만

### 1.14 조직도 리디자인
**트리 차트 업그레이드:** 부서장 아바타+이름+직위, 접기/펼치기(+/-), 루트=Violet gradient, 매트릭스 점선(토글), 최상위=CTR Holdings
**디렉토리 뷰 (신규):** 좌측 트리 사이드바(13개 법인 계층) + 우측 멤버 테이블
디렉토리 열(9열): 이름(아바타+한글+영문), 부서, 직위, 직급, 연락처, 이메일, 근무지, 상태, 입사일

### 1.15 차트
6색 기본 팔레트: Violet→Violet light→Green→Amber→Red→Slate. 확장 4색 추가(Purple, Sky, Lime, Orange).
`chart.ts` CHART_THEME 색상 업데이트 → 19개 파일 자동 적용. 인라인 8개 수동 수정.
규칙: Bar rounded-t, Line stroke 2px, Donut 65% 내부, Heatmap 시맨틱 스펙트럼, 높이 기본 320px.

### 1.16 칸반보드 (채용)
하드코딩 색상 → STATUS_VARIANT 매핑. 카드: 좌측 3px 컬러 바 + 아바타 + 메타 + 태그. **카드 높이 고정** (내용 무관). hover lift.

### 1.17 캘린더
**교대근무:** 셀 rounded, 오늘 Violet outline, 이벤트 pill 시맨틱 색상, 최대 2개+N
**팀 휴가:** 테이블 → 간트 바 스타일. 승인=Green, 사용중=Violet, 대기=Amber. 오늘 세로 빨간 선.
**통합 HR 캘린더:** 별도 Phase (이번 스펙 범위 밖)

### 1.18 다크모드
별도 Phase. 라이트모드 완성 우선.

---

## Part 2: Implementation Plan

### DO NOT TOUCH 해제
이번 작업에서 `src/components/layout/*` 제약 **임시 해제**: Sidebar.tsx, Header.tsx, MobileDrawer.tsx

### Batch 순서

**Batch 1: 토큰 교체** (~3 files, cascade)
- `globals.css` — CSS 변수 Violet 팔레트
- `tailwind.config.ts` — CTR legacy 토큰
- `layout.tsx` — Outfit 폰트 import
- 검증: 빌드 + 주요 3페이지 스크린샷

**Batch 2: DESIGN.md + rules 재작성** (2 files)
- `DESIGN.md` ≤150줄
- `.claude/rules/design.md` — 레이아웃 패턴, 컴포넌트 조합, 상태 처리

**Batch 3: 앱 쉘** (~3 files)
- Sidebar.tsx — Lucide 아이콘, 팔레트, 검색 이동, 프로필 카드
- Header.tsx — 글래스모피즘, 브레드크럼, 52px
- MobileDrawer.tsx — 동기화

**Batch 4: 상태 뱃지 통일** (~10 files)
- `status.ts` — 6카테고리 업데이트 + accent 추가
- `badge.tsx` — whitespace-nowrap
- StatusBadge 신규 컴포넌트
- 인라인 색상 8개 파일 수정

**Batch 5: 테이블 + 폼 기반** (~12 files)
- `table.tsx`, `table.ts`, `modal.ts`, `form.ts` — border 제거, Tonal Layering
- `DataTable.tsx`, `PageSkeleton.tsx`, `LoadingSkeleton.tsx` — border 제거
- `alert-dialog.tsx`, `sheet.tsx` — rounded-2xl, shadow
- StickyActionBar, LoadingSpinner — backdrop-blur 제거

**Batch 6: 대시보드 V3** (~6 files)
- HrAdminHome, ManagerHome, EmployeeHome, ExecutiveHome — V3 2-Zone
- KpiStrip — Outfit display font
- OnboardingTracker, OffboardingTracker — 신규 컴포넌트

**Batch 7: 조직도 리디자인** (~4 files)
- OrgClient.tsx — 노드 업그레이드, 접기/펼치기, 매트릭스 점선
- 디렉토리 뷰 신규 컴포넌트

**Batch 8: 차트 + 칸반 + 캘린더** (~12 files)
- `chart.ts`, `chart-colors.ts` — 팔레트 업데이트
- 인라인 하드코딩 8개 파일
- BoardClient.tsx — 칸반 카드 고정 높이 + STATUS_VARIANT
- ShiftCalendarClient.tsx — 캘린더 스타일
- LeaveTeamClient.tsx — 간트 바 스타일

**Batch 9: 페이지 레이아웃 통일 + 반응형** (~20 files)
- PageHeader 컴포넌트 통일
- 고정 grid → 반응형 breakpoint
- 모바일 Bottom Tab Bar 신규
- Tier 1 모바일 전용 뷰 (출퇴근, 연차 Bottom Sheet, 결재 카드)

**Batch 10: 잔여 Polish** (~15 files)
- Hardcoded hex 색상 교체
- A11y (htmlFor, aria-label)
- Focus ring, hover transitions
- 누락된 EmptyState, ConfirmDialog

### 검증 (per batch)
1. `npx tsc --noEmit`
2. `npm run lint`
3. `preview_screenshot` — before/after
4. Commit: `feat(design): Phase 4 Batch N — {description}`

### 리스크별 추가 검증

| Batch | 리스크 | 추가 검증 |
|-------|--------|----------|
| 1 (토큰) | 낮음 | 기본만 |
| 2 (문서) | 없음 | 기본만 |
| 3 (앱 쉘) | **중간** | `codex review --uncommitted` + 사이드바 네비게이션 수동 테스트 |
| 4 (뱃지) | 중간 | 각 모듈 상태 표시 spot check |
| 5 (테이블/폼) | **높음** | `codex review` + **Playwright E2E 실행** + 테이블 정렬/페이지네이션 수동 확인 |
| 6 (대시보드) | 중간 | 4개 역할 로그인 테스트 (super@, manager@, employee-a@, hr@) |
| 7 (조직도) | **높음** | `codex review` + **Playwright E2E 실행** + 검색/접기 수동 확인 |
| 8 (차트/칸반/캘린더) | 중간 | 차트 렌더링 + 칸반 DnD 수동 확인 |
| 9 (레이아웃/모바일) | 중간 | 768px/1024px 뷰포트 확인 (preview_resize) |
| 10 (Polish) | 낮음 | 기본만 |

**Codex Gate 1 (Plan Review):** 건너뜀 — 디자인 스펙이라 코드 리뷰 효과 낮음.
**Codex Gate 2 (Code Review):** Batch 3, 5, 7에서 필수 실행.
**Playwright E2E:** Batch 5, 7 후 기존 150개 테스트 실행 (기능 회귀 확인).

---

## Visual References

목업 파일: `.superpowers/brainstorm/37647-1775744584/content/`
- `palette-comparison.html` → Violet 선택
- `font-comparison.html` → Outfit 선택
- `dashboard-cb-hybrid.html` → V3 선택
- `dashboard-role-info.html` → 역할별 정보 매트릭스
- `dashboard-onboarding.html` → 온보딩/오프보딩 위젯
- `shell-design.html` → 앱 쉘 현재 vs 새 디자인
- `icon-style.html` → Lucide 단색 선택
- `table-design-v2.html` → 3종 테이블
- `table-name-cell.html` → 이름 셀 A+D
- `form-design.html` → 폼 표준 2유형
- `mobile-design.html` → 모바일 3화면
- `status-badge.html` → 6카테고리 매핑
- `badge-overflow.html` → nowrap 해결
- `page-layouts.html` → 5종 레이아웃
- `orgchart-redesign.html` → 트리+디렉토리
- `chart-design.html` → 차트 팔레트+규칙
- `kanban-calendar.html` → 칸반+캘린더 2종

## Scope Out (별도 Phase)
- 다크모드 (라이트모드 완성 후)
- 통합 HR 캘린더 (신규 기능 설계 필요)
- PWA (Service Worker 등)
