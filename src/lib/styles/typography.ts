/** Art.22 — Typography scale (DESIGN.md §1 aligned)
 *  Wave 0: 헤딩 스케일을 프로토 [data-style="workday"] 실측값으로 정렬 (styles.css:1130-1150) */
export const TYPOGRAPHY = {
  // === Display & Headings ===
  /** 26px / 600 / 1.2 — 페이지 제목 (proto .page-h h1 26px/600/-0.015em) */
  pageTitle: 'text-[26px] font-semibold leading-[1.2] tracking-[-0.015em] text-foreground',
  /** 17px / 600 / 1.3 — 섹션 제목 (proto .sec-h h2 17px/600/-0.01em) */
  sectionTitle: 'text-[17px] font-semibold leading-[1.3] tracking-[-0.01em] text-foreground',
  /** 14.5px / 600 / 1.4 — 카드 제목 (proto .card-head .title 14.5px/600/-0.005em) */
  cardTitle: 'text-[14.5px] font-semibold leading-[1.4] tracking-[-0.005em] text-foreground',
  /** 18px / 600 / 1.5 — 소제목 */
  subtitle: 'text-lg font-semibold leading-[1.5] tracking-tight text-foreground',

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
  /** 11px / 600 / 1.4 — 테이블 헤더 (proto workday .tbl th: uppercase + 0.04em, styles.css:1228) */
  tableHeader: 'text-2xs font-semibold leading-[1.4] uppercase tracking-[0.04em] text-muted-foreground',
  /** 12px / 500 — 라벨 */
  label: 'text-xs font-medium text-muted-foreground',

  // === Display (Dashboard Hero / Card KPI) ===
  /** 56px / 900 / Inter — 대시보드 Hero metric */
  displayLg: 'text-4xl md:text-5xl xl:text-display-lg font-black font-display tracking-tighter',
  /** 32px / 500 — 카드 내 핵심 수치 (Wave 0: proto .ss-val 32px/500/-0.025em — Pretendard, mono 아님) */
  displaySm: 'text-display-sm font-medium tracking-[-0.025em]',

  // === Numbers (Geist Mono + tabular-nums) ===
  /** 30px 숫자 — KPI 대형 stat */
  stat: 'text-[30px] font-bold font-mono tabular-nums tracking-tight text-foreground',
  /** 18px 숫자 — KPI 소형 stat */
  statSub: 'text-lg font-semibold font-mono tabular-nums tracking-tight text-foreground',
  /** 14px 숫자 — 테이블 내 금액/코드 */
  mono: 'font-mono tabular-nums',

  // === R1 Home Redesign (Linear/Attio primitives) ===
  /** 20px / 600 / 1.3 — HeroCard greeting */
  heroGreeting: 'text-xl md:text-2xl font-semibold leading-[1.3] tracking-tight text-foreground',
  /** 12px / 500 — StatCard/KPI label (Wave 0: proto .ss-h·.kpi .label 12px/500, uppercase 없음) */
  statLabel: 'text-xs font-medium text-muted-foreground',
  /** 14px / 500 / 1.5 — ListCard row primary text */
  listPrimary: 'text-sm font-medium leading-[1.5] text-foreground',
  /** 12px / 400 / 1.4 — ListCard row secondary text */
  listSecondary: 'text-xs leading-[1.4] text-muted-foreground',
} as const
