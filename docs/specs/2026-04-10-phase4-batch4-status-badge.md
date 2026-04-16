# Phase 4 Batch 4 — Status Badge Unification

**Date**: 2026-04-10
**Branch**: staging
**Scope**: Full sweep (~140 files)
**Risk**: Medium (visual-only, no business logic)

---

## Context

Status badges across the codebase use 3 separate systems with inconsistent colors:
1. `badge.tsx` — CVA-based, 8 variants (outdated colors)
2. `StatusBadge.tsx` — manual span wrapper, 6 variants (different colors)
3. `status.ts` — hex className strings, 6 variants (pre-Violet palette)

Additionally, ~32 files define local `STATUS_COLORS` maps and ~100 files use hardcoded Tailwind color classes. Phase 4 spec (section 1.12) requires 6 semantic categories with Violet palette alignment.

---

## Design: 2-Layer Architecture

### Layer 1 — `badge.tsx` (Visual)

CVA badge component. Renders the pill shape with semantic color variants.

**Changes:**
- Add `whitespace-nowrap` to CVA base
- Change `font-bold` (700) → `font-semibold` (600)
- Keep `text-[10px]` (badge-specific, DESIGN.md 2xs와 별도)
- Rename `danger` → `error` (DESIGN.md terminology)
- Add `accent` variant
- Update `success`, `warning`, `error`, `info` colors to Violet palette
- Keep non-status variants: `default`, `secondary`, `destructive`, `outline`

**Variant colors (Phase 4 palette):**

Badge FG는 WCAG AA 4.5:1 대비비 충족을 위해 BG/차트용 색상보다 약간 진한 값 사용.

| Variant | Badge FG | BG (10%) | Chart/BG FG | Contrast | Purpose |
|---------|----------|----------|-------------|----------|---------|
| success | **#15803d** | #16a34a/10% | #16a34a | 5.02:1 PASS | Approved, complete, active, paid |
| warning | #b45309 | #b45309/10% | #b45309 | 5.02:1 PASS | Pending, review, probation |
| error | #e11d48 | #e11d48/10% | #e11d48 | 4.70:1 PASS | Rejected, terminated, failed |
| info | **#4f46e5** | #6366f1/10% | #6366f1 | 6.29:1 PASS | In progress, interview, screening |
| neutral | #64748b | #f1f5f9 | #64748b | 4.76:1 PASS | Draft, cancelled, inactive |
| accent | #7c3aed | #7c3aed/10% | #7c3aed | 5.70:1 PASS | Offer, LOA, business trip, retirement |

### Layer 2 — `StatusBadge.tsx` (Semantic)

Accepts a raw status string and auto-maps to the correct Badge variant.

**Props:**
```typescript
interface StatusBadgeProps {
  status: string                    // DB enum value (e.g. "APPROVED")
  variant?: StatusCategory          // Optional override for collision cases
  children?: React.ReactNode        // Optional label override (default: status string)
  className?: string
}
```

**Usage:**
```tsx
<StatusBadge status="APPROVED" />                        // → success
<StatusBadge status="ACTIVE" />                          // → success (default)
<StatusBadge status="ACTIVE" variant="accent" />         // LOA context override
<StatusBadge status="PENDING">{t('pending')}</StatusBadge>  // i18n label
```

Internally wraps `<Badge variant={resolvedVariant}>`.

### `status.ts` — SSOT

**Deprecate (not delete):** `STATUS_VARIANT` — 색상을 새 palette로 업데이트하되 export 유지. 140파일 마이그레이션 완료 후 `rg STATUS_VARIANT` 결과가 0이면 다음 배치에서 삭제.
**Keep:** `STATUS_FG` / `STATUS_BG` — updated to new palette, used by charts/inline text
**Add:** `STATUS_MAP` — comprehensive status string → category mapping (case-insensitive resolve)
**Add:** `StatusCategory` type
**Add:** `resolveStatusCategory(status: string): StatusCategory` — STATUS_MAP lookup + lowercase fallback + neutral default

---

## STATUS_MAP — Complete Domain Mapping

### Employee & Core HR
| Status | Category | Notes |
|--------|----------|-------|
| ACTIVE | success | Default meaning (재직) |
| PROBATION | warning | — |
| ON_LEAVE | accent | — |
| RESIGNED | error | — |
| TERMINATED | error | — |
| INACTIVE | neutral | — |

### Leave
| Status | Category |
|--------|----------|
| PENDING | warning |
| APPROVED | success |
| REJECTED | error |
| CANCELLED | neutral |

### Leave of Absence (LOA)
| Status | Category | Notes |
|--------|----------|-------|
| REQUESTED | warning | — |
| APPROVED | success | LOA approved but not yet started |
| ACTIVE | — | **Collision**: global map = success; LOA pages override `variant="accent"` |
| RETURN_REQUESTED | info | — |
| COMPLETED | success | — |
| REJECTED | error | — |

### Attendance
| Status | Category | Notes |
|--------|----------|-------|
| NORMAL | success | — |
| LATE | error | — |
| EARLY_OUT | warning | — |
| ABSENT | error | — |
| ON_LEAVE | — | **Collision**: global map = accent; Attendance pages override `variant="info"` |
| HOLIDAY | info | — |

### Shift Schedule
| Status | Category |
|--------|----------|
| SCHEDULED | info |
| WORKED | success |
| SWAPPED | warning |
| SCR_PENDING | warning |
| SCR_APPROVED | success |
| SCR_REJECTED | error |

### Payroll (9-state pipeline)
| Status | Category |
|--------|----------|
| DRAFT | neutral |
| ATTENDANCE_CLOSED | info |
| CALCULATING | info |
| ADJUSTMENT | info |
| REVIEW | warning |
| PENDING_APPROVAL | warning |
| APPROVED | success |
| PAID | success |
| PUBLISHED | success |
| CANCELLED | neutral |

### Payroll Approval
| Status | Category |
|--------|----------|
| IN_PROGRESS | info |

### Bank Transfer
| Status | Category |
|--------|----------|
| GENERATING | info |
| GENERATED | success |
| SUBMITTED | info |
| PARTIALLY_COMPLETED | warning |
| SUCCESS | success |
| FAILED | error |

### Recruitment — Posting
| Status | Category |
|--------|----------|
| OPEN | info |
| CLOSED | neutral |
| FILLED | success |

### Recruitment — Interview
| Status | Category |
|--------|----------|
| NO_SHOW | error |

### Recruitment — Pipeline
| Status | Category |
|--------|----------|
| APPLIED | info |
| SCREENING | info |
| OFFER | accent |
| OFFER_ACCEPTED | success |
| HIRED | success |
| OFFER_DECLINED | error |

### Probation
| Status | Category |
|--------|----------|
| PASSED | success |
| WAIVED | neutral |

### Performance — Cycle (9-state)
| Status | Category |
|--------|----------|
| EVAL_OPEN | info |
| CHECK_IN | info |
| CALIBRATION | warning |
| FINALIZED | success |
| COMP_REVIEW | warning |
| COMP_COMPLETED | success |

### Performance — Review (7-state)
| Status | Category |
|--------|----------|
| NOT_STARTED | neutral |
| GOAL_SETTING | info |
| SELF_EVAL | info |
| PEER_EVAL | info |
| MANAGER_EVAL | info |
| CALIBRATED | warning |
| NOTIFIED | success |
| ACKNOWLEDGED | success |

### Performance — Goal
| Status | Category |
|--------|----------|
| ON_TRACK | success |
| AT_RISK | warning |
| BEHIND | error |

### Performance — Eval
| Status | Category |
|--------|----------|
| SUBMITTED | success |
| CONFIRMED | success |

### Performance — Quarterly Review
| Status | Category |
|--------|----------|
| EMPLOYEE_DONE | warning |
| MANAGER_DONE | warning |

### Performance — One-on-One
| Status | Category |
|--------|----------|
| SCHEDULED | info |

### Performance — Calibration
| Status | Category |
|--------|----------|
| CALIBRATION_DRAFT | neutral |
| CALIBRATION_IN_PROGRESS | info |
| CALIBRATION_COMPLETED | success |

### Off-Cycle Compensation
(Covered by common statuses: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, CANCELLED)

### Onboarding
| Status | Category |
|--------|----------|
| NOT_STARTED | neutral |
| SUSPENDED | warning |
| ARCHIVED | neutral |

### Offboarding
(Covered by common: IN_PROGRESS, COMPLETED, CANCELLED)

### Resignation Types (used as badges)
| Status | Category |
|--------|----------|
| VOLUNTARY | neutral |
| INVOLUNTARY | error |
| RETIREMENT | accent |
| CONTRACT_END | neutral |
| MUTUAL_AGREEMENT | neutral |

### Discipline
| Status | Category |
|--------|----------|
| DISCIPLINE_ACTIVE | error |
| DISCIPLINE_EXPIRED | neutral |
| DISCIPLINE_OVERTURNED | success |

### Appeal
| Status | Category |
|--------|----------|
| NONE | neutral |
| FILED | warning |
| UNDER_REVIEW | warning |
| UPHELD | error |
| OVERTURNED | success |

### Compliance — Certificate
| Status | Category |
|--------|----------|
| REQUESTED | warning |
| ISSUED | success |

### Compliance — KEDO
| Status | Category |
|--------|----------|
| PENDING_SIGNATURE | warning |
| SIGNED | success |
| EXPIRED | neutral |

### Compliance — Work Permit
| Status | Category |
|--------|----------|
| PENDING_RENEWAL | warning |
| REVOKED | error |

### Compliance — DPIA
| Status | Category |
|--------|----------|
| DPIA_DRAFT | neutral |
| IN_REVIEW | warning |

### Compliance — GDPR
| Status | Category |
|--------|----------|
| GDPR_PENDING | warning |

### Benefits
| Status | Category |
|--------|----------|
| SUSPENDED | warning |

### Asset Return
| Status | Category |
|--------|----------|
| RETURNED | success |
| UNRETURNED | error |
| DEDUCTED | warning |
| CIVIL_CLAIM | error |

### Entity Transfer
| Status | Category |
|--------|----------|
| TRANSFER_REQUESTED | warning |
| FROM_APPROVED | info |
| TO_APPROVED | info |
| EXEC_APPROVED | info |
| TRANSFER_PROCESSING | info |
| TRANSFER_COMPLETED | success |
| TRANSFER_CANCELLED | error |
| DATA_PENDING | warning |
| DATA_MIGRATED | success |
| DATA_FAILED | error |

### Task
| Status | Category |
|--------|----------|
| DONE | success |
| SKIPPED | neutral |
| BLOCKED | error |

### Migration Job
| Status | Category |
|--------|----------|
| VALIDATING | info |
| VALIDATED | success |
| RUNNING | info |
| ROLLED_BACK | error |

### Severance Interim
| Status | Category |
|--------|----------|
| SIP_PENDING | warning |
| SIP_APPROVED | success |
| SIP_REJECTED | error |
| SIP_PAID | success |

### System
| Status | Category |
|--------|----------|
| M365_PENDING | warning |
| M365_SUCCESS | success |
| M365_FAILED | error |
| OPEN | warning |
| RESOLVED | success |
| WHITELISTED | neutral |

### Delegation
| Status | Category |
|--------|----------|
| EXPIRED | neutral |

### AI Report
| Status | Category |
|--------|----------|
| GENERATING | info |
| GENERATED | success |

### Codex Review 추가분 (누락 status)
| Status | Category | Domain |
|--------|----------|--------|
| ENROLLED | info | Training Enrollment |
| ENROLLMENT_COMPLETED | success | Training Enrollment |
| DROPPED | error | Training Enrollment |
| CHANGE_PENDING | warning | Change Request |
| CHANGE_APPROVED | success | Change Request |
| CHANGE_REJECTED | error | Change Request |
| PLAN_DRAFT | neutral | Succession Plan |
| PLAN_ACTIVE | info | Succession Plan |
| INTERVIEW_1 / INTERVIEW_2 / FINAL | info | Recruitment Pipeline |
| SENT | success | Compensation Letter |
| CLOSED | neutral | Performance Cycle |
| REVOKED | error | Work Permit, GDPR, Delegation |

### UI-only status (non-Prisma, lowercase)
| Status | Category | Source |
|--------|----------|--------|
| not_started | neutral | YearEndHRClient |
| in_progress (lowercase) | info | YearEndHRClient |
| hr_review | warning | YearEndHRClient |
| submitted (lowercase) | success | YearEndHRClient |
| completed (lowercase) | success | YearEndHRClient |
| active (lowercase) | success | GDPR tabs |
| revoked (lowercase) | error | GDPR tabs |
| pending (lowercase) | warning | GDPR tabs |
| draft (lowercase) | neutral | DPIA tab |
| in_review (lowercase) | warning | DPIA tab |

`resolveStatusCategory()` 는 `status.toUpperCase()` 후 STATUS_MAP 조회로 lowercase 처리.

### Common (shared across multiple domains)
| Status | Category | Domains |
|--------|----------|---------|
| DRAFT | neutral | Payroll, Performance, Posting, KEDO, Off-Cycle, etc. |
| PENDING | warning | Leave, Approval, Task, etc. |
| PENDING_APPROVAL | warning | Payroll, Goal, Off-Cycle |
| APPROVED | success | Leave, LOA, Payroll, Goal, DPIA, etc. |
| REJECTED | error | Leave, LOA, Goal, KEDO, etc. |
| CANCELLED | neutral | Leave, LOA, Payroll, Posting, Off-Cycle, etc. |
| IN_PROGRESS | info | Onboarding, Offboarding, Payroll Approval, GDPR, etc. |
| COMPLETED | success | LOA, Offboarding, Onboarding, GDPR, etc. |
| ACTIVE | success | Employee, Benefit, Delegation, GDPR Consent |
| FAILED | error | Bank Transfer, Migration, Probation, AI Report |
| EXPIRED | neutral | KEDO, Work Permit, Benefit, GDPR Consent, Delegation |
| SCHEDULED | info | Shift, Interview, One-on-One |
| ABSENT | error | Attendance, Shift |

### Collision Resolution

Three status strings have different meanings per domain:

**`ACTIVE`**
- Employee/Benefit/Delegation → **success** (default in STATUS_MAP)
- LOA "active leave" → `<StatusBadge status="ACTIVE" variant="accent" />`
- Discipline → prefixed `DISCIPLINE_ACTIVE` (no collision)

**`ON_LEAVE`**
- Employee status (overall) → **accent** (default in STATUS_MAP, 휴직 중)
- Attendance (daily) → `<StatusBadge status="ON_LEAVE" variant="info" />`

**`OPEN`**
- Posting (recruitment) → **info** (default in STATUS_MAP)
- Anomaly → `<StatusBadge status="OPEN" variant="warning" />`

All prefixed enums (SIP_, SCR_, M365_, DISCIPLINE_, etc.) are naturally unique.

---

## Files to Modify

### Tier 1 — Core Components (3 files)
1. `src/lib/styles/status.ts` — palette update + STATUS_MAP + resolveStatusCategory() + STATUS_VARIANT deprecated (색상만 업데이트, export 유지)
2. `src/components/ui/badge.tsx` — CVA update + whitespace-nowrap + accent + danger→error
3. `src/components/ui/StatusBadge.tsx` — rewrite: status prop(신규) + variant prop(기존 호환) 동시 지원

### Tier 2 — Domain Badge Deletion (3 files)
4. `src/components/compensation/OffCycleStatusBadge.tsx` → delete, replace imports
5. `src/components/performance/quarterly-review/ReviewStatusBadge.tsx` → delete, replace imports
6. `src/components/payroll/PayrollStatusBadge.tsx` → delete, replace imports

### Tier 3 — Local STATUS_COLORS Map Removal (~32 files)
Remove local maps, replace with `<StatusBadge status={} />`:
- AttendanceClient.tsx, AttendanceAdminClient.tsx, AttendanceTeamClient.tsx
- LoaClient.tsx
- EmployeeListClient.tsx, EmployeeDetailClient.tsx
- WorkPermitsClient.tsx
- OffboardingDashboardClient.tsx, OffboardingDetailClient.tsx
- RecruitmentListClient.tsx, PostingDetailClient.tsx, InterviewListClient.tsx
- CyclesClient.tsx, MyGoalsClient.tsx, MyPeerReviewClient.tsx
- ManagerEvalClient.tsx, PeerReviewClient.tsx
- DisciplineListClient.tsx, DisciplineDetailClient.tsx
- OnboardingDashboardClient.tsx
- LeaveTeamClient.tsx
- YearEndHRClient.tsx, CloseAttendanceClient.tsx
- EnrollmentsTab.tsx (training)
- KedoDocumentsTab.tsx
- LetterTab.tsx, OffCycleApprovalTimeline.tsx
- PlansTab.tsx (succession)
- BenefitEnrollmentsTab.tsx
- LoaTab.tsx
- ShiftCalendarClient.tsx
- BankTransfersClient.tsx

### Tier 4 — Inline Hardcoded Colors (~100 files)
Replace hardcoded Tailwind badge classes with Badge/StatusBadge:
- Settings pages (50+ files): amber-500/10 company-exclusive badges
- Training enrollment badges
- Delegation status badges
- Task/D-day badges
- Indicator dots (minor, not all need conversion)
- Requisition status labels

### Tier 5 — Border Radius Fix (3 files)
- AttendanceClient.tsx, AttendanceAdminClient.tsx, AttendanceTeamClient.tsx
- `rounded-[4px]` → `rounded-full` (pill shape)

---

## Verification

1. `npx tsc --noEmit` — type check
2. `npm run lint` — lint
3. `/opt/homebrew/bin/codex review --uncommitted` — Codex Gate 2
4. Spot check: login as super@ctr.co.kr, navigate through Employee list, Leave, Payroll, Recruitment, Performance, Settings — verify badge colors match 6-category spec
5. Spot check: login as employee-a@ctr.co.kr — verify My pages badges

---

## Risks

| Risk | Mitigation |
|------|------------|
| 140-file diff breaks something | tsc + lint + Codex review |
| Badge color regression in charts | STATUS_FG/STATUS_BG kept separate from CVA |
| i18n label mismatch | StatusBadge children prop for translated labels |
| ACTIVE collision | variant override prop |
| Settings amber badges are not status badges | Use `<Badge variant="warning">` directly, not StatusBadge |

---

## Out of Scope
- Dark mode (separate phase)
- Dot indicator variant for compact density (future enhancement)
- Mobile bottom tab bar (Batch 9)
