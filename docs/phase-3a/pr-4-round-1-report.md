# PR-4 가디언 라운드 1 보고 — WdMonthlyStatCard 근태 카나리 (AT-005)

> Phase 3a Stage 5. 코드 작업 0 (분석/문서만). Base `2a27a8cd` 확장.
> SSOT: `02-myspace-attendance.md` §7 + `01-myspace-leave.md §7`(PR-3 학습).
> 동결: main `1260a95f` / PR-3 `f96cf765` / phase3a-audit `2a27a8cd` (불변).

---

## §1. PR-4 surface 정의

- **카나리 패턴**: PR-1 LV-001(`WdLeaveBalanceCard`) 동형 — 단일 컴포넌트
  카나리, 페이지 전면 reskin 아님. PR-4 = AT-005 월간 통계 카드 카나리.
- **출발 surface**: 프로토 `_design-reference/page-my-space.jsx:153-172`
  ("월간 통계" 카드, sub "5월", 5지표 label-left/value-right 행). 코드베이스
  = **부재**(#02 AT-005 분류 "나 — proto만, 코드 부재", 등급 저).
- **도착 SSOT**: `WdGroupedStatCard`(베이스, PR-1 #59 `942b12ea` 머지 →
  main `1260a95f` 존재) + 신규 `WdMonthlyStatCard`(얇은 래퍼). #02 §7 Q5 =
  **(B) WdGroupedStatCard 일반화 승격** 확정, AT-005 = "2번째 실수요"
  (휴가 Q6서 보류한 (C) 트리거). #01 §7 N = "#01 백포팅 완료" 사실.
- **데이터 소스**: `src/app/api/v1/attendance/monthly/[year]/[month]/route.ts`
  **기존 존재**(#02 §4 "미소비") — read-path, **스키마 변경 0**.
- **배치**: `/attendance`(AttendanceClient) 월간 통계 슬롯 (proto my-space
  월간 영역). 휴가 `WdLeaveBalanceCard` `/leave`+홈/허브 동형.

## §2. 프로토 SSOT 인용

`_design-reference/page-my-space.jsx:153-172` (정확 범위):
- L153 `<span className="title">월간 통계</span>` · L154 sub "5월"
- L158-163 5지표 배열 (label / value / unit / 의미색):

| # | 지표 | 값(목업) | 단위 | 색 (proto) |
|---|---|---|---|---|
| 1 | 근무일 | 21 | 일 | `var(--fg)` |
| 2 | 출근 평균 | 08:52 | — | `var(--success)` |
| 3 | 퇴근 평균 | 18:48 | — | `var(--accent)` |
| 4 | 초과근무 누계 | 4.2 | h | `oklch(55% .16 290)` (violet) |
| 5 | 지각 | 1 | 회 | `oklch(50% .16 60)` (amber) |

- 행 패턴: `flex justify-between` label(`fg-muted` 12.5px) ↔ value
  (`font-mono` 16px 600 의미색) + unit(`fg-faint` 11px), `borderBottom`.
- #02 §3.1/§7 Q5: WdLeaveBalanceCard(잔여바 도메인특화) 부적합 →
  `WdGroupedStatCard`(그룹 라벨 + N 지표/진행바 슬롯) 일반화. AT-005 래퍼 =
  5지표 + 의미색(②success ③accent ④violet ⑤amber) 주입.

## §3. §7 "G1 강화" 의제 분석 (m0007 parked 정밀화)

- **출처**: #02 §7 Q3 = "동시 교정 OK + **G1 강화**". 정확 내용:
  > G1 = toast만 불충분 → **낙관 UI 롤백 + 재시도 CTA + 에러사유 표시**까지.
  > `AttendanceClient.tsx:145·154·207·224` 4지점 전부.
- **PR-3 WS-D 대비 강화 델타**: PR-3 WS-D = 무음 catch→toast+재시도 CTA
  (fetchRequests·handleCancel). 근태 G1 = **+ 낙관 UI 롤백** 추가 — clock-in/out
  L207·224는 낙관적 상태 전이(출근→WORKING 즉시) 후 실패 시 무음 복귀
  (#02 §3 "휴가 L313보다 UX 악화"). 강화 = 실패 시 (a) 낙관 상태 롤백
  (b) toast 에러사유 (c) 재시도 CTA 3중.
- **PR-4 카나리 범위 판정 (조기 가드)**: AT-005 카나리 = **월간 통계 카드
  단독**(LV-001 동형). G1 강화(clock-in/out 에러처리 4지점)는 **근태 페이지
  reskin 트랙**(AT-001~003 + G1~G3)에 속함 — AT-005 카나리 surface와
  **분리**. PR-4 = AT-005만, G1 강화는 별도 근태 reskin PR(PR-3 A.1/A.2
  분리 동형). **위반 회피 가드**: PR-4가 AttendanceClient clock 로직에
  손대면 scope creep → 카나리는 월간통계 슬롯 주입만, clock 에러처리 불가침.

## §4. 사전 F-건 식별 (PR-2 F1-5 / PR-3 F6-14 학습 적용)

| F-후보 | 잠재 충돌 | 사전 판정 옵션 |
|---|---|---|
| **F15** i18n 신규 키 | 5지표 라벨(근무일·출근평균·퇴근평균·초과근무누계·지각) `attendance` ns(152키) 부재 가능 | F1 동형 — 기존 키 재사용 우선, 부재 시 신규 키 분리(활성 DO NOT 준수). PR-3 N+6/N+8 i18n 이연 패턴 |
| **F16** 의미색 SSOT | proto ④violet `oklch(55% .16 290)` ⑤amber `oklch(50% .16 60)` = wt 팔레트 매핑 필요 | P2a wt SSOT 매핑 (PR-3 Badge accent wt-4 `rgb(115,87,209)` 선례). 미정의 시 swatch 사전보고 게이트 |
| **F17** 출/퇴근 평균 시각 포맷 | 08:52 형식 = locale/timezone 의존 | `src/lib/timezone.ts` SSOT 강제(raw Date 금지, CLAUDE.md). tabular-nums |
| **F18** monthly API 데이터 형태 | route 미소비 → 응답 스키마 ↔ 5지표 매핑 불확실 | 코드 진입 시 route.ts 응답 형태 audit(N1 API 레이어). 미정합 시 가디언 보고 |
| **F19** 다크 known-deferred | #02 §3 "근태엔 WdDrawer 없음 → 다크 lavender 상속 0" | AT-005 카드 `text-primary`/`bg-primary` 사용 시 N+10 단일근인 합류 가능 — 사전 매핑 §5 |
| **F20** WdGroupedStatCard 일반화 회귀 | (B) 승격 = 베이스 일반화 → 휴가 WdLeaveBalanceCard 래퍼 회귀 위험 | 베이스 변경 시 휴가 카나리 회귀 audit 의무(N2). 무변경 주입만 우선 |

→ 사전 F-건 누적 = **F15~F20 (6건)**. 전부 코드 진입 시 정밀 판정 (라운드 2/사전 diff).

## §5. DO NOT 가드 인용 (PR-4 surface 한정)

활성 DO NOT (CLAUDE.md) + PR-4 특화:
- `messages/*.json` 기존 키 편집 금지 — 5지표 라벨 신규 키만(F15)
- `src/components/layout/*`·`navigation.ts`·`middleware.ts`·prisma·companyFilter·
  RLS 불가침 (AT-005 = read-path 표시, 백엔드 0)
- **PR-4 특화**: ① `WdGroupedStatCard` 베이스 내부 변경 금지(주입/래퍼만,
  F20 회귀 회피) ② `status.ts`/`chart.ts` SSOT 확장 0 (AT-004는 PR-2서
  status.ts 처리 완료, AT-005는 통계카드라 status/chart 무관) ③ 근태
  백엔드(`/attendance/*` route·AttendanceRecord) 무변경 ④ clock-in/out
  로직·G1 강화 불가침(§3 — 별도 트랙)
- **known-deferred 교집합 사전매핑**: N+10 단일근인(`.dark --primary`
  lavender `234 89% 74%`) — AT-005 카드가 의미색(success/accent/violet/amber)
  사용 시 `--primary` 직접 의존 **낮음**(지표색은 wt/시맨틱), 단 카드
  컨테이너/강조가 `text-primary` 쓰면 N+10 클래스 합류. **사전 매핑**:
  PR-3 세그먼트 동형 처리(기존 클래스 합류, 신규 결함 0, Phase4 일괄). 근태
  WdDrawer 부재로 휴가 대비 다크 노출 표면 ↓.

## §6. N+10 INF-1 스캐폴딩 PR-4 재사용 검증 계획

- **재사용 자산**: pr3 워크트리 심볼릭(`node_modules`·`.env`·`.env.local`
  →main) + priceless-dijkstra `.claude/launch.json` `pr3-verify` config
  (보존 확인됨, 4단계 재사용 실증).
- **prisma 변경 0 사전 확인 (read-only)**: PR-3 `37d412dc...HEAD -- prisma/`
  = **0 files**(확인 완료). main `1260a95f` prisma = scaffolding base와 동일.
  AT-005 = read-path(monthly API 기존)·스키마 무변경 → **PR-4도 prisma 0
  예상** → 심볼릭 client 호환 유지.
- **재사용 가드**: 코드 진입 시 PR-4 브랜치 `prisma/` diff 0 **재확인 필수**.
  변경 발생(예상 외) 시 = 심볼릭 client 불일치 → `npx prisma generate` 또는
  워크트리 deps 독립 설치(신규 스캐폴딩). N+10 (1) 가드 동일.
- **워크트리 선택**: PR-4 = 신규 브랜치(`feat/attendance-monthly-stat` 등)
  신규 워크트리 권장(PR-3 머지 후 pr3 워크트리는 MERGED, PR-4 코드 분리).
  단 라이브 검증은 보존 스캐폴딩 패턴(심볼릭+launch config) 재사용.

## §7. 라운드 1 → 라운드 2 / 코드 진입 절차

- **라운드 1 PASS 시**: 가디언 판정 → (a) 라운드 2(Codex Gate 1 — PR-4
  계획 3+파일 예상 시 CLAUDE.md 의무) 또는 (b) 코드 진입 사전 절차.
- **코드 진입 가디언 승인 절차** (PR-3 동형): 사전 diff 7섹션 의무 →
  가디언 라운드(들) → tsc/lint/Codex Gate2/E2E/시각 → origin push → PR open →
  CI 회귀 분석 → 사용자 admin-override(self-merge 금지).
- **3일 권고 (PR-3↔PR-4 동형)**: PR-3 #61 머지 = 2026-05-19 21:42 KST →
  PR-4 머지 3일 권고 = **2026-05-22 21:42 이후**(또는 PR-3 11:10 기준
  2026-05-22 11:10). 현 시점(라운드 1) = 분석 단계라 무관, PR-4 **머지
  시점** = 별도 사용자 판단(N+11 선례 = 권고 차원, 사용자 override 가능).
- **카나리↔다음 간격**: PR-1→PR-3 3일 권고 동형으로 PR-4 머지 후 차기
  근태 reskin PR도 안정화 윈도 권고.

---

## 라운드 1 요약 (가디언 판정 요청)

| 항목 | 결과 |
|---|---|
| PR-4 surface | AT-005 월간통계 카나리 = WdGroupedStatCard 베이스 + WdMonthlyStatCard 래퍼, /attendance, read-path(monthly API 기존), 스키마 0 |
| 프로토 SSOT | `page-my-space.jsx:153-172` 5지표 + 의미색 명세 인용 완료 |
| G1 강화 의제 | 정밀화 = 낙관UI롤백+재시도CTA+에러사유 (clock 4지점) = **근태 reskin 트랙, AT-005 카나리와 분리** (scope 가드) |
| 사전 F-건 | **F15~F20 (6건)** 식별 + 사전 판정 옵션 |
| N+10 스캐폴딩 재사용 | 가능 (prisma 0 확인, 코드 진입 시 재확인 가드) |
| 진입 절차 | 라운드 2(Codex Gate1) or 사전 diff 7섹션 → 가디언 → 머지(3일 권고 2026-05-22+, 사용자 판단) |

**가디언 판정 요청**: ① 라운드 1 PASS 여부 ② 다음 진입 = 라운드 2(Codex Gate 1) vs 코드 진입 사전 diff ③ AT-005 카나리 범위(G1 강화 분리) 확정 ④ F15~F20 사전 판정 게이트 시점.
