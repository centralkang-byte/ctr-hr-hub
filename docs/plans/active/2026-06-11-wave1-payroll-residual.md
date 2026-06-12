# Wave 1 — 급여 잔여 4라우트 + 국기 이모지 4파일 프로토 정합

> 세션: S288 (2026-06-11) · 브랜치 `design/wave1-payroll-residual` (base c991fde2 = #156)
> 감사: 5-agent 갭 감사 + 메인 루프 오탐 검증 + **Codex Gate 1 반영 완료** (HIGH 6 중 4 사실 반영·STATUS_TABS 중복 주장은 오탐 기각·GL-6은 감사 오탐으로 삭제)
> 원칙: **프로토 = 픽셀 SSOT, 기능 절대 보존** (현 구현이 프로토보다 풍부한 기능 = 갭 아님)
> 1:1 프로토 페이지 부재 → **패턴 단위 Pixel Gate**: viewport 1440/375, 기준 = `page-payroll-sim.jsx` 패턴 + DESIGN_RULES §3(KPI)/§4(탭), 의도적 편차는 본 문서 부록에 기록

## 대상

| 페이지 | 현 구현 | 갭 | 에이전트 |
|---|---|---|---|
| `/payroll/anomalies` | 280줄 | AN-1~7 | A |
| `/payroll/global` | 398줄 | GL-1~6 | A |
| `/payroll/year-end` | 761줄 | YE-1~8 | B |
| `/payroll/import` | 589줄 | IM-1~8 | C |
| 국기 이모지 잔여 3파일 | OvertimeTab·ComplianceClient·i18n config+LanguageSwitcher | FL-1~3 | D |

**이번 스코프 제외 (후속 묶음)**: adjustments(635줄)·bank-transfers(626줄, Dialog 11곳 = WdDrawer 전환 후보)·close-attendance(507줄) — payroll Wave 1 마지막 묶음으로 별 세션.

## 공통 (ALL — 전 라우트 적용)

- **ALL-1 페이지 스켈레톤**: 래퍼 `mx-auto max-w-7xl p-4 space-y-4`(hub 미러) · 헤더 56px 아이콘 타일(`h-14 w-14 rounded-[14px]` primary-container 계열) · `TYPOGRAPHY.pageTitle`(26px) + 13px 부제.
- **ALL-2 버튼 토큰화**: hardcoded 버튼 클래스 → `BUTTON_VARIANTS` (primary = warm 오렌지 자동, #152 SSOT).
- **ALL-3 EmptyState**: 수동 빈 상태 div → `EmptyState` 컴포넌트 (기본 sub 억제 — S287 컨벤션). 로딩은 EmptyState 금지(skeleton/spinner 유지 — S287 Codex G1).
- **ALL-4 상태 색 토큰**: raw 팔레트(emerald/amber/indigo) → status.ts 시맨틱 토큰 (success=tertiary 계열·warning=`bg-warning-bright/15 text-ctr-warning`·info=primary 계열). D17 bg/text 분리.
- **ALL-5 KPI 패턴 (Codex G1)**: `WdStatStrip`은 **정확히 4개 실수치일 때만**(컴포넌트 계약·DESIGN_RULES §3 패턴 A). 3개/6개 페이지는 기존 카드 구조 유지 + 토큰 정합만(`TYPOGRAPHY.label`/`stat`·1px 보더·시맨틱 tone).
- **ALL-6 탭 (Codex G1)**: Radix Tabs + TAB_STYLES. `aria-label`은 **TabsList**에. 참조 구현 = `OrgClient.tsx`·`PayrollSimulationClient.tsx`. 필터형 탭(같은 테이블 위 필터)은 테이블 단일 렌더 유지 — 패널 복제 금지.
- **ALL-7 i18n**: 기존 키 최우선 재사용. 신규 키 필요 시 코드에 t() 호출 작성 + 키 목록 보고 (messages/*.json 편집 금지 — 메인 루프가 5로케일 일괄 반영 후 runtime QA·Gate 2 진행).

## Workstream A — anomalies + global

**anomalies:**
1. **AN-1** (P0) ALL-1 스켈레톤 (현재 `p-4` only, `w-9 h-9` 아이콘, text-2xl 제목 — :128-136).
2. **AN-2** (P0) RULE_ICONS 이모지("📊📈🌍⚡" :43-47) → Lucide(BarChart3·TrendingUp·Globe·Zap) — 전 룰 정의 + default 폴백.
3. **AN-3** (P0) SEVERITY_COLORS raw 팔레트(:30-34) + emerald(:170,191,245) → ALL-4 토큰.
4. **AN-4** (P1) KPI 3장(:169-187) — **WdStatStrip 미적용**(3개, ALL-5). 기존 카드 유지 + `TYPOGRAPHY.label`/`stat` + 시맨틱 tone(totalAnomalies>0 → destructive, 0 → tertiary).
5. **AN-5** (P1) 빈 상태 2곳(:190-198, 241-251) → EmptyState (ALL-3).
6. **AN-6** (P1) severity 배지 inline span(:218) → `Badge`/status.ts 매핑.
7. **AN-7** (P2) anomaly 카드 h3 → `TYPOGRAPHY.cardTitle`.
- **이연**: renderDetail의 camelCase→헤더 자동생성(:100) i18n화 — rule별 동적 컬럼이라 키 폭발, 별 칩.

**global:**
1. **GL-1** (P0) FLAG 이모지 맵(:52-57) + 렌더(:319, 🏢 폴백 포함) 제거 → font-mono 국가/통화코드 텍스트 (S287 SIM-3 동일 패턴).
2. **GL-2** (P0) "집계됨" 배지 raw emerald(:343-346) → ALL-4 success 토큰.
3. **GL-3** (P1) ALL-1 스켈레톤 (:118-147).
4. **GL-4** (P1) KPI 4장(:177-203) → `WdStatStrip` (정확히 4개 ✓ — tone: 의미별 info/success/neutral/warning).
5. **GL-5** (P1) 3분법 완결 (Codex G1 명세): ① loading = 기존 스피너 유지 ② **fetch error 상태 신설** — catch에서 `error` state set → 페이지 본문 대신 EmptyState(에러 카피) + 재시도 버튼(`fetchData` 재호출) ③ 성공-빈 = 차트 3곳 "데이터 없음" 텍스트(:211,231,276) → EmptyState `size="sm"`, **기존 h-52 차트 컨테이너 높이 유지**(차트 영역 리플로 금지).
6. **GL-6** (P2) 환율 경고 배지(:161) → ALL-4 warning 토큰.
- **기각 (감사 오탐)**: "border 제거(No-Line Rule)" — Wave 0에서 폐기(CEO: 가시 보더). / "CHART_COLORS 하드코딩" — 이미 `[...CHART_THEME.colors]`(:51).
- **금지**: FX 42P01(별 칩 task_c13bac02)·SUPER 게이트·월 네비 로직 무변경.

## Workstream B — year-end

1. **YE-1** (P0) `border-b-2` 언더라인 탭(:535-561) → Radix Tabs + TAB_STYLES (ALL-6). **필터형 탭** — 값 4개 고정(`all`/`submitted`/`hr_review`/`confirmed`, 변경·추가 금지), `value={statusFilter}` `onValueChange={setStatusFilter}` — statusFilter는 **API 재조회 의존성**(:287,304)이므로 setter 외 흐름 무변경, 테이블 단일 렌더.
2. **YE-2** (P0) ALL-1 스켈레톤 (:448-484).
3. **YE-3** (P1) 스탯 6카드(:502-532) — **WdStatStrip 미적용**(6개, ALL-5). 기존 그리드 유지 + 토큰 정합 + 완료율 진행바 유지.
4. **YE-4** (P1) 금액 셀 `font-mono tabular-nums` (테이블 :637-645 + 모달 :176,199).
5. **YE-5** (P1) 에러 배너(:488) D17 bg/text 분리 (ALL-4).
6. **YE-6** (P1) raw emerald/amber 배지(:187-197) → ALL-4 토큰.
7. **YE-7** (P2) 테이블 loading/empty 텍스트(:598-609) → loading=skeleton·empty=EmptyState (ALL-3).
8. **YE-8** (P2) bulk 선택 바(:697-711) — **공유 BulkActionBar 채택 취소**(Codex G1: disabled/loading 미지원 → 처리중 재클릭 중복요청 위험). 현행 바 유지 + sticky/토큰 스타일 정합만. **탭 전환 후 선택 유지 = 기존 동작 그대로 보존**(숨은 행 선택 포함 — 동작 변경 금지, 편차 기록).
- **유지**: SettlementDetailModal = Dialog 유지 (조회+confirm 혼합 — §5.4 confirm류; Inspector 전환은 과리팩터).
- **금지**: fetchSettlements/confirm/receipt/bulk-confirm API 로직 (#138 fail-closed 보안) 무변경.

## Workstream C — import

1. **IM-1** (P0) `border-b-2` 탭(:242-260) → Radix Tabs + TAB_STYLES (ALL-6). 패널형 탭(upload/mapping/history — 내용 상이) → TabsContent 분리 OK. **history 탭 활성화 시 fetch useEffect(:107-113) 흐름 보존**.
2. **IM-2** (P0) **깨진 Tailwind 클래스 `hover:bg-primary/10/20`(:322) → `hover:bg-primary/10`** (진짜 버그 — hover bg 무동작).
3. **IM-3** (P0) statusBadge() raw 색(:176-193) → ALL-4 토큰/StatusBadge.
4. **IM-4** (P1) ALL-1 스켈레톤 (`p-6` :208 → 표준 래퍼).
5. **IM-5** (P1) 버튼 hardcoded(:229-236, 274, 343, 484, 491) → BUTTON_VARIANTS (ALL-2).
6. **IM-6** (P1) 빈 상태 텍스트 fallback(:270-276) → EmptyState 일관화 (:279 기존 사용처와 통일).
7. **IM-7** (P1, Codex G1 축소) 회사/매핑 선택 버튼그룹(:224-237, 280-292) → `aria-pressed` 추가. `useArrowKeyNavigation` 훅이 drop-in이면 적용, 아니면 aria-pressed만 + 편차 기록. **회사 전환 시 state 초기화 로직 신규 추가 금지**(기존 동작 보존 — editingMapping/selectedFile 흐름 무변경).
8. **IM-8** (P2) 섹션 제목(:267,299,362,412)·폼 라벨(:416,425,436) → TYPOGRAPHY 토큰.
- **이연**: 매핑 편집 인라인 패널(:411-499) → WdDrawer 전환(중앙 Dialog 아님 — §5.4 금지 대상 아님, 업로드 state 리스크) / 자체 토스트(:548-552) → use-toast 통합.
- **카피 확인**: 외주처 이름(KPMG 등) 노출 없음 실측 — 유지 ([[payroll-overseas-naming]]).

## Workstream D — 이모지 잔여 3파일

1. **FL-1** OvertimeTab `COUNTRY_RATES[].flag`(:47-53, 렌더 :225) → flag 필드 삭제 + font-mono 코드 텍스트 (CTR 법인코드 표기, [[ctr-company-codes]] 정합).
2. **FL-2** ComplianceClient `countryCards[].flag`(:115-129, 렌더 :194 text-2xl) → flag 삭제 + font-mono 국가코드 칩 (기존 카드 구조·색 유지).
3. **FL-3** i18n/config.ts `localeFlags`(:21-25) **export 삭제** + LanguageSwitcher 3사이트(:63,74,84) 언어명(`localeNames`)만 렌더 — es=🇲🇽(스페인어≠멕시코) 오매핑 자체 제거. LanguageSwitcher는 동결 대상 아님(동결 = Sidebar·MobileDrawer·navigation.ts만). **3사이트 모두 키보드/스크린리더 회귀 확인**(Codex G1).

## 검증 게이트

1. `npx tsc --noEmit` 0 · `npm run lint` 0
2. i18n 신규 키 5로케일 반영 완료 (runtime QA 전제 — Codex G1)
3. e2e: payroll 관련 spec 회귀 (커버 spec 실측 후 실행; 새 기능 없음 → 신규 spec 불요, 기존 가드 green 의무)
4. **Pixel Gate (패턴 단위)**: `python3 -m http.server 8077 -d _design-reference` + side-by-side, viewport 1440/375, 라우트별 의도적 편차 부록 기록
5. 멀티롤 UI QA: `super@ctr.co.kr`(global 포함) + `hr@ctr.co.kr`(year-end·import·anomalies + **global 접근 거부 확인** — Codex G1) + LanguageSwitcher 동작. 375px 모바일.
6. visual 스냅샷: 변경 라우트 분만 갱신 (전량 재생성 금지 — 웨이브당 1회 규칙)
7. Codex Gate 2

## 함정 (메모리)

- dev 서버 떠 있는 worktree에서 `npm run build` 금지 [[hrhub-build-poisons-dev-next]]
- 헤드리스 프리뷰 rAF 미발화 → recharts 막대 빈 렌더 = 가짜 회귀 (global 차트 3개 해당) [[hrhub-headless-preview-verification-traps]]
- e2e·프리뷰·HMR 동시 부하 금지

## 부록 — Pixel Gate 기록 (구현 후)

### ⚠ 감사 전제 정정: 글로벌 급여·연말정산은 1:1 프로토 페이지가 **실존**

Pixel Gate에서 프로토 사이드바 급여 섹션 확인 결과 글로벌 급여·연말정산 페이지가 렌더됨 (감사 시 "1:1 부재" 전제는 jsx 파일명 목록만 본 오판 — 수동 조정·이체 관리도 존재, **다음 묶음에서 1:1 비교 필수**).

- **글로벌 급여 프로토 IA**: KPI 4장(총 인건비·글로벌 인원·지급 완료 N/6·이상 검토) + **법인별 카드 그리드**(현지 통화·KRW 환산·FX%·인원·환율). 현 구현 = 차트 3개 + 테이블. → 이번 PR은 토큰/패턴 정합만(스코프), **카드 그리드 IA 전환은 별도 결정 필요** (기능상 차트가 더 풍부하나 프로토=픽셀 SSOT와 IA 상이).
- **연말정산 프로토 IA**: 5단계 진행 스텝퍼 + 주요 일정 + 자료 누락 패널 (진행관리 대시보드형). 현 구현 = 검토·확정 워크플로(테이블+bulk confirm). → 동일하게 IA 전환은 별도 결정.
- **프로토는 국기 이모지 사용** (법인 카드) — 그러나 DESIGN.md "System emoji FORBIDDEN" + S287 SIM-3 결정(#156 머지)이 우선해 제거 유지. **프로토 대비 의도적 편차**로 명시.
- **연말정산 프로토 탭 = 언더라인** — §5.5 금지라 세그먼트 채택 (S287 SIM-1 선례 그대로).

### 라우트별 의도적 편차

**anomalies**: ① 헤더 타일 destructive 틴트 → `bg-accent text-primary` 표준화 ② KPI는 실제 4장(플랜 "3장"은 감사 미스카운트)이나 ruleCount=상수라 "실수치 4개" 아님 → WdStatStrip 미적용, 카드+토큰 정합 ③ "이상 없음" 성공 배너(green bg) → 중립 EmptyState (success 시그널은 KPI tone으로) ④ 룰별 placeholder 가로 행 → EmptyState sm 세로 카드.

**year-end**: ① 스탯 tone — in_progress·submitted 둘 다 info (STATUS_MAP SSOT 정합, 페이지 내 StatusBadge와 일치) ② 스탯 카드 p-4 (compact density) ③ 모달 최종정산 패널 색보더 → 중립 1px ④ 탭 count 칩 유지 (프로토 세그먼트엔 없으나 기능 보존) ⑤ bulk 바 = sticky 카드형 (proto floating pill 대신 — Codex G1 결정).

**import**: ① 회사/매핑 선택 토글 선택 상태 = navy fill 유지 (주 액션 아님 → warm 미적용, ScenarioListSheet 선례) ② 업로드 CTA = BUTTON_SIZES.lg ③ 매핑 테이블 내부 도달 불가 EmptyState 행 미제거 (기능 보존) ④ 토스트·매핑 인라인 에디터 = 이연.

**global**: ① KPI 항목 = 기존 4지표 유지 (프로토 4지표와 상이 — 기능 보존) ② 차트+테이블 IA 유지 (상기 카드 그리드 별도 결정) ③ net bar `#059669` = 차트 도메인 색 유지.

### 검증 결과 (S288)

- tsc 0 · lint 0 (기존 무관 warning 3 제외) · i18n 신규 2키 × 5로케일 반영·전 사용 키 resolve 검증
- e2e flows/payroll: **15 pass / 4 flaky(재시도 green — dev 컴파일 지연) / 0 fail** + 신설 가드 2 (year-end 필터 탭·import 패널 탭+history fetch)
- visual 갱신: anomalies·global × light/dark × 3뷰포트 = **12장만** (전량 재생성 금지 준수)
- UI QA: hr@(year-end·import·anomalies 정상, global 403 → 신설 error EmptyState+재시도 확인) · super@(global 데이터 정상, WdStatStrip·FX 경고 warm 토큰) · LanguageSwitcher 국기 제거 확인 · 375px reflow (import 라벨 nowrap 픽스)
- 픽스 2건 (QA 발견): global KPI 풋터 단위 어순(`만원 31,875`→`31,875 만원`) · import 법인선택 라벨 모바일 세로깨짐(whitespace-nowrap)
