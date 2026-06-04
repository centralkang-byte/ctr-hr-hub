export const meta = {
  name: 'multi-tenant-leak-hunt',
  description: 'Sweep all API routes for multi-tenant (companyId) isolation leaks; adversarially verify each candidate before reporting',
  whenToUse: 'Before a release tag, or after touching API routes / permission guards. Read-only. Catches the #121 (raw companyId trust) and #119 (cross-company write) bug classes across all ~600 routes at once.',
  phases: [
    { title: 'Scan', detail: 'one agent per route cluster — flag companyId-scope gaps' },
    { title: 'Verify', detail: 'skeptic re-reads each candidate, refutes false positives' },
    { title: 'Synthesize', detail: 'dedupe + rank confirmed leaks into a CEO-actionable report' },
  ],
}

// ── Isolation doctrine embedded into every agent (correct pattern + anti-patterns) ──
const DOCTRINE = `
MULTI-TENANT ISOLATION DOCTRINE — CTR HR Hub (Next.js App Router + Prisma, 5 roles):
- SSOT: resolveCompanyId(user, requestedCompanyId) in src/lib/api/companyFilter.ts.
    * SUPER_ADMIN may pass ?companyId=... to read OTHER tenants.
    * EVERY other role: companyId is FORCED to user.companyId — the requested value is IGNORED.
- Cross-company READ (MANAGER+ dotted-line only): verifyCrossCompanyAccess() / getCrossCompanyReadFilter()
  in src/lib/api/cross-company-access.ts (read-only, never write).
- DB-layer defense: withRLS(buildRLSContext(user), tx => ...) in src/lib/api/withRLS.ts (PostgreSQL RLS).
- Roles: SUPER_ADMIN, HR_ADMIN, EXECUTIVE, MANAGER, EMPLOYEE.

LEAK CANDIDATE if ANY holds:
  (L1) Queries/mutates a tenant-scoped Prisma model with NO companyId scope in the where-clause,
       AND the route is not SUPER-only, AND it is not self-scoped to user.employeeId.
  (L2) Uses a request-supplied companyId (searchParams 'companyId' or body.companyId) for NON-super
       users WITHOUT the SUPER gate — i.e. trusts raw companyId. (#121 onboarding/instances bug class.)
  (L3) A mutation (POST/PUT/PATCH/DELETE) writes companyId from the request body without forcing it to
       user.companyId. (#119 cross-company write bug class.)
  (L4) Manual companyId comparison instead of resolveCompanyId (rule violation + drift risk).
  (L5) withCache scope 'company' whose cache key omits role (cross-role cache bleed) — severity P1.

NOT a leak (do NOT flag):
  - Route is SUPER_ADMIN-only (gate only SUPER passes, or explicit role check).
  - companyId enforced via resolveCompanyId, or the SUPER-gated ternary
    (user.role === 'SUPER_ADMIN' ? requested : user.companyId).
  - Query scoped through a parent record that is itself tenant-scoped.
  - Self-service route (withAuth) returning ONLY the caller's own data (employeeId/userId === user.*).
  - withRLS wraps the query (DB enforces isolation).
`

const CANDIDATES_SCHEMA = {
  type: 'object',
  required: ['cluster', 'routesScanned', 'candidates'],
  properties: {
    cluster: { type: 'string' },
    routesScanned: { type: 'number' },
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        required: ['route', 'method', 'leakClass', 'evidence', 'why'],
        properties: {
          route: { type: 'string', description: 'file path' },
          method: { type: 'string', description: 'GET/POST/PUT/PATCH/DELETE' },
          leakClass: { type: 'string', enum: ['L1', 'L2', 'L3', 'L4', 'L5'] },
          model: { type: 'string', description: 'Prisma model at risk' },
          evidence: { type: 'string', description: 'file:line' },
          why: { type: 'string', description: 'how cross-tenant access could happen' },
        },
      },
    },
  },
}

const VERIFIED_SCHEMA = {
  type: 'object',
  required: ['cluster', 'confirmed', 'refuted'],
  properties: {
    cluster: { type: 'string' },
    confirmed: {
      type: 'array',
      items: {
        type: 'object',
        required: ['route', 'method', 'leakClass', 'severity', 'evidence', 'attack', 'fix'],
        properties: {
          route: { type: 'string' },
          method: { type: 'string' },
          leakClass: { type: 'string' },
          severity: { type: 'string', enum: ['P0', 'P1', 'P2'] },
          evidence: { type: 'string', description: 'file:line' },
          attack: { type: 'string', description: 'concrete cross-tenant access path' },
          fix: { type: 'string' },
        },
      },
    },
    refuted: { type: 'number', description: 'candidates refuted as false positives' },
  },
}

// 14 clusters covering the tenant-scoped API surface (cron/migration/locale/sidebar omitted — internal/low-risk)
const CLUSTERS = [
  { name: 'payroll', folders: ['payroll', 'compensation', 'tax-brackets', 'bank-transfers', 'year-end'] },
  { name: 'performance', folders: ['performance', 'peer-review', 'cfr', 'competencies'] },
  { name: 'settings', folders: ['settings', 'tenant-settings', 'process-settings', 'settings-audit-log', 'delegation'] },
  { name: 'compliance', folders: ['compliance', 'disciplinary', 'discipline', 'audit', 'contracts', 'work-permits'] },
  { name: 'recruitment', folders: ['recruitment', 'succession'] },
  { name: 'employees', folders: ['employees', 'directory', 'profile', 'my'] },
  { name: 'analytics', folders: ['analytics', 'dashboard', 'home', 'pulse', 'attrition', 'monitoring'] },
  { name: 'onboarding-offboarding', folders: ['onboarding', 'offboarding'] },
  { name: 'leave', folders: ['leave', 'leave-of-absence', 'holidays', 'work-schedules'] },
  { name: 'benefits', folders: ['benefits', 'benefit-plans', 'benefit-claims', 'benefit-budgets', 'rewards'] },
  { name: 'attendance-shift', folders: ['attendance', 'shift-groups', 'shift-patterns', 'shift-roster', 'shift-schedules', 'shift-change-requests', 'terminals'] },
  { name: 'org', folders: ['org', 'positions', 'departments', 'entity-transfers', 'bulk-movements', 'grade-title-mappings', 'job-grades', 'teams', 'companies', 'locations'] },
  { name: 'training-tasks', folders: ['training', 'skills', 'unified-tasks', 'manager-hub'] },
  { name: 'platform', folders: ['ai', 'hr-chat', 'hr-documents', 'notifications', 'push', 'files', 'search', 'approvals', 'm365'] },
]

phase('Scan')
log(`Multi-tenant leak hunt: ${CLUSTERS.length} clusters across ~600 API routes (scan → adversarial verify → synthesize)...`)

const perCluster = await pipeline(
  CLUSTERS,
  // Stage 1 — scan a cluster for leak candidates
  (c) => agent(
    `You are a multi-tenant security auditor for the CTR HR Hub. READ-ONLY — do not edit any file.\n` +
    DOCTRINE +
    `\nSCAN these folders under src/app/api/v1/: ${c.folders.join(', ')}.\n` +
    `Method: \`find src/app/api/v1/<folder> -name route.ts\`, then Read each handler. For tenant-scoped models, ` +
    `check the companyId enforcement against the doctrine above.\n` +
    `Flag every LEAK CANDIDATE with file:line evidence and the leak class. When unsure, DO list it — ` +
    `the verify stage refutes false positives, so recall matters more than precision here.\n` +
    `Return candidates for cluster "${c.name}".`,
    { label: `scan:${c.name}`, phase: 'Scan', schema: CANDIDATES_SCHEMA, model: 'sonnet' }
  ),
  // Stage 2 — adversarially verify this cluster's candidates (skeptic refutes false positives)
  (scan, c) => {
    if (!scan || !scan.candidates || scan.candidates.length === 0) {
      return { cluster: c.name, confirmed: [], refuted: 0 }
    }
    return agent(
      `You are a SKEPTICAL security reviewer. Your job is to REFUTE false positives. READ-ONLY.\n` +
      DOCTRINE +
      `\nA prior scan flagged these candidates in cluster "${c.name}". For EACH, re-read the actual route file ` +
      `AND the helpers it calls (the permission gate, resolveCompanyId, withRLS, cross-company-access). ` +
      `Default to REFUTED unless you can state a concrete cross-tenant path: ` +
      `"as <non-SUPER role> of company A, request <X> returns/writes company B data."\n` +
      `Severity: P0 = real cross-tenant data read/write reachable by a non-SUPER role; ` +
      `P1 = cross-role bleed or write-gap needing unusual conditions; P2 = hardening only.\n\n` +
      `CANDIDATES:\n${JSON.stringify(scan.candidates, null, 2)}\n\n` +
      `Return only CONFIRMED leaks (with attack path + concrete fix) and the count refuted.`,
      { label: `verify:${c.name}`, phase: 'Verify', schema: VERIFIED_SCHEMA, model: 'sonnet' }
    )
  }
).then((rs) => rs.filter(Boolean))

phase('Synthesize')
const confirmed = perCluster.flatMap((r) => (r.confirmed || []).map((f) => ({ ...f, cluster: r.cluster })))
const refutedTotal = perCluster.reduce((n, r) => n + (r.refuted || 0), 0)
log(`Verify complete: ${confirmed.length} confirmed leaks, ${refutedTotal} refuted as false positives.`)

if (confirmed.length === 0) {
  return { confirmedCount: 0, refuted: refutedTotal, confirmed: [], report: 'No confirmed multi-tenant leaks across scanned clusters.' }
}

const report = await agent(
  `You are the lead security reviewer reporting to the CEO of an HR SaaS. Below are CONFIRMED multi-tenant ` +
  `isolation leaks across the CTR HR Hub API. Dedupe, rank by severity (P0 first), and write a tight summary: ` +
  `count of P0/P1/P2, which subsystems are worst, and the top 5 fixes in priority order with file:line.\n\n` +
  `CONFIRMED LEAKS:\n${JSON.stringify(confirmed, null, 2)}`,
  { label: 'synthesize', phase: 'Synthesize', model: 'sonnet' }
)

return { confirmedCount: confirmed.length, refuted: refutedTotal, confirmed, report }
