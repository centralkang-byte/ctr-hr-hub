export const meta = {
  name: 'p0-readiness-audit',
  description: 'Audit the 6 P0 HR workflows end-to-end (N1 7-layer) for dogfood-blocking gaps and bugs, role-aware — then adversarially verify each P0/P1 finding before reporting',
  phases: [
    { title: 'Audit', detail: 'one 7-layer auditor per P0 workflow, role-aware, read-only' },
    { title: 'Verify', detail: 'skeptic re-checks each P0/P1 finding against code, refutes over-reports' },
  ],
}

const AUDIT_SCHEMA = {
  type: 'object',
  required: ['workflow', 'layers', 'findings', 'dogfoodReadiness', 'summary'],
  properties: {
    workflow: { type: 'string' },
    entryPoints: { type: 'array', items: { type: 'string' }, description: 'routes/pages/libs found' },
    layers: {
      type: 'array',
      description: 'the 7 N1 layers',
      items: {
        type: 'object',
        required: ['layer', 'status', 'evidence'],
        properties: {
          layer: { type: 'string', description: 'e.g. 1-Prisma, 2-API, 3-Perm, 4-FEmutation, 5-UItrigger, 6-Feedback, 7-StateRefresh' },
          status: { type: 'string', enum: ['present', 'partial', 'missing'] },
          evidence: { type: 'string', description: 'file:line' },
        },
      },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'severity', 'layer', 'classification', 'evidence', 'fix'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['P0', 'P1', 'P2'], description: 'P0=blocks dogfood, P1=important, P2=minor' },
          layer: { type: 'string' },
          classification: { type: 'string', enum: ['가', '나', '다'], description: '가=complete, 나=partial, 다=missing' },
          role: { type: 'string', description: 'affected role(s)' },
          evidence: { type: 'string', description: 'file:line' },
          fix: { type: 'string' },
        },
      },
    },
    dogfoodReadiness: { type: 'string', enum: ['ready', 'partial', 'blocked'] },
    summary: { type: 'string' },
  },
}

// Adversarial-verify output: only findings that survive a skeptic re-check
const CONFIRM_SCHEMA = {
  type: 'object',
  required: ['workflow', 'confirmed', 'refuted'],
  properties: {
    workflow: { type: 'string' },
    dogfoodReadiness: { type: 'string', enum: ['ready', 'partial', 'blocked'] },
    confirmed: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'severity', 'evidence', 'verdict', 'fix'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['P0', 'P1', 'P2'] },
          layer: { type: 'string' },
          role: { type: 'string' },
          evidence: { type: 'string', description: 'file:line' },
          verdict: { type: 'string', description: 'concrete repro proving the bug is real' },
          fix: { type: 'string' },
        },
      },
    },
    refuted: { type: 'number', description: 'P0/P1 findings refuted as over-reports' },
  },
}

const WORKFLOWS = [
  { name: '입사 (Onboarding / Hire)', hints: "Hire wizard + employee creation + onboarding checklist. Search: src/app/api/v1/employees, src/app/api/v1/onboarding, hire/onboarding wizard components under src/components and src/app/(dashboard)/employees, src/lib onboarding. Terms: hire, onboarding, employee create, 입사, 온보딩. Trace the multi-step hire wizard end-to-end." },
  { name: '퇴사 (Offboarding)', hints: "Offboarding flow + final settlement. Search: src/app/api/v1/**/offboarding, src/lib/**/offboarding-complete.ts, offboarding pages. Terms: offboarding, 퇴사, resignation, termination, lastWorkingDay. Check status transitions and final-settlement triggers." },
  { name: '조직변경 (Org change / Assignment)', hints: "Position/assignment changes, transfers, reporting-line changes. Search: src/app/api/v1/**/assignments, position, transfer, bulk-movements, reportsToPositionId. Terms: assignment, transfer, 조직변경, 발령. Note the append-only assignment rule (set endDate + new row, never in-place update) — see .claude/rules/assignments.md." },
  { name: '휴가 (Leave)', hints: "Leave request + approval + balance. Search: src/app/api/v1/leave, LeaveClient, LeaveYearBalance, EmployeeLeaveBalance, accrualEngine. Terms: leave, 휴가, annual, 연차, request, approve. KNOWN ISSUES to verify/flag: (a) dual balance tables — legacy EmployeeLeaveBalance vs SSOT LeaveYearBalance (Phase 5/6 incomplete); (b) special leave 특별휴가 (event-based, e.g. 경조사) reportedly cannot be requested because the POST hard-requires a balance row that accrual never creates." },
  { name: '근태 (Attendance)', hints: "Attendance check-in/out + monthly stats + corrections. Search: src/app/api/v1/attendance, AttendanceClient, attendance-monthly-stats. Terms: attendance, 근태, check-in, checkOut, workDate, 출퇴근. Verify timezone handling uses src/lib/timezone.ts (never raw JS Date construction for display)." },
  { name: '급여 (Payroll — basic run)', hints: "Basic payroll run (NOT simulation/global, which are P3 — out of scope). Search: src/app/api/v1/payroll, PayrollClient, payrollRun, src/lib payroll. Terms: payroll, 급여, payrollRun, payslip, 명세서. Note overseas payroll is 'external processing → result upload' per policy. Focus on the domestic basic run end-to-end." },
]

phase('Audit')
log(`P0 readiness audit: ${WORKFLOWS.length} workflows, 7-layer trace → adversarial verify (over-report guard)...`)

const results = await pipeline(
  WORKFLOWS,
  // Stage 1 — 7-layer audit (unchanged from v1)
  (w) =>
    agent(
      `You are auditing ONE P0 HR workflow in the CTR HR Hub Next.js/Prisma codebase for dogfood-readiness, using the N1 7-layer fidelity standard. READ-ONLY — do NOT edit any files.\n\n` +
      `WORKFLOW: ${w.name}\n` +
      `DISCOVERY HINTS: ${w.hints}\n\n` +
      `Steps:\n` +
      `1. Find the workflow's entry points: API routes (src/app/api/v1/**/route.ts), pages (src/app/(dashboard)/**), key components and libs. Use Bash \`grep -rn\` and Read.\n` +
      `2. Trace all 7 layers end-to-end; mark each present/partial/missing with file:line evidence:\n` +
      `   (1) Prisma mutation (schema model + the write) (2) API endpoint (route + zod validation + RLS/companyFilter via resolveCompanyId) (3) Permission guard (withPermission/withAuth — check role-by-role: SUPER_ADMIN/HR_ADMIN/EXECUTIVE/MANAGER/EMPLOYEE) (4) FE mutation (apiClient/SWR) (5) UI trigger (button/form/wizard) (6) User feedback (toast/loading/error) (7) State refresh (refetch/selection clear).\n` +
      `3. For each gap or bug -> a finding: severity (P0 blocks dogfood / P1 important / P2 minor), the layer, classification (가 complete / 나 partial / 다 missing), affected role(s), file:line evidence, and a concrete fix.\n` +
      `4. Be role-aware: a flow may work for HR_ADMIN but break for EMPLOYEE/MANAGER — flag role-specific gaps.\n` +
      `5. Judge overall dogfoodReadiness: ready / partial / blocked.\n\n` +
      `Prefer finding real bugs over declaring 'ready'. Evidence before assertion. Return the structured audit only.`,
      { label: `audit:${w.name}`, phase: 'Audit', schema: AUDIT_SCHEMA, model: 'sonnet' }
    ),
  // Stage 2 — adversarially verify the P0/P1 findings (refute over-reports)
  (audit, w) => {
    const toCheck = (audit?.findings || []).filter((f) => f.severity === 'P0' || f.severity === 'P1')
    if (toCheck.length === 0) {
      return { workflow: w.name, dogfoodReadiness: audit?.dogfoodReadiness || 'partial', confirmed: [], refuted: 0 }
    }
    return agent(
      `You are a SKEPTICAL reviewer verifying audit findings for the P0 workflow "${w.name}" in the CTR HR Hub. READ-ONLY.\n\n` +
      `A prior auditor reported the P0/P1 findings below. Audits here have a KNOWN over-reporting failure mode ` +
      `(see memory p0-audit-overreports-wiring / phase3a-audit-drift), so your job is to REFUTE the ones that aren't real.\n` +
      `For EACH finding: re-read the cited file:line and the surrounding code (and prisma/seed.ts buildRolePermissions() ` +
      `when it's a permission claim). Confirm ONLY if you can state a concrete repro: "role R at step S gets behavior B, ` +
      `expected E." Default to REFUTED when the cited code does not actually exhibit the bug, when it's already handled ` +
      `elsewhere (e.g. middleware), or when it's stale vs current code.\n\n` +
      `FINDINGS:\n${JSON.stringify(toCheck, null, 2)}\n\n` +
      `Return only CONFIRMED findings (with a concrete verdict + fix) and the count refuted.`,
      { label: `verify:${w.name}`, phase: 'Verify', schema: CONFIRM_SCHEMA, model: 'sonnet' }
    )
  }
).then((rs) => rs.filter(Boolean))

const confirmed = results.flatMap((r) => (r.confirmed || []).map((f) => ({ ...f, workflow: r.workflow })))
const refutedTotal = results.reduce((n, r) => n + (r.refuted || 0), 0)
const p0 = confirmed.filter((f) => f.severity === 'P0')
log(`Confirmed: ${confirmed.length} (P0=${p0.length}), refuted as over-reports: ${refutedTotal}.`)

return {
  byWorkflow: results.map((r) => ({ workflow: r.workflow, dogfoodReadiness: r.dogfoodReadiness, confirmed: (r.confirmed || []).length })),
  p0Count: p0.length,
  confirmedCount: confirmed.length,
  refuted: refutedTotal,
  confirmed,
}
