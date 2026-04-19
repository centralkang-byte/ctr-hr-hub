/** Art.22 — Typography scale (DESIGN.md §1 aligned) */
export const TYPOGRAPHY = {
  // === Display & Headings ===
  /** 30px / 700 / 1.2 — 페이지 제목 */
  pageTitle: 'text-[30px] font-bold leading-[1.2] text-foreground',
  /** 24px / 700 / 1.3 — 섹션 제목 */
  sectionTitle: 'text-2xl font-bold leading-[1.3] text-foreground',
  /** 20px / 600 / 1.4 — 카드 제목 */
  cardTitle: 'text-xl font-semibold leading-[1.4] text-foreground',
  /** 18px / 600 / 1.5 — 소제목 */
  subtitle: 'text-lg font-semibold leading-[1.5] text-foreground',

  // === Body ===
  /** 16px / 500 / 1.6 — 강조 본문 */
  bodyLg: 'text-base font-medium leading-[1.6] text-foreground',
  /** 14px / 400 / 1.6 — 기본 본문 (base) */
  body: 'text-sm leading-[1.6] text-foreground',
  /** 13px / 400 / 1.5 — 보조 텍스트 */
  bodySm: 'text-[13px] leading-[1.5] text-muted-foreground',

  // === Utility ===
  /** 12px / 500 / 1.5 — 캡션, 페이지네이션 */
  caption: 'text-xs font-medium leading-[1.5] text-muted-foreground/70',
  /** 11px / 600 / 1.4 — 테이블 헤더 (uppercase + wide tracking) */
  tableHeader: 'text-2xs font-semibold leading-[1.4] uppercase tracking-wider text-muted-foreground',
  /** 12px / 500 — 라벨 */
  label: 'text-xs font-medium text-muted-foreground',

  // === Display (Dashboard Hero / Card KPI) ===
  /** 56px / 900 / Inter — 대시보드 Hero metric */
  displayLg: 'text-4xl md:text-5xl xl:text-display-lg font-black font-display',
  /** 32px / 800 — 카드 내 핵심 수치 */
  displaySm: 'text-display-sm font-extrabold',

  // === Numbers (Geist Mono + tabular-nums) ===
  /** 30px 숫자 — KPI 대형 stat */
  stat: 'text-[30px] font-bold font-mono tabular-nums text-foreground',
  /** 18px 숫자 — KPI 소형 stat */
  statSub: 'text-lg font-semibold font-mono tabular-nums text-foreground',
  /** 14px 숫자 — 테이블 내 금액/코드 */
  mono: 'font-mono tabular-nums',

  // === R1 Home Redesign (Linear/Attio primitives) ===
  /** 20px / 600 / 1.3 — HeroCard greeting */
  heroGreeting: 'text-xl md:text-2xl font-semibold leading-[1.3] text-foreground',
  /** 12px / 500 / uppercase — StatCard label (above number) */
  statLabel: 'text-xs font-medium uppercase tracking-wide text-muted-foreground',
  /** 14px / 500 / 1.5 — ListCard row primary text */
  listPrimary: 'text-sm font-medium leading-[1.5] text-foreground',
  /** 12px / 400 / 1.4 — ListCard row secondary text */
  listSecondary: 'text-xs leading-[1.4] text-muted-foreground',
} as const
