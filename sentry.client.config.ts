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
    Sentry.replayIntegration({
      // PII masking — HR SaaS: mask all text by default, selectively unmask safe elements
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
      // Unmask non-sensitive navigation/structural elements
      unmask: [
        '[data-sentry-unmask]',        // Explicitly safe elements
        '.sentry-unmask',              // Navigation labels, page titles
      ],
      // Block elements that may contain PII even as DOM nodes
      block: [
        '[data-sentry-block]',         // Salary tables, SSN fields
        '.sentry-block',               // Sensitive sections
      ],
      networkDetailAllowUrls: [],      // Do not capture request/response bodies
      networkCaptureBodies: false,
    }),
  ],

  // Session replay — 1% baseline, 10% on error (conservative for HR data)
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

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
