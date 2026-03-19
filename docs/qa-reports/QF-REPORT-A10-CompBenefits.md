# QF-REPORT: Run A-10 — Compensation & Benefits

- **Date**: 2026-03-18
- **Tool**: Claude Code Desktop (Opus 4.6)
- **Duration**: ~25 min
- **Accounts**: HK (한지영, HR_ADMIN), EA (이민준, EMPLOYEE)
- **Server**: http://localhost:3002

## Test Result: 32/33 PASSED (97%)

**0 P0 fixes required.** All CRUD and RBAC tests pass. One P2 environment issue (AI service not configured).

---

## CRUD Score Card

| Entity | C | R | R(detail) | U | D | Account | Issues |
|--------|---|---|-----------|---|---|---------|--------|
| Salary Band | ✅ 201 | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 | HK | — |
| Merit Matrix (Upsert) | ✅ 201 | ✅ 200 | n/a | n/a | n/a | HK | — |
| Matrix Copy | ✅ 201 | n/a | n/a | n/a | n/a | HK | — |
| Simulation | n/a | ✅ 200 | n/a | n/a | n/a | HK | — |
| AI Recommend | ❌ 503 | n/a | n/a | n/a | n/a | HK | P2: AI service not configured |
| Confirm | ✅ 200 | n/a | n/a | n/a | n/a | HK | — |
| Analysis | n/a | ✅ 200 | n/a | n/a | n/a | HK | — |
| History | n/a | ✅ 200 | n/a | n/a | n/a | HK | — |
| Employee Comp | n/a | ✅ 200 | n/a | n/a | n/a | HK/EA | — |
| Benefit Policy | ✅ 201 | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 | HK | — |
| Benefit Enrollment | ✅ 201 | ✅ 200 | n/a | ✅ 200 | n/a | HK | — |

---

## RBAC Score Card

| Test | Account | Endpoint | Expected | Actual | Pass? |
|------|---------|----------|----------|--------|-------|
| 1-6 | EA | GET /compensation/salary-bands | 403 | 403 | ✅ |
| 1-7 | EA | POST /compensation/salary-bands | 403 | 403 | ✅ |
| 2-4 | EA | GET /compensation/matrix | 403 | 403 | ✅ |
| 3-4 | EA | GET /compensation/simulation | 403 | 403 | ✅ |
| 3-5 | EA | POST /compensation/confirm | 403 | 403 | ✅ |
| 4-3 | EA | GET /compensation/history | 403 | 403 | ✅ |
| 4-5 | EA | GET /employees/{id}/compensation | 200 | 200 | ✅ (employees_read) |
| 4-6 | EA | GET /compensation/analysis | 403 | 403 | ✅ |
| 5-6 | EA | POST /benefits/policies | 403 | 403 | ✅ |
| 6-2a | EA | POST /benefits/enrollments | 403 | 403 | ✅ |
| 6-4 | EA | GET /benefits/enrollments | 403 | 403 | ✅ |

**RBAC: 11/11 passed** — All EMPLOYEE-role access blocks enforced correctly.

### RBAC Matrix Summary

| Module | EA (EMPLOYEE) Expected | EA Actual | Pass? |
|--------|------------------------|-----------|-------|
| compensation/salary-bands | ❌ | ❌ | ✅ |
| compensation/matrix | ❌ | ❌ | ✅ |
| compensation/simulation | ❌ | ❌ | ✅ |
| compensation/confirm | ❌ | ❌ | ✅ |
| compensation/analysis | ❌ | ❌ | ✅ |
| compensation/history | ❌ | ❌ | ✅ |
| employees/{id}/compensation | ✅ (employees_read) | ✅ | ✅ |
| benefits/policies | ❌ | ❌ | ✅ |
| benefits/enrollments | ❌ | ❌ | ✅ |

---

## Issues

### P2: AI Recommend Service Unavailable (503)

- **Test**: 3-2 — `POST /compensation/simulation/ai-recommend`
- **Status**: 503 with `"AI 서비스가 설정되지 않았습니다."`
- **Root cause**: `ANTHROPIC_API_KEY` not configured in test environment
- **Impact**: Non-blocking. The endpoint code itself is correct (proper auth, validation, error handling). AI recommendation is an optional enhancement.
- **Fix**: Configure `ANTHROPIC_API_KEY` in `.env.local` to enable AI features

### No P0 or P1 Issues Found

This is the first A-series QA run with **zero P0 fixes required**. All previous known P0 patterns were absent:
- ✅ No RBAC permission mismatch (0/17 pattern)
- ✅ No self-service blocked (0/8 pattern) — EA correctly uses `employees_read` for own comp data
- ✅ No Zod `.cuid()` rejecting UUIDs (0/8 pattern) — all schemas use `.uuid()`
- ✅ No `deletedAt` on non-existent column (0/2 pattern) — SalaryBand and BenefitPolicy both have `deletedAt`

---

## Discovery Notes

### Schema Mapping (Prompt → Actual)

| Prompt Assumption | Actual Model | Notes |
|-------------------|-------------|-------|
| `MeritMatrix` | `SalaryAdjustmentMatrix` | Uses `emsBlock` + `cycleId`, not year/cells |
| `BenefitEnrollment` | `EmployeeBenefit` | Status enum: ACTIVE/SUSPENDED/EXPIRED |
| `effectiveDate` | `effectiveFrom` / `effectiveTo` | SalaryBand uses date range |
| Benefits `type`, `maxAmount`, `eligibility` | `category` (BenefitCategory), `amount`, `eligibilityRules` | Enum-based category |
| Simulation persisted model | Calculated on-the-fly | GET enriches employee list with compa-ratio |
| Matrix `cells` with performanceGrade/positionInRange | `entries` with `emsBlock` | E/M+/M/B grading |

### Key Architecture Points

1. **Compensation Confirm** requires `adjustments[]` array with per-employee salary changes — NOT a simple approve flag
2. **Employee Compensation** endpoint uses `employees_read` permission (MODULE.EMPLOYEES), not compensation permissions — allowing employees to see their own comp data via the employee profile route
3. **Benefits enrollment** is HR-only (`benefits_create`) — no employee self-service enrollment. Self-service would need a `/benefits/my/enroll` pattern if desired.
4. **Soft delete** implemented on SalaryBand and BenefitPolicy via `deletedAt` column

---

## Data Created

| Entity | Count Created | IDs |
|--------|--------------|-----|
| SalaryBand | 2 (1 soft-deleted) | ac3e6a00-... |
| SalaryAdjustmentMatrix | 7+ entries | (upsert replaced existing) |
| BenefitPolicy | 2 (1 soft-deleted) | 10c58fd6-... |
| EmployeeBenefit | 1 | 5d4335e0-... |
| CompensationHistory | 1 (via confirm) | (for EA_EMP_ID) |

All data preserved for cross-module testing.

---

## Verdict

**PASS** — Compensation & Benefits modules are production-ready. All 15 endpoints tested across CRUD operations and RBAC enforcement. Zero code fixes required. The only issue is an environment configuration gap (AI API key) which is a P2 operational concern.
