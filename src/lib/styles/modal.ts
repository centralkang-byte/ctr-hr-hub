export const MODAL_STYLES = {
  overlay: 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[300]',
  container: 'fixed inset-0 flex items-center justify-center z-[400] p-4',
  content: {
    sm: 'bg-white dark:bg-slate-900 rounded-xl shadow-lg max-w-md w-full max-h-[85vh] overflow-y-auto',
    md: 'bg-white dark:bg-slate-900 rounded-xl shadow-lg max-w-lg w-full max-h-[85vh] overflow-y-auto',
    lg: 'bg-white dark:bg-slate-900 rounded-xl shadow-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto',
    xl: 'bg-white dark:bg-slate-900 rounded-xl shadow-lg max-w-4xl w-full max-h-[85vh] overflow-y-auto',
  },
  header: 'flex items-center justify-between p-6 border-b border-ctr-slate-200 dark:border-slate-700',
  body: 'p-6',
  footer: 'flex items-center justify-end gap-3 p-6 border-t border-ctr-slate-200 dark:border-slate-700',
} as const
