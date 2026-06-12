# Wave 1 마이스페이스 PR2 — KPI/토큰 6페이지 프로토 정합

> 2026-06-12 (S291). PR1(#160, 허브·프로필·복리후생·문서·나의업무 = 금지패턴+드로어 5p) 분할의 **나머지 묶음**.
> Codex G1(S290)이 11페이지 감사를 페이지 단위 2 PR로 분할 권고 → 이번이 PR2.
> Base = `origin/main` (PR2 페이지 6개는 #160과 byte-identical = 완전 disjoint). Branch = `design/wave1-myspace-pr2`.
> 백엔드 무수정. 동결(Sidebar/MobileDrawer/navigation.ts) 제외.

## 스코프 (6 클라이언트)

| 페이지 | 파일 | 1:1 프로토 | 핵심 변경 |
|---|---|---|---|
| 역량(skills) | `my/skills/MySkillsClient.tsx` (426) | ✅ SkillsAssessPage (proto 577-651) | KPI→WdStatStrip(foot=진행바)·raw success/amber→토큰 |
| 교육(training) | `my/training/MyTrainingClient.tsx` (419) | ✅ EduMyPage (proto 689-771) | KPI→WdStatStrip·raw배지→Badge variant·완료버튼 raw emerald→`bg-warm`·EmptyState 더블아이콘 |
| 총보상(total-rewards) | `my/total-rewards/TotalRewardsClient.tsx` (195) | ✗ (시스템 적용) | 죽은 Violet `#4a40e0`·`#7457d1`·stroke→`CHART_THEME`·hero+`WdStatStrip(4)`·bespoke empty→EmptyState |
| 내부공모(internal-jobs) | `my/internal-jobs/InternalJobsClient.tsx` (289) | ✗ | raw 우선순위/상태색→Badge·token·EmptyState 점검 |
| 연말정산(year-end) | `my/year-end/YearEndWizardClient.tsx` (948) | ✗ | step2 업로드/수동 언더라인탭(`border-b-2`)→세그먼트·raw amber/emerald 배지·step indicator emerald-600→토큰·장식 EmptyState 점검 |
| 알림(notifications) | `notifications/NotificationsClient.tsx` (287) | ✗ | 언더라인탭(`border-b-2`:156)→세그먼트·토큰 스윕. (`my/settings/notifications`는 grep 클린 = 토큰 스윕만, 발견 시) |

## 페이지별 정밀 변경 (audit 결과 — file:line)

### skills (MySkillsClient.tsx)
- 54-55, 62-63: gap-color 헬퍼 `text-amber-500`/`text-emerald-600`/`bg-amber-500/15`/`bg-emerald-500/15` → 도메인 시맨틱 토큰(D17 bg/text 분리, success ink `text-[#006b39]`·warning `text-ctr-warning`).
- 256·263: bespoke KPI `text-3xl font-bold text-emerald-600` → **WdStatStrip** (proto SkillsAssessPage 패턴; foot = 충족 진행바 `role="progressbar"`).
- 344: `CheckCircle2 text-emerald-600` → success 토큰.
- Pixel Gate: proto SkillsAssessPage(577-651) side-by-side.

### training (MyTrainingClient.tsx)
- 93-94: STATUS 맵 raw 배지 `bg-amber-500/15 text-amber-700 border-amber-300` / emerald → **Badge variant**(warning/success) 또는 StatusBadge.
- 224·232: bespoke KPI `text-3xl text-amber-700`/`text-emerald-700` → **WdStatStrip**.
- 253·336·390·299: 배지 → Badge variant 정리(이미 Badge지만 raw className).
- 272: `Button bg-emerald-600 hover:bg-emerald-700`(완료) → 주 액션 = **`bg-warm`**(§5.1).
- 289·363: 아이콘 raw amber/emerald → 토큰.
- 414: `<EmptyState />` 더블아이콘 점검(icon prop 중복 시 제거).
- Pixel Gate: proto EduMyPage(689-771).

### total-rewards (TotalRewardsClient.tsx)
- 38: `PIE_COLORS = ['#4a40e0', ...'#7457d1']` 죽은 Violet → `CHART_THEME` 팔레트(chart.ts SSOT).
- 183: `Line stroke="#4a40e0"` → `CHART_THEME` 단색.
- 89-95·106-126: hero(연 총보상) + 5 KPI div → **hero 유지 + WdStatStrip(4)**(Codex 권고). 기본급/상여/수당/복리후생 = 4-strip, 포상은 pie/구성에만(또는 4 = 상여/수당/복리후생/포상, 기본급은 hero 보조 — 구현 시 확정·PR 본문 기록).
- 70-78: bespoke empty → `EmptyState`.
- hero `font-mono` 4xl: WdStatStrip 컨벤션(Pretendard 500 + tabular-nums) 정합.

### internal-jobs (InternalJobsClient.tsx)
- 59: `normal: 'bg-amber-500/15 text-amber-700'` 우선순위 맵 → 토큰/Badge.
- 241: `bg-emerald-500/15 text-emerald-700` 지원완료 pill → Badge variant/success 토큰.
- 158: EmptyState 더블아이콘 점검.

### year-end (YearEndWizardClient.tsx)
- 400-409: step2 업로드/수동 `border-b-2` 언더라인탭 → **세그먼트 컨트롤**(§5.5 `bg-muted/50 rounded-lg p-1`, NO border-b; `useArrowKeyNavigation` 또는 Radix Tabs). 패널 전환이므로 Radix Tabs 우선.
- 441: `bg-amber-500/15 text-amber-700` 경고 → `bg-warning-bright/15 text-ctr-warning`(D17).
- 628·864: `bg-emerald-500/15 text-emerald-700 border-emerald-200` 성공 배지 → Badge variant/success 토큰.
- 188-197: step indicator done `bg-emerald-600`/`text-emerald-600` → success 토큰.
- 339: 장식 `<EmptyState />` 점검(메모리 "장식 EmptyState 제거" — 맥락 확인 후 결정).

### notifications (notifications/NotificationsClient.tsx)
- 156: `border-b-2 border-primary` 카테고리 탭 → 세그먼트.
- read-status 필터(166)·토큰 스윕.
- 192: EmptyState OK.

## i18n
- **목표 = 0 신규 키** (전 페이지 이미 useTranslations 완비; 시각/컴포넌트 스왑은 기존 문자열 재사용). 진행바 foot 등 신규 문자열 발생 시에만 **단일 소유자**가 5로케일 추가(append 충돌 방지).

## Codex Gate 1 반영 (P0 없음, P1 7·P2 3)
1. **skills KPI=3** (Codex 실측). WdStatStrip(4)에 가짜 4번째 만들지 말 것 → proto SkillsAssessPage 따라 3카드 토큰화 또는 진짜 4번째 지표만. 프로토가 SSOT.
2. **total-rewards**: hero = 총보상 **+ 기본급** 둘 다 / strip = 상여·수당·복리후생·포상(4). 기본급 누락 금지.
3. **WdStatStrip.foot은 `<p>` 래핑** → 진행바는 `<span className="block" role="progressbar" aria-valuemin/max/now>` (블록 `<div>` 금지 = invalid HTML).
4. **year-end L628 = 다중행 성공 알림(배너)** → Badge 축소 금지, 성공 토큰 배너 유지·`isSubmitted` 조건 보존. **L864만** Badge 전환.
5. **year-end L339 EmptyState = 부양가족 카드 내 잘못된 "데이터 없음"** → 점검이 아니라 **제거** 확정.
6. **i18n = HARD gate 0 신규 키**. 1개라도 추가 시 PR1 머지 후 rebase·단일 커밋 충돌해소.
7. QA = populated + empty + year-end upload/manual/submitted 전부(빈 경로만 X).
8. notifications: trigger/read 2그룹 각각 독립 `aria-label`+`role="radio"`+`aria-checked`. **L125 `제목`/`설명` placeholder 리터럴 → 실제 기존 번역 문자열 교체**(S283 placeholder 선례).
9. total-rewards pie: 0원 filter **전** 컴포넌트 정체성 기준 CHART_THEME 색 배정(인덱스 시프트 방지).

## 검증 게이트
1. `npx tsc --noEmit` 0 · `npm run lint` 0
2. **Pixel Gate**: skills/training = proto side-by-side(8077). 나머지 4 = 패턴 단위(WdStatStrip/Badge/세그먼트/CHART_THEME) + 편차 기록.
3. Codex Gate 2 (구현 후 /verify)
4. 멀티롤 UI QA: employee-a(본인 셀프서비스). (year-end·total-rewards 데이터 의존 — 빈/empty 경로 확인)

## 함정
- [[hrhub-workflow-subagent-stale-cwd]]: 서브에이전트 절대 worktree 경로 강제·존재성 메인세션 교차검증.
- [[hrhub-headless-preview-verification-traps]]: recharts rAF 미발화 가짜 회귀(total-rewards pie/line) — 실브라우저 확인.
- 1:1 프로토 부재 4페이지 = 시스템 적용(편차≠누락).
- visual 베이스라인 PNG = Wave당 1회(PR마다 갱신 금지).
