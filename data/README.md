# Production Data Import

## Directory Purpose
This directory holds real employee data for production migration.
**ALL files except this README are .gitignore'd — never commit PII.**

## CSV Format
| Column | Required | Example | Notes |
|--------|----------|---------|-------|
| employeeCode | Yes | E001 | Unique per employee |
| firstName | Yes | 동옥 | |
| lastName | Yes | 이 | |
| email | Yes | dongok.lee@ctr.co.kr | Must be unique |
| companyCode | Yes | CTR | Must match Company.code |
| departmentCode | Yes | TM-PNC | Must match Department.code |
| positionCode | Yes | POS-CTR-TL-PNC | Must match Position.code |
| jobGradeCode | Yes | G-EL | Must match JobGrade.code for company |
| employmentType | Yes | FULL_TIME | FULL_TIME/CONTRACT/DISPATCH |
| jobCategory | No | OFFICE | OFFICE/PRODUCTION (if field exists) |
| hireDate | Yes | 2020-03-15 | ISO date |
| contractEndDate | No | 2026-12-31 | For CONTRACT type only |

## Usage
```bash
# Dry run (validate only)
npx tsx scripts/import-prod-migration.ts --file data/prod-employees.csv --dry-run

# Import single company
npx tsx scripts/import-prod-migration.ts --file data/prod-employees.csv --company CTR-HOLD

# Full import
npx tsx scripts/import-prod-migration.ts --file data/prod-employees.csv
```

## Append-Only Rule
This script NEVER updates or deletes existing records.
- Existing employees (by employeeCode) are skipped with `--skip-existing`
- New assignments are always created fresh (`isPrimary: true`, `endDate: null`)
