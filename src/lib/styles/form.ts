export const FORM_STYLES = {
  label: 'block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1',
  required: 'text-red-500 ml-0.5',
  input: 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors',
  inputError: 'w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400',
  error: 'mt-1 text-xs text-red-500',
  section: 'space-y-4',
  actions: 'flex items-center justify-end gap-3 pt-4 border-t border-gray-100',
  select: 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary',
  textarea: 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[80px] focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y',
} as const
