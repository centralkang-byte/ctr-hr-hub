# Batch 카드 #02 — 나의공간 근태 (`/attendance`) — 추정 우선순위 **P0**

> Phase 3a Stage 2. 양식 = `01-myspace-leave.md` 6섹션 + §7 검증 패턴 재사용.
> 선행 결정 SSOT: `01-myspace-leave.md §7` + `6f41d2cf`. **Stage 2 = 카드만, 구현 0.**
> 1st principle = 프로토타입 디자인 충실 반영(위반=교정, 결함=정정 not 복제).
> 스크린샷: `docs/phase-3a/screenshots/myspace-attendance/` (4컷 + fallback 명시).
> 코드 근거 = `claude/phase3a-audit` 워크트리 (`AttendanceClient.tsx` 416줄).

---

## 1. 페이지 매핑

| 레퍼런스 (`_design-reference/`) | 현 코드베이스 (`src/`) | 라우트 | 관계 |
|---|---|---|---|
| `page-my-space.jsx:AttendanceMyPage` (L8–176) | `app/(dashboard)/attendance/AttendanceClient.tsx` | `/attendance` | **1:1 정본** — 사이드바 `nav.mySpace.attendance`(navigation.ts:166-169 href `/attendance`) |
| (없음) | `/my/attendance` **라우트 부재** | — | **🚩 팬텀 딥링크** — `useRecentPages.ts:68`('내 근태') + `workHourAlert.ts:214,226`(초과근무 알림 link) 가 `/my/attendance` 가리키나 라우트 미존재 → **404**. 휴가(/my/leave 실존)보다 심각 |

> 휴가 패턴(이중화)과 다름: 근태는 라우트 1개(`/attendance`)지만 알림/최근페이지
> 딥링크가 **죽은 경로**로 향함. IA 이중화가 아니라 **깨진 링크 결함**. 게이트 Q2.

## 2. 기능 inventory

| ID | 기능 | 분류 | 등급 | 의존 SSOT / 비고 |
|---|---|---|---|---|
| AT-001 | 출퇴근 액션 카드 (날짜·상태·출근/퇴근 버튼) | 가 | 고 | proto 2-state ↔ 코드 3-state(NOT/WORKING/COMPLETED). 리스킨 |
| AT-002 | 라이브 근무 타이머 (HH:MM:SS) | 다 (코드만) | 고 | 운명: **유지** (proto 부재, 실 가치) |
| AT-003 | 이번 주 근무 요약 | 가 (시각 불일치) | 고 | proto 7일 **카드 그리드** ↔ 코드 **가로 바차트**. 디자인 충실=proto 그리드 채택 |
| AT-004 | 최근 30일 근무 히트맵 + 범례 | 나 (proto만, 코드 부재) | **저** | heatmap SSOT(`status.ts` HEATMAP_COLORS/`chart.ts`) 신규 소비처. 게이트 Q4 |
| AT-005 | 월간 통계 (근무일·출근평균·퇴근평균·초과누계·지각) | 나 (proto만, 코드 부재) | **저** | WdStatStrip 후보(5지표) / WdGroupedStatCard. 게이트 Q4 |
| AT-006 | 근태상태·근무유형 배지 | 가 (코드 SSOT OK) | 고 | StatusBadge SSOT 이미 사용(L399). proto는 주간 그리드에 내장 |
| AT-007 | `/my/attendance` 팬텀 딥링크 | 다 (코드만, 라우트 부재) | 저 | 운명 1순위 §5. 게이트 Q2 |

## 3. 컴포넌트 매핑

- **이미 SSOT 적용**: `StatusBadge`(AT-006, L399) · `Badge` workType(L407) · `Skeleton`
  로딩(L236-244) · `PageHeader`(L249). 휴가 LeaveClient 대비 색 위생 양호.
- **SSOT 교체 필요 (가디언, §아래)**: L285 근무중 칩 `bg-primary/10 text-tertiary`
  raw → `Badge`/`StatusBadge` · L386-388 주간 빈상태 `<p>noData</p>` → `EmptyState` SSOT.
- **토큰화 필요 (가디언)**: L296 `bg-destructive/50 hover:bg-red-700`(`bg-red-700` raw
  Tailwind·`/50` 비정상 투명도) · L324·L379 `text-orange-500`(초과근무 → D17 `text-ctr-warning`).
- **에러 처리 (가디언)**: L145·154 fetch 무음 catch · **L207·L224 clock-in/out 실패
  롤백에 toast 0** — 사용자가 출근 눌렀는데 실패 시 무음 복귀(휴가 L313보다 UX 악화).
- **known-deferred**: 근태엔 WdDrawer 없음 → 다크 lavender 상속 0 (휴가와 차이).

### 3.1 신규 컴포넌트 후보

| 항목 | 후보 | 비고 |
|---|---|---|
| AT-004 30일 히트맵 | `status.ts` HEATMAP_COLORS 재사용 or `chart.ts` 신규 소비처 | proto colorOf(present/late/absent/leave/overtime)=의미색 → status.ts 시맨틱 매핑 적합. phase-2-closeout §4.2 의미색 가이드 준수 |
| AT-005 월간 통계 | (A) WdStatStrip(4지표 — 5중 1 통합/분리) / (B) `WdLeaveBalanceCard` 일반화 → **`WdGroupedStatCard`(C)** 첫 실수요? / (C') 인라인 | 휴가 Q6에서 (C)는 "2번째 use case 발견 시 승격" 보류됨. AT-005가 **그 2번째 후보** — 게이트 Q5 |

> 휴가 Q6 결정 `WdLeaveBalanceCard`(B, 도메인특화). 근태 월간통계는 잔여바 아님 →
> WdLeaveBalanceCard 부적합. WdStatStrip(4지표 strip)은 5지표라 부분맞음.
> → (C) `WdGroupedStatCard` 일반화 승격 트리거 가능성. 게이트 Q5 판정.

## 4. N1/N2 표준 적용 계획

**N1 7레이어 audit (`/attendance` AttendanceClient)**

| 레이어 | 분류 | 근거 |
|---|---|---|
| UI | 가 (리스킨) | AttendanceClient 존재. proto 7일 그리드/30일 히트맵/월간통계 외관 반영 필요 |
| 상태 | 나 | loading=Skeleton OK / error=무음 catch(L145·154·207·224 위반) / empty=문자열(EmptyState 미사용) |
| API | 가 | `/attendance/today`·`/weekly-summary`·`/clock-in`·`/clock-out` 존재. AT-004/005용 `/monthly/[year]/[month]` 존재(미소비) |
| DB | 가 | AttendanceRecord 읽기, 무변경 |
| 권한 | 가 | `withPermission perm(MODULE.ATTENDANCE, VIEW/CREATE)` (today:45·clock-in:105) |
| i18n | 가 | `attendance` ns 152키 (5locale) |
| e2e | 가-얕음 | `e2e/flows/attendance.spec.ts` EMPLOYEE/HR_ADMIN = 페이지 로드만 |

**N2 E2E 시나리오 후보** (`attendance.spec.ts` 심화): EMPLOYEE 출근 클릭→
WORKING(타이머 표출)→퇴근→COMPLETED + 주간 요약 갱신 + 실패시 toast(가디언 교정
검증) + 롤별(EMPLOYEE 본인 / `/attendance/admin`·`/attendance/team`=본 batch 외).
다중선택 미해당.

**M3 시각 회귀 3축**:
- color: L285 칩·L296 버튼·L324/379 `text-orange-500` → 토큰/StatusBadge ·
  AT-004 히트맵 = status.ts 의미색 SSOT.
- spacing: 근태 = `compact`(p-4) density 후보 (rules/design.md "payroll/attendance 테이블").
  단 액션 카드는 spacious — proto L46 `var(--space-6) var(--space-8)` 참조.
- typography: 타이머/시간/시수 `font-mono tabular-nums`(코드 L288 이미 적용).

## 5. 운명 카드 (다 = 코드만)

### [/my/attendance] 팬텀 딥링크 (AT-007) — 운명 제안: **링크 교정 (재지정)**
- 현 상태: `/my/attendance` **라우트 없음**. `useRecentPages.ts:68`·
  `workHourAlert.ts:214,226`(주52시간 초과근무 알림 deep-link)가 거기로 → 클릭 시 404.
- 프로토타입 부재 사유 추정: 휴가 `/my/leave`처럼 코드 진화 중 명명 불일치
  (`/attendance` 정착 후 알림 핸들러만 구 경로 잔존).
- 제안 근거: 휴가 Q2 결정(`/leave` 정본 + 링크 일괄 갱신)과 **동일 패턴**.
  `/my/attendance` → `/attendance` 재지정. `/my/attendance`는 라우트 자체가
  없으므로 redirect 라우트 신설은 불요(휴가와 차이 — 휴가는 실 라우트라 redirect 잔존).
- 영향: 미교정 시 초과근무 법정 알림 클릭 404 = 컴플라이언스 UX 결함. 교정 =
  2파일 link 문자열 갱신, 회귀 표면 = 알림 딥링크 N2.

### [/attendance] 3-state clock + 라이브 타이머 (AT-002) — 운명 제안: **유지**
- 현 상태: AttendanceClient L97-101 getClockState 3-state + L170-192 1초 타이머.
- proto 부재 사유 추정: proto는 2-state 토글 목업(checkedIn). 코드가 실 근무시간 추적.
- 제안 근거: 실 비즈 가치(근무중 경과시간 가시화) > proto 단순성. 리스킨만, 로직 보존.

## 6. 사용자 게이트 항목 (Stage 3 — OK / 정정 / 보류 / 제거)

- **Q1 우선순위**: 나의공간 근태 = **P0** (Q1 정의 "근태" 명시 매일 핵심). OK/정정?
- **Q2 팬텀 딥링크 (1순위)**: `/my/attendance` → `/attendance` 링크 교정
  (`useRecentPages.ts:68` + `workHourAlert.ts:214,226`). redirect 라우트 불요(라우트
  부재). OK / 별도 트랙 / 보류?
- **Q3 가디언 동시 교정**: L285 raw 칩 + L296 `bg-red-700` + L324/379 `text-orange-500`
  + L145/154/207/224 무음 catch(특히 clock 실패 toast 0) → 본 batch SSOT·toast 동시
  교정. 휴가 Q5와 동일 묶음. OK?
- **Q4 AT-004/AT-005 (proto만, 저확실)**: 30일 히트맵 + 월간 통계 본 batch 구현
  (status.ts 히트맵 SSOT + 통계 카드) / P2 리포팅 트랙 보류?
- **Q5 AT-005 컴포넌트 트랙**: 월간 통계(5지표) — (A) WdStatStrip 4지표 압축 /
  (B) **`WdGroupedStatCard` 일반화 승격** (휴가 Q6서 보류한 (C), AT-005=2번째 수요) /
  (C) 인라인 1회용 / 보류?
- **Q6 AT-003 시각 결정**: 이번 주 근무 = proto **7일 카드 그리드** 채택(코드 가로
  바차트 폐기) / 코드 바차트 유지 / 보류? (1st principle=proto 충실 → 그리드 제안)
- **Q7 모바일 reflow**: 휴가 M 결정 동일 적용 — 카드 reflow + 상단여백 정정(batch 내),
  사이드바 겹침=별도 트랙(DO NOT TOUCH shell). OK?

---

### 스크린샷 (4컷 + fallback 명시 — "모름은 모름")

| 파일 | 설명 |
|---|---|
| `01-list-default.png` | 출근 전 기본 — 액션카드+이번주 7일 그리드+30일 히트맵+월간통계 |
| `02-action-clocked-in.png` | "출근하기" 클릭 → "근무중" 상태 + 퇴근하기 버튼 |
| `03-clocked-out.png` | "퇴근하기" 클릭 → "아직 출근 전" 복귀 (상태 사이클) |
| `04-mobile-375.png` | 375px reflow |

- **필터/기간 컷 부재 (모름은 모름)**: 프로토타입 AttendanceMyPage·코드
  AttendanceClient 모두 **필터·기간 변경 컨트롤 없음** (휴가의 상태 pill 탭에
  해당하는 것 없음). `03`을 상태 사이클(퇴근 복귀)로 대체.
- **빈 상태 컷 부재**: proto는 주간 mock 고정(빈상태 없음). 코드 빈상태 =
  AttendanceClient L386-388 `weekly===null → <p>noData</p>` 문자열(EmptyState SSOT
  미사용 — §3 가디언). 라이브 캡처는 dev:3002 인증 불안정 → 코드 참조로 텍스트 기록.

### 가디언 위반 발견 (휴가 패턴 재발 + 신규)

| # | 위반 | 위치 | 휴가 대비 |
|---|---|---|---|
| G1 | 무음 catch (clock 실패 toast 0) | AttendanceClient L145·154·207·224 | 재발 + **악화**(낙관 UI 무음 롤백) |
| G2 | raw 색 하드코딩 (`bg-red-700`·`text-orange-500`·`bg-primary/10 text-tertiary`) | L285·296·324·379 | 재발(휴가 L88-93·L542 패턴) |
| G3 | EmptyState SSOT 미사용 | L386-388 | 재발(휴가 동일) |
| G4 | 팬텀 딥링크 404 (`/my/attendance` 라우트 부재) | useRecentPages.ts:68·workHourAlert.ts:214,226 | **신규·악화**(휴가는 실 라우트, 근태는 404) |

### 저확실 항목 (Stage 4 가디언 우선검토)

- **AT-004** 30일 히트맵 — proto만, status.ts 히트맵 SSOT 첫 소비처(의미색 가이드 준수).
- **AT-005** 월간 통계 — proto만, 컴포넌트 트랙 미정(WdGroupedStatCard 일반화 트리거 후보).
- **AT-007/G4** 팬텀 딥링크 — 컴플라이언스 알림(주52시간) 404 = 실사용 영향.
