# Design Wave 1 — Home (HR Admin) Proto Fidelity

> **Date**: 2026-06-10 · **Session**: S280
> **Track**: Design Wave campaign ([[hrhub-design-wave-campaign]]) — Wave 0 (PR #142, merged 34b1a238) 후속
> **CEO decisions already made**: proto `_design-reference` `[data-style="workday"]` = pixel SSOT · orange 복원은 퀵픽스 분리 없이 Wave 1에서 한꺼번에 · **Wave 1 첫 타깃 = 홈(오렌지 복원 포함 구조 완결)**
> **Pixel SSOT**: `_design-reference/page-dashboard-workday.jsx` + `styles.css` (`.wd-hero` :669, `.wd-worklet` :825-832, `.wd-w-count` :879, `.wd-quick` :1097, `.wd-action-card` :895, `.wd-suggest` :1017, `.wd-announce-card` :965)

## Scope

HR Admin 홈(`HrAdminHomeV2.tsx`) + 홈 프리미티브의 프로토 정합. 다른 역할 홈(Employee/Manager/Executive V2)은 이번 Wave 범위 밖 — 단, 공유 프리미티브 수정(WorkdayHero 미사용·WorkletGrid 미사용이라 blast 없음)은 영향 확인.

### Gap inventory (memory + 코드 실측 2026-06-10)

| # | Gap | Proto spec | Current | Fix |
|---|-----|-----------|---------|-----|
| 1 | 히어로 radial glow 부재 | `.wd-hero`: 좌상 blue glow `oklch(85% .10 230 / .3)` + **우하 orange glow `oklch(85% .10 50 / .25)`** over navy 135deg linear | `bg-gradient-to-r from-primary to-primary-dim`만 | WorkdayHero bg를 3-layer gradient로 (arbitrary CSS 또는 globals 유틸) |
| 2 | 빠른작업 행 부재 | `.wd-quick-row` — pill 버튼 5개 (1px border, bg-elev, icon 13px) | PR-5A에서 제거됨 ("워클릿 대체" — proto에는 둘 다 있음) | `QuickActionsRow` 신규 프리미티브: 직원 등록→/employees·급여 실행→/payroll·분석 리포트→/analytics·채용 공고→/recruitment·온보딩 시작→/onboarding |
| 3 | 워클릿 wt-1~8 미배선 | `.wd-tile.tN`: `linear-gradient(135deg, var(--wt-N), darker)` — t1 navy·t2 teal·t3 terracotta·t4 purple·t5 forest·t6 gold·t7 steel·t8 coral | tone이 임의 토큰(primary/tertiary/chart-2/wd-orange/badge-accent/warning-bright/chart-4/info) flat bg | WorkletTone을 `wt-1`~`wt-8`로 교체, 그라데이션 적용. 메뉴 매핑은 proto 순서: 직원=1·채용=3·근태=2·휴가=4·성과=5·급여=6·조직=7·분석=8 |
| 4 | 워클릿 카운트 배지 빨강 오구현 | `.wd-w-count`: `background: var(--wd-orange)` | `bg-destructive` (WorkletGrid.tsx:111) | `bg-wd-orange` |
| 5 | StatCard 4-행 중복 | proto 홈에 stat row 없음 (히어로 우측 3-KPI가 유일) | 히어로 KPI + StatCard 4개 이중 표시 | HrAdminHomeV2에서 StatCard 섹션 제거 (StatCard 프리미티브 자체는 타 role 홈이 사용 — 파일 보존). sparkline 정보 손실은 분석 페이지 링크가 커버 |
| 6 | ApprovalPreview 좌측보더 | `.wd-action-card`: 1px full border + 40px colored ico square + `.chip-due` (overdue=red-soft·today=orange-soft) — **좌측보더 없음** (proto 금지 패턴: "좌측 보더 강조 카드" AI slop) | `border-l-4` + urgency별 좌보더 색 (ApprovalPreview.tsx:61-63,133) | proto 패턴으로 전환: border 1px, ico 사각형 urgency 틴트(overdue red-soft/today orange-soft), chip-due 동일 틴트 |
| 7 | 권장 작업 카드 | `.wd-suggest-grid` 3-col 카드 (ico-pill + title + sub + cta) | InsightStrip 1-col 스트립 2건 조건부 | `SuggestCard` 신규(또는 InsightStrip 변형): 그리드 카드형. 데이터 있는 항목만 조건부 렌더 — 기존 urgent/orphanHires 2건 유지 + 가능하면 MBO 마감(quarterlyReviewStats) 1건 추가. **AI 사칭 금지 — 라벨은 "자동 감지" 수준, 실데이터 조건만** |
| 8 | 활동 피드 부재 | `grid-2`: 활동피드(notifications 최근 5) + 온보딩 진행 | ListCard 온보딩/오프보딩 2-col만 | `ActivityFeedCard` 추가 — 기존 `/api/v1/notifications` (본인 알림 최근 5) 소비. 레이아웃: grid-2 [활동피드][온보딩], 다음 행 [오프보딩] (기능 후퇴 없이 proto 구조 수렴) |
| 9 | 공지사항 섹션 | `.wd-announce-grid` cover-art 카드 2개 (cv-1 orange/cv-2 blue) | 없음 | **이연** — Announcement 백엔드 모델/API/작성 UI 자체가 없음 (Notification은 per-employee). 가짜 데이터 금지 원칙. 별도 제품 트랙으로 기록 |

### Out of scope
- 공지사항 백엔드 (별도 제품 트랙 — 칩 spawn)
- Employee/Manager/Executive 홈 proto 정합 (Wave 1 후속 페이지)
- 다크모드 (Phase 4 별도 — Wave 캠페인 메모리 참조)
- ⌘K·모바일 reflow (Phase 4)

## Implementation

### Files (예상 ~12)
1. `src/components/home/primitives/WorkdayHero.tsx` — bg 3-layer gradient (#1)
2. `src/components/home/primitives/WorkletGrid.tsx` — wt-1~8 그라데이션 톤 + 배지 orange (#3,#4)
3. `src/components/home/primitives/ApprovalPreview.tsx` — wd-action-card 패턴 (#6)
4. `src/components/home/primitives/QuickActionsRow.tsx` — 신규 (#2)
5. `src/components/home/primitives/SuggestCard.tsx` — 신규 (#7; InsightStrip은 타 소비처 있으면 보존)
6. `src/components/home/primitives/ActivityFeedCard.tsx` — 신규 (#8)
7. `src/components/home/HrAdminHomeV2.tsx` — 조립: quick row 삽입·StatCard 섹션 제거·suggest 그리드·활동피드 (#2,#5,#7,#8)
8. `messages/{ko,en,zh,vi,id}.json` — 신규 키 additive (기존 키 불변 — FORBIDDEN 준수)
9. `tailwind.config.ts` 또는 `globals.css` — wt 그라데이션/glow 유틸 필요 시 (worklet-N 클래스는 이미 wt 토큰 존재, gradient는 arbitrary로 가능하면 무변경)

## Codex Gate 1 반영 (2026-06-10, P0 1·P1 7·P2 4 — 전부 수용)

| # | Finding | Resolution |
|---|---------|-----------|
| P0-1 | `01-home.visual.spec.ts`가 EMPLOYEE 계정만 촬영 — 이번 변경 화면이 visual 미검증 | HR_ADMIN `/home` visual case 신설 (desktop/tablet/mobile × light/dark, 기존 spec 구조 따름). 기존 employee baseline 불변 |
| P1-2 | 히어로 KPI는 `<md` hidden — StatCard 제거 시 모바일 KPI 전멸 | WorkdayHero에 모바일 컴팩트 KPI 행 추가 (`md` 미만 전용, dl 가로 3분할). **sparkline 추이 손실은 수용** (제품 결정: 추이는 /analytics; 홈 proto에 sparkline 부재) |
| P1-3 | per-user notifications는 "활동 피드"가 아님 | 명명 = **"최근 알림"** (notification inbox preview). 헤더 Bell과 중복은 의도적 수용 (proto도 동일 데이터 중복) |
| P1-4 | 알림 fetch 상태 설계 누락 | RecentNotificationsCard에 독립 loading(skeleton)/error(재시도)/empty 3분법 + `?limit=5` + 응답 타입 정의 |
| P1-5 | quarterlyReviewStats에 deadline 없음 — D-day는 조작 | suggest 카드 = **"MBO 미완료 현황"** (pending/completionRate 실데이터만, D-day 미표기) |
| P1-6 | 퀵액션 라벨이 동작 과장 (목록 랜딩인데 "등록/실행") | 구현 시 타깃별 생성 진입점 grep — 직접 생성 URL/쿼리파람 있으면 액션 라벨, 없으면 "X 관리"로 강등 |
| P1-7 | ApprovalPreview 모바일 한 행 충돌 | `<sm` 2행 배치 (본문 행 + 우측 액션 행), 긴 번역 검증 |
| P1-8 | i18n 키 존재 확인만으로 부족 | 신규 수치 문구 ICU plural · 5 locale 키 완전성 검사 스크립트 · en/zh 모바일 smoke |
| P2-9 | wt 토큰 이미 Tailwind 등록 — config 수정 불필요 | tailwind.config/globals 무변경, 그라데이션은 프리미티브 내 명시 클래스 |
| P2-10 | QuickActions a11y | min-h-44px·focus-visible ring·`<nav aria-label>` + list 구조 |
| P2-11 | SuggestCard 링크 중첩 금지 | 카드 전체 단일 Link, 내부 CTA는 시각 요소 (중첩 `<a>` 없음) |
| P2-12 | 오프보딩 단독 행 레이아웃 모호 | grid-2에 3카드 wrap (2+1): [최근 알림][온보딩] / [오프보딩 half-width]. 명시적 결정 |

**베이스라인 정정**: 330장 전수 재생성은 별도 패스가 아니라 **이 Wave 1 브랜치에서 구현 완료 후 1회** (`npm run test:visual:update`) — "웨이브당 1회" 원칙 충족 + Wave 0 토큰 효과·Wave 1 홈 변경을 한 번에 캡처.

### 검증 게이트
- `npx tsc --noEmit` 0 · `npm run lint` 0
- **Pixel Gate** (rules/design.md): `python3 -m http.server 8077 -d _design-reference` 서빙 → workday 대시보드 vs `/home` (hr@ctr.co.kr) side-by-side 스크린샷
- 멀티롤 smoke: super@ + employee-a@ (홈 프리미티브 공유분 회귀 — 타 role 홈 V2는 WorkdayHero/WorkletGrid 미사용 확인됨)
- e2e: 기존 home 관련 spec + visual 01-home 스냅샷 갱신 (Wave 0 전수 재생성과 별개로 이 PR에서 home만)
- Codex Gate 2 (/verify)

### 함정 (Wave 캠페인 메모리)
- visual 베이스라인 330장 전수 재생성은 **Wave 0 머지 직후 main에서 1회** (이 PR과 분리) — 이 PR은 home 분만 갱신
- `messages/*.json` 키 추가만, 편집/삭제 금지
- Sidebar/MobileDrawer/navigation.ts 동결 — 미접촉
- WorkletGrid 카운트 배지는 "긴급" 시맨틱이 아니라 proto상 단순 대기 카운트 → orange가 맞음 (destructive 의미 과부하 제거)
