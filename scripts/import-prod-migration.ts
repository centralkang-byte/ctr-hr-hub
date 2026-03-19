/**
 * Production Data Migration Script
 *
 * Usage: npx tsx scripts/import-prod-migration.ts --file data/prod-employees.csv --dry-run
 *
 * Flags:
 *   --file <path>    CSV file to import
 *   --dry-run        Validate only, don't write to DB
 *   --company <code> Filter to single company (for phased rollout)
 *   --skip-existing  Skip employees that already exist (by employeeNo)
 *
 * CSV Expected Columns:
 *   employeeCode, firstName, lastName, email, companyCode, departmentCode,
 *   positionCode, jobGradeCode, employmentType, jobCategory, hireDate,
 *   contractEndDate (optional), reportsToEmployeeCode (optional)
 *
 * Append-Only Rule: NEVER updates or deletes existing records.
 */

import dotenv from 'dotenv'
import path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Check .env.local or .env')
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma: PrismaClient = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] })

// ================================================================
// Types
// ================================================================

interface ImportRow {
  employeeCode: string
  firstName: string
  lastName: string
  email: string
  companyCode: string
  departmentCode: string
  positionCode: string
  jobGradeCode: string
  employmentType: string
  jobCategory?: string
  hireDate: string
  contractEndDate?: string
}

interface ImportResult {
  total: number
  created: number
  skipped: number
  errors: Array<{ row: number; employeeCode: string; error: string }>
}

// ================================================================
// CLI Argument Parsing
// ================================================================

function parseArgs(): { file: string; dryRun: boolean; company?: string; skipExisting: boolean } {
  const args = process.argv.slice(2)
  let file = ''
  let dryRun = false
  let company: string | undefined
  let skipExisting = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) { file = args[++i]; continue }
    if (args[i] === '--dry-run') { dryRun = true; continue }
    if (args[i] === '--company' && args[i + 1]) { company = args[++i]; continue }
    if (args[i] === '--skip-existing') { skipExisting = true; continue }
  }

  if (!file) {
    console.error('Usage: npx tsx scripts/import-prod-migration.ts --file <path> [--dry-run] [--company <code>] [--skip-existing]')
    process.exit(1)
  }

  return { file, dryRun, company, skipExisting }
}

// ================================================================
// CSV Parsing (simple — no external dependency)
// ================================================================

function parseCSV(filePath: string): ImportRow[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) throw new Error('CSV file must have a header row + at least 1 data row')

  const headers = lines[0].split(',').map(h => h.trim())
  const rows: ImportRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] ?? '' })

    rows.push({
      employeeCode: row['employeeCode'] ?? '',
      firstName: row['firstName'] ?? '',
      lastName: row['lastName'] ?? '',
      email: row['email'] ?? '',
      companyCode: row['companyCode'] ?? '',
      departmentCode: row['departmentCode'] ?? '',
      positionCode: row['positionCode'] ?? '',
      jobGradeCode: row['jobGradeCode'] ?? '',
      employmentType: row['employmentType'] ?? 'FULL_TIME',
      jobCategory: row['jobCategory'] || undefined,
      hireDate: row['hireDate'] ?? '',
      contractEndDate: row['contractEndDate'] || undefined,
    })
  }

  return rows
}

// ================================================================
// Validation
// ================================================================

async function validateRows(rows: ImportRow[], companyFilter?: string): Promise<ImportResult> {
  const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: [] }

  // Lookup maps from DB
  const companies = await prisma.company.findMany({ select: { id: true, code: true } })
  const companyMap = new Map(companies.map(c => [c.code, c.id]))

  const departments = await prisma.department.findMany({ select: { id: true, code: true, companyId: true } })
  const deptMap = new Map(departments.map(d => [`${d.companyId}:${d.code}`, d.id]))

  const positions = await prisma.position.findMany({ select: { id: true, code: true } })
  const posMap = new Map(positions.map(p => [p.code, p.id]))

  const grades = await prisma.jobGrade.findMany({ select: { id: true, code: true, companyId: true } })
  const gradeMap = new Map(grades.map(g => [`${g.companyId}:${g.code}`, g.id]))

  const existingEmps = await prisma.employee.findMany({ select: { employeeNo: true, email: true } })
  const existingCodes = new Set(existingEmps.map(e => e.employeeNo))
  const existingEmails = new Set(existingEmps.map(e => e.email))

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // header is row 1

    // Company filter
    if (companyFilter && row.companyCode !== companyFilter) {
      result.skipped++
      continue
    }

    // Validate company
    const companyId = companyMap.get(row.companyCode)
    if (!companyId) {
      result.errors.push({ row: rowNum, employeeCode: row.employeeCode, error: `Company "${row.companyCode}" not found` })
      continue
    }

    // Validate department
    if (!deptMap.has(`${companyId}:${row.departmentCode}`)) {
      result.errors.push({ row: rowNum, employeeCode: row.employeeCode, error: `Department "${row.departmentCode}" not found for company "${row.companyCode}"` })
    }

    // Validate position
    if (!posMap.has(row.positionCode)) {
      result.errors.push({ row: rowNum, employeeCode: row.employeeCode, error: `Position "${row.positionCode}" not found` })
    }

    // Validate grade
    if (!gradeMap.has(`${companyId}:${row.jobGradeCode}`)) {
      result.errors.push({ row: rowNum, employeeCode: row.employeeCode, error: `JobGrade "${row.jobGradeCode}" not found for company "${row.companyCode}"` })
    }

    // Validate unique email
    if (existingEmails.has(row.email)) {
      result.errors.push({ row: rowNum, employeeCode: row.employeeCode, error: `Email "${row.email}" already exists` })
    }

    // Validate unique employee code
    if (existingCodes.has(row.employeeCode)) {
      result.skipped++
      continue
    }

    // Validate hireDate
    if (!row.hireDate || isNaN(new Date(row.hireDate).getTime())) {
      result.errors.push({ row: rowNum, employeeCode: row.employeeCode, error: `Invalid hireDate "${row.hireDate}"` })
    }

    result.created++
  }

  return result
}

// ================================================================
// Main
// ================================================================

async function main() {
  const { file, dryRun, company, skipExisting } = parseArgs()

  console.log('═══════════════════════════════════════════')
  console.log(' Production Data Migration')
  console.log(`  File: ${file}`)
  console.log(`  Mode: ${dryRun ? 'DRY RUN (validate only)' : 'LIVE (will write to DB)'}`)
  if (company) console.log(`  Company filter: ${company}`)
  if (skipExisting) console.log(`  Skip existing: ON`)
  console.log('═══════════════════════════════════════════\n')

  if (!fs.existsSync(file)) {
    console.error(`❌ File not found: ${file}`)
    process.exit(1)
  }

  const rows = parseCSV(file)
  console.log(`📄 Parsed ${rows.length} rows from CSV\n`)

  const result = await validateRows(rows, company)

  console.log('═══════════════════════════════════════════')
  console.log(' Validation Results')
  console.log(`  Total rows: ${result.total}`)
  console.log(`  Would create: ${result.created}`)
  console.log(`  Skipped: ${result.skipped}`)
  console.log(`  Errors: ${result.errors.length}`)
  console.log('═══════════════════════════════════════════\n')

  if (result.errors.length > 0) {
    console.log('Errors:')
    for (const err of result.errors.slice(0, 20)) {
      console.log(`  Row ${err.row} [${err.employeeCode}]: ${err.error}`)
    }
    if (result.errors.length > 20) {
      console.log(`  ... and ${result.errors.length - 20} more errors`)
    }
  }

  if (dryRun) {
    console.log('\n🔍 Dry run complete. No changes made to DB.')
    return
  }

  if (result.errors.length > 0) {
    console.error('\n❌ Cannot proceed with errors. Fix CSV data and retry.')
    process.exit(1)
  }

  // TODO: Implement actual DB writes
  // For each valid row:
  //   1. prisma.employee.create()
  //   2. prisma.employeeAssignment.create() (isPrimary: true)
  //   3. prisma.employeeRole.create() (EMPLOYEE default)
  //   4. prisma.employeeAuth.create() (for credentials login)
  //   5. prisma.ssoIdentity.create() (for SSO login)
  console.log('\n⚠️ Write mode not yet implemented. Use --dry-run for validation.')
}

main()
  .catch(e => { console.error('❌ Import failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
