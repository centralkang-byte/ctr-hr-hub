/** DESIGN.md — Tab tokens (Phase 4 Batch 6) */
export const TAB_STYLES = {
  /** TabsList — tonal container (segmented control) */
  // flex + w-fit + max-w-full: 컨텐츠 크기에 맞추되 부모 너비 초과 시 scroll
  // inline-flex는 overflow가 작동하지 않아 block-level flex 사용
  list: [
    'flex w-fit max-w-full items-center gap-1',
    'bg-muted/50 p-1 rounded-lg',
    'text-muted-foreground',
    'overflow-x-auto',
  ].join(' '),

  /** TabsList — compact (중첩 탭용) */
  listCompact: [
    'flex w-fit max-w-full items-center gap-0.5',
    'bg-muted/50 p-0.5 rounded-md',
    'text-muted-foreground',
    'overflow-x-auto',
  ].join(' '),

  /** TabsTrigger — default */
  trigger: [
    'inline-flex items-center justify-center whitespace-nowrap',
    'rounded-md px-3 py-1.5 text-sm font-medium',
    'motion-safe:transition-all text-muted-foreground',
    'hover:text-foreground/80',
    'data-[state=active]:bg-card data-[state=active]:text-primary',
    'data-[state=active]:font-semibold data-[state=active]:shadow-sm',
  ].join(' '),

  /** TabsTrigger — compact (중첩 탭용) */
  triggerCompact: [
    'inline-flex items-center justify-center whitespace-nowrap',
    'rounded px-2.5 py-1 text-xs font-medium',
    'motion-safe:transition-all text-muted-foreground',
    'hover:text-foreground/80',
    'data-[state=active]:bg-card data-[state=active]:text-primary',
    'data-[state=active]:font-semibold data-[state=active]:shadow-sm',
  ].join(' '),

  /** TabsContent — no default margin */
  content: 'mt-0',

  /** Icon inside trigger */
  icon: 'mr-1.5 h-4 w-4',
} as const
