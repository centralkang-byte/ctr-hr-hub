/**
 * Track B B-1a: Company code rename script
 *
 * Mappings:
 *   CTR-HQ  → CTR-HOLD
 *   CTR-KR  → CTR        (DANGEROUS — must not touch employee numbers/position codes)
 *   CTR-ENG → CTR-ENR
 *   FML     → CTR-FML
 *   CTR-MX  → CTR-US     (merge)
 *
 * Strategy:
 *   - Only replace company code values in specific contexts (quoted strings as field values)
 *   - Employee numbers (CTR-KR-0001, CTR-KR-3070) are NOT touched
 *   - Position codes (CTR-KR-MFG-004) are NOT touched
 *   - UUID generation keys are NOT touched
 */

import * as fs from 'fs'
import * as path from 'path'

const SEED_DIR = path.join(__dirname, '..', 'prisma', 'seeds')
const SRC_DIR = path.join(__dirname, '..', 'src')

interface Replacement {
  file: string
  line: number
  old: string
  new: string
}

const results: Replacement[] = []

// ── CTR-HQ → CTR-HOLD ────────────────────────────
// Safe: CTR-HQ is only used as a company code, never as an employee number prefix
function replaceCtrHq(content: string, filePath: string): string {
  return content.replace(/'CTR-HQ'/g, (match, offset) => {
    const lineNum = content.substring(0, offset).split('\n').length
    results.push({ file: filePath, line: lineNum, old: match, new: "'CTR-HOLD'" })
    return "'CTR-HOLD'"
  }).replace(/"CTR-HQ"/g, (match, offset) => {
    const lineNum = content.substring(0, offset).split('\n').length
    results.push({ file: filePath, line: lineNum, old: match, new: '"CTR-HOLD"' })
    return '"CTR-HOLD"'
  })
}

// ── CTR-KR → CTR ──────────────────────────────────
// DANGEROUS: Must only match company code references, NOT employee numbers or position codes.
// Employee numbers: CTR-KR-0001, CTR-KR-3070 (always followed by -NNNN)
// Position codes: CTR-KR-MFG-004, CTR-KR-QA-TEAM-A-MGR (always followed by -ALPHA)
// Company codes: 'CTR-KR' (quoted, NOT followed by -)
function replaceCtrKr(content: string, filePath: string): string {
  // Match 'CTR-KR' that is NOT followed by - (which would indicate employee/position code)
  // Pattern: 'CTR-KR' at end of string OR 'CTR-KR' followed by non-hyphen
  return content.replace(/'CTR-KR'(?![\w-])/g, (match, offset) => {
    const lineNum = content.substring(0, offset).split('\n').length
    results.push({ file: filePath, line: lineNum, old: match, new: "'CTR'" })
    return "'CTR'"
  }).replace(/"CTR-KR"(?![\w-])/g, (match, offset) => {
    const lineNum = content.substring(0, offset).split('\n').length
    results.push({ file: filePath, line: lineNum, old: match, new: '"CTR"' })
    return '"CTR"'
  })
}

// ── CTR-ENG → CTR-ENR ─────────────────────────────
function replaceCtrEng(content: string, filePath: string): string {
  return content.replace(/'CTR-ENG'/g, (match, offset) => {
    const lineNum = content.substring(0, offset).split('\n').length
    results.push({ file: filePath, line: lineNum, old: match, new: "'CTR-ENR'" })
    return "'CTR-ENR'"
  }).replace(/"CTR-ENG"/g, (match, offset) => {
    const lineNum = content.substring(0, offset).split('\n').length
    results.push({ file: filePath, line: lineNum, old: match, new: '"CTR-ENR"' })
    return '"CTR-ENR"'
  })
}

// ── FML → CTR-FML ─────────────────────────────────
function replaceFml(content: string, filePath: string): string {
  // Only match 'FML' as a standalone company code (not part of larger word)
  return content.replace(/'FML'/g, (match, offset) => {
    const lineNum = content.substring(0, offset).split('\n').length
    results.push({ file: filePath, line: lineNum, old: match, new: "'CTR-FML'" })
    return "'CTR-FML'"
  }).replace(/"FML"/g, (match, offset) => {
    const lineNum = content.substring(0, offset).split('\n').length
    results.push({ file: filePath, line: lineNum, old: match, new: '"CTR-FML"' })
    return '"CTR-FML"'
  })
}

// ── CTR-MX → CTR-US ───────────────────────────────
function replaceCtrMx(content: string, filePath: string): string {
  return content.replace(/'CTR-MX'/g, (match, offset) => {
    const lineNum = content.substring(0, offset).split('\n').length
    results.push({ file: filePath, line: lineNum, old: match, new: "'CTR-US'" })
    return "'CTR-US'"
  }).replace(/"CTR-MX"/g, (match, offset) => {
    const lineNum = content.substring(0, offset).split('\n').length
    results.push({ file: filePath, line: lineNum, old: match, new: '"CTR-US"' })
    return '"CTR-US"'
  })
}

// ── Also handle comments ──────────────────────────
function replaceComments(content: string, filePath: string): string {
  // Replace company code references in comments (// CTR-HQ, CTR-KR etc.)
  // Only replace when it's clearly a company code reference (not part of employee number)
  let updated = content

  // In comments: CTR-HQ → CTR-HOLD
  updated = updated.replace(/(\/\/.*?)CTR-HQ/g, '$1CTR-HOLD')

  // In comments: standalone CTR-KR (not followed by -NNNN or -ALPHA)
  // Match CTR-KR in comments only when not followed by hyphen+alphanumeric
  updated = updated.replace(/(\/\/.*?)CTR-KR(?!-[A-Z0-9])/g, '$1CTR')

  // In comments: CTR-MX → CTR-US
  updated = updated.replace(/(\/\/.*?)CTR-MX/g, '$1CTR-US')

  return updated
}

function processFile(filePath: string): number {
  const content = fs.readFileSync(filePath, 'utf-8')
  let updated = content

  updated = replaceCtrHq(updated, filePath)
  updated = replaceCtrKr(updated, filePath)
  updated = replaceCtrEng(updated, filePath)
  updated = replaceFml(updated, filePath)
  updated = replaceCtrMx(updated, filePath)
  updated = replaceComments(updated, filePath)

  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf-8')
    return 1
  }
  return 0
}

function walkDir(dir: string, ext: string): string[] {
  const files: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip node_modules, .next, dist
      if (['node_modules', '.next', 'dist', '.git'].includes(entry.name)) continue
      files.push(...walkDir(fullPath, ext))
    } else if (entry.name.endsWith(ext)) {
      files.push(fullPath)
    }
  }
  return files
}

// ── Main ──────────────────────────────────────────
console.log('🔄 Track B B-1a: Company code rename script\n')

// Process seed files
const seedFiles = fs.readdirSync(SEED_DIR)
  .filter(f => f.endsWith('.ts'))
  .map(f => path.join(SEED_DIR, f))

let filesChanged = 0
for (const f of seedFiles) {
  filesChanged += processFile(f)
}

// Process src files (only .ts and .tsx)
const srcFiles = walkDir(SRC_DIR, '.ts').concat(walkDir(SRC_DIR, '.tsx'))
for (const f of srcFiles) {
  filesChanged += processFile(f)
}

// Also process e2e files
const e2eDir = path.join(__dirname, '..', 'e2e')
if (fs.existsSync(e2eDir)) {
  const e2eFiles = walkDir(e2eDir, '.ts')
  for (const f of e2eFiles) {
    filesChanged += processFile(f)
  }
}

console.log(`\n📊 Results:`)
console.log(`   Files modified: ${filesChanged}`)
console.log(`   Total replacements: ${results.length}`)
console.log(`\n📋 Detailed changes:`)

// Group by file
const byFile = new Map<string, Replacement[]>()
for (const r of results) {
  const rel = path.relative(path.join(__dirname, '..'), r.file)
  if (!byFile.has(rel)) byFile.set(rel, [])
  byFile.get(rel)!.push(r)
}

for (const [file, reps] of byFile) {
  console.log(`\n  ${file}: ${reps.length} changes`)
  for (const r of reps.slice(0, 5)) {
    console.log(`    L${r.line}: ${r.old} → ${r.new}`)
  }
  if (reps.length > 5) {
    console.log(`    ... and ${reps.length - 5} more`)
  }
}
