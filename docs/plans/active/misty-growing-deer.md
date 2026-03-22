# A2-2: Position/Job Data Models — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add Job, Position, CompanyProcessSetting Prisma models; seed CTR-KR-centric org data (9 departments, ~60 positions); update current_employee_view; add helper functions.

**Architecture:** Self-referential Position tree (solid-line `reportsToPositionId` + dotted-line `dottedLinePositionId`); Job as a named function (global or company-scoped); CompanyProcessSetting as global-default + company-override with JSONB values.

**Tech Stack:** Prisma v7 (PrismaPg adapter), Next.js 15 App Router, PostgreSQL/Supabase
- Custom import: `@/generated/prisma/client` (not `@prisma/client`)
- Prisma client import: follow pattern in `src/lib/assignments.ts`

---

## Task 1: Prisma Schema — Add Job, Position, CompanyProcessSetting Models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add `Job` model** (after the existing `JobCategory` model block)

```prisma
model Job {
  id         String     @id @default(cuid())
  code       String     @unique
  titleKo    String     @map("title_ko")
  titleEn    String     @map("title_en")
  companyId  String?    @map("company_id")
  company    Company?   @relation(fields: [companyId], references: [id])
  positions  Position[]
  createdAt  DateTime   @default(now()) @map("created_at")
  updatedAt  DateTime   @updatedAt @map("updated_at")

  @@map("jobs")
  @@index([companyId])
}
```

**Step 2: Add `Position` model** (after Job)

```prisma
model Position {
  id                   String       @id @default(cuid())
  code                 String       @unique
  titleKo              String       @map("title_ko")
  titleEn              String       @map("title_en")
  companyId            String       @map("company_id")
  company              Company      @relation(fields: [companyId], references: [id])
  departmentId         String?      @map("department_id")
  department           Department?  @relation(fields: [departmentId], references: [id])
  jobId                String?      @map("job_id")
  job                  Job?         @relation(fields: [jobId], references: [id])
  jobGradeId           String?      @map("job_grade_id")
  jobGrade             JobGrade?    @relation(fields: [jobGradeId], references: [id])
  reportsToPositionId  String?      @map("reports_to_position_id")
  reportsTo            Position?    @relation("SolidLine", fields: [reportsToPositionId], references: [id])
  directReports        Position[]   @relation("SolidLine")
  dottedLinePositionId String?      @map("dotted_line_position_id")
  dottedLineTo         Position?    @relation("DottedLine", fields: [dottedLinePositionId], references: [id])
  dottedLineReports    Position[]   @relation("DottedLine")
  isHeadcount          Boolean      @default(true) @map("is_headcount")
  isActive             Boolean      @default(true) @map("is_active")
  assignments          EmployeeAssignment[]
  createdAt            DateTime     @default(now()) @map("created_at")
  updatedAt            DateTime     @updatedAt @map("updated_at")

  @@map("positions")
  @@index([companyId])
  @@index([departmentId])
  @@index([reportsToPositionId])
}
```

**Step 3: Add `CompanyProcessSetting` model** (after Position)

```prisma
model CompanyProcessSetting {
  id           String   @id @default(cuid())
  companyId    String?  @map("company_id")
  company      Company? @relation(fields: [companyId], references: [id])
  settingType  String   @map("setting_type")
  settingKey   String   @map("setting_key")
  settingValue Json     @map("setting_value")
  description  String?
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@unique([companyId, settingType, settingKey])
  @@map("company_process_settings")
  @@index([companyId])
  @@index([settingType])
}
```

**Step 4: Update `EmployeeAssignment`** — find the existing `positionId String?` line and update it to wire the FK relation:

```prisma
positionId   String?   @map("position_id")
position     Position? @relation(fields: [positionId], references: [id])
```

**Step 5: Add back-relations on existing models**

In `Company` model, add:
```prisma
jobs            Job[]
positions       Position[]
processSettings CompanyProcessSetting[]
```

In `Department` model, add:
```prisma
positions       Position[]
```

In `JobGrade` model, add:
```prisma
positions       Position[]
```

**Step 6: Run `prisma validate`**
```bash
cd /Users/sangwoo/Vibe.nosync/03. HR_Hub/ctr-hr-hub
npx prisma validate
```
Expected: "The schema at ... is valid 🚀"

**Step 7: Run `prisma generate`**
```bash
npx prisma generate
```
Expected: generates client with new models

**Step 8: Commit**
```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add Job, Position, CompanyProcessSetting models"
```

---

## Task 2: Migration — Create Tables, Wire FK, Drop Legacy Backup Table

**Files:**
- Auto-generated under `prisma/migrations/`

**Step 1: Run migration**
```bash
npx prisma migrate dev --name add_positions_jobs_process_settings
```
Expected: creates and applies migration. SQL should include:
- `CREATE TABLE "jobs" ...`
- `CREATE TABLE "positions" ...`
- `CREATE TABLE "company_process_settings" ...`
- `ALTER TABLE "employee_assignments" ADD CONSTRAINT ... FOREIGN KEY ("position_id") REFERENCES "positions"("id")`

**Step 2: Remove `EmployeeManagerBackup` model from schema** (0 records in DB — safe to drop)

- Delete the entire `model EmployeeManagerBackup { ... }` block from `prisma/schema.prisma`
- Find and remove `managerBackups EmployeeManagerBackup[]` from the `Employee` model
- Also remove `getManagerBackup` function from `src/lib/assignments.ts` (and its export)
- Search for any other references: `grep -r "EmployeeManagerBackup\|managerBackup\|manager_backup" src/ --include="*.ts" -l` — fix or remove all

**Step 3: Run second migration**
```bash
npx prisma migrate dev --name drop_employee_manager_backup
```
Expected: generates `DROP TABLE "employee_manager_backups"` SQL

**Step 4: Commit**
```bash
git add prisma/schema.prisma prisma/migrations/ src/lib/assignments.ts
git commit -m "feat(migration): add positions/jobs tables, drop legacy employee_manager_backups"
```

---

## Task 3: Seed Data — Departments, Jobs, Positions, CompanyProcessSettings

**Files:**
- Modify: `prisma/seed.ts`

Use the existing `genId(key: string)` deterministic UUID helper already in seed.ts. Look up company IDs from the existing `companies` array using `code` field (e.g., `CTR-KR`, `CTR-HQ`).

**Step 1: Add 5 new CTR-KR departments** (after existing 4: MGMT, HR, DEV, SALES)

```typescript
// New CTR-KR departments — add to existing departments upsert block
const newKrDepts = [
  { id: genId('dept-kr-mfg'),  name: '생산/제조팀', code: 'MFG',   companyCode: 'CTR-KR' },
  { id: genId('dept-kr-qa'),   name: '품질관리팀',  code: 'QA',    companyCode: 'CTR-KR' },
  { id: genId('dept-kr-fin'),  name: '재무/회계팀', code: 'FIN',   companyCode: 'CTR-KR' },
  { id: genId('dept-kr-pur'),  name: '구매/조달팀', code: 'PUR',   companyCode: 'CTR-KR' },
  { id: genId('dept-kr-rd'),   name: '연구개발팀',  code: 'RANDD', companyCode: 'CTR-KR' },
]
```

**Step 2: Add departments for the other 12 companies** (1-2 each, since they currently have 0)

```typescript
const otherCompanyDepts = [
  // CTR-HQ
  { id: genId('dept-hq-mgmt'),  name: 'Corporate Management', code: 'MGMT', companyCode: 'CTR-HQ' },
  { id: genId('dept-hq-strat'), name: 'Strategy & Planning',  code: 'STRAT', companyCode: 'CTR-HQ' },
  // CTR-MOB
  { id: genId('dept-mob-eng'), name: 'Engineering',  code: 'ENG', companyCode: 'CTR-MOB' },
  { id: genId('dept-mob-mfg'), name: 'Production',   code: 'MFG', companyCode: 'CTR-MOB' },
  // CTR-ECO
  { id: genId('dept-eco-eng'), name: 'Engineering',  code: 'ENG', companyCode: 'CTR-ECO' },
  { id: genId('dept-eco-ops'), name: 'Operations',   code: 'OPS', companyCode: 'CTR-ECO' },
  // CTR-ROB
  { id: genId('dept-rob-eng'), name: 'Robotics Engineering', code: 'ENG', companyCode: 'CTR-ROB' },
  { id: genId('dept-rob-mfg'), name: 'Manufacturing',        code: 'MFG', companyCode: 'CTR-ROB' },
  // CTR-ENG
  { id: genId('dept-eng-eng'), name: 'Engineering', code: 'ENG', companyCode: 'CTR-ENG' },
  { id: genId('dept-eng-rd'),  name: 'R&D',         code: 'RD',  companyCode: 'CTR-ENG' },
  // FML
  { id: genId('dept-fml-ops'), name: 'Operations', code: 'OPS', companyCode: 'FML' },
  { id: genId('dept-fml-fin'), name: 'Finance',    code: 'FIN', companyCode: 'FML' },
  // CTR-US
  { id: genId('dept-us-ops'),   name: 'Operations', code: 'OPS',   companyCode: 'CTR-US' },
  { id: genId('dept-us-sales'), name: 'Sales',      code: 'SALES', companyCode: 'CTR-US' },
  // CTR-CN
  { id: genId('dept-cn-mfg'), name: 'Manufacturing',    code: 'MFG', companyCode: 'CTR-CN' },
  { id: genId('dept-cn-qa'),  name: 'Quality Assurance',code: 'QA',  companyCode: 'CTR-CN' },
  // CTR-RU
  { id: genId('dept-ru-mfg'), name: 'Manufacturing', code: 'MFG', companyCode: 'CTR-RU' },
  { id: genId('dept-ru-eng'), name: 'Engineering',   code: 'ENG', companyCode: 'CTR-RU' },
  // CTR-VN
  { id: genId('dept-vn-mfg'), name: 'Manufacturing', code: 'MFG', companyCode: 'CTR-VN' },
  { id: genId('dept-vn-asm'), name: 'Assembly',      code: 'ASM', companyCode: 'CTR-VN' },
  // CTR-EU
  { id: genId('dept-eu-eng'),   name: 'Engineering', code: 'ENG',   companyCode: 'CTR-EU' },
  { id: genId('dept-eu-sales'), name: 'Sales',       code: 'SALES', companyCode: 'CTR-EU' },
  // CTR-MX
  { id: genId('dept-mx-mfg'), name: 'Manufacturing', code: 'MFG', companyCode: 'CTR-MX' },
  { id: genId('dept-mx-asm'), name: 'Assembly',      code: 'ASM', companyCode: 'CTR-MX' },
]
```

Upsert all departments using `prisma.department.upsert({ where: { id }, create: {...}, update: {} })`.

**Step 3: Seed global Jobs (15 entries, companyId: null)**

```typescript
const globalJobs = [
  { id: genId('job-sw-eng'),    code: 'SW_ENG',    titleKo: '소프트웨어 엔지니어', titleEn: 'Software Engineer' },
  { id: genId('job-hr-mgr'),    code: 'HR_MGR',    titleKo: 'HR 매니저',           titleEn: 'HR Manager' },
  { id: genId('job-hr-spec'),   code: 'HR_SPEC',   titleKo: 'HR 담당',             titleEn: 'HR Specialist' },
  { id: genId('job-mfg-ops'),   code: 'MFG_OPS',   titleKo: '생산직',              titleEn: 'Manufacturing Operator' },
  { id: genId('job-mfg-sup'),   code: 'MFG_SUP',   titleKo: '생산감독',            titleEn: 'Manufacturing Supervisor' },
  { id: genId('job-qa-eng'),    code: 'QA_ENG',    titleKo: '품질 엔지니어',       titleEn: 'Quality Engineer' },
  { id: genId('job-fin-mgr'),   code: 'FIN_MGR',   titleKo: '재무 매니저',         titleEn: 'Finance Manager' },
  { id: genId('job-sales-mgr'), code: 'SALES_MGR', titleKo: '영업 매니저',         titleEn: 'Sales Manager' },
  { id: genId('job-rnd-eng'),   code: 'RND_ENG',   titleKo: '연구개발 엔지니어',   titleEn: 'R&D Engineer' },
  { id: genId('job-pur-spec'),  code: 'PUR_SPEC',  titleKo: '구매 전문가',         titleEn: 'Procurement Specialist' },
  { id: genId('job-plant-mgr'), code: 'PLANT_MGR', titleKo: '공장장',              titleEn: 'Plant Manager' },
  { id: genId('job-ops-mgr'),   code: 'OPS_MGR',   titleKo: '운영 매니저',         titleEn: 'Operations Manager' },
  { id: genId('job-it-eng'),    code: 'IT_ENG',    titleKo: 'IT 엔지니어',         titleEn: 'IT Engineer' },
  { id: genId('job-exec-asst'), code: 'EXEC_ASST', titleKo: '임원 보좌',           titleEn: 'Executive Assistant' },
  { id: genId('job-admin-mgr'), code: 'ADMIN_MGR', titleKo: '총무 매니저',         titleEn: 'Administrative Manager' },
]
```

Upsert with `prisma.job.upsert({ where: { id }, create: { ...job, companyId: null }, update: {} })`.

**Step 4: Seed CTR-KR Positions (~55 total across 9 departments)**

Each position needs: `id`, `code` (e.g., `CTR-KR-MGMT-001`), `titleKo`, `titleEn`, `companyId`, `departmentId`, `jobId`, `jobGradeId`. Wire `reportsToPositionId` after all positions exist (second pass).

Department breakdowns (position count in parentheses):
- **MGMT (6):** 대표이사(G1), 경영지원본부장(G2), 경영지원팀장(G3), 경영지원선임(G4), 경영지원담당(G5), 총무사원(G6)
- **HR (4):** 인사팀장(G3), 인사담당선임(G4), 인사담당(G5), 인사사원(G6)
- **DEV (7):** 개발팀장(G3), 수석개발자(G4)×2, 개발자(G5)×2, 개발사원(G6)×2
- **SALES (7):** 영업팀장(G3), 영업선임(G4)×2, 영업담당(G5)×2, 영업사원(G6)×2
- **MFG (10):** 생산팀장(G3), 생산감독(G4)×2, 생산반장(G5)×3, 생산사원(G6)×4
- **QA (7):** 품질팀장(G3), 품질감독(G4)×2, 품질담당(G5)×2, 품질사원(G6)×2
- **FIN (5):** 재무팀장(G3), 재무선임(G4), 재무담당(G5)×2, 재무사원(G6)
- **PUR (5):** 구매팀장(G3), 구매선임(G4), 구매담당(G5)×2, 구매사원(G6)
- **RANDD (8):** 연구소장(G2), 연구팀장(G3), 선임연구원(G4)×2, 연구원(G5)×2, 연구사원(G6)×2

After creating all positions, do a second pass to set `reportsToPositionId`:
- G6 → their dept's G5 position
- G5 → their dept's G4 position
- G4 → their dept's G3 (team lead) position
- All G3 team leads → 경영지원본부장(G2) or 연구소장(G2) as appropriate
- G2 → 대표이사(G1)

**Step 5: Seed positions for other 12 companies** (10-12 each, generic structure)

For each company, create: General Manager → Dept Head × 2 → Senior × 2 per dept → Staff × 3 per dept.
Use generic titles matching the company's departments from Step 2.

**Step 6: Seed global CompanyProcessSettings (companyId: null)**

```typescript
const globalSettings = [
  { type: 'evaluation', key: 'cycle',               value: { type: 'SEMI_ANNUAL', months: [1, 7] } },
  { type: 'evaluation', key: 'self_eval_weight',    value: { weight: 0.3 } },
  { type: 'attendance', key: 'overtime_threshold',  value: { hoursPerWeek: 40, alertAt: 36 } },
  { type: 'attendance', key: 'work_modes',          value: { allowed: ['OFFICE', 'REMOTE', 'HYBRID'] } },
  { type: 'leave',      key: 'annual_base_days',    value: { days: 15, accrual: 'MONTHLY' } },
  { type: 'leave',      key: 'carry_over_max',      value: { days: 10 } },
  { type: 'payroll',    key: 'pay_day',             value: { dayOfMonth: 25 } },
  { type: 'recruitment',key: 'approval_flow',       value: { steps: ['HR', 'DEPT_HEAD', 'EXEC'] } },
]
```

CTR-KR overrides (companyId: ctrKrId):
```typescript
const krOverrides = [
  // Korea 52-hour rule
  { type: 'attendance', key: 'overtime_threshold', value: { hoursPerWeek: 52, alertAt: 48, legalMax: 52 } },
  // Korea Labor Standards Act minimum
  { type: 'leave', key: 'annual_base_days', value: { days: 15, accrual: 'MONTHLY', lawMinimum: 15 } },
]
```

Use `prisma.companyProcessSetting.upsert` with composite unique `{ companyId_settingType_settingKey: { companyId, settingType: type, settingKey: key } }`.

**Step 7: Assign existing 4 CTR-KR employees to positions**

After positions are created, update their current `EmployeeAssignment.positionId`:
```typescript
// Example: find HR manager's current assignment, set positionId to 인사팀장 position
await prisma.employeeAssignment.updateMany({
  where: { employeeId: hrManagerId, isPrimary: true, endDate: null },
  data: { positionId: genId('pos-kr-hr-001') }, // 인사팀장
})
```

**Step 8: Run seed**
```bash
npx prisma db seed
```
Expected: exits without error. Check counts in Prisma Studio.

**Step 9: Commit**
```bash
git add prisma/seed.ts
git commit -m "feat(seed): departments, jobs, positions, process settings for all 13 companies"
```

---

## Task 4: Update `current_employee_view`

**Files:**
- First: `grep -r "current_employee_view" prisma/ src/ --include="*.sql" --include="*.ts" -l`
- Modify: whichever file defines the view (likely a migration SQL file or seed.ts raw SQL block)

**Step 1: Find the view definition**

Run the grep above. It will be one of:
- A raw `CREATE OR REPLACE VIEW` statement in `prisma/seed.ts`
- A `prisma/migrations/.../migration.sql` file

**Step 2: Add position + job columns to SELECT**

In the view's SELECT list, add:
```sql
p.title_ko                               AS position_title,
p.title_en                               AS position_title_en,
p.code                                   AS position_code,
j.title_ko                               AS job_title,
j.title_en                               AS job_title_en,
mgr_ea.employee_id                       AS manager_employee_id
```

**Step 3: Add JOINs** (after the existing EmployeeAssignment join)

```sql
LEFT JOIN positions p
  ON ea.position_id = p.id
LEFT JOIN jobs j
  ON p.job_id = j.id
LEFT JOIN positions mgr_pos
  ON p.reports_to_position_id = mgr_pos.id
LEFT JOIN employee_assignments mgr_ea
  ON mgr_pos.id = mgr_ea.position_id
 AND mgr_ea.is_primary = true
 AND mgr_ea.end_date IS NULL
```

**Step 4: Apply the updated view**

If the view is in seed.ts (as a raw SQL exec), re-run seed:
```bash
npx prisma db seed
```

If it's in a migration, create a new migration:
```bash
npx prisma migrate dev --name update_current_employee_view
```
Then manually edit the generated migration SQL to add `DROP VIEW IF EXISTS current_employee_view;` + the updated `CREATE OR REPLACE VIEW` statement.

**Step 5: Verify**
```bash
npx prisma db execute --stdin <<'SQL'
SELECT column_name FROM information_schema.columns
WHERE table_name = 'current_employee_view'
ORDER BY ordinal_position;
SQL
```
Expected: `position_title`, `job_title`, `manager_employee_id` appear in results.

**Step 6: Commit**
```bash
git add prisma/
git commit -m "feat(view): add position_title, job_title, manager_employee_id to current_employee_view"
```

---

## Task 5: Type Definitions

**Files:**
- Create: `src/types/position.ts`
- Create: `src/types/process-settings.ts`

**Step 1: Create `src/types/position.ts`**

```typescript
export type PositionWithRelations = {
  id: string
  code: string
  titleKo: string
  titleEn: string
  companyId: string
  departmentId: string | null
  jobId: string | null
  jobGradeId: string | null
  reportsToPositionId: string | null
  dottedLinePositionId: string | null
  isHeadcount: boolean
  isActive: boolean
  job?: { titleKo: string; titleEn: string } | null
  department?: { name: string } | null
  jobGrade?: { name: string; level: number } | null
  reportsTo?: { id: string; titleKo: string; titleEn: string } | null
  directReports?: PositionWithRelations[]
}

export type PositionTreeNode = PositionWithRelations & {
  children: PositionTreeNode[]
}
```

**Step 2: Create `src/types/process-settings.ts`**

```typescript
export type SettingType = 'evaluation' | 'attendance' | 'leave' | 'payroll' | 'recruitment'

export type EvaluationCycleSetting = { type: 'ANNUAL' | 'SEMI_ANNUAL'; months: number[] }
export type EvaluationWeightSetting = { weight: number }
export type OvertimeSetting = { hoursPerWeek: number; alertAt: number; legalMax?: number }
export type WorkModesSetting = { allowed: string[] }
export type AnnualDaysSetting = { days: number; accrual: 'MONTHLY' | 'UPFRONT'; lawMinimum?: number }
export type CarryOverSetting = { days: number }
export type PayDaySetting = { dayOfMonth: number }
export type ApprovalFlowSetting = { steps: string[] }

export type ProcessSettingValue =
  | EvaluationCycleSetting
  | EvaluationWeightSetting
  | OvertimeSetting
  | WorkModesSetting
  | AnnualDaysSetting
  | CarryOverSetting
  | PayDaySetting
  | ApprovalFlowSetting
  | Record<string, unknown>

export type CompanyProcessSettingRow = {
  id: string
  companyId: string | null
  settingType: SettingType
  settingKey: string
  settingValue: ProcessSettingValue
  description: string | null
}
```

**Step 3: Commit**
```bash
git add src/types/position.ts src/types/process-settings.ts
git commit -m "feat(types): Position and CompanyProcessSetting TypeScript types"
```

---

## Task 6: Helper Functions

**Files:**
- Modify: `src/lib/assignments.ts` (add 3 functions, remove `getManagerBackup`)
- Create: `src/lib/process-settings.ts`

**Step 1: Open `src/lib/assignments.ts`**

Check how Prisma client is imported (look for `getPrismaClient` or `prisma` constant at top of file). Use the exact same pattern.

**Step 2: Add `getManagerByPosition`** at end of file

```typescript
export async function getManagerByPosition(positionId: string): Promise<{
  managerId: string | null
  managerPositionId: string | null
  managerPositionTitle: string | null
} | null> {
  const prisma = getPrismaClient() // use existing pattern

  const position = await prisma.position.findUnique({
    where: { id: positionId },
    select: {
      reportsTo: {
        select: {
          id: true,
          titleKo: true,
          assignments: {
            where: { isPrimary: true, endDate: null },
            select: { employeeId: true },
            take: 1,
          },
        },
      },
    },
  })

  if (!position?.reportsTo) return null

  return {
    managerId: position.reportsTo.assignments[0]?.employeeId ?? null,
    managerPositionId: position.reportsTo.id,
    managerPositionTitle: position.reportsTo.titleKo,
  }
}
```

**Step 3: Add `getDirectReports`**

```typescript
export async function getDirectReports(
  positionId: string
): Promise<Array<{ positionId: string; titleKo: string; employeeId: string | null }>> {
  const prisma = getPrismaClient()

  const reports = await prisma.position.findMany({
    where: { reportsToPositionId: positionId, isActive: true },
    select: {
      id: true,
      titleKo: true,
      assignments: {
        where: { isPrimary: true, endDate: null },
        select: { employeeId: true },
        take: 1,
      },
    },
    orderBy: { titleKo: 'asc' },
  })

  return reports.map(r => ({
    positionId: r.id,
    titleKo: r.titleKo,
    employeeId: r.assignments[0]?.employeeId ?? null,
  }))
}
```

**Step 4: Add `getDottedLineManager`**

```typescript
export async function getDottedLineManager(positionId: string): Promise<{
  managerId: string | null
  positionTitle: string
} | null> {
  const prisma = getPrismaClient()

  const position = await prisma.position.findUnique({
    where: { id: positionId },
    select: {
      dottedLineTo: {
        select: {
          titleKo: true,
          assignments: {
            where: { isPrimary: true, endDate: null },
            select: { employeeId: true },
            take: 1,
          },
        },
      },
    },
  })

  if (!position?.dottedLineTo) return null

  return {
    managerId: position.dottedLineTo.assignments[0]?.employeeId ?? null,
    positionTitle: position.dottedLineTo.titleKo,
  }
}
```

**Step 5: Create `src/lib/process-settings.ts`**

```typescript
// Use same Prisma import pattern as assignments.ts
import type { SettingType, ProcessSettingValue } from '@/types/process-settings'

// Returns company override if it exists, else global default, else null
export async function getProcessSetting(
  companyId: string,
  settingType: SettingType,
  settingKey: string
): Promise<ProcessSettingValue | null> {
  const prisma = getPrismaClient()

  const [companyOverride, globalDefault] = await Promise.all([
    prisma.companyProcessSetting.findFirst({
      where: { companyId, settingType, settingKey },
    }),
    prisma.companyProcessSetting.findFirst({
      where: { companyId: null, settingType, settingKey },
    }),
  ])

  const row = companyOverride ?? globalDefault
  return row ? (row.settingValue as ProcessSettingValue) : null
}

// Get all settings for a type merged: global defaults, then company overrides on top
export async function getAllSettingsForType(
  companyId: string,
  settingType: SettingType
): Promise<Record<string, ProcessSettingValue>> {
  const prisma = getPrismaClient()

  const rows = await prisma.companyProcessSetting.findMany({
    where: {
      settingType,
      OR: [{ companyId }, { companyId: null }],
    },
  })

  const merged: Record<string, ProcessSettingValue> = {}

  // Apply globals first, then company-specific overrides on top
  for (const row of rows.filter(r => r.companyId === null)) {
    merged[row.settingKey] = row.settingValue as ProcessSettingValue
  }
  for (const row of rows.filter(r => r.companyId !== null)) {
    merged[row.settingKey] = row.settingValue as ProcessSettingValue
  }

  return merged
}
```

**Step 6: Run TypeScript check**
```bash
npx tsc --noEmit 2>&1 | grep -E "process-settings|assignments|position" | head -20
```
Expected: no new errors in these files (baseline is 418 existing errors elsewhere)

**Step 7: Commit**
```bash
git add src/lib/assignments.ts src/lib/process-settings.ts
git commit -m "feat(lib): getManagerByPosition, getDirectReports, getDottedLineManager, process-settings helpers"
```

---

## Verification Checklist

After all tasks complete:

1. **Schema**: `npx prisma validate` → "The schema is valid 🚀"
2. **Tables exist**: Open Prisma Studio (`npx prisma studio`) → confirm `jobs`, `positions`, `company_process_settings` tables; confirm `employee_manager_backups` is gone
3. **Seed counts**:
   - Jobs: 15 rows
   - Positions: ~55 CTR-KR + ~120 other companies = ~175 total
   - CompanyProcessSettings: 8 global + 2 CTR-KR overrides = 10 rows
   - Departments: 4 + 5 new CTR-KR + 24 other = 33 total
4. **View columns**: `SELECT position_title, job_title, manager_employee_id FROM current_employee_view LIMIT 1` → no error
5. **TS baseline**: `npx tsc --noEmit 2>&1 | wc -l` → count should be ≤ original 418-error count (no new errors added)
6. **Helper smoke test**: Add a temporary console.log in seed.ts to call `getDirectReports` on CTR-KR CEO position → should return array of G2/G3 direct reports

---

## Key File Paths

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add Job, Position, CompanyProcessSetting; update EmployeeAssignment; add back-relations |
| `prisma/seed.ts` | Add departments, jobs, positions, process settings, employee position assignments |
| `prisma/migrations/` | Auto-generated (2 migrations) |
| `src/lib/assignments.ts` | Add 3 new functions, remove `getManagerBackup` |
| `src/lib/process-settings.ts` | New file |
| `src/types/position.ts` | New file |
| `src/types/process-settings.ts` | New file |
