/** Art.22 — Typography scale (DESIGN.md §1 aligned) */
export const TYPOGRAPHY = {
  // === Display & Headings ===
  /** 30px / 700 / 1.2 — 페이지 제목 */
  pageTitle: 'text-[30px] font-bold leading-[1.2] text-ctr-slate-900',
  /** 24px / 700 / 1.3 — 섹션 제목 */
  sectionTitle: 'text-2xl font-bold leading-[1.3] text-ctr-slate-900',
  /** 20px / 600 / 1.4 — 카드 제목 */
  cardTitle: 'text-xl font-semibold leading-[1.4] text-ctr-slate-900',
  /** 18px / 600 / 1.5 — 소제목 */
  subtitle: 'text-lg font-semibold leading-[1.5] text-ctr-slate-800',

  // === Body ===
  /** 16px / 500 / 1.6 — 강조 본문 */
  bodyLg: 'text-base font-medium leading-[1.6] text-ctr-slate-700',
  /** 14px / 400 / 1.6 — 기본 본문 (base) */
  body: 'text-sm leading-[1.6] text-ctr-slate-700',
  /** 13px / 400 / 1.5 — 보조 텍스트 */
  bodySm: 'text-[13px] leading-[1.5] text-ctr-slate-500',

  // === Utility ===
  /** 12px / 500 / 1.5 — 캡션, 페이지네이션 */
  caption: 'text-xs font-medium leading-[1.5] text-ctr-slate-400',
  /** 11px / 600 / 1.4 — 테이블 헤더 (uppercase + wide tracking) */
  tableHeader: 'text-2xs font-semibold leading-[1.4] uppercase tracking-wider text-ctr-slate-500',
  /** 12px / 500 — 라벨 */
  label: 'text-xs font-medium text-ctr-slate-500',

  // === Numbers (Geist Mono + tabular-nums) ===
  /** 30px 숫자 — KPI 대형 stat */
  stat: 'text-[30px] font-bold font-mono tabular-nums text-ctr-slate-900',
  /** 18px 숫자 — KPI 소형 stat */
  statSub: 'text-lg font-semibold font-mono tabular-nums text-ctr-slate-900',
  /** 14px 숫자 — 테이블 내 금액/코드 */
  mono: 'font-mono tabular-nums',
} as const
