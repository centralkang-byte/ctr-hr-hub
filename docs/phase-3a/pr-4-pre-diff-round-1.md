# PR-4 사전 diff 라운드 1 — WdMonthlyStatCard 근태 카나리 (AT-005)

> Phase 3a Stage 5. PR-3 `b0d9b884` 동형 7섹션 + P2 3축 + D4 게이트 근거.
> PR-4 워크트리 `feat/at005-monthly-stat-canary` tip `b85f91d2` (미push,
> E.1 e2e 5 시나리오 추가).
> 동결: main `1260a95f` / PR-3 `f96cf765` / phase3a-audit `e27b3fd1`(→ E.3 확장)
> / PR-4 `b85f91d2` (불변).
> 코드 사이클 A·B'·B0·B1·B2·C·D 전수 PASS (가디언 m0061) + **E.1 e2e
> `b85f91d2`** + **E.2 시각 검증 PASS (가디언 m0067)** + **E.3 docs 보강
> (본 라운드 1 합본)**.

---

## §1. 워크트리 commit history

- base `1260a95f` (main, PR-3 #61 머지 tip) off
- A `d9526365` — WdMonthlyStatCard 래퍼 신설
- B1 `2ed7f747` — monthly-aggregate helper + vitest 12
- B2 `fb1791b1` — AttendanceClient 마운트
- C `cc726e61` — JSDoc @remarks 보강 (F23, 로직 0)
- 누적 **4 files +326/−2** (monthly API route 부재)
- 추가 RECORD (`claude/phase3a-audit` 별 트랙):
  - B' N+12 `1b057505` (F21 신규 워크트리 prisma generate 2-step)
  - B0 N+13 `0bf1940a` (F22 AT-005 case iii + monthly API 갭)

## §2. A/B0/B1/B2/C/D surface 요약

| 단계 | 내용 |
|---|---|
| A | `src/components/shared/WdMonthlyStatCard.tsx` 래퍼 신설. WdGroupedStatCard 베이스 소비, 5지표 props, F15/F16/F17 가드, F17 계약 JSDoc 명시 |
| B0 | 가디언 m0051 case (iii)+F18 갭 판정 → (A) 클라 집계 + helper 순수함수 + AttendanceClient 마운트 + F22 §7 N+13 RECORD |
| B1 | `src/lib/attendance/monthly-aggregate.ts` 순수 helper (tz 분단위 산술평균, formatToTz SSOT, countLate 분리 export) + vitest 12 케이스 |
| B2 | `AttendanceClient.tsx` 마운트 (+34/−2, 기존 `fetchMonthly` 재사용=중복 fetch 회피, AT-004 `setMonthlyCells` byte-identical, proto 시각순) |
| C | JSDoc 1-line @remarks (자정 wrap 무가정, F23 in-code 문서화), 로직 0 |
| D | N2 audit read-only (9 surface 전수 ∅, F20 종결 정량, 코드 0) |

## §3. 프로토 SSOT 토큰 + API 매핑

`_design-reference/page-my-space.jsx:153-172` ↔ `aggregateMonthlyStats`:

| 지표 | proto | API source | 변환 | valueTone (F16) | i18n (F15) |
|---|---|---|---|---|---|
| ① 근무일 | 근무일 | `summary.workedDays` | 직접 | neutral | `t('workDate')` ✅ |
| ② 출근 평균 | 출근 평균 | `days[].clockIn` | tz분평균 | success | `t('clockInTime')` (갭 F1) |
| ③ 퇴근 평균 | 퇴근 평균 | `days[].clockOut` | tz분평균 | accent | `t('clockOutTime')` (갭 F1) |
| ④ 초과근무 누계 | 초과근무 | `summary.totalOvertimeMinutes` | ÷60 소수1 | accent (violet≈wt-4) | `t('typeOvertime')` (갭 F1) |
| ⑤ 지각 | 지각 | `days[].status==='LATE'` | `countLate` | warning (amber≈ctr-warning) | `t('lateCount')` ✅ |

신규 토큰 0 / 신규 키 0 / status·chart SSOT 확장 0. 컨테이너 = `bg-card`(베이스).

## §4. 단위 테스트 + e2e 회귀 노트

- 단위: `tests/unit/attendance/monthly-aggregate.test.ts` vitest **12 케이스** —
  (a)정상5지표 (b)일부null (c)전부null (d)overtime÷60소수 (e)LATE카운트.
  회귀 0 (B1·B2·C·D 전수 12/12 유지)
- e2e: PR-4 surface 신규 마운트 + AT-004 byte-identical → PR-3
  `leave-workflow.spec.ts` 회귀 0 (D 정량).
- **E.1 신규 e2e 5 시나리오** (PR-4 워크트리 `b85f91d2`):
  - 파일 `e2e/flows/attendance-monthly-stats.spec.ts` **+75 lines** (단일 spec)
  - S1: AT-005 5지표 마운트 (`region` role + 5 라벨 regex visible)
  - S2: 빈 표현 정합 (StatRow OR EmptyState `--:--` / 데이터행, seed 비의존)
  - S3: AT-004 히트그리드 회귀 0 (`WdStatusHeatGrid` + `WdMonthlyStatCard` 공존 proto 순서)
  - S4: 가디언 회귀 0 (에러바운더리 + 치명 콘솔 단언 + Vercel `speed-insights`/`vercel-scripts` 제외)
  - S5: 모바일 375×812 reflow (overflow 0, rows 5)
  - 비-flaky 구조 단언 (PR-3 `leave-workflow.spec.ts` 동형 패턴)
  - Playwright `--list` 정합 (파싱 0 에러, S1–S5 5건 등록)
- D4 게이트 구조: CI=가드(prod build·tsc·lint·spec·vitest·**PR-4 e2e**) / 로컬=
  컴포넌트 N2 spec.
- **D4 보강 — 옵션 (i) 채택** (E.2 시각 검증 합본):
  - M3 SHA `96d1a514` 선례 + 옵션 (i) 채택 (PR-4 = 신규 마운트 surface =
    라이트 baseline 첫 정량 확인 가치)
  - 로컬 시각 검증 = E.2 실측 (N+12 dev 스캐폴딩 활용, 라이트/다크/모바일/LV-001 회귀)
  - 결과 §6 검증 합본 (회귀 0 정량)

## §5. 후속 트랙 SHA

- §7 N+12 `1b057505` (F21 prisma generate 2-step 스캐폴딩 보강)
- §7 N+13 `0bf1940a` (F22 AT-005 case iii + monthly API 갭, 카나리 자연확장)
- PR-3 후속(N+5~N+11) = PR-4 무관, 인용 없음
- 라운드 1 본문 등록 SHA = `e27b3fd1` (`claude/phase3a-audit`)
- **E.1 e2e 5 시나리오 SHA** = `b85f91d2` (`feat/at005-monthly-stat-canary`,
  PR-4 워크트리, 미push)
- **E.3 보강 commit SHA** = 본 보강 등록 시점 자체 갱신 (`claude/phase3a-audit`,
  base `e27b3fd1` 확장, docs only)

## §6. 검증 결과

```
tsc app:  0 errors  (PR-4 4 changed files clean + e2e +1 = 5 total)
lint:     0 errors / 0 warnings  (changed files only)
vitest:   12/12 pass  (회귀 0)
```

| 검증 | 결과 |
|---|---|
| tsc app | 0 errors (PR-4 4 changed files clean, e2e +1 = 5 total) |
| lint | 0 errors / 0 warnings (변경 파일 한정) |
| vitest | 12/12 pass (회귀 0) |
| F18 정량 충족 | monthly API route `git diff 1260a95f..cc726e61 -- src/app/api/v1/attendance/**` = **∅** + 스키마 변경 0 + 호출 재사용 |
| F20 종결 정량 | WdGroupedStatCard 베이스 + WdLeaveBalanceCard + leave surface 등 **9 surface 전수 ∅** (D N2 audit) |
| **E.1 e2e PR-4** | 5 시나리오 작성 (`b85f91d2`, +75 lines) + Playwright `--list` 정합 (S1–S5 5건) |
| **E.2 시각 라이트** | 5지표 valueTone rgb 정량 (neutral / success / accent / accent / warning) |
| **E.2 시각 다크** | `textPrimaryEls=0` (N+10 lavender 미합류, F19 강화) |
| **E.2 시각 모바일 375px** | overflow 0, rows 5 reflow 정합 |
| **E.2 LV-001 시각 회귀** | N+10 rgb 전수 동일 (회귀 0, D N2 audit + 시각 시그널 누적) |

- 동결 SHA 무손실 (`1260a95f`/`f96cf765`/`e27b3fd1`/`b85f91d2`)

## §7. F-건 + DO NOT + P2 3축 + D4 게이트

### F-건 (F15~F23 전수 (a) 판정)

| F | 판정 | RECORD |
|---|---|---|
| F15 i18n | (a) 기존 키 재사용 + 갭 F1 위임 (N+6 동형) | — |
| F16 violet/amber→wt | (a) valueTone 4토큰 최근접-hue, swatch 0 | — |
| F17 timezone | (a) 래퍼 미포맷 + helper formatToTz SSOT | — |
| F18 monthly API | (a) 클라 집계 (m0051), route 변경 0 정량 | N+13 |
| F19 다크 known-deferred | (a) N+10 **미합류** 정밀화 — `textPrimaryEls=0` 정량 확정 (E.2.2 측정), PR-5+ 진입 가드 자산 | N+10 |
| F20 베이스 회귀 | (a) 종결 확정 = git ∅ (D N2 9 surface) + 시각 (E.2.4 LV-001 N+10 rgb 전수 동일) **이중 시그널 누적** | — |
| F21 prisma generate | (a) 2-step 스캐폴딩 가드 | N+12 |
| F22 case iii + API 갭 | (a) 카나리 자연 확장 + helper 분리 | N+13 |
| F23 자정 wrap | (관찰) in-code @remarks (C 보강) | — (관찰) |

### DO NOT 준수 (10건 전수 ✅)

WdGroupedStatCard 베이스 불가침(F20) / status·chart SSOT 확장 0 /
근태 백엔드·clock·G1 강화 불가침 / 다크 N+10 미터치 / 신규 i18n 0(F15) /
timezone SSOT 우회 0(F17) / monthly API 변경 0(F18) / proto 토큰 위반 0 /
self-merge 금지(push 0 + PR open 0) / 동결 SHA 변경 0 — 전수 ✅.

### P2 변형 3축 (PR-3 G1 동형)

- **색 매핑 표**: 5지표 valueTone = neutral/success/accent/accent/warning ·
  컨테이너 `bg-card`(베이스) · 신규 토큰 0 · status·chart SSOT 확장 0
- **시각 회귀 3축** (E.2 실측 합본):
  - **light 정량** (E.2.1): 5지표 valueTone rgb 측정 = neutral/success/
    accent/accent/warning 정합 (proto SSOT 일치)
  - **mobile 375px 정량** (E.2.3): overflow 0, rows 5 reflow 정합
  - **다크 known-deferred 이월** (E.2.2): `textPrimaryEls=0` =
    **N+10 미합류** = Phase 4 다크 트랙 PR-4 surface 무관 명시
- **known-deferred 사전매핑**: handover §7 4항목 중 PR-4 교집합 =
  WdMonthlyStatCard `text/bg-primary` 직접의존 **0**(컨테이너 bg-card·지표
  valueTone) → 다크 노출 표면 최소, N+10 미합류 정합. 나머지 3(WdDrawer·
  Inspector·BulkActionBar) = PR-4 surface 외, 무관 명시

### F19 다크 미합류 — 긍정 발견 (PR-5+ 카나리 진입 가드 자산)

E.2.2 측정 결과 PR-4 AT-005 surface 다크 `textPrimaryEls=0` 정량 확정:

- **PR-3 세그먼트 합류 패턴 대비 우수**: PR-3 `_design-reference` lavender
  합류 surface 대비 PR-4 = lavender 노출 표면 0
- **Phase 4 다크 트랙 무관 정합**: N+10 미합류 = 다크 known-deferred 트랙
  진입 시 PR-4 무관 surface 명시
- **PR-5+ 진입 가드 권장 패턴**: `text-primary` / `bg-primary` 직접 의존
  회피 (컨테이너 `bg-card` 베이스 + valueTone 토큰 매핑). 본 라운드 RECORD
  신설 가드 (§7 본문 명시 + 사전 diff 라운드 2 자료)

### D4 게이트 근거 (PR-3 G2 동형 + 옵션 (i) 채택)

- CI = 가드 (prod build / tsc / lint / spec 정합 / vitest 단위 / **PR-4 e2e
  `attendance-monthly-stats`**)
- 로컬 = 컴포넌트 N2 spec (M3 SHA `96d1a514` 선례, CI=가드만/로컬=시각)
- **옵션 (i) 채택** (E.2 시각 검증 실측 합본):
  - PR-4 = 신규 마운트 surface = 라이트 baseline **첫 정량 확인 가치**
    (M3 선례 + N+12 dev 스캐폴딩 활용)
  - 시각 결과 §6 합본 (라이트 5지표 rgb / 다크 `textPrimaryEls=0` / 모바일
    375px overflow 0·rows 5 / LV-001 N+10 rgb 회귀 0)
  - 다크 known-deferred 이월 = Phase 4 다크 트랙 PR-4 surface 무관 정합
- **SSOT 5+ 임계**: 현 PR-4 SSOT 누적 = status.ts · chart.ts ·
  timezone.ts · WdGroupedStatCard 베이스 · 신규 monthly-aggregate 도메인
  helper = **5건 (임계 도달)** → 인프라 재평가 의제 = §7 RECORD 후보
  (가디언 판정 — 본 라운드 RECORD 신설 가드, 의제 flag만)

---

## 라운드 1 요약 (가디언 판정 요청)

| 항목 | 결과 |
|---|---|
| 코드 사이클 | A·B'·B0·B1·B2·C·D 전수 PASS, 4 files +326/−2 |
| 검증 | tsc 0 · lint 0 · vitest 12/12 · F18 route ∅ · F20 9-surface ∅ |
| F-건 | F15~F23 전수 (a) 판정, F20 종결(이중 시그널), F23 in-code 문서화 |
| DO NOT | 10건 전수 ✅ |
| P2 3축 / D4 | 색매핑·3축(light/mobile 정량·다크 known-deferred 이월)·known-deferred 매핑 / D4 CI=가드(+e2e)·로컬 옵션(i) 채택 |
| **E.1 e2e** | 5 시나리오 (`b85f91d2`, +75) — S1 마운트 / S2 빈표현 / S3 AT-004 회귀 / S4 가디언 / S5 모바일 |
| **E.2 시각 검증** | 라이트 5지표 rgb + 다크 `textPrimaryEls=0` (F19 강화) + 모바일 375px overflow 0·rows 5 + LV-001 N+10 rgb 회귀 0 |
| **E.3 보강** | §4 (e2e 5 + D4 옵션 i) / §6 (시각 4축 표) / §7 (F19/F20 정밀화 + P2 3축 정량 + F19 긍정 발견) / §5 (SHA 갱신) |
| 미결 의제 | ① ~~옵션(i) 시각 검증 채택 여부~~ → **E.2 채택·합본 완료** ② SSOT 5+ 임계 인프라 재평가 RECORD ③ ~~PR-4 e2e 시나리오 작성 시점~~ → **E.1 작성 완료(`b85f91d2`)** ④ PR-4 머지 3일 권고(PR-3 #61 2026-05-19→2026-05-22+) |

**가디언 판정 요청**: ① 라운드 1 PASS 여부 (E.1+E.2+E.3 합본 후) ② 라운드 2(Codex Gate 1) vs origin push+PR open 진입 ③ SSOT 5+ 인프라 재평가 RECORD ④ PR-4 머지 타이밍 (3일 권고).
