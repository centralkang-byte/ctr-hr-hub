# PR-3 Description Draft — feat/leave-reskin-ws-d-ws-c (가디언 라운드 2)

> Phase 3a Stage 4 — 나의공간 휴가 reskin + WS-D 가디언 교정 + WS-C IA 통합
> Base `37d412dc` (PR-2 머지 tip) · Branch `feat/leave-reskin-ws-d-ws-c` tip `f96cf765`
> 11 files `+174 / −442` · tsc 0 · lint 0 · 가디언 라운드 2 보강 (G1·G2·G3·G5, 코드 변경 0)
> 라운드 1 G4 = 현행 유지 확정(코드 0, §6 D4 게이트 + §7 N+9 RECORD `fd0d6155`)

---

## §1. Summary

휴가(`/leave`) 페이지를 HR Hub 프로토타입 컨벤션으로 reskin 하고, 디자인 가디언
라운드 1 지적(WS-D)을 동시 교정하며, `/my/leave` IA 이중화를 해소(WS-C)한다.
P0(실 운영 마일스톤 핵심) 트랙.

| 워크스트림 | 내용 | 커밋 |
|---|---|---|
| **A.1 WS-D** | raw `statusBadgeClass` → `StatusBadge` SSOT · 무음 `catch` → toast + 재시도 CTA | `1269bf7a` |
| **A.2 reskin** | page-h(F10a) · F6 잔여\|패턴 grid-2 · 세그먼트 필터+건수 · chip accent · tabular-nums (F11a DataTable 불변) | `eb62eac6` |
| **B WS-C** | `/my/leave` → `/leave` redirect-only · `MyLeaveClient` 폐기 (−363) | `2c9732c0` |
| **C 링크** | 9곳 `/my/leave` → `/leave` 일괄 갱신 (nav·홈·허브·핸들러·route link) | `2c9732c0` |
| **D 드로워** | P1-5 `WdDrawer`/`WdField`/`WdNote` SSOT 이미 충족 — 라벨 델타만 RECORD(N+8) | 코드 0 |
| **E2E** | 5 시나리오 (드로워+배지 / redirect / 잔여 3surface / 가디언 회귀 / 모바일 375px) | `f96cf765` |

백엔드 무변경: prisma / API route 로직 / lib / middleware / RLS / companyFilter 0.
변경 route 2건(`approve|reject`)은 알림 link 문자열만(`/my/leave`→`/leave`).

---

## §2. A — 휴가 페이지 reskin + 가디언 교정 (A.1 WS-D + A.2)

**A.1 WS-D (가디언 라운드 1 교정)**
- `LeaveClient.tsx` L88-93 raw `statusBadgeClass` 4키 맵 **제거** → 상태 컬럼
  `<StatusBadge status={row.status}>` SSOT (status.ts `STATUS_MAP`:
  PENDING→warning / APPROVED→success / REJECTED→error / CANCELLED→neutral).
- `fetchRequests` 무음 `catch {}` → `catch (err)` + `toast(destructive)` +
  `ToastAction` 재시도 CTA. 빈 상태 노출로 stale 방지.
- `handleCancel` 취소 실패 무음 → toast(에러 사유).

**A.2 reskin** (신규 i18n 키 0 — 활성 DO NOT + F1 완전 준수)
- page-h: `title` `t('title')`→`t('request')`("휴가 신청", F10a 재사용), description `t('balance')` 유지.
- F6: 잔여 카드 \| 월별 패턴 = `grid lg:grid-cols-2` 2열 병치 (컴포넌트 내부 불변).
- 세그먼트 필터: raw `bg-foreground text-white` → `role="tablist"` 컨테이너
  `bg-muted/50` + active `bg-card text-primary shadow-sm` (design.md §5.5 Tabs=Segmented).
- 우측 건수 카운터(`pagination.total`), 단위 "건" = PR-2 `WdUsageBarChart` unit 선례 리터럴.
- chip: 정책 배지 `variant="outline"`→`variant="accent"`. 날짜·일수 `tabular-nums`.

---

## §3. B — WS-C `/my/leave` IA 통합

- `/my/leave/page.tsx` = `redirect('/leave')` 전용 (북마크·구 딥링크 보호).
- `MyLeaveClient.tsx` 폐기 (`−363`, 외부 import 0 — page.tsx 한정 검증).
- **C 링크 9곳** `/my/leave`→`/leave` 일괄: `MySpaceClient.tsx`×2 ·
  `EmployeeHomeV2.tsx`×3 · `useRecentPages.ts` · `leave-approved.handler.ts` ·
  `leave-rejected.handler.ts` · `approve|reject/route.ts` 알림 link.
  (`navigation.ts` mySpace.leave 는 이미 `/leave` → 변경 0, DO NOT TOUCH 준수.)
- 정본 = `/leave`(LeaveClient, 기능 상위집합). 딥링크 회귀는 §7 E2E S2 커버.

---

## §4. G1 — P2 색 변형 3축 (색 SSOT 정량 단언)

> CLAUDE.md "P2 토큰통합 트랙 변형" 표준 적용. PR-3 색 변경 = **소비처 raw→SSOT
> 전환만** (globals.css / tailwind.config 0 변경 — 토큰 정의 자체 불변).

### N1 변형 — 색 매핑 표

| 셀렉터 | (나) 기존 raw | (가) 신 SSOT | (다) 영향 파일 |
|---|---|---|---|
| 상태 배지 | `statusBadgeClass`: PENDING `bg-orange-500/10 text-orange-500` / APPROVED `bg-primary/10 text-tertiary` / REJECTED `bg-destructive/5 text-red-500` / CANCELLED `bg-muted text-muted-foreground` | `<StatusBadge>` → badge.tsx variant SSOT (info `text-wt-7` / accent `text-wt-4`, P2a `1956d9e1` 확정, `dark:` 폴백 유지) | `LeaveClient.tsx` 상태 컬럼 |
| 정책 칩 | `<Badge variant="outline">` (border/transparent) | `<Badge variant="accent">` = `text-wt-4` (P2a SSOT) | `LeaveClient.tsx` leaveType 컬럼 |
| 세그먼트 active | `bg-foreground text-white border-foreground` (raw) | `bg-card text-primary shadow-sm` (Phase1 navy `--primary`) | `LeaveClient.tsx` 필터 |
| 세그먼트 컨테이너 | (없음 — flat 버튼) | `bg-muted/50` 트랙 + inactive `text-muted-foreground` | 동일 |

### N2 변형 — 시각 회귀 3축

1. **변경 셀렉터 computed-style → 신 값**: `--wt-4`/`--wt-7`/`--primary` 토큰값은
   PR-3 미변경 → P2a `1956d9e1`에서 라이브 readback 검증된 값 그대로 상속
   (`--wt-1 = 196 100% 20%` = primary 교차검증, F1 swatch 사용자 승인 이력).
   PR-3은 셀렉터를 raw 16진/유틸 → SSOT 변수 참조로 **치환**만 = 신 값 = 기 검증값.
2. **불변 대상 회귀 0**: PR-3 `globals.css` 0 · `tailwind.config.ts` 0 ·
   `badge.tsx`/`status.ts`/`StatusBadge` 0 (전부 P1/P2 기존 자산 재사용).
   타 소비처(employees·analytics 등 StatusBadge 사용처) 영향 0 (정의 불변).
3. **chrome/타이포/레이아웃 PNG**: 환경 차단(플랜모드 + #60 머지로 preview 소멸
   + dev 인증 P2~ 불안정) → **M3 선례**(정량 + 코드구조 근거 갈음, 조작 금지)
   대로 production 페이지 트랙서 자연 확보. PNG 축 = known-deferred(시각 확인).

### known-deferred 사전매핑

- **WdDrawer 다크 lavender** 1건: P1-5 known-deferred 보드 기등재 항목
  (`.dark --primary` 미마이그레이션 근인). PR-3 교집합 = D 드로워 다크 primary
  — **PR-3 신규 격차 아님**, 기존 보드 항목 그대로 승계. 다크 Phase 일괄 해소.

---

## §5. G3 — RECORD 결정 SHA 인용 (§7 N+x SSOT)

> PR-3 사전 diff 가디언 라운드에서 확정된 격차·이연 결정의 추적 SHA.
> 전부 `claude/phase3a-audit` 브랜치 `docs/phase-3a/batch-cards/01-myspace-leave.md §7`.
> 5 distinct 결정 SHA.

| RECORD | 항목 | 가디언 | 결정 SHA |
|---|---|---|---|
| N+1 | LV-002 insight 슬롯 미배선 (i18n-heavy 이연) | F5 m0008 | `7cf51a7a` |
| N+2 | WS-E `leave.balance` ×4 미번역 보정 (F1 트랙) | F1 ✅ | `c8a1501a` |
| N+3 | `fetchUsage` 6개월 윈도 충분성 (백엔드 무변경) | N4 통과 | `c8a1501a` (N+2 합본) |
| N+5 | F8 드로워 "대체자" 백엔드 배선 별도 트랙 (Path B) | F8 m0023 | `aca713a0` |
| N+6 | F10(a) page-h greet-sub 카피 격차 (WS-E/F1) | F10(a) m0028 | `920cbffc` |
| N+7 | F11(a) 이력 테이블 모바일 카드 reflow (DataTable 트랙) | F11(a) m0028 | `920cbffc` |
| N+8 | F12(a) D 드로워 라벨 폴리시 (WS-E/F1 i18n) | F12(a) m0028 | `920cbffc` |
| **N+9** | **F14 수동 tablist keyboard-nav 부재 (별도 a11y 트랙)** | **G4 (ii)+(iii) 현행 유지** | **`fd0d6155`** |

distinct SHA 5건: `7cf51a7a` · `c8a1501a` · `aca713a0` · `920cbffc` · `fd0d6155`.

---

## §6. G2 — D4 게이트 근거 (e2e 시각 회귀 검증 경계)

> 라운드 1 G2 지적 = "D4 시각 회귀를 왜 CI에서 안 돌리나" 근거 명문화.

- **M3 SHA `96d1a514`** ("Phase 3a Stage4 §4 정정3 v2 — PR-1·PR-2 e2e PASS 의미
  갱신: D4 = CI 가드만 / 로컬 시각") = 본 PR의 D4 경계 SSOT.
- **CI / 로컬 분리**: CI e2e(`e2e.yml`)는 `prisma db push --force-reset`
  (정식 마이그레이션 미실행) + MV 의도적 미생성. → **시각 회귀 검증은 CI 무효**.
  CI 역할 = 가드 회귀(가시 에러·콘솔 fatal·라우팅) 검출만. 시각 = 로컬.
- **미실행 사유(시각 축)**: dev 인증 P2~ 환경적 불안정 + #60 머지로 Vercel
  preview 소멸 + 플랜모드. → M3 선례대로 정량 + 코드구조 단언으로 갈음,
  production 페이지 트랙서 자연 확보 (조작 금지 원칙 유지).
- **SSOT 5+ 임계 미달**: D4 게이트 SSOT 표준 = 신규 SSOT 소비처 누적 **5+** 시
  공유 컴포넌트 인프라/별도 트랙 승격. **PR-3 신규 SSOT 소비처 산정**:
  StatusBadge(LeaveClient 상태컬럼 1) + Badge accent variant(1) = 누적 **< 5**
  → 인프라 트랙 미진입, in-scope 수용 정당. (cf. N+9 tablist 누적 = 2/5 동형 미달.)

---

## §7. 검증 & Test Plan

### G5 — 검증 표기 (표준화)

```
tsc app:  0 errors  (11/11 changed files clean)
lint:     0 errors / 0 warnings  (changed files only)
```
(워크트리 tip `f96cf765` 재검증 — 본 라운드 2 코드 변경 0, 표기만 표준화.)

### E2E (`e2e/flows/leave-workflow.spec.ts` — PR-3 5 시나리오)

| # | 시나리오 | 검증 |
|---|---|---|
| S1 | 신청 드로워 열림 + 이력 상태 배지 렌더 | 드로워 + StatusBadge SSOT |
| S2 | `/my/leave` redirect → `/leave` 착지 | WS-C 딥링크 회귀 |
| S3 | 잔여 카드 3 surface 렌더 | WdLeaveBalanceCard |
| S4 | 가디언 회귀 — 필터·에러바운더리·콘솔 | fatal 0 단언 |
| S5 | 모바일 375px 렌더 | reflow 가드 |

### CI 회귀 분석 (PR-2 패턴)

- 기대: PR-2 #60 e2e 14-tail · PR-1 #59 13-tail 동일 known-unrelated
  (이질 seed/시퀀스 + known 2 `evaluation-forms:49`·`onboarding:24`).
  PR-3 변경 surface(leave) green 확인 → tail 무관 확정.
- Vercel preview = #60 머지로 소멸, production 자연 확보(M3 선례).

### 머지 권고

- 사용자 admin-override 머지 (CI tail known-unrelated 확정 후).
- **PR-1 ↔ PR-3 3일 간격 권고** (카나리 → 페이지 적용 안정화 관찰 윈도).

---

## 라운드 2 변경 요약 (가디언용)

| G | 조치 | 코드 |
|---|---|---|
| G1 | §4 P2 색 매핑 표 + 시각 회귀 3축 + WdDrawer known-deferred 사전매핑 | 0 |
| G2 | §6 D4 게이트 근거 별도 섹션 (M3 `96d1a514` + CI/로컬 분리 + SSOT 5+ 미달) | 0 |
| G3 | §5 RECORD SHA 표 — distinct 5건 (`7cf51a7a`/`c8a1501a`/`aca713a0`/`920cbffc`/`fd0d6155`) | 0 |
| G4 | (ii)+(iii) 현행 유지 확정 — 세그먼트 `role="tablist"` 유지, §7 N+9 RECORD | 0 |
| G5 | §7 검증 표기 표준화 (`tsc app: 0 / lint: 0·0`) | 0 |
