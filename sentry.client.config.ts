// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Sentry Client Config (Browser)
// Phase Q-5f: Error Monitoring
// ═══════════════════════════════════════════════════════════

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',

  // Environment
  environment: process.env.NODE_ENV,

  // Performance: 10% in prod, 100% in dev
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Browser tracing with INP (Interaction to Next Paint) measurement
  integrations: [
    Sentry.browserTracingIntegration({
      enableLongTask: true,
      enableInp: true,
    }),
  ],

  // Session replay (disabled — PII masking required before enabling for HR SaaS)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Only send errors when DSN is configured
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Filter out noise
  ignoreErrors: [
    'ResizeObserver loop',
    'Non-Error promise rejection',
    'AbortError',
    'NetworkError',
    /Loading chunk \d+ failed/,
  ],
})
