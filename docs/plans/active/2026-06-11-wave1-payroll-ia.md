# Wave 1 — 글로벌 급여·연말정산 IA 전환 (CEO 결정 후속)

> 세션: S288 연속 (2026-06-11) · 브랜치 `design/wave1-payroll-ia` (stack on `design/wave1-payroll-residual` = #157)
> **CEO 결정 (2026-06-11)**: ① 글로벌 급여 = **완전 프로토 전환** (법인별 카드 그리드만, 차트 3개 제거) ② 연말정산 = **워크플로 유지 + 5단계 스텝퍼 추가**
> 프로토 1:1 = `_design-reference/page-round2.jsx` (글로벌 :251-414 · 연말정산 :7-160)
> 원칙: 프로토 = 픽셀 SSOT · 기능 절대 보존 · **백엔드 절대 보존**(API 무수정 — 데이터 부재 항목은 날조 없이 생략+기록)

> **Codex G1 반영 (HIGH 3·MED 5·LOW 3)**: 차트 4개(3 아님)·환율 폴백 1 정직성·visual/e2e SUPER 분리·무데이터 월 안내·금액/환율 포맷 계약·스텝퍼 fill 의미·cumulative 계약+단위테스트·grid 명세·year-end visual 신규 6장.

## GL-IA — 글로벌 급여 완전 전환 (`GlobalPayrollClient.tsx`)

1. **차트 4개 전부 제거** (G1: 인당 평균 bar :305 포함 — 플랜 초안 "3개"는 미스카운트): 법인별 급여 총액(bar)·급여 비중(pie)·6개월 트렌드(line)·인당 평균(bar) + recharts import·가공 배열(chartData/pieData/trendData/headcountData)·CHART_COLORS 삭제. **trend API 필드는 소비만 중단**(백엔드 무수정).
2. **법인별 카드 그리드 신설** (프로토 :312-365 1:1, 테이블 대체): Card + card-head("법인별 급여 현황" + sub "YYYY년 M월") + `grid-3`(responsive 1/2/3열). 카드 구성:
   - 헤더 행: ~~flag~~ → **font-mono 통화코드 칩**(SIM-3 확정 편차) + companyName(14/600) + `companyCode` mono 11px + **상태 칩 = hasData ? 집계됨(success) : 미시작(neutral)** (프로토 지급완료/결재진행/이상검토는 API 미반환 → 편차)
   - 현지 통화 블록: uppercase 라벨 행(현지 통화 / {currency}) + 18px mono 금액 (**VND는 M 축약** — 프로토 동일), 상하 1px 보더
   - KRW 환산 블록: 라벨 행(KRW 환산; ~~FX delta%~~ 전월 환율 API 미반환 → 우측 생략) + 16px mono `₩X.XX억` accent-ink
   - 풋터: `bg-muted rounded` 행 — `{headcount}명` + 환율 mono. **환율 정직성(G1 HIGH)**: `currency !== 'KRW' && exchangeRate === 1` = API 폴백(미설정) → `1 CCY = ₩1` 거짓 표기 금지, **"환율 미설정" dim 텍스트**로 대체 (페이지 상단 FX 경고 배너와 일관). 정상 rate 표시 = `maximumSignificantDigits: 4` (₩188.6·₩0.054 모두 수용).
   - **금액 계약(G1 MED)**: gross 기준(totalGrossLocal/totalGrossKRW — 기존 화면 동일). VND만 M 축약(프로토 규칙 그대로 `/1e6 toFixed(0)+"M"`), 그 외 toLocaleString. KRW 환산 = 기존 `fmtBillion` 재사용. **hasData=false → 금액 "—"** + 카드 dim.
   - **무데이터 월(G1 MED)**: companiesWithData===0 → 카드 그리드 상단 안내 1줄("선택 월 집계 데이터 없음") + 전 법인 미시작 카드 유지 — 전체 EmptyState 대체 금지(법인 현황 정보 보존, Codex 권고안).
3. **FX 환율 영향 테이블(프로토 :370-410) = 생략**: 전월 환율 미반환으로 변동률·KRW 영향 계산 불가 — **데이터 부재 편차** 기록. API 확장(전월 rate 동봉)은 별도 백엔드 트랙 칩.
4. **유지**: ALL-1 헤더(업로드/환율설정/refresh 3버튼 = 기능 — 프로토 select+리포트와 편차)·월 네비·WdStatStrip KPI 4장(#157 — 프로토 지급완료/이상검토 지표는 API 미반환 편차)·3분법(error+재시도)·FX 경고 배너·SUPER 게이트.
5. **그리드(G1 LOW)**: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3` + 법인명 truncate (375px overflow 검증).

## YE-IA — 연말정산 스텝퍼 추가 (`YearEndHRClient.tsx`)

1. **스탯 6카드 그리드 → 프로토형 5단계 스텝퍼 카드** (프로토 :93-130 시각 1:1, 데이터는 기존 summary): Card + card-head("5단계 진행 현황" + sub "전체 N명 · 완료율 X%" — 기존 완료율 흡수). 5열 그리드(모바일 reflow), 단계별:
   - 번호 원(24px, **count>0 → accent fill/white** = 프로토 원 의미 그대로 "현재 단계 점유", 0 → muted+보더) + 라벨(12/600). count 우측에 프로토처럼 **"명 진행"** 표기로 raw count임을 명시(G1 MED 5 — cumulative 강조와 혼동 차단)
   - 24px mono count + "명 진행" + sub 11px + "도달: N명" mono
   - **cumulative 계약(G1 MED 6)**: `sum(count of statusIndex >= stageIndex)`, 알 수 없는 status는 **무시**(실패 금지). 1단계 도달=전체 인원(정보가치 낮음 — 프로토 그대로 표시). **순수 헬퍼 `src/lib/payroll/year-end-stepper.ts`** + vitest 3케이스(혼합/전부 0/전부 confirmed)
   - 마지막(확정) 단계 = tertiary 틴트 bg (프로토 green 틴트)
   - **단계 = 기존 5 status 순서 그대로**(미시작→진행중→제출완료→HR검토중→확정; 프로토 자료수집~신고 라벨로 갈아끼우지 않음 — 데이터 모델 날조 금지, 시각만 채택)
2. **유지**: 헤더·연도 select·bulk 버튼·필터 탭·테이블·일괄확정·모달 전부 무변경 (#138 핸들러 불가침). 프로토 KPI 4장(환급/추가징수/진행중/자료누락)·주요 일정·자료 누락 패널·탭 3개 = **스코프 외**(CEO 결정 = 스텝퍼까지).

## i18n (메인 루프 단일 소유)

신규 키 추정: `globalPage.companyCards`(법인별 급여 현황)·`localCurrency`·`krwConverted`·`notStarted`/`aggregated`(기존 재사용 우선)·`yearEndHR.stepperTitle`·단계 sub 5개·`reached` 등 — 에이전트가 기존 키 grep 후 신규만 보고, 5로케일 일괄 반영.

## e2e·visual (G1 HIGH 3 — SUPER 분리)

- **flows/payroll.spec.ts**: SUPER describe 신설(`storageState: authFile('SUPER_ADMIN')`) — global 카드 그리드 렌더 가드(법인 카드 N개·집계됨 칩) + 월 네비 클릭 → 새 API 요청 발화. 기존 HR page-load 테스트는 유지(에러 상태도 정상 로드).
- **visual/07-payroll.visual.spec.ts**: `payroll-global` 2건을 **SUPER describe로 분리**(현 HR 베이스라인 = 403 에러 상태 — 비정보 스냅샷) + **`payroll-year-end` 신규 추가**(HR, 6장 — 스텝퍼 다크/모바일 회귀 자동화, G1 LOW 11). 스냅샷 갱신 = global 6장(SUPER 재촬영) + year-end 신규 6장.

## 검증 게이트

1. tsc 0 · lint 0 · i18n 키 resolve · **unit: year-end-stepper 3케이스**
2. e2e flows/payroll 회귀 + 신설 SUPER 가드 (year-end 탭 가드의 `main table` 1개는 무영향)
3. **Pixel Gate = 진짜 1:1**: 프로토 :8077 글로벌·연말정산 vs 구현 side-by-side (1440/375), 편차 = 본 문서 기록 (flag→코드·status 칩=hasData 대체·FX 테이블 생략·헤더 버튼·KPI 지표·스텝퍼 라벨·환율 미설정 표기)
4. UI QA: super@(global 카드 그리드·환율 미설정 표기·무데이터 월) + hr@(year-end 스텝퍼+워크플로 회귀) + 375px
5. visual: global 6장 재촬영(SUPER) + year-end 6장 신규
6. Codex G2

## 함정

- recharts 제거로 번들·import 정리 시 다른 소비처 오삭제 금지 (해당 파일 한정)
- 스텝퍼 cumulative 계산은 순수 헬퍼로 (단위 검증 가능)
- [[hrhub-build-poisons-dev-next]] · 헤드리스 rAF (차트 제거로 global은 해당 없음)

## 검증 결과 (S288 연속)

- tsc 0 · lint 0 · unit year-end-stepper **3/3** · i18n 신규 **14키 × 5로케일** parity 14/14 전부 · 전 키 resolve OK
- e2e flows/payroll: **17 pass / 4 flaky(재시도 green — dev 컴파일 지연) / 1 skip**, 신설 SUPER 가드 2(카드 그리드·월 네비 재조회) green
- visual: **deferred** — global(SUPER)·year-end 둘 다 클라이언트 useEffect-fetch가 `waitForVisualStability`(=waitForPageReady) 통과 후 시작되는 hydration 레이스로 스크린샷에 "데이터 로딩 중…" 스피너/스켈레톤이 잡힘(특히 global 집계 쿼리가 dev에서 느림). visual은 CI 미실행 로컬 게이트라 오도 베이스라인 커밋 회피 → spec·베이스라인 S288 상태로 되돌림. **IA 정합성은 flows SUPER e2e + 수동 Pixel Gate로 검증.** 후속 = 데이터 정착 대기(`waitForLoading`/spinner-gone) fixture로 global(SUPER)·year-end 베이스라인 신설.
- **Pixel Gate 진짜 1:1** (프로토 page-round2.jsx vs 구현, 1440px): 구조·밀도·타이포 충실 일치 확인. 카드 그리드 3열·card-head·현지통화/KRW 블록·풋터 레이아웃 동일
- 멀티롤 UI QA: super@(글로벌 카드 그리드·USD "환율 미설정" 정직 표기·CTR홀딩스 무데이터=전 법인 미시작 카드) + hr@(연말정산 2025년 6명 스텝퍼 — 미시작 1·진행중 5 navy 채운 원/도달 cumulative 정확/확정 green 틴트, 워크플로 테이블·필터·검토 액션 보존). 콘솔 에러 0·MISSING_MESSAGE 0

### Pixel Gate 의도적 편차 (기록)

**글로벌 급여**: ① KPI 4지표 상이(전사총급여/인원/인당평균/데이터법인 vs 프로토 총인건비/인원/지급완료/이상검토) — API가 지급상태·이상 카운트 미반환 ② flag → 통화코드 font-mono 칩(SIM-3) ③ 카드 부제 국가명 생략(API CompanyStat에 country 부재) ④ 상태 칩 = hasData 2값(집계됨/미시작) vs 프로토 지급완료/결재진행/이상검토 — API 미반환, 정직 대체 ⑤ KRW 환산 FX delta% 생략(전월 환율 API 미반환) ⑥ FX 영향 테이블 생략(동일 사유, 백엔드 트랙 칩) ⑦ ₩X.X억 = fmtBillion(toFixed 1) vs 프로토 toFixed(2) ⑧ 비-KRW 환율 폴백(rate===1) → "환율 미설정" dim(프로토는 raw rate) ⑨ 헤더 = 업로드/환율설정/refresh 3버튼(기능) vs 프로토 select+리포트 ⑩ 인당평균 컬럼·합계 tfoot·환율 1:1 각주는 테이블과 함께 소멸(전사 합계·인당평균은 KPI에 잔존)

**연말정산**: ① 스텝퍼 5단계 = 기존 status(미시작/진행중/제출완료/HR검토중/확정) — 프로토 자료수집~신고 라벨 미채택(데이터 모델 날조 금지) ② 단계 sub 5개 = 우리 status 의미로 신작 ③ 원/카운트 색 proto --accent → bg-primary(navy) ④ 확정 단계 틴트 → bg-tertiary/10(파일 내 D17 선례) ⑤ 구 완료율 진행바(role=progressbar) 제거 → 완료율 수치는 card-head sub로 흡수(시각 진행바 소멸 = a11y P2, 후속 후보) ⑥ 11px 텍스트(단계 sub·도달) = 본문 12px 룰 경계(프로토 충실 채택)

### Codex G2 / 적대 검증 결과

- 워크플로 적대 검증 2(프로토 충실·기능 보존) 모두 **GO**, P0 0건
- P1 = i18n 14키 누락(플랜대로 메인 루프가 5로케일 반영 — **해소 완료**)
- P2 처리: card-head 패딩/색 GL·YE 통일(px-5 py-4·text-muted-foreground) / 국가명·억 소수자리·avgPerHead 등 = 상기 편차 기록 / progressbar a11y·11px = 후속 a11y 트랙 후보로 기록
