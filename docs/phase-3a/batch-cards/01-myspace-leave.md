# Batch 카드 #01 — 나의공간 휴가 (`/leave`) — 추정 우선순위 **P0**

> Phase 3a Stage 2 산출물. 표준 = `CLAUDE.md` "## Phase 3 작업 표준" Q2 C양식 +
> `docs/plans/active/2026-05-18-phase3a-audit.md`. **Stage 2 = 카드만, 구현 0.**
> 백엔드(prisma/API/RLS)·DO NOT TOUCH 불변. v2 (사용자 카드 평가 3건 보완 반영).
> 스크린샷: `docs/phase-3a/screenshots/myspace-leave/` (5컷).

---

## 1. 페이지 매핑

| 레퍼런스 (`_design-reference/`) | 현 코드베이스 (`src/`) | 라우트 | 관계 |
|---|---|---|---|
| `page-my-space.jsx:LeaveReqPage` (L179–311) | `app/(dashboard)/leave/LeaveClient.tsx` | `/leave` | **1:N 정본 후보** — 사이드바 `nav.mySpace.leave`(navigation.ts:175-178) + P1-5 WdDrawer 카나리(`77762bf0`) 적용됨 |
| `page-leave-modal.jsx:LeaveRequestModal` (WdDrawer) | LeaveClient 내 WdDrawer 신청폼 (L593–844) | `/leave` (모달) | 1:1 — SSOT WdDrawer 이미 적용 |
| (동일 LeaveReqPage 1개) | `app/(dashboard)/my/leave/MyLeaveClient.tsx` | `/my/leave` | **1:N 中복** — 사이드바 부재. My Space 허브(MySpaceClient.tsx:69,164)·홈(EmployeeHomeV2.tsx:197,256,324)·알림 딥링크(approve/reject route, leave-*.handler)·useRecentPages.ts:69 전부 `/my/leave` 링크 |

> 🚩 **핵심 IA 결함**: 프로토타입 휴가 화면 1개 ↔ 코드 2개(`/leave`·`/my/leave`).
> 동일 직원이 사이드바로 가면 `/leave`(완전 신청), 홈/알림으로 가면 `/my/leave`
> (읽기 위주 잔여 뷰). 게이트 **Q2** 1순위 결정.

## 2. 기능 inventory

| ID | 기능 | 분류 | 등급 | 의존 SSOT / 비고 |
|---|---|---|---|---|
| LV-001 | 잔여 휴가 카드 (카테고리 그룹·잔여/총·사용바) | 가 | 중 | WdStatStrip **부적합** → §3.1 신규 컴포넌트 후보 (게이트 Q6) |
| LV-002 | 월별 사용 패턴 차트 + 인사이트 문구 | 나 (proto만, 코드 부재) | **저** | chart.ts SSOT **신규 소비처** + WdSummaryLead풍 인사이트. 게이트 Q4 |
| LV-003 | 휴가 신청 드로어 (정책·기간·일수·대체자·사유) | 가 | 고 | WdDrawer (P1-5 적용 완료, 다크 lavender known-deferred 상속) |
| LV-004 | 신청 이력 테이블 + 상태 pill 탭 + 건수 | 가 | 고 | shared/DataTable. proto `pill-tabs`+`count-display` ↔ 코드 LeaveClient L560-591 |
| LV-005 | 상태 칩 (승인됨/대기/반려됨/취소됨) | 가 (코드 raw 위반) | 고 | StatusBadge/status.ts SSOT. ★가디언: LeaveClient L88-93 raw 하드코딩 |
| LV-006 | 신청 취소 (대기/승인 건) | 가 | 고 | 7레이어 완비 (PUT `/leave/requests/[id]/cancel`) |
| LV-007 | 이력 다운로드 | 나 (proto만, 코드 부재) | 저 | 운명: 구현(CSV export 풀스택) vs 숨김. 게이트 Q3 |
| LV-008 | 반차/반반차 preset(FULL/AM/PM/QUARTER/CUSTOM) + 잔여 미리보기 | 다 (코드만) | 중 | 운명: **유지** 제안 (실 법정 비즈로직, 프로토보다 풍부) |
| LV-009 | `/my/leave` 별도 잔여 뷰 (읽기 위주, EmptyState 사용) | 다 (코드만) | 저 | EmptyState SSOT. 운명 카드 §5 — 게이트 Q2 |

## 3. 컴포넌트 매핑

- **이미 SSOT 적용**: WdDrawer (LV-003, `77762bf0` 카나리) · DataTable (LV-004).
- **SSOT 교체 필요 (가디언)**: LV-005 → `StatusBadge`/`status.ts` (LeaveClient
  L88-93 `statusBadgeClass` raw `bg-orange-500/10` 등 제거) · 빈 필터 결과 →
  `@/components/ui/EmptyState` SSOT (현재 DataTable `emptyMessage` 문자열만).
- **토큰화 필요 (가디언)**: LeaveClient L542 잔여 바
  `bg-gradient-to-r from-[#5E81F4] to-[#00BFA5]` 하드코딩 violet→teal. 게이트 Q7.
- **에러 처리 (가디언)**: LeaveClient L313-319 `catch{ setRequests([]) }` 무음 →
  rules/error-handling.md "toast 필수" 위반. 구현 시 동시 교정 (게이트 Q5).
- **known-deferred 사전매핑**: WdDrawer primary 다크 lavender (P1-5,
  `.dark --primary` 미마이그레이션) = LV-003 상속, 별도 다크 Phase. 본 batch 비대상.

### 3.1 신규 컴포넌트 후보 (LV-001 — WdStatStrip 부적합 확정)

**부적합 근거**: WdStatStrip = 4지표 운영핵심 KPI strip (예: leave/admin
"승인대기·금월소진·…"). LV-001 = 정책별 N개(연차/병가/경조사/리프레시…)
잔여·총·사용률 진행바 = **그룹 카드 리스트**, 4-strip 시맨틱과 불일치.
프로토타입도 strip 아닌 progress-list (page-my-space.jsx:226-248).

세 가지 트랙 옵션 (게이트 **Q6** 결정):

| 옵션 | 내용 | 장 | 단 |
|---|---|---|---|
| (A) 인라인 1회용 | LeaveClient 내부 잔여 카드 JSX를 Phase1/2 토큰으로 리스킨만, 컴포넌트 추출 없음 | 최소 diff·블라스트 0 | `/my/leave`(LV-009)와 잔여 카드 중복 유지 |
| (B) 신규 SSOT `WdLeaveBalanceCard` | 휴가 전용 잔여 카드 컴포넌트 신설, `/leave`·`/my/leave` 공용 | 중복 제거·Q2와 시너지 | 휴가 도메인 한정 SSOT 1종 추가 |
| (C) 일반화 `WdGroupedStatCard` | "그룹 라벨 + N개 진행바 카드" 범용 컴포넌트 (휴가·교육·스킬 등 재사용) | 최대 재사용 | 과설계 위험·타 페이지 audit 선행 필요 |

CC 제안: **(B)** — Q2(/my/leave 정본화)와 묶으면 중복 자연 해소, 범용화(C)는
타 페이지 audit 전 과설계. 단 최종은 사용자 Q6.

> **🔄 Stage 3 백포팅 (#02 근태 게이트 결정 반영)**: 근태 AT-005 월간 통계가
> "그룹 라벨 + N지표 카드" **2번째 수요**로 확인됨 → (C) 일반화 **승격 확정**.
> 최종 구조 = **(B-rewrite)**: `WdGroupedStatCard`(범용 베이스 — 그룹 라벨 +
> N개 지표/진행바 슬롯) + `WdLeaveBalanceCard`(그 위 **얇은 래퍼**, 휴가 잔여
> 의미색·잔여율 도메인 로직 주입). 근태 AT-005도 동일 베이스의 별도 얇은 래퍼.
> 과설계 우려 = 2-shot 실수요(휴가+근태)로 해소. 상세 = §7 Q6.

## 4. N1/N2 표준 적용 계획

**N1 7레이어 audit (`/leave` LeaveClient 기준)**

| 레이어 | 분류 | 근거 |
|---|---|---|
| UI | 가 (리스킨) | LeaveClient 존재, Workday 외관(page-h·pill·잔여카드) 토큰 리스킨 필요 |
| 상태 | 나 | loading=DataTable OK / error=무음 catch(위반) / empty=문자열(EmptyState 미사용) |
| API | 가 | `/leave/balances`·`/policies`·`/requests`(GET·POST)·`/requests/[id]/cancel` 전부 존재 |
| DB | 가 | LeaveRequest·LeaveYearBalance·LeaveTypeDef 읽기, 무변경 |
| 권한 | 가 | `withPermission perm(MODULE.LEAVE, VIEW/CREATE)` (requests/route.ts:57,336) |
| i18n | 가 | `leave` ns 98키 + `mySpace` ns (5locale) |
| e2e | 가-얕음 | `leave-workflow.spec.ts`(EMPLOYEE/HR_ADMIN/MANAGER) + `my-space.spec.ts` = 페이지 로드만 |

**N2 E2E 시나리오 후보** (`e2e/flows/leave-workflow.spec.ts` 심화):
다중선택 미해당(휴가=단건). 시나리오 = EMPLOYEE 드로어 열기→신청 제출→
PENDING 표출→취소→CANCELLED + 상태 필터 탭 + 롤별(EMPLOYEE 본인 / MANAGER·
HR_ADMIN은 `/leave/admin`·`/leave/team` 별 라우트=본 batch 외) 가시성.

**M3 시각 회귀 3축**:
- color: LV-005 상태칩 raw→StatusBadge wt 토큰 · L542 그라데이션→토큰(Q7).
- spacing: 휴가=`comfortable`(p-6) density (rules/design.md).
- typography: TYPOGRAPHY 상수 + 일수/잔여 `font-mono tabular-nums`.

## 5. 운명 카드 (다 = 코드만, 프로토타입 부재)

### [/my/leave] MyLeaveClient 별도 잔여 뷰 (LV-009) — 운명 제안: **숨김→정본 통합**
- 현 상태: `/my/leave` 라우트+MyLeaveClient. 사이드바 없음. 홈·허브·알림 딥링크
  4+ 곳이 여기로. 읽기 위주 잔여(EmptyState L221/314, 키 `emptyLeaveBalance`/
  `emptyLeaveHistory`) — 신청 드로어·반차 preset 없음.
- 프로토타입 부재 사유 추정: 프로토는 휴가 화면 1개. `/my/leave`는 코드 진화 중
  파생된 경량 위젯 (홈 hero CTA 타겟용).
- 제안 근거: `/leave`가 기능 상위집합(신청·취소·preset·미리보기 전부 포함) +
  사이드바 정본 + P1-5 카나리. `/my/leave`는 부분집합 → IA 이중화 = 사용자 혼란.
- 영향: 통합 시 홈/허브/알림/useRecentPages 링크 4+곳 `/leave` 재지정 필요
  (회귀 표면 = 딥링크 테스트). 경량 위젯 유지 시 중복 SSOT 유지비. → 게이트 Q2.

### [/leave] 반차/반반차 preset + 잔여 미리보기 (LV-008) — 운명 제안: **유지**
- 현 상태: LeaveClient L182-356 FULL/AM/PM/QUARTER/CUSTOM preset + 투영잔여 경고.
- 프로토타입 부재 사유 추정: 프로토 드로어는 단순(일수 수동). 코드가 한국 법정
  반차/반반차(0.5·0.25) + 음수잔여 차단 실装.
- 제안 근거: 실 비즈니스 가치(법정 정합) > 프로토 단순성. 리스킨만, 로직 보존.
- 영향: 제거 시 반차 신청 불가(기능 후퇴). 유지=프로토 대비 추가 UI 정당.

## 6. 사용자 게이트 항목 (Stage 3 — OK / 정정 / 보류 / 제거)

- **Q1 우선순위**: 나의공간 휴가 = **P0** (Q1 정의 "휴가" 명시 매일 핵심 워크플로).
  → OK / 정정(P1·P2)?
- **Q2 정본 결정 (1순위, 2지선다 + 보류)**: `/leave`를 정본 확정. `/my/leave` 처리:
  - (1) `/my/leave` → `/leave` **redirect** (라우트 폐기, 링크 4+곳 자동 흡수)
  - (2) `/my/leave` = **경량 위젯 유지** + 정본 링크는 `/leave`로 (이중 SSOT 감수)
  - (보류) 추가 조사 필요
- **Q3 LV-007 이력 다운로드**: 구현(CSV export 풀스택, 다 전체 7레이어) / 버튼
  숨김(프로토 충실 보류) / 별도 트랙 등록?
- **Q4 LV-002 월별 패턴+인사이트**: chart.ts SSOT 신규 구현 / P2 리포팅 트랙 보류
  (저확실 — 디자인 가디언 우선검토 대상)?
- **Q5 가디언 동시 교정**: LV-005 raw statusBadgeClass + L542 하드코딩 그라데이션
  + L313 무음 catch → 본 batch 구현 시 SSOT 토큰·StatusBadge·toast 동시 교정. OK?
- **Q6 LV-001 컴포넌트 트랙**: (A) 인라인 1회용 / (B) 신규 SSOT
  `WdLeaveBalanceCard`(CC제안) / (C) 일반화 `WdGroupedStatCard` / 보류?
- **Q7 L542 잔여 바 색 방향**: (a) 단색 `--accent` / (b) 토큰 그라데이션
  `wt-1→wt-3` / (c) 잔여율 의미색(녹·황·적, status.ts) / 보류?

---

## 7. Stage 3 게이트 결정 (확정 — Stage 4 입력 SSOT)

> 사용자 게이트 응답(Session 후속). Stage 4 작업계획·구현은 본 절을 입력으로 함.
> Stage 4 진입 시 별도 작업계획 사전 제출 + 구현 전 가디언 검토 1회 추가.

| Q | 결정 | Stage 4 적용 |
|---|---|---|
| Q1 | **P0 확정** | 휴가 = 실 운영 마일스톤 핵심 |
| Q2 | **(1) `/my/leave` redirect 폐기** | `/my/leave`=redirect-only 라우트 잔존(북마크 보호). 링크 일괄 `/leave` 갱신: `src/config/navigation.ts`(my-leave 이미 /leave) · `MySpaceClient.tsx:69,164` · `EmployeeHomeV2.tsx:197,256,324` · `useRecentPages.ts:69` · `leave-approved.handler.ts` · `leave-rejected.handler.ts` · `requests/[id]/approve|reject/route.ts` link. /my/leave 잔여정보 = 홈/허브 카드 **인라인 컴포넌트**로 (= Q6 WdLeaveBalanceCard 재사용) |
| Q3 | **별도 트랙** | LV-007 이력 다운로드 = 본 batch 제외. 휴가 batch 종료 후 LV-007 단독 카드 |
| Q4 | **batch 포함** | LV-002 = `chart.ts` **첫(단독) 소비처** — 단일 시리즈 월별 막대, `CHART_THEME.colors[0]`+axis/grid/tooltip **정확 수용**(확장 0). chart.ts **2-shot 검증은 다음 batch 이연**(AT-004는 chart.ts 부적합→status.ts home, PR-2 audit 발견 2026-05-19). 계획서 §2 WS-B 정정 SSOT |
| Q5 | **동시 교정 OK** | LV-005 raw statusBadgeClass→StatusBadge · L542 그라데이션→토큰 · L313 무음 catch→toast |
| Q6 | **(B-rewrite) `WdGroupedStatCard` 베이스 + `WdLeaveBalanceCard` 래퍼** | Stage 3 백포팅(#02 근태 AT-005=2번째 수요로 (C)일반화 **승격 확정**). 범용 베이스=그룹 라벨+N지표/진행바 슬롯. 휴가 래퍼=잔여 의미색·잔여율(Q7) 주입, `/leave`+홈/허브 인라인(Q2) 공용. 근태 AT-005=동일 베이스 별도 래퍼 |
| Q7 | **(c) 잔여율 의미색** | 기본 임계값 ≥30% `--success` / 10–30% `--accent` / <10% `--warning`. 임계값은 Stage 4 PR 코멘트 미세조정 토픽 |

**M. 모바일 reflow (프로토타입 결함 복제 금지)**:
- 이력 테이블 → `.tbl-as-cards` reflow (각 `<td>` `data-label` 추가).
- 페이지 상단 거대 여백 정정 = 본 batch 내.
- 사이드바-콘텐츠 겹침 = `src/components/layout/*` (DO NOT TOUCH shell) → **별도 트랙 분리**.

**B. 브랜치**: `claude/phase3a-audit` trajectory 보존 결정. ⚠️ 단 해당 브랜치가
`.claude/worktrees/phase3a` 워크트리에 이미 체크아웃됨(git 잠금) → 현 워크트리
checkout 불가. 안전 경로 = phase3a 워크트리에서 커밋(파괴 0). 절차 보고 후 진행.

### N+1. LV-002 insight 슬롯 미배선 (i18n-heavy 이연)

- 프로토 (`page-my-space.jsx` L268~) = bg-sunk 패널 + `<b>인사이트</b>` ·
  평균 X일/월 사용 + 액션 권장 텍스트
- PR-2 카나리는 `insight={null}` 전달, 슬롯 자체는 `WdUsageBarChart` 에 존재
  (dev fixture `fx-lv002` 에서 시연)
- 사유: 인사이트 텍스트 i18n-heavy (신규 키 ↑), F1 "신규 키 최소" 원칙 충돌
- 해소 트랙: WS-E i18n 또는 LV-007 이력 다운로드 batch
- 가디언 판정: F5 조건부 이연 (m0008). 결정 SHA: 본 커밋

### N+2. WS-E `leave.balance` ×4 미번역 보정 (F1 약속 트랙)

- en/es/vi/zh `leave.balance` = `"Leave Balance"` 미번역 플레이스홀더 (PR-2 이전 기존)
- PR-2 신규 `leave.monthlyUsagePattern` 은 4 locale **실번역 제공**(플레이스홀더보다 우위)
- 약속(F1 ✅ 조건): PR-2 머지 후 WS-E i18n 라벨 트랙에서 `balance` ×4 정역 보정
- ⚠️ **충돌**: `balance` ×4 보정 = **기존 키 값 편집** → DO NOT TOUCH "messages
  기존 키 편집 금지"와 상충. WS-E 게이트에서 양안 판정:
  - **(a) 신규 키 분리** (CC 권장) — `leave.balanceLabel` 등 신설, DO NOT TOUCH
    가드 완전 준수. 구 키는 잔존(미사용화) 또는 별도 정리 트랙
  - **(b) 예외 승인** — 미번역 영문 플레이스홀더는 "보호 대상 번역값 아님" 논리로
    기존 키 직접 보정 1회 예외 승인 (WS-E 게이트 사용자 판정)
- 가디언: F1 ✅ (PR-2 머지 후 트랙 등록, open 비차단). 결정 SHA: 본 커밋

### N+3. N4 — `fetchUsage` 6개월 윈도 데이터 충분성 (백엔드 무변경 확정)

- `fetchUsage`(LeaveClient) = `/leave/requests` limit 100 + `createdAt desc` +
  REJECTED/CANCELLED 제외 → 클라이언트 6개월 group-by-month (백엔드 0 변경)
- **정량 바운드**: truncation = >100건/6개월 = >16.7건/월 지속 (개인 휴가 비현실).
  현실 ≤4건/월 → 100÷4 ≈ 25개월 ≫ 6. 시드(`04-leave.ts:131-150` 페르소나
  `requests` 0~5건/직원) ≤0.8건/월 ≪ 임계. 신규입사자 0건 → EmptyState 정상
- **판정**: date-range 파라미터 **불필요**, 백엔드 무변경 OK (가디언 N4 통과)
- **라이브 잔여 갭(모름은 모름)**: 실 prod per-user max 신청수 실측 = 환경 차단
  (플랜모드+#60머지 preview소멸+인증불안정). 분석 바운드로 갈음(M3 선례).
  실데이터 스팟체크 = Phase 3 페이지 트랙/production 자연 사용 시점 이연
- 결정 SHA: 본 커밋

#### 라이브 갭 RECORD 결과 (handover §7 N+3 약속 이행 — 머지 후 4단계)

- **검증 환경**: main HEAD `1260a95f` ≡ pr3 워크트리 `f96cf765` (tree
  `9423eabf…` 바이트 동일) 보존 스캐폴딩(N+10 INF-1 우회) dev :3014,
  hr@ctr.co.kr (팀 휴가 데이터 보유). 검증일 2026-05-19 (현재 월 2026-05).
- **(a) 윈도 경계**: 차트 x축 = `12·1·2·3·4·5월` = 6개월. 윈도 =
  2025-12 ~ 2026-05 = **현재 월(-5) ~ 현재 월** → 경계 정확 (∅ 갭).
- **(b) 집계 정확성**: 툴팁 "12월 value : 2건" + 바 라벨 `[2,2,1]` =
  **건수 기반**(일수 아님) — PR-2 F3 정정(count≠days) 정합. 0건 월
  (3·4·5월) = 빈 막대 정상.
- **(c) 시각 정합**: 네이비 막대(Workday wt SSOT) + 툴팁 + chart.ts SSOT
  (WdUsageBarChart PR-2 LV-002 카나리) 정상.
- **truncation 미관측**: 표시 13건/팀(pagination total) ≪ 100 limit,
  ≤2건/월 ≪ 16.7건/월 임계 → N+3 정량 바운드 라이브 재확인.
- **판정**: **라이브 갭 0 확정**. N+3 분석(date-range 불필요·백엔드 무변경)
  라이브 검증 완료. "모름은 모름" 잔여 갭 해소 (M3 이연 → 실측 종결).
- 라이브 RECORD SHA: 본 커밋

### N+5. F8 드로워 "대체자(선택)" 필드 — 백엔드 배선 별도 트랙 (Path B)

- 프로토 `page-leave-modal.jsx:LeaveRequestModal` "업무 인수인계 > 대체자(선택)" 필드
- 스키마: `LeaveRequest.delegatedById` / `delegatee Employee?@relation("LeaveDelegatee")`
  **기존 존재** (마이그레이션 0)
- 격차: `POST /leave/requests` route.ts create data(L198-208) + zod parse **미수용**
  → end-to-end(제출→영속) = API zod+create 수정 = **백엔드 변경 = PR-3 scope
  (UI reskin+WS-D+WS-C) creep**. 백엔드 무변경 원칙 충돌
- N1 가드: 비기능 렌더(필드 표시만, 미제출) = "mock·stub·준비중 disabled 금지" 위반
  → PR-3 드로워 reskin **제외**
- 별도 트랙: 대체자 필드 백엔드 배선(zod schema + create data + 조회 노출) 별도
  PR (LV-008류 backend 트랙)
- PR-3 시각 일치도 격차 **RECORD**: 드로워 "대체자" 필드 미구현 (의도적 scope 보존,
  F8 Path B 가디언 m0023 확정)
- 결정 SHA: 본 커밋

### N+6. F10(a) page-h greet-sub 카피 격차 (WS-E/F1 트랙)

- 프로토 LeaveReqPage greet-sub "잔여 휴가를 확인하고 휴가를 신청·관리해요."
- PR-3 A.2 = `t('request')`("휴가 신청") title + 기존 `t('balance')`("잔여 휴가")
  description 재사용 (신규 i18n 키 0, 활성 DO NOT·F1 완전 준수)
- 격차: 프로토 친근톤 안내 문장 미반영 → WS-E/F1 i18n 라벨 트랙서 일괄 보정
- 가디언: F10(a) m0028. 결정 SHA: 본 커밋

### N+7. F11(a) 이력 테이블 모바일 카드 reflow 격차 (별도 DataTable 트랙)

- 프로토 `.tbl-as-cards` data-label 카드 reflow = `DataTable.tsx` SSOT 미지원
  (컬럼 `sm:` 숨김만)
- PR-3 = DataTable SSOT **불변**(전 소비처 블라스트 회피), 기존 반응형 수용
- 격차: 프로토 카드 reflow 미적용 → DataTable 카드 reflow 추가 = 별도 공유
  컴포넌트 트랙(전 소비처 회귀 audit 동반)
- 가디언: F11(a) m0028. 결정 SHA: 본 커밋

### N+8. F12(a) D 드로워 라벨 폴리시 격차 (WS-E/F1 i18n 트랙)

- 프로토 LeaveRequestModal eyebrow="자가 서비스" + WdSectionH "휴가 정보"·
  "업무 인수인계"
- D 드로워 구조 = WdDrawer/WdField/WdNote SSOT **이미 충족**(P1-5 `77762bf0`)
- 격차: eyebrow/WdSectionH **라벨**만 미적용 (재사용 키 0 + 활성 DO NOT 신규키
  금지 + 한글 하드코딩 i18n 위반 = 3중 차단) → WS-E/F1 i18n 트랙 이연
- D in-scope 추가 코드 = 0 (구조 SSOT 충족, 라벨 델타만 RECORD)
- 가디언: F12(a) m0028. 결정 SHA: 본 커밋

### N+9. F14 수동 tablist keyboard-nav 부재 (별도 a11y 트랙 — PR-3 외)

- 격차: 수동 `<div role="tablist">` + `<button role="tab">` 세그먼트가 arrow-key
  네비게이션·focus management 미구현. **코드베이스 공통 기존 격차** —
  `LeaveClient.tsx`(PR-3 A.2 세그먼트) + `MyTasksClient.tsx:368` 동형 (PR-3 신규 surface 도입 아님)
- DESIGN.md §5.5 "Segmented Control (Tabs) — Radix handles keyboard nav" 명시했으나
  현 구현 = 수동 div tablist (단일 필터 결과 surface = 별도 패널 부재 → Radix Tabs
  panel 전제 부적합, `aria-controls` 미연결 = 표준상 정상)
- WCAG 2.1: 기능 키(Tab 키)로 도달·작동 = **Level A 충족**. Arrow-key roving =
  ARIA Authoring Practices 권고 (AA 추가 강화 — Level A 차단 아님)
- 별도 a11y 트랙 옵션 (PR-3 비대상 확정 — shadcn Radix Tabs 교체는 panel 전제 +
  선례 대비 과변경 = scope creep):
  - (a) 전 수동 tablist 일괄 Radix Tabs 교체 — panel 전제 필요, 필터 surface 부적합 가능성
  - (b) `useArrowKeyNavigation` 훅 신설 — 수동 tablist 보존 + 키보드 보강
- 트리거 임계 = 코드베이스 수동 tablist surface 누적 **5+** (D4 게이트 SSOT 5+ 동형 표준).
  현 누적 = 2 (LeaveClient + MyTasksClient) → 미달, 인프라 트랙 미진입
- 우선순위 = **P3** (핵심 기능 무영향, 별도 a11y batch)
- 가디언 G4: (ii)+(iii) **현행 유지 확정** — 선례(`MyTasksClient.tsx:368` 수동 tablist
  컨벤션) + DESIGN.md §5.5 SSOT 양 축 충족. radiogroup 정정 (i) 거부(선례 0 + SSOT
  미규정 = 양 축 위반, 1-line ARIA 패치라도 코드베이스 분기 도입). PR-3 코드 변경 0
- 결정 SHA: 본 커밋

### N+10. PR-3 시각 검증 (INF-1 우회) + 다크 단일근인 정량확정

> 가디언 m0012 시각 검증 라운드 PASS. PR-3 f96cf765 무관 (별 트랙). 코드 변경 0.

**(1) INF-1 우회 방법론 (PR-4 재사용 자산)**
- INF-1 근본원인 = Vercel `DATABASE_URL`·`DIRECT_URL`이 `Preview (staging)`
  브랜치 스코프 한정 → 타 PR 브랜치 preview instrumentation 훅 부팅 hard-fail
  (런타임 로그 실증). 사용자 대시보드(방법 A)로 일반 Preview 스코프 확장 →
  재배포 검증 `/login`·`/api/auth/providers`·`/` 200 = INF-1 해소.
- 로컬 우회 방법론(검증 스캐폴딩): ① `prisma` 변경 0 확인(`git diff 37d412dc...HEAD
  -- prisma/` 빈) → main `node_modules`·`.env`·`.env.local` 심볼릭(client 호환)
  ② 별 워크트리(priceless-dijkstra) `.claude/launch.json` `pr3-verify` config
  (pr3 워크트리 불변) ③ dev 서버 :3014 (`:3002` phase2-recover 점유 회피,
  포트 하드코딩 우회) ④ gstack 헤드리스(Claude Preview MCP cwd EPERM 우회).
- **PR-4 재사용 전제**: `prisma` 변경 0 재확인 필수 (변경 시 심볼릭 client
  불일치 → `npx prisma generate` 또는 워크트리 deps 독립 설치 필요).

**(2) 라이트 전수 정합 (computed-style 정량)**
- StatusBadge SSOT: Approved `rgb(21,128,61)`(success)·bg `rgba(22,162,73,.1)` /
  Pending `rgb(180,83,9)`(warning) — raw `statusBadgeClass` 제거 확인 (WS-D)
- Badge accent(outline→accent) = wt-4 SSOT `rgb(115,87,209)` (`--wt-4 254 57% 58%`)
- tabular-nums(날짜셀) + WdDrawer/WdField/WdNote P1-5 SSOT + F8 대체자 부재
  (N+5 Path B 정합) + B/C `/my/leave`→`/leave` redirect + C 링크 9곳(/my/leave=0) +
  잔여 3 surface(/leave·/my·CI S3 ✓) + page-h F10a + F6 grid-2 + WdUsageBarChart 실데이터
- 콘솔 = Vercel Speed Insights CSP 2건만 (프로젝트 공통, PR-3 11파일 무관)

**(3) 다크 단일근인 정량확정**
- `--primary` 라이트 navy `196 100% 20%`(Phase1) ↔ 다크 lavender `234 89% 74%`
  (미마이그레이션 `.dark --primary`) = known-deferred 4항목(WdDrawer·Inspector
  CTA·BulkActionBar·bg-primary 일반) **단일근인** 정량확정.
- 해소 = `.dark --primary` navy **1-line 마이그레이션**으로 4항목 동시 해결
  (Phase 4 다크 트랙). PR-3 세그먼트 active `text-primary` = 다크서 이 토큰
  상속 → **기존 known-deferred 클래스 합류** (P1-5~P1-7 SSOT 카나리 동형),
  **신규 결함 0**. 구조·레이아웃·타이포 다크 reflow 정상.
- 머지 **비차단** 확정 (라이트 전수 정합 + 다크 = 기존 클래스, M3 합의).

**(4) M0 클린업 (m0009 정밀화)**
- PR-3 CI(run `26094362679`) 정확 표기 = **12 failed · 1 flaky · 1628 passed**.
  총 13 비-green = PR-2 #60 baseline(14 failed·3 flaky) 부분집합
  (`comm -23` PR-3∖PR-2 = ∅, 신규 회귀 0). leave-workflow S1~S5 전수 ✓.

**(5) M1 클린업 (신규 표준)**
- INF-1 류 환경 차단 발생 시 → 대체 수단(로컬 dev·갈음 증거) pivot **사전
  보고 권고**를 표준화. CC m0012 pivot(preview→로컬 dev)은 가드 준수 +
  목적(시각 검증) 충족 → **사후 수용 사례**로 등록 (선례).

- 가디언: m0012 시각 검증 라운드 PASS. 결정 SHA: 본 커밋

### N+11. PR-3 머지 시점 3일 권고 우회 사유 + main tip 재검증

> PR-3 #61 머지(2026-05-19 21:42 KST) 3일 권고 우회 사유 + 머지 후 검증 영구 기록. 코드 변경 0.

**(1) 머지 게이트 충족 시점 시그널 (3중 누적)**
- CI green: PR-3 12 failed · 1 flaky · 1628 passed (총 13 비-green ⊆ PR-2
  baseline 14, `comm -23` PR-3∖PR-2 = ∅, 신규 회귀 0)
- 가디언 3 라운드 PASS: (a) Codex Gate 1 라운드 2 = No HIGH findings /
  (b) CI 회귀 분석 (PR-2 14-tail 진부분집합) / (c) 시각 검증 (라이트 11
  surface 전수 정합 + 다크 단일근인 정량확정, N+10)
- Vercel SUCCESS
- PR-1(#59 `942b12ea`) 머지 후 ~10.5h main tip 회기 0

**(2) 3일 권고 우회 (62h 조기)**
- 권고 만료 = 2026-05-22 11:10 KST / 실제 머지 = 2026-05-19 21:42 KST (62h 조기)
- 사용자 판단 근거: (a) 3중 시그널 누적(CI+가디언 3라운드+Vercel) /
  (b) 추가 관찰 윈도 한계 효용 체감 / (c) PR-1 후 ~10.5h 회기 0 = 카나리
  부분 안정화 / (d) 사용자 일정·판단

**(3) 가드 준수**
- self-merge 금지 = 100% 준수 (사용자 직접 admin-override 실행, CC 머지 미실행)
- CC 머지 미실행 = 영구 표준 무손실
- 3일 권고 = **권고 차원** 우회 (표준 차원 무손실 — 표준 ≠ 권고 구분 유지)

**(4) main tip 재검증 결과**
- merge commit = `1260a95f` (Merge PR #61, parent `f96cf765`, --merge)
- `f96cf765..1260a95f` diff = 완전 ∅ (tree `9423eabf…` 바이트 동일)
- PR 변경셋 (`37d412dc..1260a95f`) = 11 files · +174 / −442 정합
- tsc 0 errors / lint 게이트 통과 (tree 동등 pr3 워크트리 검증, main
  워크트리 WIP 무터치)
- 잔존 lint warning = PR-3 11파일 외 기존(`react-hooks/exhaustive-deps` 등),
  회귀 아님. 본질 diff 0, 회귀 표면 0

**(5) Phase 3a Stage 4 종료 인지**
- PR-1 #59 (WdGroupedStatCard SSOT + LV-001 카나리, `942b12ea`) ✅
- PR-2 #60 (WdUsageBarChart LV-002 + WdStatusHeatGrid AT-004, `37d412dc`) ✅
- PR-3 #61 (휴가 페이지 reskin + WS-D + WS-C, `1260a95f`) ✅
- 다음 Stage 5 = PR-4 (WdMonthlyStatCard 근태 카나리) 가디언 라운드 1 별도 진입

**(6) 후속 트랙 인용**
- Phase 4 다크 트랙: N+10 단일근인 정량확정 (`.dark --primary` 1-line
  마이그레이션, 4항목 동시 해소)
- N4 라이브 갭 RECORD: N+3 약속, 별도 라운드
- LV-007 이력 다운로드 / LV-008(F8 대체자 백엔드 N+5) / DataTable 카드
  reflow(N+7): 별도 트랙 누적

- 가디언: 머지 후 절차 1·2단계 PASS. 결정 SHA: 본 커밋

### N+12. PR-4 A 단계 발견 — 신규 워크트리 스캐폴딩 prisma generate 2-step 필수 (N+10 보강)

> PR-4 A 단계 발견. N+10 INF-1 우회 방법론 보강(사후 발견·진화 트래픽 명료성 = 신설). 코드 0.

**(1) 발견 컨텍스트**
- PR-4 A(WdMonthlyStatCard 래퍼) 신규 워크트리
  `feat/at005-monthly-stat-canary`(base `1260a95f`) 진입 시점
- prisma diff 0 확인 (`37d412dc..1260a95f -- prisma/` = 0 files) →
  N+10 스캐폴딩 재사용 가드 충족
- 그러나 신규 워크트리 tsc 실패: `@/generated/prisma/*` 모듈 미해결
  (src/types/employee.ts·index.ts)
- 원인: prisma client `output = "../src/generated/prisma"` (gitignore,
  워크트리별 생성, node_modules 심볼릭 미커버)

**(2) Remedy**
- `npx prisma generate` → exit 0, `./src/generated/prisma` 생성
- schema diff 0 ≡ main `1260a95f` → **드리프트 0**(client 동등성 정량 확정)
- A.0/N+10 가드 예견 범위 내 ("변경 시 = prisma generate 필요")

**(3) N+10 방법론 보강 (PR-5+ 재사용 가드)**
- N+10 = "심볼릭(node_modules+.env+.env.local)" 1-step 기록
- 보강: 신규 워크트리 재사용 = **"심볼릭 + prisma generate" 2-step 필수**
- 사전 가드 절차(코드 진입 직전): (a) prisma 변경 0 확인(drift 0 보장)
  (b) 심볼릭 3건→main (c) `npx prisma generate`(workspace-local client)
  (d) tsc baseline 0 확인

**(4) 적용 범위**
- PR-4 B/C/D: 동일 워크트리 재사용 = generate 1회 충분
- PR-5+ 신규 카나리/reskin 워크트리: 2-step 가드 활성
- prisma 변경 발견 시 = drift 위험, generate 후 schema diff 0 **재확인
  의무**(단순 generate만으로 drift 0 미보장)

**(5) 가드 무손실**
- main `1260a95f` 무변경 · schema diff 0(드리프트 0 정량) · 가드 위반 0
  (generate = workspace-local, gitignore 자산)

**(6) 후속 트랙**
- N+10 본문 보충 아닌 **N+12 신설**(사후 발견+방법론 진화 트래픽 명료성)
- PR-5+ 진입 가디언 라운드 1 시 N+12 인용 의무
- prisma output 경로 변경 시(gitignore 해제/워크스페이스 표준화) 재평가

- 가디언: PR-4 A 단계 PASS(m0047) 후속 방법론 보강. 결정 SHA: 본 커밋

### N+13. PR-4 B.0 발견 — AT-005 case (iii) 코드부재 + monthly API 3/5 미제공 = 카나리 자연 확장

> PR-4 B.0 read-only 확인 발견. 가디언 m0051 스코프 (A) 클라이언트 집계 확정. 코드 0.

**(1) 발견 컨텍스트**
- PR-4 B 단계 B.0 사전 read-only 확인 시점
- AT-005 surface 코드 = 프로덕션 **부재** (case iii). 유일 매치 =
  `src/app/dev/components/Fixtures.tsx` dev 픽스처. #02 분류 "AT-005 =
  나, proto만 코드 부재" 정합
- 호스트 `AttendanceClient` 존재하나 5지표 블록 미구현 (monthly 관련
  코드 = PR-2 AT-004 히트그리드 한정)

**(2) monthly API 갭 (F18 실측)**
- `GET /attendance/monthly/[year]/[month]` 응답: `summary{ workedDays,
  totalMinutes, totalOvertimeMinutes }` + `days[]{ date,status,clockIn
  (ISO),clockOut(ISO),totalMinutes,overtimeMinutes,workType,note }`
- 5지표 매핑: ① 근무일=`summary.workedDays` ✅ / ④ 초과누계=
  `summary.totalOvertimeMinutes`÷60 ✅ / ② 출근평균=`days[].clockIn`
  집계 ❌ / ③ 퇴근평균=`days[].clockOut` 집계 ❌ / ⑤ 지각=
  `days[].status==='LATE'` 집계 ❌ → 3건 클라이언트 집계 필요

**(3) 가디언 판정 (m0051)**
- 스코프 = **(A) 클라이언트 집계** — F18(monthly API 변경 0) 100% 준수
  · 백엔드 무변경 = 머지 게이트 단순 · proto 5지표 충실(1st principle)
- 집계 위치 = **신규 helper 순수함수**(재사용·테스트 가능, status/chart
  SSOT 동형 도메인 helper 분리)
- surface 마운트 = `AttendanceClient`(직원 본인 attendance 자연 위치,
  LV-001 카나리 동형)
- 거부: (B) API summary 확장=F18 위반 / (C) 범위 축소=proto 충실 위반

**(4) 카나리 범위 자연 확장 (표준 명료화)**
- PR-1 LV-001 = render-swap (기존 `balances` prop 베이스, 표시 래퍼만)
- PR-4 AT-005 = **신규 마운트 + 신규 집계** (case iii + F18 갭):
  A=WdMonthlyStatCard 래퍼(완료 `d9526365`) / B1=helper
  `monthly-aggregate` 신설(예정) / B2=AttendanceClient 신규 마운트(예정)
- 카나리 = render-swap 한정 아닌 "신규 마운트 + 데이터 집계" 포함
  표준 명료화 (PR-5+ 카나리 진입 가드)

**(5) 가드 무손실**
- F18 API 변경 0(클라 집계=read-only 변환) · F17 timezone SSOT(helper
  내 `formatToTz`, 인라인 0) · F15 신규 키 0 · F16 status/chart 확장 0
  (베이스 valueTone) · F20 베이스 불가침 · 동결 SHA 변경 0

**(6) 후속 트랙**
- B1=helper `monthly-aggregate` 신설+단위테스트+빌드 / B2=AT-005
  AttendanceClient 신규 마운트+빌드 / C=monthly API 매핑 read-only
  정밀(F18 정량 재확인) / D=N2 audit(LV-001 회귀 0, F20)
- PR-5+ 카나리 진입 시 N+13 인용 의무 (case iii / API 갭 사전 검증)

- 가디언: PR-4 B.0 case (iii) 판정 m0051. 결정 SHA: 본 커밋

### N+14. PR-5A WorkdayHero F19 신규 위반 (Phase 4 다크 트랙 일괄)

> PR-5A 시각 검증(다크) 결과 = `WorkdayHero` `from-primary to-primary-dim`
> 그라데이션이 다크에서 lavender 노출. F19 (`text-primary`/`bg-primary`
> 직접 의존) 신규 위반 1건. PR-5A 미수정 = plan V3 확정 사양 + Codex
> Gate 1 Round 3 PASS 후 변경 금지. Phase 4 다크 트랙 일괄 해소.

**(1) 발견 경위**
- PR-5A 가디언 시각 검증(라이트/다크/모바일) 진행 중 다크 모드 =
  `localhost:3015/home` hr@ctr.co.kr 로그인 후
  `document.documentElement.classList.add('dark')` 강제 토글
- `WorkdayHero` (`from-primary to-primary-dim`) 다크에서 lavender 계열 노출
  (globals.css `.dark --primary` = lavender 토큰)
- 8 워클릿 (WorkletGrid) + StatCard 4 + ApprovalPreview 4 = 다크 정합
  (개별 tone 명시 토큰 사용 = lavender 회피)

**(2) F19 가드 위반 분류**
- Codex Gate 1 Round 1 권고: "PR-5+ 카나리 진입 시 `text-primary` /
  `bg-primary` 직접 의존 회피 권장" (`docs/phase-3a/pr-4-pre-diff-round-1.md`
  F19 긍정 발견 섹션)
- PR-5A WorkdayHero 채택 시 `from-primary to-primary-dim` = 권고 위반
- 그러나 plan V3 사양 + Codex Gate 1 Round 3 PASS 후 = "확정 사양 변경 금지"
  가드와 충돌. **계획 우선 + Phase 4 다크 트랙 일괄 해소** 결정 m0079

**(3) Phase 4 다크 트랙 일괄 처리 인벤토리**
- 본 N+14 = Phase 4 진입 시 lavender 의존 컴포넌트 일괄 작성 시작점
- 후보 inventory (현 시점 식별):
  - `WorkdayHero` (PR-5A) — `from-primary to-primary-dim` 그라데이션
  - PR-3/PR-4 N+10 단일근인 = `.dark --primary` 1-line (별 트랙)
  - handover §7 4항목 (WdDrawer / Inspector / BulkActionBar) — PR-5A 무관
- Phase 4 토큰 보강 방향:
  - (옵션 A) `--primary` 다크 변형을 navy 유지로 변경 (전역 영향 = 사이드바·
    버튼 등 회귀 표면 큼)
  - (옵션 B) `--wd-hero-from`/`--wd-hero-to` 별도 토큰 (라이트=primary,
    다크=navy hex)
  - (옵션 C) WorkdayHero 다크 한정 `dark:` Tailwind variant 추가
- 결정은 Phase 4 진입 시 lavender 일괄 트랙 가디언이 판정

**(4) PR-5A 가드 불변**
- 신규 commit 0 (`feat/hr-admin-dashboard-workday` tip `cdbb215f` 불변)
- WorkdayHero 코드 수정 금지 (Codex Gate 1 PASS 후 변경 금지)
- admin-override 머지 (2026-05-24+ KST) 시 본 N+14가 PR description 보강
  자산 (미해소 항목 명시)

**(5) 다른 surface 다크 정합 확인 (긍정)**
- WorkletGrid 8 타일 = primary/tertiary/chart-2/wd-orange/badge-accent/
  warning-bright/chart-4/info — 다크에서도 distinct color 유지 (개별 토큰
  명시 사용, primary 그라데이션 회피)
- ApprovalPreview = `border-l-4` urgency 토큰 (destructive/warning-bright/
  border) + `bg-card` 베이스 — 다크 정합
- StatCard / ListCard / InsightStrip / DashboardHomeShell = 기존 유지, 다크 정합

**(6) PR-5+ 카나리 진입 가드 (재확인)**
- N+10 F19 긍정 발견 + N+14 위반 발생 → PR-5+ 카나리 진입 시 사전 grep
  `from-primary|to-primary|text-primary|bg-primary` 직접 의존 0 검증 의무
- 검증 미통과 시 = Phase 4 다크 트랙 진입 후 작업 또는 별도 토큰 도입

- 가디언: PR-5A 다크 검증 m0079. 결정 SHA: 본 커밋

### N+15. F25 — P2-1 가디언 Gate 2 권고 책임 + Attendance range query 가이드라인

> Codex 외부 리뷰 (PR #63 [comment-4500940912](https://github.com/centralkang-byte/ctr-hr-hub/pull/63#issuecomment-4500940912))
> P2-1 발견 = 가디언 Gate 2 권고가 회귀 유발. `Attendance.workDate` exact UTC instant
> 비교 특성을 Gate 2 권고가 인지하지 못함. P2-1 quick patch 완료 (`675b80cd`).
> 본 N+15 = 책임 명시 + Attendance 쿼리 가이드라인 표준화.

**(1) 발견 경위**
- Codex 외부 리뷰 (PR #63 comment-4500940912) P2-1 지적
- Gate 2 정정 commit (`todayStart` → `tzMidnight`, PR-5A `cdbb215f` 범위)이
  오히려 회귀 유발
- `Attendance.workDate`는 exact UTC instant (`workDate: tzMidnight`로 점 비교
  시 일반 출근 기록 미매칭)
- KST `tzMidnight` = 전날 15:00 UTC → HR 대시보드 근태 타일 항상 0건
  (핵심 KPI 깨짐)

**(2) 가디언 책임 영역 (명시)**
- Codex Gate 2 P2 권고 (`todayStart` → `tzMidnight`)는 Vercel UTC 환경
  0-9시 KST 시간대 카운트 오류를 회피 의도
- 그러나 **`Attendance.workDate` 저장 컨벤션 (UTC 자정 = exact instant)
  미인지** = 점값 비교가 매칭 0 유발
- 정확한 fix = **점(point) → 범위(range) 전환** 필요성 누락
- 본 회귀의 가디언 권고 직접 책임 명시 — 향후 timezone 권고 시 attendance
  저장 컨벤션 사전 확인 의무

**(3) 정확한 해결책 (P2-1 patch `675b80cd` 적용)**
```ts
const tzMidnight = getStartOfDayTz(now, DEFAULT_TZ)  // KST 자정
const dayEnd = new Date(tzMidnight)
dayEnd.setDate(dayEnd.getDate() + 1)

prisma.attendance.count({
  where: {
    companyId,
    workDate: { gte: tzMidnight, lt: dayEnd },  // [tzMidnight, dayEnd) range
    // ... 기존 조건 (clockIn / status)
  },
})
```
- 3 attendance count 전수 적용 (present / late / absent)
- 기존 attendance API (예: `/api/attendance/today`) 패턴 동형
- commit 8 = `675b80cd` (`feat/hr-admin-dashboard-workday`, push origin
  반영 `cdbb215f..742dab35`)

**(4) Attendance 쿼리 가이드라인 (PR-5+ 후속 가드 표준화)**
- 모든 `Attendance.workDate` 쿼리 = **range 형태** (`gte` + `lt`) **의무**
- 점값 (`workDate: tzMidnight` 같은 exact 비교) **금지**
- 신규 attendance API 작성 시 사전 grep `Attendance.*workDate` 권고
- 기존 조회 API 패턴 = SSOT (`src/app/api/v1/attendance/today/route.ts` 등)

**(5) 다른 attendance API 정합 확인 (긍정)**
- `/api/attendance/today` 등 기존 조회 API 모두 range 패턴 정합
- 본 회귀는 PR-5A summary API 신규 추가 분기 (HR_ADMIN/SUPER_ADMIN
  attendanceToday) 에서만 발생
- 기존 코드 회귀 없음 — Gate 2 권고 → patch 8 사이클로 한정

**(6) PR-5+ 카나리 진입 가드 (재확인 + 신설)**
- 사전 grep `workDate:\s*\w+\b` 의무 (point 비교 검출)
- Codex Gate 1 plan review 단계에서 attendance 신규 쿼리 = range 패턴 확인 의무
- N+15 본문 인용 의무 (PR-5+ 진입 가디언 라운드 1)

- 가디언: PR-5A P2-1 회귀 책임 m0083. 결정 SHA: 본 커밋

### 저확실 항목 (Stage 4 가디언 우선검토 — 결정 후 잔존 리스크)

- **LV-002** (월별 패턴+인사이트) — batch 포함 확정이나 chart.ts SSOT **첫 소비처** =
  P2b 자산 실검증 부담. 차트 색 의미색/카테고리 혼합배열 가이드(phase-2-closeout §4.2) 준수 확인.
- **LV-009 → Q6 연동** — `/my/leave` 폐기 + 홈/허브 인라인화는 `WdLeaveBalanceCard`
  완성에 의존. 링크 6+곳 재지정 = 딥링크 회귀 표면, N2 E2E로 커버 필요.
- **M 모바일** — `.tbl-as-cards`는 신규 패턴 도입, 프로토타입에 검증 레퍼런스 없음(모름).
