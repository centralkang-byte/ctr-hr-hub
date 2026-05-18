# Phase 3a Stage 4 작업계획 (사전 제출) — 나의공간 휴가+근태 묶음

> 입력 SSOT: `docs/phase-3a/batch-cards/01-myspace-leave.md §7` +
> `02-myspace-attendance.md §7` (`4153ce55`). 본 문서 = Stage 4 구현 사전
> 작업계획. **가디언 검토 → 구현 진입 결정** 대상. 아직 구현 0.

## 0. 진입 전제 (Precondition) — ⚠️ 검증 결과

| # | 전제 | 상태 (검증 2026-05-18) | 구현 차단? |
|---|---|---|---|
| 1 | **G4 hotfix #58 머지 → main** | ❌ **PR #58 OPEN, 미머지**. `origin/main` tip=`c73c27a0` 불변. main `workHourAlert.ts` 여전히 `/my/attendance` | **YES — WS-C·전체 구현 차단**. #58 머지·main 반영 확인 전 구현 진입 불가 |

> 본 계획서 *작성*은 비차단(계획≠구현). 구현 진입은 #58 머지 + 가디언 승인 후.
> #58 머지 확인 절차: `gh pr view 58 --json state,mergeCommit` = MERGED →
> `git fetch && git show origin/main:src/lib/attendance/workHourAlert.ts | grep link`
> = `/attendance` 확인.

## 1. Context

Phase 3a = 페이지별 Workday 디자인 적용. Stage 4 = 「나의공간 근태·휴가」 batch
구현(#01+#02 게이트 결정 실행). 1st principle = 프로토타입 충실(위반=교정,
결함=정정 not 복제). 백엔드(prisma/API/RLS)·DO NOT TOUCH 불변.

## 2. 워크스트림 (WS) + 순서

순서 원칙: **공유 SSOT 먼저 → 카나리 1곳 → 확산 → 부수 정리**. 컴포넌트가
페이지보다 선행(휴가·근태 공동 의존).

### WS-A. `WdGroupedStatCard` 신규 SSOT (의존성 #2 — 휴가·근태 공동 선행)

- 베이스: 범용 `WdGroupedStatCard` (그룹 라벨 + N개 지표/진행바 슬롯).
  위치 = `src/components/shared/WdGroupedStatCard.tsx` (WdDrawer 동일 디렉토리 관례).
- 래퍼 2종 (얇은): `WdLeaveBalanceCard`(휴가 잔여·의미색·잔여율 Q7 주입) /
  근태 월간통계 래퍼(AT-005, 5지표). 둘 다 베이스 위 도메인 로직만.
- **PR 분리 결정 (가디언 항목)**: 컴포넌트 자체 = **독립 선행 PR**
  (`feat(design): WdGroupedStatCard SSOT + 2 wrappers`). 근거 = 휴가·근태
  2페이지 공동 의존, 색·N1/N2 회귀 표면 분리. 카나리 = 휴가 `/leave` 1곳
  적용 후 근태 확산 (CLAUDE.md 카나리 표준).
- N2: 컴포넌트 단위 렌더 + 래퍼별 스냅샷. 다크 = known-deferred(WdDrawer 패턴).

### WS-B. `chart.ts` 2번째 소비처 (의존성 #3 — SSOT 2-shot 검증)

- 휴가 LV-002(월별 사용 패턴+인사이트) + 근태 AT-004(30일 히트맵).
- **검증 게이트 (가디언 항목)**: 1-shot 미일반화 `chart.ts` API가 2-shot으로
  처음 압박받는 지점. LV-002=시계열 막대, AT-004=히트맵(의미색) — 이종 2케이스.
  phase-2-closeout §4.2 **시맨틱↔카테고리 혼합배열 가이드 준수** 필수
  (히트맵=status.ts HEATMAP/RISK 의미색, 카테고리 idx만 wt). API가 두 형태를
  무리 없이 수용하는지 = SSOT 안정성 판정. 불수용 시 chart.ts 확장은 **별도
  선행 서브트랙**으로 승격(블라스트 분리, 카드 #01/#02 Q4 재게이트).
- 순서: WS-A 후, 페이지 적용(WS-F) 전 chart 소비 형태 확정.

### WS-C. redirect 라우트 신설 (의존성 #4 — #58 머지 후)

- 휴가 `/my/leave`: 현 실 라우트(MyLeaveClient) → **redirect-only**
  (`redirect('/leave')`), 잔여정보는 홈/허브 인라인(WdLeaveBalanceCard 재사용).
  링크 일괄 `/leave`: `MySpaceClient.tsx:69,164`·`EmployeeHomeV2.tsx:197,256,324`·
  `useRecentPages.ts:69`·`leave-approved|rejected.handler`·`requests/[id]/
  approve|reject/route.ts`.
- 근태 `/my/attendance`: 라우트 부재 → **redirect-only 라우트 신설**
  (북마크 보호). 링크 교정은 **hotfix #58 완료분**(workHourAlert·useRecentPages)
  — 본 WS는 redirect 라우트 신설만. **#58 머지 전 착수 금지**(중복·충돌 방지).
- 별도 작업 묶음(페이지 reskin과 분리 커밋). N2 = 딥링크 6+곳 라우팅 검증.

### WS-D. 가디언 위반 동시 교정 (휴가 Q5 / 근태 Q3)

| 위반 | 위치 | 교정 |
|---|---|---|
| 휴가 raw statusBadgeClass | LeaveClient L88-93 | StatusBadge/status.ts SSOT |
| 휴가 하드코딩 그라데이션 | LeaveClient L542 | Q7 (c) 잔여율 의미색 ≥30%success/10–30%accent/<10%warning |
| 휴가 무음 catch | LeaveClient L313 | toast (rules/error-handling) |
| 휴가 EmptyState 문자열 | DataTable emptyMessage | EmptyState SSOT |
| 근태 raw 색 | AttendanceClient L285·296·324·379 | 토큰/StatusBadge (`bg-red-700`·`text-orange-500` 제거) |
| 근태 EmptyState 문자열 | AttendanceClient L386-388 | EmptyState SSOT |
| **근태 G1 무음 catch (강화)** | AttendanceClient L145·154·207·224 (4지점) | **toast만 불충분 → 낙관 UI 롤백 + 재시도 CTA + 에러사유 표시** 전부 |

### WS-E. i18n 키 정합 (의존성 #5)

- 라벨 시맨틱 재검토: `useRecentPages.ts:41` `'/attendance':'근태 관리'` =
  HR/관리자 톤, 직원 셀프뷰(나의공간) 어색. → 셀프뷰 적정 라벨 검토.
- **제약**: `messages/*.json` 기존 키 편집·삭제 **금지**(DO NOT TOUCH), 신규
  키 추가만. 친근 톤 변환은 `ko.json` 등 한국어만, 타 locale 그대로
  (CLAUDE.md). hotfix #58의 useRecentPages L68 삭제와 정합 확인.

### WS-F. 페이지 reskin (카드 §1~§4 실행)

- 휴가 `/leave`: LV-001(WdGroupedStatCard 래퍼)·LV-002(chart)·LV-003(WdDrawer
  적용됨, 리스킨)·LV-004 이력+pill·LV-005 StatusBadge·LV-006 취소. M 모바일
  `.tbl-as-cards`+상단여백(사이드바겹침=별도트랙). LV-007 별도 트랙(제외).
- 근태 `/attendance`: AT-001 액션카드·AT-002 타이머(유지)·AT-003 **proto 7일
  그리드 채택**(코드 바차트 폐기, ⚠️PR 코멘트 final check 노트)·AT-004 히트맵·
  AT-005 월간통계 래퍼·AT-006 배지. M 모바일 동일.
- 카나리 = 휴가 1곳 → 근태 확산.

## 3. PR 전략

| PR | 범위 | base | 선행 |
|---|---|---|---|
| (이미) #58 | G4 링크 hotfix | main | — (머지 대기) |
| PR-1 | WS-A WdGroupedStatCard SSOT + 2 래퍼 (카나리 휴가 1곳) | main | #58 |
| PR-2 | WS-B chart.ts 2-shot (LV-002+AT-004 형태 확정) | PR-1 | PR-1 |
| PR-3 | WS-F 휴가 `/leave` reskin + WS-D 휴가 가디언 + WS-C 휴가 redirect | PR-2 | PR-1,2 |
| PR-4 | WS-F 근태 `/attendance` reskin + WS-D 근태 가디언(G1강화) + WS-C 근태 redirect | PR-3 | PR-3 |
| PR-5 | WS-E i18n 라벨 정합 | PR-4 | PR-4 |

> 단일 거대 PR 회피(블라스트 분리). chart 2-shot 불안정 시 PR-2를 게이트로
> 후속 중단·재게이트.

## 4. N1/N2 + 검증 게이트 (per PR)

- N1 7레이어: 카드 #01 §4 / #02 §4 판정표 그대로. UI 가(리스킨)·상태 나(교정)·
  API/DB/권한/i18n 가·e2e 가-얕음(심화).
- N2 E2E: 휴가=신청→PENDING→취소(`leave-workflow.spec.ts` 심화) / 근태=출근→
  WORKING→퇴근→COMPLETED + 실패 toast/롤백/재시도 검증(`attendance.spec.ts` 심화)
  / redirect=딥링크 라우팅 / 롤별.
- M3 3축: color(SSOT 토큰)·spacing(휴가 comfortable / 근태 compact+액션 spacious)·
  typography(mono tabular-nums).
- 게이트: tsc 0 · lint 0 errors · Codex Gate2 HIGH 0 · E2E PASS(롤별) ·
  gstack 3구간(라이트 풀+다크 스모크+ctr-* known-deferred) → 커밋·푸시·보고·승인.

## 5. 범위 밖

- LV-007 이력 다운로드(별도 트랙, 휴가 batch 종료 후 단독 카드).
- 사이드바-콘텐츠 겹침(DO NOT TOUCH shell, 별도 트랙).
- 백엔드/prisma/RLS/companyFilter, known-deferred 다크 lavender, MV 트랙.

## 6. 가디언 검토 체크리스트 (사용자 사전 안내 5건 대조)

| # | 의존성 | 본 계획 반영 위치 |
|---|---|---|
| 1 | #58 머지 확정 | §0 (구현 차단 전제, 검증 절차 명시) |
| 2 | WdGroupedStatCard 트랙 (선후·PR분리) | §2 WS-A (독립 선행 PR-1, 카나리 휴가→근태) |
| 3 | chart.ts 2-shot SSOT 안정성 | §2 WS-B (PR-2 게이트, 불안정시 별도 승격) |
| 4 | redirect 라우트 (휴가+근태) | §2 WS-C (PR-3/4, #58 후, 별도 묶음) |
| 5 | i18n 라벨 시맨틱 | §2 WS-E (PR-5, 신규 키만, 기존 키 금지) |

가디언 검토 = 위 5건 + WS-D 가디언 교정(특히 근태 G1 강화) 누락 없음 확인 →
구현 진입(#58 머지 후 PR-1부터) 결정.
