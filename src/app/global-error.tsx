'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Global Error Boundary
// Catches unhandled errors outside (dashboard) layout
// Phase Q-5f: Sentry integration
// ═══════════════════════════════════════════════════════════

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          backgroundColor: '#fafafa',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            backgroundColor: '#FEE2E2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
            fontSize: 28,
          }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111', marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>
              Error code: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: '8px 20px',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
