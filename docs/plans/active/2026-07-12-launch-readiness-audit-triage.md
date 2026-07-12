# Launch-Readiness Full Audit — Triage (2026-07-12, S335)

> Source: `launch-readiness-full-audit` workflow (run `wf_c56b9aad-d32`) — 15 modules audited
> (6 P0 workflows + 9 non-P0), N1 7-layer, role-aware, Sonnet auditors + Fable-high adversarial
> verification of every P0/P1 finding. 38 agents, 8 confirmed / 13 downgraded / 2 refuted.
> Succession/Talent auditor returned a placeholder → re-audited standalone (findings below are
> **unverified** — no adversarial pass; re-verify before fixing).
> ⚠️ Audits go stale fast ([[phase3a-audit-drift]]) — re-grep evidence before each fix.

## Module readiness snapshot

| Module | Readiness | Module | Readiness |
|---|---|---|---|
| 입사 Onboarding | partial | 성과 Performance | ready |
| 퇴사 Offboarding | **ready** | 교육 Training | **blocked** |
| 조직변경 Org change | partial | 복리후생 Benefits | partial |
| 휴가 Leave | **ready** | 설정 Settings | partial |
| 근태 Attendance | partial | 채용 Recruitment | partial |
| 급여 Payroll | **ready** | 승계/인재풀 Succession | blocked (unverified) |
| 컴플라이언스 Compliance | partial | My Space | partial |
| 대시보드/분석 Analytics | partial | | |

## P0 — launch blocking (confirmed)

1. **[Training] Start/complete-course = 405 for every role** — FE calls `apiClient.patch` but
   route only exports PUT. `src/app/(dashboard)/my/training/MyTrainingClient.tsx:154,166` vs
   `src/app/api/v1/training/enrollments/[id]/route.ts`. Fix: patch→put.
2. **[Training] Even after method fix, self start/complete 403** — route gated
   `perm(TRAINING, ACTION.APPROVE)`; EMPLOYEE has zero training_* perms
   (`enrollments/[id]/route.ts:67`, `prisma/seed.ts:164-168`). Fix: self-service ownership path
   (own enrollment via withAuth ownership check) or dedicated my-enroll endpoint.
3. **[Benefits] Claim proof upload is still fake** — `MyBenefitsClient.tsx:96-100` fabricates
   `benefit-claims/${Date.now()}-${name}` strings, discards File objects; no presign/S3 PUT in the
   flow. HR reviewers see nonexistent paths (`BenefitApprovalTab.tsx:198-210`). Fix: reuse PR-5
   #183 presigned-POST + FileUpload SSOT pattern ([[hrhub-file-upload-infra]]).

## P1 — fix before UAT (confirmed)

4. **[Onboarding] PR #222 dead-end: MANAGER has no sidebar path to `/onboarding`** — only nav item
   is in HR_UP-only `hr-mgmt` group (`src/config/navigation.ts:388-401`); backend/ACL allow MANAGER.
   Fix: add onboarding entry to `team` group (MANAGER_UP). Related open decision: 52h-warning
   MANAGER surface — same "MANAGER surface" bucket.
5. **[Attendance] weekly-summary hardcodes KST offset** — `weekly-summary/route.ts:28-38`
   (`9*60*60*1000`) instead of `resolveDayContext`/timezone.ts; sole outlier among attendance
   routes; wrong week windows for non-KST companies (CTR-VN/CN/US…). Fix: swap to SSOT helpers.
   (monthly/[year]/[month] has same pattern — verified impact lower, P2 #d3.)
6. **[Recruitment] Interview form: native validation dead + silent failure** —
   `InterviewFormClient.tsx` no `<form>`, min/max inert, catch swallows errors
   (WdDrawer-regression class [[hrhub-wddrawer-form-validation-regression]]). Fix: error state +
   JS guards.
7. **[Recruitment] Requisition approval workflow unreachable** — no nav entry / zero links to
   `/recruitment/requisitions` (`navigation.ts:411-458`). Fix: add nav (HR_UP) + approver inbox
   surface.
8. **[Analytics] `hasPermission()` ANALYTICS fallback ignores action** — `permissions.ts:29-34`
   grants MANAGER/EXECUTIVE any analytics action; `analytics/calculate` (CREATE, HR-only per header)
   directly callable. Fix: restrict fallback to ACTION.VIEW.
9. **[Training] EMPLOYEE cannot reach /my/training via nav** (downgraded P0→P1) —
   `useNavigation.ts:16` SELF_SERVICE_PATHS lacks `/my/training`; zero training perms seeded.
10. **[Training] Self-enroll button wrong endpoint/payload** (P0→P1) — posts
    `{courseId, source}` to bulk-enroll route expecting `employeeIds[]` + CREATE perm → 400/403.
    Fix: self-enroll endpoint (withAuth, employeeId=self).
11. **[Benefits] BenefitPlan admin CRUD missing entirely** (P0→P1) — GET only; HR cannot add/modify
    plans without dev/seed. Fix: POST/PUT/soft-delete routes + admin tab.
12. **[Compliance] Retention-policy CRUD calls nonexistent paths** (P0→P1) — FE hits
    `gdpr/retention-policies*` (4 call sites), backend is `gdpr/retention`. Fix: repoint call sites.
13. **[Compliance] Consent revoke hits nonexistent PATCH** (P0→P1) — real route is
    POST `consents/[id]/revoke`. Fix: repoint.

### Succession/Talent (standalone re-audit — UNVERIFIED, verify then decide)

- **MANAGER/EXECUTIVE succession 전면 403** — no succession_* perms seeded (`seed.ts:154-172`).
  ⚠️ May be intentional RBAC (cf. ⑥-C precedent: role enablement = product decision + perm-row SQL).
  CEO decision needed: which roles should see succession/talent-pool.
- **EXECUTIVE has recruitment_export but not recruitment_read** — likely paste artifact; talent-pool
  requires recruitment_read.
- **P1 latent IDOR if MANAGER succession write is granted** — candidates write routes lack team
  scoping; adopt `skill-access.ts` SSOT pattern before granting.

## P2 register (verified-downgraded + notable unverified)

- Teams-bot leave approval lacks delegation check (web path has it) — d2
- attendance monthly same KST pattern (impact bounded by workDate storage) — d3/d4
- entity-transfers 4 routes + concurrent-assignment 2 routes = dead code (no FE) — decide keep/remove
- bulk-movements missing RATE_LIMITS.BULK
- Settings CompanySettingSelector shows all 13 companies to non-SUPER (backend silently ignores) —
  silent-ignore UX; also CEO's "global→override 구조 결함" memory partially reflected here
- GDPR tabs raw fetch + silent error swallowing (rules violation)
- unified-tasks LEAVE_APPROVAL uses raw getDirectReportIds (no active/company re-filter) — auto-fixed
  by direct-reports SSOT track ([[hrhub-direct-reports-helper-scoping]])
- offboarding EMPLOYEE self-view dead branches; isSeveranceCalculated misnomer
- training batch-create no self-ownership guard (conditional on perm grant)
- REFUTED (do not fix): MANAGER Executive-Summary nav leak (useNavigation already hides it)

## Suggested fix order (Phase 4)

1. **PR-A Training self-service** — ✅ **PR #225** (S335): self-service withAuth routes
   (POST/PUT `/training/my/enrollments`), FE repoint, nav. Follow-ups filed: expired re-enroll
   model (`@@unique(courseId,employeeId)` — product design), `/training/my` course company filter.
2. **PR-B Benefits upload** — ✅ **PR #226** (S335): presign + verify/consume (LoA #183 SSOT
   mirror) + HR proof download route (record-equality key check kills forged/legacy keys) +
   pure parser vitest. Follow-up filed: **apiError exposes raw Error.message app-wide (P2,
   pre-existing systemic — non-AppError 500s leak internals like AWS errors)**. Plan-CRUD P1 #11
   still open (separate PR).
3. **PR-C Compliance** — ✅ **PR #227** (S335): audit understated — GDPR FE was written against a
   prototype mock contract (paths + snake_case + free-string enums + lowercase status); realigned
   5 FE files, added retention hard-DELETE route, + **consents POST cross-tenant guard** (Codex G2
   found arbitrary-employeeId consent creation — prior sweeps missed it). Follow-ups: DataRequests/
   Dpia tabs legacy patterns, enum-label i18n.
4. **PR-D Surfaces/nav** — ✅ **PR #228** (S335): team-nav onboarding (frozen-file unlock flow),
   requisitions nav + approvals-inbox deep-link banner (myApprovals SSOT reuse), analytics fallback
   VIEW-only + employee-risk recalculate guard + attrition button gate, weekly-summary company-tz.
5. **Succession**: verify findings → CEO role-visibility decision → perms + scoping in one PR.

Phase 2 (design QA) / Phase 3 (UAT scenario walkthrough) of the campaign follow after or in
parallel with fixes — see session log.
