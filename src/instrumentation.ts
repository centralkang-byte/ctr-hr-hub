// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Next.js Instrumentation Hook
// src/instrumentation.ts
// ═══════════════════════════════════════════════════════════
// Next.js App Router: register() is called once on server start.
// Use this as the single bootstrap entry point for the EventBus.

export async function register() {
  // Only run in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { bootstrapEventHandlers } = await import('@/lib/events/bootstrap')
    bootstrapEventHandlers()
  }
}
