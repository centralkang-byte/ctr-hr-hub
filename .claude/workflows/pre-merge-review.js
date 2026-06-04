export const meta = {
  name: 'pre-merge-review',
  description: 'Multi-dimensional review of the current branch diff (correctness, tenant/permission security, project-rules, i18n, design tokens) with adversarial verification of every finding',
  whenToUse: 'Before opening or merging a PR — the in-house parallel version of the Codex Gate. Reviews `git diff <base>...HEAD` across 5 dimensions at once, then refutes false positives. Pass the base branch as args (default origin/main).',
  phases: [
    { title: 'Review', detail: 'one agent per dimension over the branch diff' },
    { title: 'Verify', detail: 'skeptic confirms each finding against the actual diff' },
  ],
}

const BASE = typeof args === 'string' && args.trim() ? args.trim() : 'origin/main'

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'evidence', 'issue', 'fix'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['P0', 'P1', 'P2'] },
          evidence: { type: 'string', description: 'file:line in the diff' },
          issue: { type: 'string' },
          fix: { type: 'string' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['confirmed', 'refuted'],
  properties: {
    confirmed: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'severity', 'evidence', 'fix'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['P0', 'P1', 'P2'] },
          evidence: { type: 'string' },
          fix: { type: 'string' },
        },
      },
    },
    refuted: { type: 'number' },
  },
}

const DIMENSIONS = [
  { key: 'correctness', focus: 'logic bugs, null/undefined derefs, race conditions, missing await, broken or empty catch blocks (empty catch is a rule violation), Prisma misuse, off-by-one, wrong comparisons.' },
  { key: 'security', focus: 'multi-tenant companyId isolation (resolveCompanyId is SSOT — non-SUPER must be forced to user.companyId; no raw companyId trust [#121]; no cross-company write [#119]); permission guards (withPermission/withAuth present and role-correct); SoD on approvals; injection; leaked secrets.' },
  { key: 'rules', focus: 'project conventions in .claude/rules/*.md: FE uses apiClient not raw fetch; AppError factories not raw throw; Korean user-facing error messages; timezone via src/lib/timezone.ts; append-only assignments (endDate + new row); withCache company-scope key includes role.' },
  { key: 'i18n', focus: 'hardcoded user-facing strings that should use next-intl; message keys added to ko.json but missing in en/es/vi/zh; edits or deletes of EXISTING message keys (FORBIDDEN — keys are frozen); placeholder mismatches.' },
  { key: 'design', focus: 'changed .tsx UI files: DESIGN.md token adherence (Workday Navy #004964; status/typography from src/lib/styles); no raw hex or leftover violet; loading/error/empty tri-state per rules/components.md.' },
]

phase('Review')
log(`Pre-merge review vs ${BASE}: ${DIMENSIONS.length} dimensions, diff-scoped, adversarially verified...`)

const reviewed = await pipeline(
  DIMENSIONS,
  // Stage 1 — review the diff for one dimension
  (d) =>
    agent(
      `You are reviewing the CURRENT BRANCH DIFF of the CTR HR Hub for the "${d.key}" dimension. READ-ONLY.\n` +
      `First run \`git diff --name-only ${BASE}...HEAD\` then \`git diff ${BASE}...HEAD\` to see exactly what changed. ` +
      `Review ONLY changes introduced by this diff (Read full files for context as needed, but do not report pre-existing issues).\n` +
      `Focus: ${d.focus}\n` +
      `Report concrete findings with file:line and a fix. If the diff is clean for this dimension, return an empty findings list.`,
      { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS_SCHEMA, model: 'sonnet' }
    ),
  // Stage 2 — refute false positives for this dimension
  (rev, d) => {
    const fs = rev?.findings || []
    if (fs.length === 0) return { dimension: d.key, confirmed: [], refuted: 0 }
    return agent(
      `Skeptical reviewer. REFUTE false positives among these "${d.key}" findings on the CTR HR Hub branch diff. READ-ONLY.\n` +
      `Re-read each cited file:line in the actual diff (\`git diff ${BASE}...HEAD\`) and surrounding code. ` +
      `Confirm only real issues INTRODUCED by this diff with a concrete consequence. ` +
      `Default to refuted if the cited code is correct, pre-existing, or the concern does not actually apply.\n\n` +
      `FINDINGS:\n${JSON.stringify(fs, null, 2)}\n\n` +
      `Return confirmed (with severity + fix) and the count refuted.`,
      { label: `verify:${d.key}`, phase: 'Verify', schema: VERDICT_SCHEMA, model: 'sonnet' }
    ).then((v) => ({ dimension: d.key, confirmed: v?.confirmed || [], refuted: v?.refuted || 0 }))
  }
).then((rs) => rs.filter(Boolean))

const confirmed = reviewed.flatMap((r) => (r.confirmed || []).map((f) => ({ ...f, dimension: r.dimension })))
const refutedTotal = reviewed.reduce((n, r) => n + (r.refuted || 0), 0)
const blocking = confirmed.filter((f) => f.severity === 'P0' || f.severity === 'P1')
log(`Confirmed ${confirmed.length} issues (${blocking.length} blocking), refuted ${refutedTotal}.`)

return { base: BASE, confirmedCount: confirmed.length, blocking: blocking.length, refuted: refutedTotal, confirmed }
