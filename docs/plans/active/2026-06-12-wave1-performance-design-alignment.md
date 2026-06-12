# Wave 1 — Performance 클러스터 디자인 정합 (단일 bounded PR)

> 브랜치: `design/wave1-performance` (← origin/main `f6ed9763`)
> Wave 1 마지막 legacy 클러스터. 규모 ~12.8k LOC / ~30 client 파일 / 23 서브라우트.
> 성격: settings #170와 동일 — 금지패턴 밀도 낮음(border-l-4 0·gradient 0), 실작업 = off-token→토큰 + SSOT 통합 + a11y + 실버그.

## CEO 결정 (2026-06-12 게이트)

1. **고아 라우트 2개 삭제**: `manager-evaluation`·`my-evaluation` (앱 내 0 인바운드; live=manager-eval·self-eval). 폴더 + e2e 3건 정리. API 라우트는 백엔드라 잔존.
2. **WdDrawer 전환은 후속 PR 분리**: 입력 모달 6개(raw center div 포함)는 이번 범위 밖. `docs/plans/active/2026-06-10-modal-to-drawer-migration.md`에 기록.
3. **단일 bounded PR**: Pixel Gate·Codex G1/G2·visual baseline 1회.

## 불변식 (campaign 기본)

- **IA 보존** (예외 = 고아 라우트 삭제, CEO 승인). 백엔드/API/Prisma/RLS 무수정.
- **i18n 키 추가·삭제 0** — 기존 키 재사용/매핑 라벨로만 해결.
- 동결 파일(Sidebar/MobileDrawer/navigation.ts) 무수정 — 고아 라우트는 navigation.ts에 없음(확인됨).
- `src/components/ui/*` shadcn 베이스 무수정.

## In-scope

### A. 실버그 (토큰 미스 아님 — 우선)
- malformed `bg-amber-500/15/30`·`/15/20` ×3 (CycleDetailClient:262, CompReviewClient:59·388) → 이중 opacity = 배경 안 그려짐. `bg-warning-bright/15` 등 단일 tint로.
- CompReviewClient:76 `placeholder={'placeholderExceptionReasonRequired'}` → `t()`/`tCommon()` 래핑 (키 존재). 원시 키 화면 노출 수정.
- GoalsClient:403 제출버튼 `bg-destructive/50`(반투명 빨강) → `bg-warm`(주액션 토큰).
- `EmptyState`를 `<select>` 안에 렌더 ×3 (NewGoalClient:123, self-eval:243, NotificationsClient:166) → `<option disabled>` no-data 또는 select 밖으로.

### B. off-token 색 → 토큰 (~118곳, ~28파일)
- raw `emerald/amber/green/red/blue/orange-NNN` → semantic 토큰.
- **D17 준수**: warning 텍스트는 `text-ctr-warning`(#b45309) — `#d0901e`/`amber-700`/`amber-800`은 텍스트 AA 미달 금지. success ink는 `text-[#006b39]`(`text-tertiary`는 소형 텍스트 AA 미달).
- `bg-X-500/100` 류(렌더는 되나 off-token)도 토큰화.
- `placeholder-[#999]`(TeamGoals:443) → `placeholder:text-muted-foreground`.
- 백드롭블러 3번째 위치(QuarterlyReviewDetailClient:392 `backdrop-blur-sm` sticky footer) → 솔리드 `bg-card`.
- 고스트 보더 `border-destructive/15`(MyCheckins:158, Notifications:183) → 솔리드/Alert 패턴.

### C. raw 상태 pill → StatusBadge/Badge (~17곳)
- 손수 만든 const 맵·인라인 ladder → `<StatusBadge status={...}/>` (STATUS_MAP이 cycle 9-state·review 7-state·goal·eval·calibration·pulse 전부 커버 — status.ts 확인됨).
- 원시 enum 텍스트 노출(ResultsClient·TeamResults가 `status` 값 직접 렌더) 동시 해소.

### D. 차트 축/그리드 hex → CHART_THEME (3파일)
- PeerReviewResultsClient(PolarGrid `#E8E8E8`, tick `#555`/`#999`), OneOnOneClient(`#666`), PulseResultsClient(`#666`) → `CHART_THEME.axis.tick`/`.grid.stroke`. (시리즈색은 이미 CHART_THEME 소비 중.)

### E. scale-encoded 색 SSOT 통합 (이 클러스터의 핵심 디자인 작업)
raw amber/emerald로 흩어진 **5개 의미 스케일**을 SSOT 상수로:
1. **9-box 매트릭스** (CalibrationBlockGrid BLOCK_LABELS 56-66 + TeamResults block pill) — 2D 성과×역량 스케일.
2. **최종등급** (MyResult GRADE_STYLE 76-83: EXCEEDS_PLUS…BELOW_MINUS).
3. **승계 준비도** (CalibrationBlockGrid 192-194: READY_NOW/1_2/3_PLUS) — RISK low/medium/critical 의미와 동일.
4. **인정 핵심가치 4색** (Recognition VALUE_CONFIG 47-52: CHALLENGE/TRUST/RESPONSIBILITY/RESPECT) — 카테고리색(시맨틱 아님).
5. **1:1 기분척도** (OneOnOneDetail 235-238: 😊😐😞😟 4단계) — emoji→Lucide + 단계별 토큰색.

**SSOT 배치 (Codex G1 검토 요청)**: 안 1) 신규 `src/lib/styles/performance.ts`에 클래스기반 도메인 상수 통합(차트 hex와 분리; mood는 Lucide 아이콘 ref 포함 가능) / 안 2) chart.ts에 추가(RISK_COLORS·HEATMAP_COLORS 선례). 1안 선호(관심사 분리·class vs hex), 2안은 단일 색파일 응집.
**원칙**: 기존 블록↔색 의미 매핑은 보존(도메인 의미), raw 색만 토큰으로 치환. 등급/준비도가 기존 semantic category에 깨끗이 매핑되면 StatusBadge 우선(신규 상수 회피). 단계 수 보존(기분 4단계 — Codex 선례).

### F. a11y
- underline 탭 `border-b-2` → 세그먼트 컨트롤(또는 Radix Tabs) 6파일: CycleDetail, manager-evaluation(삭제예정→제외), my-evaluation(삭제예정→제외), PeerReviewClient, CompReview, OneOnOne, Pulse, Recognition. **삭제 라우트 제외하면 실제 ~5파일.** 패널 전환형은 Radix Tabs, 필터형은 `role="radiogroup"`+`useArrowKeyNavigation`.
- `<select>` aria-label 누락 다수 → 추가.
- 기분/Likert/필터 pill 그룹 → radiogroup + aria-checked + 화살표 키.
- progress bar `role="progressbar"`+aria values (MyCheckins).
- BatchToolbar select `focus:ring-0` 제거(포커스 링 복원).

### G. emoji/glyph → Lucide
- CycleDetail `✓`(169)·`⚠️`(203), TeamResults `✓`(165), OneOnOneDetail 기분 😊😐😞😟, Recognition `→`(232)·`●`(207) → Lucide.

### H. 삭제 (CEO 승인)
- `src/app/(dashboard)/performance/manager-evaluation/` (page.tsx + ManagerEvaluationClient.tsx)
- `src/app/(dashboard)/performance/my-evaluation/` (page.tsx + MyEvaluationClient.tsx)
- e2e: evaluation-forms.spec.ts(31-32, 119-120), performance-deep.spec.ts(21) — 해당 assert 제거.

## Out-of-scope (defer)
- WdDrawer 전환 6개 (후속 PR — modal-to-drawer 문서 추적).
- mojibake i18n 키(`kr_kec…`) — 해석은 됨(키 존재), 가독성 부채 → 별 트랙.
- CalibrationBlockGrid DnD 키보드 센서(@dnd-kit KeyboardSensor) — a11y 피처급, defer 후보(Codex 판단).
- 백엔드/API, IA 재구조, i18n 키 add/delete.
- 다크모드(.dark Violet 잔존 — known-deferred Phase).

## 방법론
1. **Codex Gate 1** (이 플랜) → HIGH/P0-P1 반영.
2. 구현: 기능영역별 병렬 에이전트(hub/cycles/goals·eval/peer·calibration/review·engagement) — 삭제 먼저, SSOT 상수 먼저 만든 뒤 소비처 치환. 메인세션 중앙검증.
3. **Pixel Gate**: `python3 -m http.server 8077 -d _design-reference` → perf-cycle 프로토(`page-perf-cycle.jsx`) side-by-side (유일 1:1 프로토; 나머지는 시스템 적용).
4. `/verify` (tsc·lint·prisma status·패턴 + **Codex Gate 2**).
5. visual baseline 갱신(웨이브당 1회) + PR.

## 리스크
- chart.ts에 SSOT 추가 시 recruitment #169(RECRUITMENT_STAGE_COLORS)와 머지 시 텍스트 충돌 가능 — append 충돌이라 사소. (신규 파일 1안 택하면 회피.)
- StatusBadge 치환 시 status enum 케이스(대소문자) 불일치 주의 — resolveStatusCategory가 toUpperCase 처리.
- 등급/9-box 색 의미 보존 — 임의 재매핑 금지(도메인 의미).
- 서브에이전트 stale-cwd — 절대경로 명시 + 메인 교차검증.

---

## Codex Gate 1 반영 (P0 0 · P1 6 · P2 2 — 2026-06-12)

**SSOT 배치 확정 = 안 1**: 신규 `src/lib/styles/performance.ts`. chart.ts는 Recharts hex 전용이라 Tailwind class config 혼입 금지(Codex A). typed config·동적 클래스 문자열 금지·mood 아이콘은 `LucideIcon` union 타입(Codex P2-1).

**정확한 enum(검증 완료)**: readiness=`READY_NOW`/`READY_1_2_YEARS`/`READY_3_PLUS_YEARS`(`_YEARS` 접미사!) · grade=`EXCEEDS_PLUS`/`EXCEEDS`/`MEETS_PLUS`/`MEETS`/`BELOW`/`BELOW_MINUS`(labelKey `grade.*` 존재) · mood=`positive`/`neutral`/`negative`/`concerned`.

**P1-1 삭제 범위 확장(검증 완료)** — 고아 라우트 참조가 e2e 3건 외에도:
  - `scripts/capture-screenshots.ts:72-73`, `scripts/qa/capture-screenshots.ts:124,128` → **반드시 제거**(안 하면 visual/QA 캡처가 404).
  - 문서: `docs/reports/PAGE_CATALOG.md:138,142`, `docs/reports/crud-inventory.md:709,711`, `docs/reports/CODEBASE_SCAN_REPORT.md:283`, `docs/guides/HR_OPERATIONS_CALENDAR.md:82` → canonical로 갱신.
  - `scripts/i18n-audit.json` = 생성 산출물 → 손대지 않음(재생성). RBAC엔 canonical `manager-eval`만 → 충돌 없음.

**P1-2 StatusBadge raw-enum(검증 완료)**: `StatusBadge`는 `children ?? status`라 children 없으면 **raw enum 그대로 노출**. Results/TeamResults 치환 시 **번역 라벨 children 필수**(`<StatusBadge status={x}>{t(label)}</StatusBadge>`). 기존 키 `submitted`/`notStarted` 등 재사용.

**P1-3 SSOT 3번째 소비처(검증 완료·1차 감사 누락)**: `src/components/performance/EmployeeInsightPanel.tsx:55-65`가 readiness(`READINESS_BADGE`)+mood(`SENTIMENT_ICON`)를 **별도 정의 + emoji 🟢🟡🔴·😊😐😞😟 보유**. → **신규 SSOT의 소비처에 포함**(미포함 시 즉시 중복) + emoji→Lucide. 소비처 최종: CalibrationBlockGrid(9-box+readiness)·TeamResults(9-box pill)·MyResult(grade)·Recognition(values)·OneOnOneDetail(mood)·**EmployeeInsightPanel(readiness+mood)**.

**P1-4 탭 확정표**: 삭제 2(manager-evaluation·my-evaluation) 제외 후 잔존 underline 탭 = CycleDetail·PeerReviewClient·CompReview·OneOnOne·Pulse·Recognition. 구현 시 파일별 **패널전환(Radix Tabs)** vs **필터(radiogroup)** 확정표 작성.

**P1-5 visual 범위**: 현 performance visual suite=admin/calibration/goals만. 28파일 변경을 1장으로 못 덮음 → **역할별 targeted screenshot 목록**(대표 변경페이지: cycles·cycle detail·goals·calibration·comp-review·results·my-result·one-on-one·pulse results·recognition) 명시 후 캡처. perf-cycle 프로토는 유일 1:1 Pixel Gate.

**P1-6 등급 6단계 보존**: "StatusBadge 우선" escape hatch **삭제**. grade 6단계는 전용 ordinal SSOT로 distinct 유지(semantic category로 축약 금지 — 정보 손실).

**Codex B(ordinal 함정)**: 9-box는 2D(성과×역량) → good→bad 선형화 금지. **라벨·위치가 주 정보, 색은 보조**. readiness는 "인재 품질" 아닌 "준비까지 시간" — 라벨로 명확히.

**Codex D(탭 전환 보존)**: Radix Tabs(`TAB_STYLES` SSOT 존재 확인)로 패널전환, 필터는 radiogroup+`useArrowKeyNavigation`. 보존: 기본탭·통계탭 진입 fetch effect·조건부 탭 권한·선택값 유지·URL query/hash 동기화·Radix 자동 화살표키와 수동 hook 중복 금지.

**Codex F(i18n 검증)**: "기존 키 재사용 안전" 가정 금지. 참조 키가 5 locale 전부에 존재하는지 node 스크립트로 확인 + 컴포넌트의 `useTranslations` 네임스페이스 기준. placeholder·grade 키는 5 locale 존재 확인됨, raw status 라벨 매핑은 구현 중 검증.

**Codex P2-2**: PR 본문에 "삭제 라우트 직접 URL 북마크 404 수용(redirect 안 둠)" 명시.

## 구현 순서 (Codex E)
1. 삭제 + 전 참조 정리(스크립트·문서·e2e). `READY_3_PLUS_YEARS` 등 정확 enum 먼저 고정.
2. typed `performance.ts` SSOT 작성.
3. 실버그 4종 수정.
4. StatusBadge + 번역 라벨 치환.
5. 탭/a11y 변경(확정표 기반).
6. 나머지 기계적 토큰 치환.
7. tsc·lint·targeted E2E·역할별 screenshots·visual update + Codex Gate 2.
> 1·2는 공유 아티팩트라 메인세션 단독 선행(레이스 회피), 3~6은 기능영역 병렬 에이전트.
