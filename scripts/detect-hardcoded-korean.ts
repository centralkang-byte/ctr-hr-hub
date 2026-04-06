#!/usr/bin/env npx tsx
/**
 * Hardcoded Korean String Detector
 *
 * Scans src/ for Korean strings that should be using next-intl i18n.
 *
 * Usage:
 *   npx tsx scripts/detect-hardcoded-korean.ts              # Full scan
 *   npx tsx scripts/detect-hardcoded-korean.ts --module src/app/(auth)  # Scoped
 *   npx tsx scripts/detect-hardcoded-korean.ts --json        # JSON output
 */

import fs from 'fs'
import path from 'path'
import { glob } from 'fast-glob'

// ─── Config ─────────────────────────────────────────────────

const ROOT = process.cwd()
const DEFAULT_SCAN_DIRS = ['src/app', 'src/components', 'src/lib']
const KOREAN_CHAR = /[가-힣]/

// DO NOT TOUCH files + seed/test exclusions
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/.next/**',
  '**/*.d.ts',
  '**/*.test.*',
  '**/*.spec.*',
  '**/e2e/**',
  '**/prisma/seeds/**',
  '**/prisma/seed.ts',
  '**/scripts/**',
  // DO NOT TOUCH
  '**/layout/Sidebar.tsx',
  '**/layout/MobileDrawer.tsx',
  '**/config/navigation.ts',
]

// Lines matching these patterns are ignored (comments, console, imports)
function isExcludedLine(line: string): boolean {
  const trimmed = line.trim()
  // Single-line comments
  if (trimmed.startsWith('//')) return true
  // Import statements
  if (trimmed.startsWith('import ')) return true
  if (trimmed.startsWith('export ') && trimmed.includes(' from ')) return true
  // Console calls
  if (/console\.(log|error|warn|info|debug)\(/.test(trimmed)) return true
  // Block comment markers
  if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('*/')) return true
  // Decorative comment lines
  if (trimmed.startsWith('// ═') || trimmed.startsWith('// ─')) return true
  return false
}

// ─── Pattern Definitions ────────────────────────────────────

type PatternType =
  | 'jsx_text'
  | 'label_map'
  | 'template_literal'
  | 'string_prop'
  | 'toast_error'
  | 'locale_hardcode'

interface Finding {
  file: string
  line: number
  pattern: PatternType
  text: string
  korean: string
}

function extractKorean(str: string): string {
  const match = str.match(/[가-힣][^'"`)}<>]*/g)
  return match ? match.join(' ').trim().slice(0, 60) : ''
}

/**
 * Detect Korean strings in a single file
 */
function detectInFile(filePath: string): Finding[] {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const findings: Finding[] = []
  const relPath = path.relative(ROOT, filePath)
  const isTsx = filePath.endsWith('.tsx')

  // Track if we're inside a block comment
  let inBlockComment = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // Block comment tracking
    if (line.includes('/*')) inBlockComment = true
    if (line.includes('*/')) { inBlockComment = false; continue }
    if (inBlockComment) continue

    if (isExcludedLine(line)) continue
    if (!KOREAN_CHAR.test(line)) continue

    const trimmed = line.trim()

    // Pattern 6: Locale hardcoding (check first, applies to all file types)
    if (/['"]ko-KR['"]|['"]ko['"]/.test(trimmed) && /toLocale|format|Intl\./.test(trimmed)) {
      findings.push({
        file: relPath, line: lineNum, pattern: 'locale_hardcode',
        text: trimmed.slice(0, 120), korean: 'ko-KR locale hardcoded',
      })
    }

    // Pattern 1: JSX text content (tsx only)
    // Korean text between > and < or as direct text child
    if (isTsx && />([^<]*[가-힣][^<]*)</.test(trimmed)) {
      const match = trimmed.match(/>([^<]*[가-힣][^<]*)</)
      if (match) {
        findings.push({
          file: relPath, line: lineNum, pattern: 'jsx_text',
          text: trimmed.slice(0, 120), korean: extractKorean(match[1]),
        })
        continue // Don't double-count
      }
    }

    // Pattern 2: Label/status mapping objects
    // { label: '한국어', name: '한국어', title: '한국어', description: '한국어', message: '한국어' }
    if (/(label|name|title|description|message|text|placeholder|header)\s*:\s*['"][^'"]*[가-힣]/.test(trimmed)) {
      const match = trimmed.match(/(label|name|title|description|message|text|placeholder|header)\s*:\s*['"]([^'"]*[가-힣][^'"]*)['"]/)
      if (match) {
        findings.push({
          file: relPath, line: lineNum, pattern: 'label_map',
          text: trimmed.slice(0, 120), korean: extractKorean(match[2]),
        })
        continue
      }
    }

    // Pattern 3: Template literals with Korean
    if (/`[^`]*[가-힣][^`]*`/.test(trimmed)) {
      const match = trimmed.match(/`([^`]*[가-힣][^`]*)`/)
      if (match) {
        findings.push({
          file: relPath, line: lineNum, pattern: 'template_literal',
          text: trimmed.slice(0, 120), korean: extractKorean(match[1]),
        })
        continue
      }
    }

    // Pattern 4: String props in JSX (tsx only)
    if (isTsx && /(placeholder|title|alt|aria-label|description)=["'][^"']*[가-힣]/.test(trimmed)) {
      const match = trimmed.match(/(placeholder|title|alt|aria-label|description)=["']([^"']*[가-힣][^"']*)["']/)
      if (match) {
        findings.push({
          file: relPath, line: lineNum, pattern: 'string_prop',
          text: trimmed.slice(0, 120), korean: extractKorean(match[2]),
        })
        continue
      }
    }

    // Pattern 5: Toast/error/throw with Korean strings
    if (/(toast\s*\(\s*\{|throw\s+new|NextResponse\.json\s*\(|apiError\s*\()/.test(trimmed) && KOREAN_CHAR.test(trimmed)) {
      findings.push({
        file: relPath, line: lineNum, pattern: 'toast_error',
        text: trimmed.slice(0, 120), korean: extractKorean(trimmed),
      })
      continue
    }

    // Pattern 5 also: Korean in string assignments to error/message variables
    if (/(title|description|message|errorMessage)\s*[:=]\s*['"][^'"]*[가-힣]/.test(trimmed)) {
      // Skip if already caught by label_map
      if (!(/(label|name|title|description|message|text|placeholder|header)\s*:\s*['"]/.test(trimmed))) {
        findings.push({
          file: relPath, line: lineNum, pattern: 'toast_error',
          text: trimmed.slice(0, 120), korean: extractKorean(trimmed),
        })
        continue
      }
    }

    // Catch-all: Any remaining Korean in string literals
    if (/['"][^'"]*[가-힣][^'"]*['"]/.test(trimmed)) {
      const match = trimmed.match(/['"]([^'"]*[가-힣][^'"]*)['"]/)
      if (match) {
        // Skip if it looks like a key path or class name
        if (/^[a-z]/.test(match[1]) && !KOREAN_CHAR.test(match[1].slice(0, 3))) continue
        findings.push({
          file: relPath, line: lineNum, pattern: 'label_map',
          text: trimmed.slice(0, 120), korean: extractKorean(match[1]),
        })
      }
    }
  }

  return findings
}

// ─── Module mapping for summary ─────────────────────────────

function getModule(filePath: string): string {
  if (filePath.includes('/api/')) return 'api'
  if (filePath.includes('/(auth)/')) return 'auth'
  if (filePath.includes('/home/') || filePath.includes('/dashboard/')) return 'home'
  if (filePath.includes('/employees/') || filePath.includes('/directory/')) return 'employees'
  if (filePath.includes('/attendance/') || filePath.includes('/shift')) return 'attendance'
  if (filePath.includes('/leave/') || filePath.includes('/leave-of-absence/')) return 'leave'
  if (filePath.includes('/payroll/')) return 'payroll'
  if (filePath.includes('/performance/') || filePath.includes('/calibration/')) return 'performance'
  if (filePath.includes('/recruitment/')) return 'recruitment'
  if (filePath.includes('/onboarding/') || filePath.includes('/offboarding/')) return 'onoff'
  if (filePath.includes('/analytics/')) return 'analytics'
  if (filePath.includes('/compliance/')) return 'compliance'
  if (filePath.includes('/settings/')) return 'settings'
  if (filePath.includes('/compensation/')) return 'compensation'
  if (filePath.includes('/org/') || filePath.includes('/org-studio/')) return 'org'
  if (filePath.includes('/my/')) return 'mySpace'
  if (filePath.includes('src/lib/')) return 'lib'
  if (filePath.includes('src/components/')) return 'components'
  return 'other'
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const jsonMode = args.includes('--json')
  const moduleIdx = args.indexOf('--module')
  const scanDirs = moduleIdx !== -1 && args[moduleIdx + 1]
    ? [args[moduleIdx + 1]]
    : DEFAULT_SCAN_DIRS

  // Find files
  const patterns = scanDirs.map(d => `${d}/**/*.{ts,tsx}`)
  const files = await glob(patterns, {
    cwd: ROOT,
    absolute: true,
    ignore: EXCLUDE_PATTERNS,
  })

  if (!jsonMode) {
    console.log(`\n📊 Hardcoded Korean String Detection`)
    console.log(`${'─'.repeat(50)}`)
    console.log(`Scanning ${files.length} files in: ${scanDirs.join(', ')}\n`)
  }

  // Scan all files
  const allFindings: Finding[] = []
  for (const file of files) {
    allFindings.push(...detectInFile(file))
  }

  // Deduplicate (same file+line)
  const seen = new Set<string>()
  const findings = allFindings.filter(f => {
    const key = `${f.file}:${f.line}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (jsonMode) {
    const output = {
      timestamp: new Date().toISOString(),
      totalFiles: files.length,
      totalFindings: findings.length,
      findings,
    }
    const outPath = path.join(ROOT, 'scripts', 'i18n-audit-hardcoded.json')
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2))
    console.log(`Written to ${outPath}`)
    return
  }

  // ─── Summary by module ────────────────────────────────────

  const byModule = new Map<string, number>()
  const byPattern = new Map<PatternType, number>()

  for (const f of findings) {
    const mod = getModule(f.file)
    byModule.set(mod, (byModule.get(mod) ?? 0) + 1)
    byPattern.set(f.pattern, (byPattern.get(f.pattern) ?? 0) + 1)
  }

  console.log(`TOTAL: ${findings.length} hardcoded Korean strings in ${new Set(findings.map(f => f.file)).size} files\n`)

  // Module table
  console.log('By Module:')
  const sortedModules = [...byModule.entries()].sort((a, b) => b[1] - a[1])
  for (const [mod, count] of sortedModules) {
    const bar = '█'.repeat(Math.min(Math.ceil(count / 5), 40))
    console.log(`  ${mod.padEnd(15)} ${String(count).padStart(4)}  ${bar}`)
  }

  console.log('\nBy Pattern:')
  const patternLabels: Record<PatternType, string> = {
    jsx_text: 'JSX Text',
    label_map: 'Label/Map',
    template_literal: 'Template',
    string_prop: 'String Prop',
    toast_error: 'Toast/Error',
    locale_hardcode: 'Locale',
  }
  const sortedPatterns = [...byPattern.entries()].sort((a, b) => b[1] - a[1])
  for (const [pat, count] of sortedPatterns) {
    console.log(`  ${patternLabels[pat].padEnd(15)} ${String(count).padStart(4)}`)
  }

  // Top files
  const byFile = new Map<string, number>()
  for (const f of findings) {
    byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1)
  }
  console.log('\nTop 10 Files:')
  const sortedFiles = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  for (const [file, count] of sortedFiles) {
    console.log(`  ${String(count).padStart(3)}  ${file}`)
  }

  // Sample findings (first 5)
  console.log('\nSample Findings:')
  for (const f of findings.slice(0, 5)) {
    console.log(`  ${f.file}:${f.line} [${f.pattern}]`)
    console.log(`    ${f.korean}`)
  }

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Run with --json to save full results to scripts/i18n-audit-hardcoded.json`)
}

main().catch(err => {
  console.error('Detection error:', err)
  process.exit(1)
})
