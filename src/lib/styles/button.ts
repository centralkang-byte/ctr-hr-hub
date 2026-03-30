/** Art.24 — Button sizes & variants */
export const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs rounded-md',
  md: 'h-9 px-4 text-sm rounded-lg',
  lg: 'h-11 px-6 text-base rounded-lg',
} as const

export const BUTTON_VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary/90 active:scale-[0.98] transition-all duration-150',
  secondary: 'bg-card border border-border text-foreground hover:bg-muted/50 active:scale-[0.98] transition-all duration-150',
  danger: 'bg-card border border-destructive/20 text-destructive hover:bg-destructive/5 active:scale-[0.98] transition-all duration-150',
  ghost: 'text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150',
} as const
