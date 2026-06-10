# Wave 0 — Design Foundation Fidelity Restoration

> 2026-06-10 (S274). CEO ruling: **prototype `_design-reference` `[data-style="workday"]` = pixel SSOT**; house No-Line Rule retired.
> Root cause (verified by 2-workflow audit): brand accents (navy/orange/wt-1..8) were ported pixel-exact in Phase 1,
> but the **neutral foundation, borders, and typography were never converted** from the pre-existing Stitch/Violet system,
> and no gate ever compared implementation against the *rendered* prototype. Wave 0 fixes the foundation so every page
> moves closer to the prototype at once; page-structure work (worklet colors, missing sections) = Wave 1+.
> Branch: `design/wave0-foundation` off origin/main b22db932. Light mode only — `.dark` untouched (Phase 4b).

## 1. Token changes — `src/app/globals.css` `:root`

All values converted from prototype OKLCH via the same Björn Ottosson math as Phase 1 (verified against
`_design-reference/styles.css` L555-615):

| Token | Now (Stitch green-gray) | New (proto cool-gray hue 245-250) |
|---|---|---|
| `--background` | `0 0% 96.5%` #f6f6f6 | `210 27.3% 95.7%` #f1f4f7 |
| `--foreground` / card-fg / popover-fg | `180 3.4% 18.2%` #2d2f2f | `211.8 26.2% 12.7%` #182029 |
| `--secondary` / `--muted` / `--accent` | `0 0% 94.5%` #f0f1f1 | `210 31.3% 93.7%` #eaeff4 (bg-sunk) |
| `--muted-foreground` | `180 1.7% 35.9%` #5a5c5c | `211.8 9.5% 35.1%` #515962 |
| `--border` / `--input` | `180 1.5% 67.8%` #acadad (used at /15) | `210 21.9% 87.5%` #d8dfe6 (**full opacity**) |
| `--border-strong` (NEW) | — | `207 17.2% 77.3%` #bbc6cf (btn/input borders) |
| `--destructive` | `347 77% 50%` #e11d48 rose | `358.5 67.2% 52.2%` #d73337 true red |
| `--tertiary` | #16a34a tailwind-green | `153.7 100% 27.3%` #008b4e proto success |
| `--tertiary-container` | #86efac | `138.8 69.6% 91%` #d8f8e2 success-soft |
| `--info` | #0ea5e9 sky | `193 100% 36.3%` #0091b9 proto info |
| `--warning-bright` | #f59e0b amber | `38.4 74.8% 46.7%` #d0901e proto warning (BG/icon only — text stays #b45309, D17 WCAG split 유지) |
| `--alert-red` | #ef4444 | `358.5 67.2% 52.2%` #d73337 (danger family) |
| `--surface-container-low/-/high` | green-gray steps | cool steps #eaeff4 / #e3e9ee / #dbe2e9 (derived, hue 245) |
| `--chart-5` | rose | danger #d73337 |

Plus `@layer base`: `html` letter-spacing `-0.02em → -0.005em`; **`body { font-size: 14px }` 추가** (proto body 14px —
rules/design.md가 "base 14px"를 주장해왔으나 미집행이었음).

## 2. `tailwind.config.ts`

- `letterSpacing.ctr`: `-0.02em → -0.005em` (body에 적용 중)
- `colors`: `border-strong: hsl(var(--border-strong))` 추가; ctr-* 호환 hex 갱신
  (`ctr-success #008b4e`, `ctr-error #d73337`, `ctr-info #0091b9`, `ctr-success-bg #d8f8e2`,
  `ctr-error-bg #ffe6e1`, `ctr-warning-bg #ffedc6`, surface scale → cool grays #f1f4f7/#eaeff4/#dbe2e9/#e3e9ee)
- `fontFamily.display`: **Outfit 제거** → Pretendard 스택 (프로토는 Pretendard+Geist Mono만 로드; layout.tsx의
  Outfit import/variable도 제거)
- `fontSize.display-sm`: weight `800 → 500` (proto `.ss-val` 32px/500)
- `borderRadius.2xl`: `0.75rem → 0.875rem` (proto workday `.card` 14px)
- `boxShadow`: `sm → 0 1px 2px rgba(30,47,65,.04), 0 1px 0 rgba(30,47,65,.02)` (proto shadow-card),
  `md → 0 4px 12px rgba(30,47,65,.08)`, `lg → 0 4px 12px rgba(30,47,65,.08), 0 20px 48px rgba(30,47,65,.12)`
  (proto shadow-pop, navy-tinted #1e2f41)

## 3. `src/lib/styles/typography.ts` (전 소비처 자동 전파)

- `pageTitle`: 30px/700 → **26px/600/-0.015em** (proto workday `.page-h h1`)
- `sectionTitle`: 24px/700 → **17px/600/-0.01em** (proto `.sec-h h2`)
- `cardTitle`: 20px/600 → **14.5px/600/-0.005em** (proto `.card-head .title`)
- `tableHeader`: **uppercase·tracking-wider 제거** → 11px/500/+0.02em (proto `.tbl th` — uppercase는 콘솔 스타일이지 workday가 아님)
- `statLabel`: **uppercase 제거** → 12px/500 (proto `.kpi .label` text-transform:none)
- `displaySm`: tracking `-0.05em(tighter) → -0.025em` (proto ss-val)

## 4. shadcn base (Phase 1 완료로 수정 허용) — `src/components/ui/`

- `card.tsx`: `border-0` → `border border-border` (proto `.card` 1px solid)
- `table.tsx`: table 13px; th 11px/500 **no-uppercase** bg-muted border-b px-4 py-2.5; td 13px px-4 py-2.5;
  row `border-b` + `[&_tr:last-child]:border-0`; hover `bg-muted`
- `button.tsx`: default size `rounded-xl → rounded-lg`(8px), `sm → rounded-md`(6px),
  **`lg`의 그라데이션·rounded-full·glow 제거** → flat `rounded-lg`(프로토는 그라데이션 금지);
  default variant hover → `hover:brightness-95`(proto); outline → `border-border-strong bg-card`; 폰트 13px
- `badge.tsx`: `text-[10px] font-semibold` → `text-[11px] font-medium`, `py-0.5 → py-[3px]` (proto `.chip`);
  outline variant `border-border/15 → border-border`; success/error ink hex 갱신 (§5)

## 5. `src/lib/styles/status.ts` + semantic hex 정렬

proto semantic 패밀리로 교체 (WCAG AA용 ink는 동일 hue에서 파생, 산식 명기):

- success: FG `#16a34a → #008b4e`, BADGE_FG `#15803d → #006b39` (oklch 46%/0.12/155 — 4.5:1), BG `#dcfce7 → #d8f8e2`
- error: FG/BADGE_FG `#e11d48 → #d73337`, ink `#b71824` (oklch 50%/0.19/25), BG `#fce7f3 → #ffe6e1`
- warning: **text #b45309 유지** (proto warning #d0901e는 70% lightness로 AA 미달 — D17 bg/text 분리 원칙 유지), BG `#fef3c7 → #ffedc6`
- 하드코딩 잔존 9파일의 옛 hex 동일 치환

## 6. Mechanical sweep

- `border-border/15` 20곳(14파일) → `border-border` (새 border는 밝은 쿨그레이라 full-opacity가 proto 정합);
  `/30·/40·/50` 변형 10곳도 full로
- `WdStatStrip.tsx`: KPI 수치 `font-mono` 제거 (proto ss-val = Pretendard + tnum; `tabular-nums`만 유지)
- `PageHeader.tsx`: h1 `text-xl sm:text-2xl font-bold` → `text-[26px] font-semibold tracking-[-0.015em]`
- `DataTable.tsx`: th/td를 §4 table 규격으로 정렬

## 7. 문서·게이트

- `.claude/rules/design.md` 개정: **No-Line Rule 폐기** → "카드·테이블·card-head = 1px solid var(--border)";
  radius 3-tier에서 CTA pill 폐기(버튼 8px); font-display 규칙 삭제; hex 예외 갱신; base 14px 집행 명시;
  **Pixel Gate 신설** — 페이지 작업 시 `python3 -m http.server 8077 -d _design-reference`로 프로토 렌더 →
  구현과 side-by-side 스크린샷 비교 필수 (Babel JSX는 file://에서 CORS로 깨짐 — 서버 필수)
- `DESIGN.md` 토큰 표 갱신 (중립·시맨틱·border·radius·shadow·타이포 §)

## Out of scope (명시)

`.dark` 팔레트(Phase 4b) · Sidebar 240px(동결 파일) · 홈 워클릿 색/누락 섹션(Wave 1) · PDF hex(별도 트랙) ·
e2e visual 베이스라인 330장 재생성(토큰 변경으로 전량 무효화 — 별도 커밋/CI staging에서 1회 갱신)

## Codex Gate 1 반영 (P0 0 · P1 7 · P2 4)

- **테이블 명세 교정 (Codex 옳음)**: workday override `styles.css:1228` = th **uppercase/600/0.04em/12px pad 유지**
  (§3·§4의 no-uppercase 계획 폐기 — 1차 비교가 base `.tbl`을 봤음). th는 현행 유지 + tracking 0.04em·py-3·px-4·bg-muted·border-b만 정렬.
  단 `statLabel`은 proto `.ss-h`(12px/500/no-uppercase) 실측 확인 → uppercase 제거 유지.
- **다크 border 파손 방지**: `.dark`에 `--border: 208 18.1% 16.3%`(proto dark oklch 28% .018 245) +
  `--border-strong: 210 14.5% 24.3%`(36% 파생) 추가. 나머지 .dark는 불변(Phase 4b).
- **WCAG**: `STATUS_FG.success`는 차트/아이콘용 #008b4e(4.37:1, 기존 #16a34a 3.3:1 대비 개선), 텍스트는 BADGE_FG #006b39(6.64:1).
  `--destructive-foreground` → white(4.75:1). `STATUS_BG.warning`은 #fef3c7 유지(#b45309와 4.51:1 — proto soft #ffedc6는 4.35:1 미달, 의도적 편차).
- **accent 분리**: `--accent` = proto accent-soft `200 71.4% 91.8%` #dbeff9 (hover 네이비 틴트), secondary/muted만 bg-sunk.
- **동결 파일 sweep 제외**: Sidebar.tsx:145 등 layout 동결 파일은 토큰 전파만 (클래스 변경 금지).
- **chart.ts 추가**: SEMANTIC_SLOTS 2/3/4 → #008b4e/#d0901e/#d73337. sweep은 고정 목록 대신 종료 시 `rg` 패턴 검증.
- **의도적 편차 2건 (Codex 권고와 다름, 사유 기록)**: ① shadow sm/md/lg 글로벌 갱신 유지 — 현행과 크기 등급 거의 동일, 틴트·레이어만 proto 정렬이며 별도 shadow-card/pop 이중 체계가 더 큰 드리프트 ② rounded-2xl 12→14px 글로벌 유지 — 2xl=Container 티어 의미가 proto 카드 14px와 일치, 비카드 +2px는 지각 불가.

## Codex Gate 2 반영 (P0 0 · P1 3 · P2 3)

- **P1-1 다크 보더 비가시(1.08:1)**: proto dark border는 proto dark surface 전제 → 현 Violet 다크 카드(#2d2f2f) 기준으로
  밝게 파생한 stopgap(`210 12% 31%`/`40%`)으로 교체. Phase 4b에서 일괄 재설계.
- **P1-2 시맨틱 텍스트 AA**: badge error/destructive → `text-[#b71824]` ink (라이트). `text-tertiary` 소비처 광역 AA는
  기존 #16a34a(3.3:1)→#008b4e(4.37:1)로 **전부 개선**이므로 Wave 0 범위 밖 — 전수 ink 정리는 별도 task.
- **P1-3 displaySm 소비처 font-mono 충돌**: StatCard·WorkdayHero에서 `font-mono` 제거(tabular-nums 유지) — KPI 대형 수치 Pretendard 규칙 정합.
- **P2-4** rowClickable hover(`bg-muted/60`)와 selected(`bg-accent`) 분리. **P2-6** 다크 success badge=Phase 4b 유예 주석화.
- **P2-5 동적 Tailwind 클래스**(`text-[${STATUS_FG}]` 미생성, KpiSummaryCard:26)는 **기존 결함**(Wave 0 무관) — 별도 task 분리.

## Verification (실측 완료)

tsc 0 · lint 에러 0 · **Pixel Gate 첫 적용**: dev(3010)+프로토(8077) 기동 → side-by-side 스크린샷
(`/tmp/wave0-proto-dashboard.png` vs `/tmp/wave0-impl-home.png`·`/tmp/wave0-impl-employees.png`) —
쿨그레이 배경·가시 보더·26px/600 타이틀·uppercase 11px th+bg-sunk·13px 셀·flat 버튼 적용 확인.
홈의 히어로 글로우·빠른작업 행·워클릿 wt색·누락 섹션 = Wave 1 범위(의도적 잔여).
리스크: body 14px로 명시 `text-*` 없는 텍스트 16→14 축소(프로토 밀도 정합 — 의도된 변화),
visual 베이스라인 330장 전량 무효(별도 1회 갱신 — out of scope 명시).
