# Design Wave 1 — 급여 run 상세 플로우 (review · approve · publish) 프로토 정합

> **Branch**: `design/wave1-payroll-run-pages` (base: main 923bcfd4)
> **선행**: #150 급여 허브(f3d6b a81) · #152 warm 버튼 전역(923bcfd4) — 둘 다 머지
> **갭 출처**: 워크플로 `wf_92caf581-c3d` (8-agent: proto 패턴 추출 + #150 선례 + 페이지별 audit + 페이지별 적대 검증 — 50갭 검증 통과, 2갭 기각)

## 0. 스코프

| 파일 | LOC | 갭 수 |
|---|---|---|
| `payroll/[runId]/review/PayrollReviewClient.tsx` | 1029 | 22 (+공유 2) |
| `payroll/[runId]/approve/PayrollApproveClient.tsx` | 388 | 14 |
| `payroll/[runId]/publish/PayrollPublishDashboardClient.tsx` | 362 | 12 |
| dead code 삭제: `payroll/PayrollAdjustDialog.tsx`(소비처 0)·`payroll/AnomalyPanel.tsx`(소비처 0) | -278 | 2 |

**Out of scope** (명시 이연):
- `PayStubBreakdown.tsx` 색 정리 — 소비처는 `/payroll/me`(직원 명세서) → my-space/me Wave 1 PR에서
- simulation 페이지(~2.9k LOC) — 전용 프로토 `page-payroll-sim.jsx` 있음 → 별도 PR
- `bg-emerald-600` 잔존 19파일(팬아웃 함정 — 이 PR은 3페이지만), timezone `formatToTz` 전환(클라이언트 24파일 cross-cutting), variantless Button 15건(S282 이연 그대로)
- 비-ko 로케일의 기존 오염 키 값(`工资roll Decision`, `Reject됨`) — 키 편집 금지라 잔존, 새 키로 참조만 이탈

**기능 보존 invariant** (적대 검증이 갭마다 명시 — 구현 중 체크리스트):
anomaly resolve/bulk-resolve·whitelist 등록/해제(DELETE)·비교 테이블(정렬/필터/검색/행클릭)·엑셀 export 3종·submit-for-approval→router.push·approve/reject ConfirmDialog+SoD 단계·publish-status 폴링·notify-unread·mark-paid·이체 이력 토글. **API·로직 무변경, 표면만 전환.**

## 1. 공통 변환 레시피 (#150 선례 = git show f3d6ba81)

1. **KPI → `WdStatStrip`** — 자체 KPI grid 삭제, `items=[{label, value, unit, icon: LucideIcon, tone, foot, onClick?}]`. 수치 displaySm 32/500 tabular-nums. 한국어 단위 '명/건'은 unit prop + i18n.
2. **emerald/amber → D17 시맨틱** — 치환표: `text-emerald-600`(텍스트)→`text-[#006b39]` ink·(아이콘)→`text-tertiary`/STATUS_FG, `bg-emerald-500/15`→`bg-tertiary/10`, `text-amber-500`(텍스트)→`text-ctr-warning`·(아이콘)→`text-wd-orange`, `bg-amber-500/15`→`bg-warning-bright/15`, pill amber→`bg-wd-orange-soft text-wd-orange-ink`.
3. **raw pill → `Badge`/`StatusBadge`** — 도메인 status는 `<StatusBadge status={...}>`(STATUS_MAP 기존 엔트리 커버 확인됨: APPROVED/REJECTED/PENDING/GENERATED…), 수동은 `<Badge variant>`. i18n 라벨은 children으로.
4. **raw button → `Button`/`BUTTON_VARIANTS`** — 주 액션 emerald fill 2곳(review 승인 요청, approve 승인) = **warm 전환**(P0; 프로토 `.btn-primary` 6개소 실측·`.btn-success` 0건·#152 KEEP allowlist 비해당 검증됨). 반려 = `variant=destructive`(모달 확정)/outline(트리거). 보조 = outline(border-strong).
5. **hand-rolled 모달 → 컨테이너 결정표(§5.4)** — whitelist 사유 입력 = **WdDrawer**(modal→drawer 인벤토리 방식, closeDisabled·hidden submit·WdField htmlFor·실패 토스트 4종 보존 레시피). 승인요청 confirm+메모·반려 confirm = **shadcn Dialog**(중앙 유지 — confirm류; 수제 MODAL_STYLES → Radix로 focus trap/ESC/aria 확보).
6. **typography** — h1 `text-2xl font-bold tracking-[-0.02em]` → `TYPOGRAPHY.pageTitle`(26/600/-0.015em), 섹션 → sectionTitle/cardTitle.
7. **i18n** — mojibake 키 38회(review 26 + approve 12) → 새 가독 키 additive(reviewPage.*/approvePage.* 5로케일 ko·en·zh·vi·es), 구 키 잔존(삭제 FORBIDDEN). 검증 `npx tsx scripts/validate-i18n-keys.ts`. 보너스 수정: L822 '급여월' 키가 급여대장 export 라벨로 오용→올바른 새 키, L256 placeholder 리터럴 노출→기존 common 키 t() 호출(P0).
8. **loading** — 스피너 → PageSkeleton 계열 (rules/components.md 3-상태).

## 2. 페이지별 핵심 (공통 레시피 외)

### review (22갭)
- **P0 좌측 색 보더 카드 제거** — SEVERITY_CONFIG `border-l-4 border-{red,amber,blue}-*` = 명시 금지 AI slop. 심각도 = 아이콘 틴트 + Badge variant(error/warning/info).
- **탭 → Segmented Control**(rules/design.md 'NO border-b') + Radix Tabs role/키보드. 동적 `font-${...}` 클래스 결합(JIT 비추출 버그) 자연 해소. count 배지·lazy fetch 보존.
- **직원 상세 사이드패널** — hand-rolled overlay(w-80, focus trap 없음) → DetailPanel/Inspector 패턴(§5.4 조회=Inspector). **도달 불가 detail 분기(L323-390, 항상 `detail={null}`) 삭제** — 이모지 P2·죽은 emerald 3곳 자동 소멸.
- 비교 탭 3-KPI는 **WdStatusChips**(패턴 B — 같은 페이지 strip 중복 회피, DESIGN_RULES §3 '중복 헤비' 신호).
- EmptyState 아이콘 중복 렌더 교정(icon prop으로 통합).

### approve (14갭)
- **ApprovalProgressBar → 프로토 `.wd-stepper` 정합 재작성**(in-page 유지, shared 승격은 후속): 44px dot — done=`bg-tertiary`(success) solid+white Check, current=`bg-primary`(accent) solid+`0 0 0 6px` soft 헤일로(amber ring 폐기), future=bg-sunk+2px border; ChevronRight → 2px 수평 커넥터(done=success). lbl 12.5/600·when mono 10.5. styles.css:2646-2705 실측 스펙.
- KPI 4장(3실수치+1불리언) = WdStatStrip + tone으로 흡수(경계 사례 — Pixel Gate에서 칩 분리 여부 최종 판정).
- 반려 textarea focus ring `red-600` → destructive 토큰. fmtDate 복붙 2곳 → 파일 내 1헬퍼(timezone 전환은 비대상 — 검증자 판정).
- HR 메모 카드 `bg-background rounded-xl` → CARD_STYLES.padded(동일 페이지 표면 통일).

### publish (12갭)
- **P0 진행바 그라데이션 제거** — `bg-gradient-to-r from-primary to-primary-dim` → 프로토 flat: track `bg-muted` h-2 rounded + fill solid `bg-primary` + `role=progressbar`/aria-valuenow (in-house 선례 WdGroupedStatCard:103-117).
- mark-paid pill 버튼 → `Button`(8px flat radius — pill은 badge 전용; min-h-44는 비-Tier1이라 드롭 가능).
- 이체 이력 raw enum 노출(`{b.status}`) → StatusBadge + t() children.
- icon-only 버튼 2곳 aria-label + `Button variant=ghost size=icon`.

## 3. 검증 게이트

1. `npx tsc --noEmit` 0 · `npm run lint` 신규 0 · `npm run build`
2. `npx tsx scripts/validate-i18n-keys.ts` (5로케일 roundtrip)
3. e2e: 기존 payroll spec 풀그린 + 추가 가드(whitelist 드로어 open→cancel — 공유시드 무오염 주석; review/approve/publish 페이지 로드 가드 기존 spec 확인 후 부족분만)
4. **Pixel Gate** — 주의: 프로토에 review/approve/publish 1:1 페이지 없음 → **패턴 단위 대조**로 수행·기록 (stepper=page-perf-cycle.jsx 렌더, stat-strip/chips/배너=허브·DESIGN_RULES §3, 의도된 편차 번호 목록 PR 기록). hr@ + 모바일 375px.
5. UI QA 멀티롤: hr@(REVIEW run 리뷰→제출) + executive@(승인 2단계 — S270 dogfood 동선 회귀)
6. visual 베이스라인: `[runId]` 동적 라우트가 visual spec에 있는지 확인 → 있으면 해당 장만, 없으면 갱신 0 (전수 재생성 금지 — #152가 이미 수행)
7. Codex Gate 2

## 4. Codex Gate 1 findings (Request Changes → 전건 반영)

| # | 심각도 | 지적 | 반영 |
|---|---|---|---|
| 1 | P1 | publish-status "폴링"은 실재하지 않음(원샷 fetch) — invariant 과서술 | invariant를 "publish-status 1회 조회 + 수동 재조회" 로 정정. 폴링 신설은 비대상 (로직 PR) |
| 2 | P1 | approve KPI 4번째가 boolean(`allAnomaliesResolved`) — 패턴 A "실수치 4개" 계약 위반, Pixel Gate로 미루지 말 것 | **확정: approve는 패턴 B `WdStatusChips`** — 실수치 3개(인원·실지급액·조정) 칩 + 이상해결 상태 칩(tone success/warning). WdStatStrip 비사용 |
| 3 | P1 | SoD 2단계(HR step1→EXEC step2) 완주 e2e 부재 | 기존 커버리지 실측: `e2e/api/payroll-approval-exports.spec.ts`가 submit→PENDING·approve 단계 처리·reject·재제출·approval-status·EXECUTIVE carve-out·RBAC(EMPLOYEE/MANAGER 403) 커버. 2단계 연속 완주는 **멀티롤 수동 QA**(hr@ 제출→step1, executive@ step2 — S270 dogfood 동선 재현)로 수행·PR 기록. 공유시드 쓰기 e2e 신설은 S281 오염 교훈상 비대상 |
| 4 | P1 | review `resolve()`가 에러 삼킴 → whitelist 실패에도 모달 닫힘 | 드로어 전환 시 교정: **성공 시에만 닫기** + 실패 destructive 토스트 + 입력 보존 (error-handling 규칙 정합, #150 빈 catch 교정 선례) |
| 5 | P2 | Tabs 전환 검증 미흡 | 검증 체크리스트 추가: 키보드 이동·aria-label·whitelist 탭 lazy fetch 1회·탭 전환 후 검색/필터 상태 보존 |
| 6 | P2 | 기존 payroll e2e가 [runId] 상세 라우트 미커버 | 읽기 전용 UI 가드 추가: 3페이지 로드 + export 드롭다운 open + reject Dialog open→cancel + whitelist 드로어 open→cancel + 이체 이력 토글 (공유시드 무쓰기) |
| 7 | P2 | PayrollAdjustDialog 삭제 시 인벤토리 문서 stale | `docs/plans/active/2026-06-10-modal-to-drawer-migration.md` #19 항목을 "dead code 삭제됨"으로 갱신 동봉 |

추가 기록: 승인 버튼 warm 전환·dead branch 삭제는 Codex 승인 (detail={null} 고정 호출 grep 근거 PR에 기록).

## 5. 검증 기록 (2026-06-11)

| Check | Result | Remarks |
|---|---|---|
| tsc --noEmit | ✅ 0 | |
| lint | ✅ | 변경 3파일 경고 6=6 (main 동수 — useCallback 't' 기존 클래스) |
| build | ✅ | |
| i18n roundtrip | ✅ PASS | 신규 55키 × 5로케일 append (단일 소유자), 5216 unique keys |
| prisma migrate status | ⚠ 기존 드리프트 | `20260420000000_sync_soft_delete_drift` 미적용 — 이 PR 무관(스키마 무변경), #147 트랙 클래스 |
| e2e flows/payroll | ✅ 15 pass / 1 skip(조건부) | [runId] 3페이지 가드 신설 — Radix tab role·progressbar a11y·드로어 open→cancel |
| Codex Gate 2 | ✅ GO | "새로 도입된 명확한 기능 오류 없음" |
| 멀티롤 | ✅ | hr@(3페이지) · executive@(approve carve-out 렌더) · super@(API 404→스켈레톤 = 기존 동작, fetch 무변경) · employee-a@(/home 리다이렉트 = 미들웨어 보존) |
| 모바일 375px | ✅ | review/approve 1열 reflow |
| visual 베이스라인 | ✅ 갱신 0장 | [runId] 동적 라우트는 visual spec 미커버 실측 |

**Pixel Gate (패턴 단위 — 프로토에 1:1 페이지 없음, §3-4 선언대로)**:
- 근거 3중: ① styles.css 라인 단위 스펙 적대 검증(stepper 2646-2705 · progress 4753-4770/1274-1278 · chip 1259-1264 · page-h 1129-1135) ② 구현 스크린샷의 수치 일치(44px solid dot·white check·2px 커넥터·mono when·flat 진행바·displaySm 32px) ③ 공용 컴포넌트(WdStatStrip/Badge/WdDrawer)는 #150 Pixel Gate 통과본 재사용(재구현 0)
- **의도된 편차**: ① 스테퍼 REJECTED dot(solid destructive+X) = 프로토 미정의 상태의 시맨틱 확장 ② 헤더 상태 배지 스케일 raw pill(text-sm)→Badge 표준(11px) 축소 = 프로토 .chip 정합 ③ approve 패턴 B 칩을 헤더 직하 배치(기존 stepper 아래 4카드와 위치 상이) ④ max-w(-3xl/4xl) 중앙 정렬 = 결재/발행 단일 문서 성격 유지

**기존 결함 발견(이 PR 비대상, 기록)**: SUPER가 타법인 run by-id 접근 시 `/api/v1/payroll/runs/[id]` 404 → 페이지 무한 스켈레톤+토스트 (백엔드 스코프 — 회사 컨텍스트 전환으로 우회 가능, UI fetch 무변경)
