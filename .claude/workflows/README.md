# Dynamic Workflows — CTR HR Hub

Saved, re-runnable multi-agent workflows + when/how to use them. A workflow fans out many subagents in parallel for work too big or too independent for one context.

## When to reach for a workflow
- **Audit / review across many areas** — P0 readiness, security sweep, dependency map (one agent per area, verified in parallel)
- **Migration across many call-sites** — rename, API deprecation (one agent per site, worktree-isolated)
- **Multi-perspective design / research** — independent attempts, judged + synthesized
- **High-stakes verification** — adversarial verify before committing

**NOT for**: single-file edits, quick fixes, one-shot questions. Workflows are token-heavy.

## How to trigger — opt-in by design (CC does NOT auto-launch)
1. Put **"workflow"** in your request — e.g. "이거 워크플로로 돌려줘", "fan out agents to review X"
2. Turn on **ultracode** via `/effort` — then CC decides per task whether a workflow fits
3. Ask CC to **fan out / orchestrate**
4. **Run a saved one by name** — e.g. "run the p0-readiness-audit workflow"

CC may *suggest* a workflow when a task fits, but the launch needs one of the above (cost control).

## Saved workflows (this folder)

Organized by cadence. Every audit-class workflow ends with an **adversarial-verify** stage — a skeptic re-reads each finding and refutes false positives. This is non-optional here: audits have a known over-reporting failure mode (memory `p0-audit-overreports-wiring`, `phase3a-audit-drift`).

**Standing guards (run periodically / before a release — pair with `/loop` or `/schedule`):**
- **`multi-tenant-leak-hunt.js`** — sweeps all ~600 API routes for companyId isolation leaks (the #121 raw-companyId-trust and #119 cross-company-write classes). 14 cluster scanners → per-cluster skeptic verify → ranked report. Read-only. **The #1 SaaS risk; run before every release tag.**
- **`i18n-drift-audit.js`** — 5 locales × ~69 namespaces: missing/orphan keys vs `ko` (source of truth), placeholder mismatches, and hardcoded user-facing strings bypassing next-intl. Read-only.

**Dev-cycle gates (run before opening / merging a PR):**
- **`pre-merge-review.js`** — reviews `git diff <base>...HEAD` across 5 dimensions (correctness · tenant/permission security · project-rules · i18n · design tokens) in parallel, each finding adversarially verified. The in-house parallel version of the Codex Gate. Pass base branch as args (default `origin/main`).
- **`p0-readiness-audit.js`** — audits the 6 P0 HR workflows (입사·퇴사·조직변경·휴가·근태·급여) end-to-end via the N1 7-layer standard, role-aware → 7-layer auditor per workflow, then a skeptic verifies each P0/P1 finding. Read-only.
  - **Use before fixing P0s to re-verify against current `main`.** Audits go stale fast (parallel sessions merge fixes). First run (S248) found 15 P0; the v2 verify stage now filters over-reports automatically.

## Related (not manual workflows)
- **CLAUDE.md / docs drift** is AUTOMATED weekly by the `claude-md-drift-watch` routine (https://claude.ai/code/routines) — no manual workflow needed.
- **`n1-layer-auditor`** (`.claude/agents/n1-layer-auditor.md`) is the single-feature version of the P0 audit — usable standalone or as a workflow `agentType`.

## Authoring a new one
Workflows are plain JS: `export const meta = {…}` then `parallel()` / `pipeline()` / `agent()` (with a JSON `schema` for structured output). Easiest path: ask CC *"author a workflow that …"* — CC writes and runs it inline, then we save the proven script here by name. Use `p0-readiness-audit.js` as a template.
