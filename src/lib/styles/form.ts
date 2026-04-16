export const FORM_STYLES = {
  label: 'block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1',
  required: 'text-red-500 ml-0.5',
  input: 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors',
  inputError: 'w-full px-3 py-2 border border-destructive/50 rounded-lg text-sm focus:ring-2 focus:ring-destructive/20 focus:border-destructive',
  error: 'mt-1 text-xs text-destructive',
  section: 'space-y-4 bg-card rounded-lg p-4',
  sectionTitle: 'text-xs font-bold text-foreground flex items-center gap-1.5',
  actions: 'flex items-center justify-end gap-3 pt-4',
  select: 'w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary',
  textarea: 'w-full px-3 py-2 border border-border rounded-lg text-sm min-h-[80px] focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y',
} as const
