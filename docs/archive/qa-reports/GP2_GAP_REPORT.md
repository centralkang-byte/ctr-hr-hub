# GP#2 Onboarding/Offboarding — Gap Analysis Report

> **Generated**: 2026-03-11 02:10 KST
> **Scan Mode**: READ-ONLY — no code modifications
> **Compared Against**: GP#2 Design Spec v1.1 FINAL

---

## 1. Schema Gap Summary — Onboarding Models

| Spec Model | Actual Model | Status | Field-Level Diff |
|------------|-------------|:------:|-----------------|
| `OnboardingTemplate` | `OnboardingTemplate` | ✅ EXISTS | **Extra**: `planType` (ONBOARDING/OFFBOARDING/CROSSBOARDING_*), `deletedAt` — Good enhancement for crossboarding |
| `OnboardingTemplateTask` | `OnboardingTask` | ✅ EXISTS (name diff) | **Name**: spec says `OnboardingTemplateTask` → actual `OnboardingTask`. **Extra**: `category` (OnboardingTaskCategory). **Missing**: none |
| `EmployeeOnboarding` | `EmployeeOnboarding` | ✅ EXISTS | **Extra**: `buddyId`, `planType`, `linkedPlanId` (crossboarding), `lastWorkingDate` — Exceeds spec. **Missing**: `signOffBy`, `signOffAt` (sign-off fields) |
| `EmployeeOnboardingTask` | `EmployeeOnboardingTask` | ⚠️ PARTIAL | **MISSING**: `blockedReason`, `blockedAt`, `unblockedAt`, `dueDate`, `assigneeId`. Task status is `TaskProgressStatus` (PENDING/DONE/SKIPPED) — **no BLOCKED/IN_PROGRESS** |
| `OnboardingCheckin` | `OnboardingCheckin` | ⚠️ PARTIAL | **Diff**: `checkinWeek` (Int) instead of `milestone` (DAY_7/DAY_30/DAY_90 enum). `mood` uses `Mood` enum (GREAT/GOOD/NEUTRAL/...) instead of 1-5 scale. **Missing**: `onboardingId` FK |
| `OnboardingSetting` | `OnboardingSetting` | ✅ EXISTS | JSON-based config (flexible) |

## 2. Schema Gap Summary — Offboarding Models

| Spec Model | Actual Model | Status | Field-Level Diff |
|------------|-------------|:------:|-----------------|
| `OffboardingTemplate` | `OffboardingChecklist` | ✅ EXISTS (name diff) | Spec: `OffboardingTemplate` → Actual: `OffboardingChecklist`. Fields match well. |
| `OffboardingTemplateTask` | `OffboardingTask` | ✅ EXISTS | All fields present: `title`, `description`, `assigneeType`, `dueDaysBefore`, `isRequired`, `sortOrder` |
| `EmployeeOffboarding` | `EmployeeOffboarding` | ✅ EXISTS | **Extra**: `resignType`, `resignReasonCode`, `resignReasonDetail`, `handoverToId`, `severanceCalculated`, `itAccountDeactivated`, `exitInterviewCompleted` — Exceeds spec. **Missing**: `successorId` (has `handoverToId` instead — same concept) |
| `EmployeeOffboardingTask` | `EmployeeOffboardingTask` | ⚠️ PARTIAL | Status uses generic `TaskStatus` (PENDING/DONE/SKIPPED/BLOCKED) — has BLOCKED! **Missing**: `assigneeId`, `dueDate` (computed from `dueDaysBefore`) |
| `ExitInterview` | `ExitInterview` | ✅ EXISTS | **Extra**: `detailedReason`, `satisfactionDetail` (JSON), `suggestions`, `isConfidential` — Exceeds spec |
| `AssetReturn` | — | ❌ MISSING | No `AssetReturn` model exists in schema |

## 3. Enum Gap Summary

| Spec Enum | Actual Enum | Status | Diff |
|-----------|------------|:------:|------|
| `OnboardingTaskStatus` (PENDING/IN_PROGRESS/DONE/BLOCKED/SKIPPED) | `TaskProgressStatus` (PENDING/DONE/SKIPPED) | ⚠️ PARTIAL | **MISSING**: `IN_PROGRESS`, `BLOCKED` — Critical for task state machine |
| `AssigneeType` (HR/IT/MANAGER/BUDDY/EMPLOYEE/FINANCE) | `OnboardingAssignee` (same values) | ✅ MATCH | Separate enum `OffboardingAssignee` exists too |
| `OnboardingTargetType` (NEW_HIRE/TRANSFER/REHIRE) | `OnboardingTargetType` (same) | ✅ MATCH | — |
| `OffboardingType` (VOLUNTARY/INVOLUNTARY/RETIREMENT/CONTRACT_END/MUTUAL_AGREEMENT) | `OffboardingTargetType` + `ResignType` | ✅ EXISTS | Split across two enums. `ResignType` has MUTUAL_AGREEMENT; `OffboardingTargetType` does not |
| `ExitReason` (8 values) | `ExitReason` (8 values) | ✅ MATCH | Exact match |
| `OnboardingMilestone` (DAY_1/DAY_7/DAY_30/DAY_90) | — | ❌ MISSING | Uses `checkinWeek` (Int) instead of enum. No milestone concept |
| — | `OnboardingPlanType` | ➕ EXTRA | ONBOARDING/OFFBOARDING/CROSSBOARDING_* — crossboarding support |
| — | `OnboardingTaskCategory` | ➕ EXTRA | DOCUMENT/TRAINING/SETUP/INTRODUCTION/... — task categorization |

## 4. API Route Gap Summary

### Onboarding APIs

| Spec Route | Actual Route | Exists | Pattern | Notes |
|-----------|-------------|:------:|:-------:|-------|
| `GET/POST /onboarding/templates` | `/api/v1/onboarding/templates` | ✅ | ✅ apiSuccess | 75 lines, Zod, withPermission |
| `GET/PUT/DELETE /onboarding/templates/[id]` | `/api/v1/onboarding/templates/[id]` | ✅ | ✅ | 92 lines |
| `GET/POST /onboarding/templates/[id]/tasks` | `/api/v1/onboarding/templates/[id]/tasks` | ✅ | ✅ | 80 lines + reorder endpoint |
| `GET /onboarding/instances` | — | ❌ MISSING | — | No instances list endpoint (dashboard returns aggregated data instead) |
| `GET /onboarding/instances/[id]` | — | ❌ MISSING | — | No single onboarding instance GET |
| `PUT /instances/[id]/tasks/[taskId]/status` | `/api/v1/onboarding/tasks/[id]/complete` | ⚠️ PARTIAL | ✅ | Only "complete" action — no IN_PROGRESS or BLOCKED transitions |
| `POST /instances/[id]/tasks/[taskId]/block` | — | ❌ MISSING | — | No block endpoint |
| `POST /instances/[id]/tasks/[taskId]/unblock` | — | ❌ MISSING | — | No unblock endpoint |
| `POST /instances/[id]/sign-off` | — | ❌ MISSING | — | No sign-off endpoint |
| `GET/POST /onboarding/checkins` | `/api/v1/onboarding/checkins` + `/checkin` | ✅ | ✅ | List + submit endpoints |
| `GET /onboarding/me` | `/api/v1/onboarding/me` | ✅ | ✅ | 56 lines |
| `GET /onboarding/dashboard` | `/api/v1/onboarding/dashboard` | ✅ | ✅ | 100 lines, B5 enhanced |
| `POST /onboarding/crossboarding` | `/api/v1/onboarding/crossboarding` | ✅ | ✅ | 64 lines |
| `PUT /onboarding/[id]/force-complete` | `/api/v1/onboarding/[id]/force-complete` | ✅ | ✅ | HR force-complete |
| Event: `employee-hired` handler | `src/lib/events/handlers/employee-hired.handler.ts` | ✅ | ✅ | Auto-creates onboarding on hire |

### Offboarding APIs

| Spec Route | Actual Route | Exists | Pattern | Notes |
|-----------|-------------|:------:|:-------:|-------|
| `POST /employees/[id]/offboarding/start` | `/api/v1/employees/[id]/offboarding/start` | ✅ | ✅ | 249 lines — comprehensive |
| `GET /offboarding/instances` | — | ❌ MISSING | — | Dashboard endpoint exists instead |
| `GET /offboarding/instances/[id]` | — | ❌ MISSING | — | No single offboarding instance GET |
| `PUT /instances/[id]/tasks/[taskId]/status` | `/api/v1/offboarding/[id]/tasks/[taskId]/complete` | ⚠️ PARTIAL | ✅ | Only "complete" — no block/unblock |
| `POST /instances/[id]/cancel` | `/api/v1/offboarding/[id]/cancel` | ✅ | ✅ | 78 lines |
| `PUT /instances/[id]/reschedule` | — | ❌ MISSING | — | No reschedule endpoint |
| `GET/POST /instances/[id]/exit-interview` | `/api/v1/offboarding/[id]/exit-interview` | ✅ | ✅ | 151 lines + AI summary sub-route |
| `GET /exit-interviews/statistics` | — | ❌ MISSING | — | No anonymized statistics endpoint |
| `GET /offboarding/dashboard` | `/api/v1/offboarding/dashboard` | ✅ | ✅ | 88 lines |
| `GET /offboarding/me` | `/api/v1/offboarding/me` | ✅ | ✅ | 113 lines |
| `GET/POST /offboarding/checklists` | `/api/v1/offboarding/checklists` | ✅ | ✅ | Template CRUD |
| Event: `offboarding-started` handler | `src/lib/events/handlers/offboarding-started.handler.ts` | ✅ | ✅ | Fire-and-forget |

## 5. UI Page Gap Summary

> ⚠️ **CRITICAL FINDING**: 6 of 7 existing pages use **pre-CRAFTUI colors** (`#00C853`, `#1A1A1A`, `#E0E0E0`, `#F5F5F5`) instead of CRAFTUI tokens (`#5E81F4`, `#F0F0F3`, `#F5F5FA`, `#8181A5`, `#1C1D21`). Only `MyOffboardingClient.tsx` (35 token hits) uses CRAFTUI. All others: **0 hits**. Pages use `@/components/ui` (shadcn-like shared components) rather than inline CRAFTUI styling.

| Spec Page | Actual Path | Exists | LOC | CRAFTUI | Workday UX | Missing Features |
|-----------|------------|:------:|:---:|:-------:|:----------:|------------------|
| `/onboarding` (HR dashboard) | `(dashboard)/onboarding/` | ✅ | 514 | ❌ (0 tokens) | ⚠️ Flat table, no milestone grouping | Missing: BLOCKED count card, sign-off queue |
| `/onboarding/me` (Employee self) | `(dashboard)/onboarding/me/` | ✅ | 335 | ❌ (0 tokens) | ⚠️ Simple checklist, no My Tasks pattern | Missing: BLOCKED state visual, task unblock UI |
| `/onboarding/[id]` (Detail) | — | ❌ MISSING | — | — | — | No single onboarding detail page (milestone view + task list) |
| `/onboarding/checkin` (Form) | `(dashboard)/onboarding/checkin/` | ✅ | — | ❌ | ⚠️ No milestone steps | Uses checkinWeek instead of milestone enum |
| `/onboarding/checkins` (Admin) | `(dashboard)/onboarding/checkins/` | ✅ | — | ❌ | ⚠️ | — |
| `/settings/onboarding` | `(dashboard)/settings/onboarding/` | ✅ | 738 | ❌ (0 tokens) | ✅ Settings pattern OK | Uses shared Dialog/Textarea components |
| `/offboarding` (HR dashboard) | `(dashboard)/offboarding/` | ✅ | 655 | ❌ (0 tokens) | ⚠️ No Master-Detail, flat table | — |
| `/offboarding/[id]` (Detail) | `(dashboard)/offboarding/[id]/` | ✅ | 956 | ❌ (0 tokens) | ✅ Has timeline view + exit interview inline | Has exit interview inline UI + AI summary |
| `/offboarding/exit-interviews` (Stats) | — | ❌ MISSING | — | — | — | No exit interview analytics/statistics page |
| `/settings/offboarding` | `(dashboard)/settings/offboarding/` | ✅ | 692 | ❌ (0 tokens) | ✅ Settings pattern OK | — |
| `/my/offboarding` (Employee self) | `(dashboard)/my/offboarding/` | ✅ | 354 | ✅ (35 tokens) | ⚠️ No Business Process pattern | Only page using CRAFTUI tokens |

## 6. Event Handler & Shared Infra Gap Summary

| Component | Exists | LOC | Notes |
|-----------|:------:|:---:|-------|
| `employee-hired.handler.ts` | ✅ | — | Auto-creates EmployeeOnboarding + tasks from template |
| `offboarding-started.handler.ts` | ✅ | — | Dedup guard; tasks created in start/route.ts transaction |
| `createOnboardingPlan()` utility | ✅ | — | `src/lib/onboarding/create-onboarding-plan.ts` |
| Unified Task Mapper (Onboarding) | ✅ | 228 | Maps to UnifiedTaskType.ONBOARDING_TASK |
| Unified Task Mapper (Offboarding) | ✅ | 264 | Maps to UnifiedTaskType.OFFBOARDING_TASK |
| Nudge Engine | ✅ | 258 | Rules-based overdue nudging system |
| NudgeCards component | ✅ | — | Dashboard nudge cards for overdue items |
| BLOCKED state machine | ❌ MISSING | — | No block/unblock logic exists anywhere |
| Sign-off workflow | ❌ MISSING | — | No sign-off fields in model or API |
| Task status state machine | ❌ MISSING | — | Only PENDING→DONE/SKIPPED; no IN_PROGRESS or BLOCKED transitions |
| AI Checkin Summary | ✅ | — | `/api/v1/ai/onboarding-checkin-summary` + Claude integration |
| AI Exit Interview Summary | ✅ | — | Inline in offboarding detail page |

## 7. Sidebar & Navigation

| Menu Item | Exists | Config Location | Notes |
|-----------|:------:|-----------------|-------|
| 온보딩/오프보딩 (HR) | ✅ | `navigation.ts:343` | `key: 'onboarding-offboarding'`, href: `/onboarding` |
| 나의 오프보딩 (Employee) | ✅ | `navigation.ts:225` | `key: 'my-offboarding'`, href: `/my/offboarding` |
| 나의 온보딩 (Employee) | ⚠️ | — | Linked via `/onboarding/me` but may not have dedicated sidebar entry |
| Settings > 온보딩 | ✅ | — | Settings page exists |
| Settings > 오프보딩 | ✅ | — | Settings page exists |

## 8. Seed Data Gap Summary

| Seed | Exists | Coverage | Notes |
|------|:------:|----------|-------|
| Onboarding Template (KR) | ✅ | 1 template | In main `seed.ts` |
| Onboarding Tasks (KR) | ✅ | ~6 tasks | In main `seed.ts` |
| Onboarding Template (US) | ✅ | 1 template + tasks | B5 enhancement |
| Multi-entity templates (CN/RU/VN) | ✅ | 3 templates + tasks | B5 enhancement |
| Offboarding Checklist | ✅ | 1 checklist | In main `seed.ts` |
| Offboarding Tasks | ✅ | ~6 tasks | In main `seed.ts` |
| Active onboarding instances | ❌ | — | No sample EmployeeOnboarding records |
| Active offboarding instances | ❌ | — | No sample EmployeeOffboarding records |
| Sample exit interviews | ❌ | — | No sample ExitInterview records |
| Sample checkin data | ❌ | — | No sample OnboardingCheckin records |

---

## 9. Key Decisions for E-1 Prompt

### Schema: EXTEND (6 changes)

| Action | Detail |
|--------|--------|
| **EXTEND** `EmployeeOnboardingTask` | Add `blockedReason`, `blockedAt`, `unblockedAt`, `dueDate`, `assigneeId` |
| **EXTEND** `TaskProgressStatus` enum | Add `IN_PROGRESS`, `BLOCKED` values |
| **EXTEND** `EmployeeOnboarding` | Add `signOffBy`, `signOffAt` |
| **EXTEND** `OnboardingCheckin` | Add `onboardingId` FK; consider replacing `checkinWeek` with `milestone` enum |
| **CREATE** `OnboardingMilestone` enum | DAY_1, DAY_7, DAY_30, DAY_90 |
| **CREATE** `AssetReturn` model | employeeId, assetId, status, deductionAmount (if in scope) |

### APIs: CREATE 7, EXTEND 2, KEEP rest

| Action | Route |
|--------|-------|
| **CREATE** | `GET /onboarding/instances` (list active) |
| **CREATE** | `GET /onboarding/instances/[id]` (single detail) |
| **CREATE** | `PUT /instances/[id]/tasks/[taskId]/status` (state machine: PENDING→IN_PROGRESS→DONE + BLOCKED) |
| **CREATE** | `POST /instances/[id]/tasks/[taskId]/block` |
| **CREATE** | `POST /instances/[id]/tasks/[taskId]/unblock` |
| **CREATE** | `POST /instances/[id]/sign-off` |
| **CREATE** | `PUT /offboarding/instances/[id]/reschedule` |
| **CREATE** | `GET /offboarding/exit-interviews/statistics` |
| **EXTEND** | `tasks/[id]/complete` → Refactor to support full status state machine |
| **KEEP** | All 15+ existing routes — well-structured, apiSuccess/error pattern compliant |

### Pages: CREATE 2, EXTEND 2, VISUAL REFRESH 6, KEEP rest

| Action | Page |
|--------|------|
| **CREATE** | `/onboarding/[id]` — Single onboarding detail (milestone view + task list + BLOCKED management) |
| **CREATE** | `/offboarding/exit-interviews` — Exit interview statistics/analytics page |
| **EXTEND** | `/onboarding` dashboard — Add BLOCKED count card, sign-off queue |
| **EXTEND** | `/onboarding/me` — Add BLOCKED visual, task block/unblock UI |
| **VISUAL REFRESH** | 6 pages need CRAFTUI token migration (0→CRAFTUI). Colors: `#00C853`→`#22C55E`, `#1A1A1A`→`#1C1D21`, `#E0E0E0`→`#F0F0F3`, `#F5F5F5`→`#F5F5FA` |
| **UX UPGRADE** | Onboarding dashboard/me → Workday My Tasks + milestone grouping. Offboarding dashboard → Master-Detail pattern |

### Shared Infra: BUILD 2

| Component | Notes |
|-----------|-------|
| **BUILD** Task Status State Machine | PENDING → IN_PROGRESS → DONE/BLOCKED/SKIPPED (+ unblock flow) |
| **BUILD** Sign-off Workflow | Manager sign-off with signature, auto-complete remaining PENDING tasks |

---

## 10. Risk Items

| Risk | Level | Mitigation |
|------|:-----:|------------|
| `TaskProgressStatus` enum extension | 🟡 MEDIUM | Adding `IN_PROGRESS`/`BLOCKED` to Prisma enum requires migration. Existing PENDING/DONE/SKIPPED data is safe. |
| Name mismatch: `OnboardingTask` vs spec `OnboardingTemplateTask` | 🟢 LOW | Keep current name — it's fine and already seeded + referenced by 500+ lines. |
| Name mismatch: `OffboardingChecklist` vs spec `OffboardingTemplate` | 🟢 LOW | Keep current name — already seeded + referenced. |
| `checkinWeek` (Int) vs `milestone` (Enum) | 🟡 MEDIUM | Could add `milestone` column alongside without breaking existing. |
| No `AssetReturn` model | 🟡 MEDIUM | May be out of scope for E-1 — defer to separate task if not critical path. |
| Existing 4,244 LOC of UI code | 🟡 MEDIUM | Well-structured but **6/7 pages use pre-CRAFTUI colors** (Material palette). Functional logic is solid — keep logic, refresh visuals. |
| Existing 1,421 LOC of API code | 🟢 LOW | All follow apiSuccess/apiError, Zod, withPermission patterns. Keep and extend. |
| CRAFTUI visual inconsistency | 🔴 HIGH | Onboarding/Offboarding pages are visually inconsistent with GP#4 Performance pages. Must unify to CRAFTUI tokens for release cohesion. |
| Dual-implementation risk: `TaskStatus` (offboarding) vs `TaskProgressStatus` (onboarding) | 🟡 MEDIUM | Two different enums for task status. Consider unifying or keeping separated. Offboarding `TaskStatus` already has BLOCKED. |
| Crossboarding linked plans | 🟢 LOW | Already implemented via `linkedPlanId` + `planType`. Exceeds spec. |
| No test data for UI validation | 🟡 MEDIUM | Need seed for active onboarding/offboarding instances to test dashboard. |

---

## 11. Summary Scorecard

| Area | Total Required | Exists | Partial | Missing | Coverage |
|------|:-:|:-:|:-:|:-:|:-:|
| **Models** (Onboarding) | 6 | 4 | 2 | 0 | 83% |
| **Models** (Offboarding) | 6 | 4 | 1 | 1 | 75% |
| **Enums** | 7+ | 5 | 1 | 1 | 79% |
| **APIs** (Onboarding) | 13 | 7 | 1 | 5 | 58% |
| **APIs** (Offboarding) | 10 | 6 | 1 | 3 | 65% |
| **UI Pages** | 11 | 9 | 0 | 2 | 82% |
| **Event Handlers** | 2 | 2 | 0 | 0 | 100% |
| **Shared Infra** | 5 | 3 | 0 | 2 | 60% |
| **Seeds** | 6 | 2 | 0 | 4 | 33% |
| **Overall** | — | — | — | — | **~72%** |

> **Bottom Line**: GP#2 is ~72% implemented. Schema and UI are strong (75-83%). **Main gaps are in API layer (5-8 missing routes), task state machine (BLOCKED flow), sign-off workflow, and seed data.** Estimated E-1 effort: 1 session for schema + APIs, 1 session for UI extension + seeds.
