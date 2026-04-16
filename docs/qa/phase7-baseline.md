# Phase 7 Performance Baseline

> Measured: 2026-04-16, Branch: `staging`, Node 24 LTS
> Build: Next.js 15.5.12, TypeScript strict (ignoreBuildErrors: true)

## First Load JS (Shared by All Routes)

| Chunk | Size |
|-------|------|
| `28529-*.js` (shared) | 117 kB |
| `4bd1b696-*.js` (shared) | 54.4 kB |
| other shared chunks | 4.71 kB |
| **Total shared** | **176 kB** |

## Heaviest Pages (First Load JS > 300kB)

| Route | Page JS | First Load |
|-------|---------|------------|
| `/succession` | 379 B | 404 kB |
| `/talent/succession` | 380 B | 404 kB |
| `/analytics/attrition` | 14.2 kB | 391 kB |
| `/performance/recognition` | 11.3 kB | 391 kB |
| `/payroll/simulation` | 24.1 kB | 389 kB |
| `/performance/one-on-one` | 8.04 kB | 377 kB |
| `/payroll/global` | 8.02 kB | 367 kB |
| `/analytics/predictive` | 5.79 kB | 365 kB |
| `/analytics/compensation` | 8.21 kB | 360 kB |
| `/recruitment/dashboard` | 5.12 kB | 350 kB |
| `/analytics/recruitment` | 4.22 kB | 350 kB |
| `/analytics/predictive/[employeeId]` | 4.79 kB | 346 kB |
| `/analytics/turnover` | 8.08 kB | 346 kB |
| `/analytics/attendance` | 3.75 kB | 336 kB |
| `/analytics/payroll` | 6.64 kB | 336 kB |
| `/analytics/performance` | 6.79 kB | 336 kB |
| `/analytics/workforce` | 6.31 kB | 335 kB |
| `/performance/peer-review/results/[cycleId]` | 7.46 kB | 324 kB |

## Analytics Routes Summary

All analytics pages load 160-215 kB of chart libraries (recharts) on top of the 176 kB shared bundle.

## Key Observations

- **176 kB shared bundle** is acceptable but could be reduced with dynamic imports for layout floating components
- **Analytics pages** are the heaviest group (330-391 kB) due to eager recharts loading
- **Succession pages** are outliers at 404 kB — likely loading @xyflow/react eagerly
- **Dashboard layout** uses `force-dynamic`, causing server-side DB queries on every navigation
- **No loading.tsx** files exist — no route-level streaming
- **Cache hit rate** not yet measured (counters just added)

## Middleware

| Middleware | Size |
|-----------|------|
| Middleware bundle | 63.5 kB |
