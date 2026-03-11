/** Art.24 — Button sizes & variants */
export const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs rounded-md',
  md: 'h-9 px-4 text-sm rounded-lg',
  lg: 'h-11 px-6 text-base rounded-lg',
} as const

export const BUTTON_VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary/90 active:scale-[0.98] transition-all duration-150',
  secondary: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150',
  danger: 'bg-white border border-red-200 text-red-600 hover:bg-red-50 active:scale-[0.98] transition-all duration-150',
  ghost: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-150',
} as const
