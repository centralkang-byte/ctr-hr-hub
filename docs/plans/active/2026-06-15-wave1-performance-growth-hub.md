# Wave 1 IA — Performance 클러스터 PR-1: 평가/성장 허브 (self-service demotion)

> 브랜치: `feat/wave1-performance-growth-hub` (← origin/main, 비스택)
> Wave 1 IA/백엔드 정합 트랙. performance/payroll 클러스터의 첫 bounded PR.
> 디자인 레이어(토큰/SSOT/a11y)는 #171에서 이미 랜딩 — 이 PR은 **IA 데모션 허브배선**.

## CEO 결정 (2026-06-15 게이트)
1. **첫 슬라이스 = 평가/성장 허브 (self)** — CC 추천 채택 (헤드라인·프로토 1:1·bounded).
2. **nav.ts = 이번 PR서 격리 커밋** (relabel + 데모션). frozen 파일이라 단일 커밋 + 멀티롤 도그푸드.

## 목표 (프로토 정합)
`_design-reference/page-wrappers.jsx` `PerfGrowthWrapper` 정합:
- 통합 헤더 "평가 / 성장" + 부제 + KPI 스트립 + 탭별 액션 버튼
- 3탭: **목표**(MyGoalsClient) / **분기 리뷰**(MyQuarterlyReviewClient) / **자기평가**(MySkillsClient)
- 자식 페이지의 자체 page 헤더/패딩 흡수 (proto `InlineNoPageH`) → 중복 헤더 제거

## 불변식 (campaign 기본)
- **백엔드/API/Prisma/RLS/middleware 무수정** (이 PR은 프론트 배선 + nav). 신규 API 0.
- **i18n add-only** — 기존 키 편집/삭제 0. 신규 키만 5 locale.
- 동결 파일: `Sidebar.tsx`/`MobileDrawer.tsx` 무수정 (data-driven). `navigation.ts`만 CEO 승인 격리 커밋.
- `src/components/ui/*` shadcn 베이스 무수정.

## 데모션 매핑 (현재 → 목표)
| 현재 rail (나의 공간/성장) | href | 조치 |
|---|---|---|
| `my-goals` "목표/평가" | `/performance` | **relabel→"평가/성장"·repoint→`/performance/growth`** (허브) |
| `my-quarterly-review` "분기 리뷰" | `/performance/my-quarterly-review` | **rail 제거** (허브 탭으로) |
| `my-skills` "역량 자기평가" | `/my/skills` | **rail 제거** (허브 탭으로) |

- 루트는 전부 **존속**(직접 URL·딥링크 유효). rail에서만 내림 → 고아 0 (허브가 노출).
- `/my/skills`는 `organization/skill-matrix`·`team/skills`의 redirect 타깃 → **루트 보존 필수** (확인됨).
- `/performance/my-quarterly-review` 딥링크: `MyCheckinsClient:103`·`EmployeeHomeV2:191,270` → 루트 보존이라 무손상 (허브 `?tab=review`로 리포인트는 scope-out, 별 퀵윈).

## In-scope (파일)
### A. 신규 허브 (2)
- `src/app/(dashboard)/performance/growth/page.tsx` (server) — 세션 가드 + **스킬 서버데이터 로드**(공유 헬퍼) → `PerfGrowthHubClient`.
- `src/app/(dashboard)/performance/growth/PerfGrowthHubClient.tsx` (client) — 헤더+KPI+탭별 액션 + shadcn `<Tabs>`(`?tab=` URL 동기화, 기본 `goals`) + 3 자식 `embedded` 렌더.

### B. 공유 헬퍼 추출 (1, drift 차단)
- `src/lib/skills/load-my-skills.ts` — `loadMySkillsData(user)` (competencies+requirementMap+grade). `/my/skills/page.tsx`와 허브 page.tsx가 공유 (중복 prisma 쿼리 제거). `/my/skills/page.tsx`는 이 헬퍼 호출로 치환 (동작 무변경).

### C. 자식 `embedded` prop (3, additive)
- MyGoalsClient·MyQuarterlyReviewClient·MySkillsClient에 `embedded?: boolean` (기본 false=기존 standalone 무변경).
  - `embedded=true`: ① 페이지 레벨 컨테이너(`min-h-screen bg-muted p-6`·`p-6`·`max-w-4xl`) 중립화 ② 타이틀 블록(`<h1>`+부제) 숨김 ③ 기능 컨트롤(사이클/연도/기간 select)은 **유지**.

### D. KPI 스트립 (정직성 — 실데이터만)
- 허브가 기존 GET 재사용으로 라이트 페치: **현재 사이클명**(cycles API) + **자기평가 D-day**(cycle.evalDeadline) + **진행중 목표 수**(goals API status=IN_PROGRESS count).
- 데이터 없는 칩은 **렌더 생략**(가짜 숫자 0). D-day는 날짜부 로컬자정 고정(recruitment #191 D-day 선례 — UTC off-by-one 회피).
- 신규 엔드포인트 0 (기존 cycles·goals GET만). 목표 페치 중복(자식도 페치)은 카운트만이라 경량 — Codex 판단.

### E. nav.ts (격리 단일 커밋)
- `my-goals`: `labelKey: 'nav.mySpace.growthHub'`·`label: '평가/성장'`·`href: '/performance/growth'` (key 'my-goals' 보존).
- `my-quarterly-review`·`my-skills` 엔트리 **제거**.
- Sidebar/MobileDrawer 무수정 (data-driven 확인).
- `useFavorites.ts` `DEPRECATED_NAV_KEYS`에 `my-quarterly-review`·`my-skills` 추가 (즐겨찾기 유령 슬롯 정리, P2).

### F. i18n (add-only, 5 locale)
- `nav.mySpace.growthHub` = "평가/성장" (기존 `nav.mySpace.goals`="목표/평가"는 잔존, 편집 금지).
- `performance.growth.*`: title·subtitle·tab(goals/review/skills)·kpi(cycle/selfEvalDday)·라벨.

### G. 테스트
- vitest: D-day 순수 헬퍼(회사 tz·DST 경계) + `pickCurrentCycle` + `loadMySkillsData` shape + i18n 5-locale 키셋 parity.
- e2e: 허브 3탭 렌더·탭 전환·`?tab=` 딥링크·**자기평가 입력 후 탭 왕복 시 상태 보존**·데모션 루트 직접 URL 200·standalone 페이지 비회귀·rail에서 분기리뷰/스킬 제거 확인(멀티롤).

---

## Codex Gate 1 반영 (P0 0 · P1 8 · P2 3 — 2026-06-15)

**P1-1 KPI API 계약 정정 (코드 확인)**: cycle 필드=`evalEnd`(≠evalDeadline). goals API는 `cycleId` 필수·status 필터 無. `GoalStatus`에 `IN_PROGRESS` 없음(DRAFT/PENDING_APPROVAL/APPROVED/REJECTED). → **KPI 스트립 축소**: 진행중-목표 칩 **삭제**(double-fetch+모호 의미 회피). 칩 2개만 = **현재 사이클명 + 자기평가 D-day**(둘 다 단일 cycle 객체서). 데이터 없으면 칩 생략.
**P1-2 "현재 사이클" 선택 규칙**: 순수 헬퍼 `pickCurrentCycle(cycles, now)` — eval 윈도우 open(evalStart≤now≤evalEnd) > active > 최신순 fallback. DRAFT/종료 cycle 오선택 차단.
**P1-3 스킬 헬퍼 잠복버그 동반수정**: 현 `/my/skills` page는 primary assignment 無→`jobLevelCode: undefined`→**전 등급 요건 과조회**, company/global 중복 시 `Object.fromEntries` 순서의존. `loadMySkillsData`로 추출하며 **수정**: 무배정→`jobLevelCode: null`만, **company가 global 덮어쓰기** 명시, employee 조회 `id+companyId` 방어. ⚠ `/my/skills` 표시 변화 동반(S300/S311 선례=노출된 백엔드 갭 동일 PR 수정). PR 본문 명시.
**P1-4 탭 마운트 정책**: 기본 Radix `TabsContent`는 비활성 시 언마운트→자기평가 미저장 입력·필터·modal 상태 소실. forceMount만 쓰면 3 클라 즉시 fetch. → **visited-tabs + forceMount**(최초 방문 시 mount, 이후 유지). 탭 왕복 E2E 추가.
**P1-5 브라우저 뒤로가기**: 사용자 탭 전환=`router.push(?tab=, {scroll:false})`(history 보존), 잘못된 tab 정규화만 `replace`. 기존 query param 보존.
**P1-6 액션 버튼 정직성**: "새 목표/리뷰 작성/자기평가 시작"은 각 자식 내부 state/handler 의존 → 허브 헤더에 버튼 추가 시 toast-only 가짜 액션 위험. → **허브 헤더 = 타이틀+부제+KPI만**(액션 버튼 無). 자식 액션 버튼은 embedded에서 **유지**(네이티브 작동). 프로토(헤더로 액션 lift)와의 의도적 정직성 편차 — PR 본문 명시.
**P1-7 D-day = 회사 timezone**: 브라우저 로컬 아님. `src/lib/timezone.ts` SSOT + 회사 tz 서버 전달 → 순수 D-day 헬퍼(evalEnd·now·tz 인자, DST 경계 테스트).
**P1-8 nav key≠active-state**: Sidebar 활성=`pathname===href`/prefix(key 아님, `Sidebar.tsx:372`, frozen). → 데모션 루트 직접 접근 시 허브 rail 미활성 = **수용+테스트**. "key 보존=active 안정" 문구 삭제. 허브 루트(`/performance/growth`)는 rail 활성됨 — 이것만 보장+테스트.

**P2**: ① `DEPRECATED_NAV_KEYS`에 제거 키 2개 추가(상기 E). ② `embedded` 처리는 **전 return 경로**(MyGoals `isBlocked` 조기 return 포함)에 적용 — 정상 return만 바꾸면 padding/min-h 잔존. ③ i18n 테스트=5-locale 키셋 동등 비교.

**embedded 정의 확정**: 타이틀 블록(`<h1>`+부제 `<div>`)만 숨김 + 페이지 컨테이너(min-h-screen/bg/p-6/max-w-4xl) 중립화. 컨트롤(select)·액션 버튼·콘텐츠는 전부 유지. 기본 false=standalone 무변경.

---

## 🔄 재설계 v2 — CEO "프로토와 차이내지 말고 개발해서라도 넣어라" (2026-06-15)

> CEO 피드백: 헤더 액션 버튼·KPI 칩을 빼지 말고 **실제 작동하게 개발**. v1의 P1-1(KPI 축소)·P1-6(액션 버튼 생략) **번복**. 6-에이전트 워크플로 재리뷰(`wtngsd6sa`: 자식3 조사 + KPI 데이터 + 합성 + 적대검증) 결과 반영.

### 통합 액션 계약 (callback-registration)
프로토 헤더 액션 버튼을 **진짜로** 작동시킴. forwardRef(비반응)·state lift(과침습) 기각.
```ts
// perf-growth/types.ts (공유)
type HubTabKey = 'goals' | 'quarterly' | 'skills'
interface PrimaryActionState { labelKey: string; enabled: boolean; visible: boolean; pending?: boolean; run: () => void | Promise<void> }
interface EmbeddedChildProps { embedded?: boolean; onPrimaryActionChange?: (s: PrimaryActionState | null) => void }
```
- 각 자식이 `useEffect`(액션 관련 deps)로 디스크립터 등록, unmount 시 `null` 해제. 허브는 `actions[activeTab]`로 헤더 버튼 **1개** 렌더(`visible`/`enabled`/`pending` 반영). 미마운트 탭=null→버튼 없음(레이지 가드).
- **레이지 마운트 = visited-set + forceMount + hidden**(최초 방문 mount, 이후 keep-alive). Radix 기본 언마운트로 인한 자기평가 미저장 입력 소실 차단.

### 자식별 액션 (실작동)
- **목표** "새 목표" = **이미 작동**(GoalModal+POST `/performance/goals`). 등록→`setModal({mode:'add'})`. cycle 블록 시 `enabled:false`(실 authz). ⚠ 등록 useEffect는 `isBlocked` 조기 return **위**(hooks 규칙) + embedded blocked 상태는 풀스크린 min-h-[60vh]→컴팩트로.
- **분기 리뷰** "리뷰 작성" = **편집가능 리뷰 열기**(직원 self-create 불가=POST admin전용). `writable=reviews.find(편집가능 status)` → `router.push(/quarterly-reviews/[id])`. 없으면 `visible:false`. ⚠ 편집가능 status는 `[id]` 상세 게이트와 정합 검증(masked·DRAFT admin가능성).
- **자기평가** "자기평가 시작" = `handleSave(true)`(제출). 등록 `pending:saving`. ⚠ **error-handling 수정 동반**: `handleSave` catch+토스트 부재 + `loadAssessments` 빈 catch(rules 위반) 둘 다 수정 + CTA를 load 성공/loading 게이트(empty 폼 위 제출 차단).

### KPI 3칩 (전부 실데이터, 서버 해결)
**masking P1 해결**: EMPLOYEE는 `/cycles` GET이 COMP_*→CLOSED 마스킹 → 클라 picker 오작동. → **허브 page.tsx(서버)가 prisma로 unmasked 현재사이클 해결**(skills props와 동일 패턴, 신규 엔드포인트 0):
- **칩1 현재 사이클명**: `pickCurrentCycle` 우선순위(EVAL_OPEN>CHECK_IN>ACTIVE>CALIBRATION>FINALIZED>DRAFT, fallback 최신). ⚠ 정직: "Q2" 금지 — PerformanceCycle은 `half`(H1/H2/ANNUAL)만, quarter 없음 → `name` 또는 "상반기/하반기".
- **칩2 진행중 목표**: `goals.filter(status==='APPROVED').length`(GoalStatus에 IN_PROGRESS 없음 → APPROVED=확정/진행세트). 서버 prisma self-scope count.
- **칩3 자기평가 D-day**: 현재사이클 `evalEnd` + `getCompanyTimezone(companyId)`(`timezone-lookup.ts`)+`timezone.ts` 순수헬퍼(raw Date 금지). eval 단계 전이면 `goalEnd` fallback(빈칩 방지). ⚠ 정직: eval윈도우 종료=self+manager+peer 공용(self전용 마감 컬럼 없음), 스킬 자체 마감 없음.

### nav.ts (격리 커밋) — IA 의미 변화 명시 (적대검증 P1)
- 현 `목표/평가`→`/performance`(**PerformanceClient=역할별 대시보드**: 직원=CycleTimeline+KPI카드+목표프리뷰). 허브 목표탭=MyGoalsClient(개인 목표 풀페이지). → **프로토 정합 = Option 1**: `목표/평가`→`평가/성장`·repoint→`/perf-growth`(허브가 직원 /performance 대시보드 대체). **CycleTimeline은 프로토에 없음**(프로토는 KPI 스트립으로 대체) → 허브에 미반입(라이브 전용 enhancement, CEO 원하면 additive). `/performance`·`/performance/my-goals`·`/performance/my-quarterly-review`·`/my/skills` 루트 **전부 존속**(직접 URL·deep-link). 관리자/HR은 팀목표·성과관리 별 entry 보유라 무영향(허브=개인 평가성장).
- `분기 리뷰`·`스킬 자기평가` rail 제거 → 허브 탭(딥링크 `?tab=` 지원으로 기존 링크 보존). `DEPRECATED_NAV_KEYS`에 2키 추가.

### 잔존 프로토 편차 (불가피 — 백엔드/도메인 제약, CEO 인지)
1. 칩1 "Q2" 불가 → "상반기/하반기"(cycle에 quarter 없음).
2. "리뷰 작성"=편집리뷰 열기(직원 self-create 불가).
3. "자기평가 시작"=제출 매핑(자식은 임시저장+제출 2버튼).
4. "새 목표" cycle 블록 시 disabled(실 authz — 저장 거부될 모달 여는 것보다 정직).
5. 칩3 D-day=eval윈도우 종료(self전용/스킬전용 마감 컬럼 없음).
→ 이들은 "개발로 넣을 수 있는" 게 아니라 **데이터모델/authz 변경 필요**(별 피처). 나머지(액션 작동·3칩 실데이터)는 전부 정합.

### 적대검증 must-fix 5 (구현 전 필수, 전부 v2 반영됨)
① 현재사이클 서버해결(masking) ② nav=실 IA변화로 취급·CEO승인·직원 손실 audit ③ 등록 useEffect를 조기 return 위(hooks) + blocked 컴팩트화 ④ 스킬 error-handling 2곳 + CTA load 게이트 ⑤ 분기리뷰 편집가능 predicate를 [id] 게이트와 정합.

### 파일 (v2 확정)
NEW `perf-growth/{page.tsx, PerfGrowthClient.tsx, types.ts, KpiStrip.tsx}` · NEW `lib/skills/load-self-assessment-props.ts`(공유, my/skills/page.tsx도 채택) + `lib/performance/pick-current-cycle.ts`(순수) + D-day 순수헬퍼 · EDIT 자식3(embedded+등록+버그수정) · EDIT navigation.ts(격리) · EDIT useFavorites.ts(DEPRECATED 2키) · EDIT messages ×5(perfGrowth namespace add-only).

---

## 🔁 Codex Gate 1 R2 반영 (Request Changes → P0 1·P1 5·P2 3, 2026-06-15)

**P0-1 자기평가 CTA "제출"은 가짜** — assessments API에 submit/lock/submittedAt 구분 없음(임시저장=제출=동일 upsert, `submit` 인자는 토스트만). → **CTA 라벨 = "자기평가 저장"**(제출/시작 금지). 진짜 제출(잠금)은 백엔드 도메인 변경(별 피처). → 잔존편차 #3.
**P1-2 분기리뷰 CTA가 타인 리뷰 열 위험** — MANAGER 응답=본인+담당, HR=전사. 개인 허브 CTA가 타인 리뷰 선택 가능. → writable predicate = **`review.employee.id===user.employeeId && status∈[DRAFT,IN_PROGRESS]`**(자기 한정, `[id]` 상세 게이트 정합) + 연도필터 결합 분리(과거연도 편집가능 리뷰 누락 방지=self만 별 조회 or 서버공급).
**P1-3 칩3 "자기평가 D-day" 의미 불일치** — evalEnd=MBO 평가 전체 기한(self전용 아님), 스킬 자기평가는 사이클/마감 연결 자체 없음, goalEnd fallback 더 무관. → **칩 라벨="평가 마감", evalEnd만 사용, goalEnd fallback 삭제**. → 잔존편차 #5 갱신.
**P1-4 nav 변경 MANAGER "무영향" 오판** — MANAGER `/performance`=팀목표수+팀평균달성률 진입점. 허브=개인이라 제거됨(팀목표 페이지 존재≠동일 대시보드). → **MANAGER 손실 CEO 승인항목 명시 + MANAGER E2E 추가**(super+employee로 미검출). → 도그푸드/E2E에 MANAGER 추가.
**P1-5 pickCurrentCycle 상태우선순위만으론 부족** — 오래된 EVAL_OPEN이 최신 ACTIVE 이길 수 있음. → **날짜범위 매칭(now∈[start,end]) 우선 → 그 안에서 상태우선순위+최신 → fallback 최신 비종료 → 최신 종료**. 음수 D-day는 숨김 또는 정확한 `D+N`.
**P1-6 액션 등록 계약 세대보호 없음** — 무조건 null cleanup이 Strict Mode/identity 변화 시 최신 등록 삭제 가능. → **등록 토큰/id**(`register(tab,action,id)`/`unregister(tab,id)` id일치 시만 삭제) + 부모 callback·자식 `run` `useCallback` 고정·effect deps 완전.
**P2**: ⑦ recharts hidden 복귀 width-0 → 탭복귀 resize/remount key + SVG width E2E. ⑧ 칩2 라벨 "승인된 목표"가 "진행 중"보다 정확(완료 개념 無). ⑨ 스킬 기간전환 응답 경쟁 → load-success 게이트에 request token/abort.

### 잔존 프로토 편차 v3 (백엔드/도메인 갭 — "버튼 개발"로 안 됨, CEO 판단 필요)
1. 칩1 "Q2"→"상반기/하반기" (cycle에 quarter 컬럼 없음, quarter는 별 QuarterlyReview 모델).
2. "리뷰 작성"=편집가능 **자기** 리뷰 열기 (직원 self-create 불가=POST admin전용).
3. **"자기평가 시작/제출"→"자기평가 저장"** (assessments에 submit/lock 없음).
4. "새 목표" cycle 블록 시 disabled (실 authz).
5. 칩3 "자기평가 D-day"→"평가 마감"(evalEnd, self/스킬 전용 마감 컬럼 없음).
6. MANAGER가 rail에서 `/performance` 팀 대시보드 진입점 상실 (허브=개인).
→ **선택지**: (A) 지금 **정직한 작동버전** 출하(버튼 전부 작동·칩 실데이터, 라벨만 정직) + 위 백엔드 갭(제출잠금·스킬마감·cycle quarter·직원 QR생성)은 **후속 피처**로 분리 [권장·bounded] / (B) 백엔드까지 이 PR서 확장(submit-lock·스킬 deadline 등 = 멀티 피처, 범위 대폭 확대).

### 빌드 가드 (R2 필수 E2E/unit)
MANAGER 허브 CTA 타인리뷰 미오픈 · HR/SUPER 허브 self-review만 · 과거 EVAL_OPEN+최신 ACTIVE picker unit · D-day 음수/당일/DST · Strict Mode 등록/해제 · 자기평가 저장 실패 시 성공토스트 미출력 · recharts 탭왕복 SVG width≠0.

---

## ✅ 구현 완료 + Codex Gate 2 반영 (2026-06-15)

**구현**: NEW `performance/growth/{page.tsx,PerfGrowthClient.tsx}` · NEW `lib/performance/{growth-kpi.ts,growth-hub.ts}`·`lib/skills/{load-self-assessment-props.ts,requirement-map.ts}` · EDIT 자식3(embedded+등록+버그수정)·nav.ts(격리)·useFavorites·messages×5 · vitest 15 · e2e flows 신규.
**검증**: tsc0·lint0(기존 fetchGoals 경고만)·vitest **896/896**(신규15) · **라이브 도그푸드**(employee-a: 3탭·KPI 실데이터[진행사이클 2026상반기·진행중목표2·평가마감D-15]·새목표 헤더버튼 클릭→모달 OPEN·?tab=skills 딥링크→자기평가저장 버튼·분기리뷰 CTA 편집리뷰없어 숨김[정직]·콘솔0 / super: 3탭·홀딩사 사이클없어 KPI생략[정직] / 데모션루트 my-quarterly-review·/my/skills·/performance 전부 200).

**Codex G2 (Request Changes → P1 3·P2 3) 반영**:
- **P1-1 자기평가 토스트** ✅수정: `handleSave(successKey)` 리팩터 — 허브 저장=`toastSaved`("저장되었습니다", 신규키), 제출버튼=`toastSubmitted` 유지. "제출되었습니다" 오표시 제거.
- **P1-2 분기리뷰 CTA 연도결합** ✅수정: 화면 필터와 분리한 별도 self-editable 조회(`limit:50` no-year)로 writableId 산출 → 타연도 편집리뷰도 CTA 유지.
- **P2-5 embedded 빈상태 새목표 중복** ✅수정: empty-state 버튼 `!embedded` 게이트.
- **P2-6 e2e 약함** ✅보강: 주석 정직화 + CTA실행(새목표→모달)·keep-alive 레벨선택 왕복보존·MANAGER 렌더 assertion 추가.
- **P1-3 칩2 "진행 중 목표" vs APPROVED** → **CEO 프로토 정합 지시 우선 유지**(deviation 문서화): GoalStatus에 완료 상태 없음 → APPROVED=현 모델의 활성 목표 세트, 프로토 라벨 "진행 중 목표" 정직성 허용범위. (Codex 권고 "승인된 목표"는 프로토 이탈이라 미적용.)
- **P2-4 등록 세대토큰** → **불필요 판정**(문서화): 자식 keep-alive(forceMount+visited, 탭전환 시 unmount 안 함) + 탭별 슬롯 키잉 + React cleanup-before-next-effect 순서보장 → stale-null 레이스 불가. 라이브 도그푸드가 탭별 정확 버튼 등록 입증. 토큰 추가는 과설계.

**최종 잔존 프로토 편차**(불가피, 백엔드 갭=후속 피처): Q표기 불가(half만)·리뷰작성=편집리뷰열기(self-create 불가)·자기평가=저장(제출잠금 없음)·새목표 cycle블록 시 disabled·평가마감=eval윈도우 종료(self/스킬 전용 마감 없음)·MANAGER /performance 팀대시보드 rail 진입점 상실(개인허브, 팀목표/성과 별도).

## Out-of-scope (defer)
- 분기리뷰(admin)→성과관리 허브 (클러스터 PR-2).
- 급여 run-flow 데모션·page-perf-cycle.jsx·page-team-hub 등 (후속 슬라이스).
- 홈/체크인 CTA를 허브 `?tab=`로 리포인트 (별 퀵윈, 루트 보존이라 무손상).
- 백엔드 집계 엔드포인트, 다크모드.

## 방법론 (CLAUDE.md 디자인 플로우)
1. **Codex Gate 1** (이 플랜) → HIGH/P0-P1 반영.
2. 구현: 헬퍼·embedded prop 먼저(공유 아티팩트) → 허브 → nav.ts 격리 커밋 → i18n.
3. **Pixel Gate**: `python3 -m http.server -d _design-reference` → PerfGrowthWrapper side-by-side.
4. `/verify` (tsc·lint·prisma status·패턴 + **Codex Gate 2**).
5. **멀티롤 도그푸드** (super@ + employee-a@ — 사이드바 핫스팟: rail 렌더·허브 탭·데모션 제거·루트 도달).
6. visual baseline 갱신 + PR.

## 리스크
- **사이드바 파괴 핫스팟**: nav.ts 격리 커밋 + 멀티롤 도그푸드 의무 (과거 사고 가드).
- `embedded` prop이 자식 standalone 동작 회귀? → 기본 false, standalone 무변경 e2e로 가드.
- KPI 페치 중복/결합 → 경량 카운트만, 실패 시 칩 생략 (Codex 판단).
- 서브에이전트 stale-cwd → 절대경로 + 메인 교차검증.
