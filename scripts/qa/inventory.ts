/**
 * Phase 0 Day 1-2 — Codebase Baseline Inventory
 *
 * Automated counting of routes, pages, models, tests, locales.
 * Used by Final QA Sweep (10-12 week program) to detect baseline drift.
 *
 * Outputs:
 *   - scripts/qa/inventory.json    (machine-readable snapshot)
 *   - scripts/qa/inventory-summary.md (human-readable markdown table)
 *
 * Run: npm run qa:inventory
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import fg from 'fast-glob'

const ROOT = path.resolve(__dirname, '../..')
const OUT_JSON = path.join(ROOT, 'scripts/qa/inventory.json')
const OUT_MD = path.join(ROOT, 'scripts/qa/inventory-summary.md')

type LocaleInfo = { topLevelKeys: number; fileSizeKb: number } | { error: string }

interface Inventory {
  generatedAt: string
  gitCommit: string | null
  gitBranch: string | null
  counts: {
    apiRoutes: number
    apiRoutesV1: number
    pages: number
    cronRoutes: number
    prismaModels: number | null
    e2eSpecs: number
    locales: number
  }
  locales: Record<string, LocaleInfo>
  localeParity: boolean
  warnings: string[]
}

function safeGit(args: string[]): string | null {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

function countGlob(pattern: string, ignore: string[] = []): number {
  return fg.sync(pattern, { cwd: ROOT, ignore, dot: false }).length
}

function countPrismaModels(warnings: string[]): number | null {
  const schemaPath = path.join(ROOT, 'prisma/schema.prisma')
  if (!fs.existsSync(schemaPath)) {
    warnings.push('prisma/schema.prisma not found')
    return null
  }
  const content = fs.readFileSync(schemaPath, 'utf8')
  // ^model <name> { — line-start + whitespace + identifier + opening brace
  // comments (//) and block comments (/* */) ignored by line-start anchor
  const matches = content.match(/^model\s+\w+\s*\{/gm)
  return matches ? matches.length : 0
}

function analyzeLocales(warnings: string[]): { locales: Record<string, LocaleInfo>; parity: boolean } {
  const messagesDir = path.join(ROOT, 'messages')
  const result: Record<string, LocaleInfo> = {}

  if (!fs.existsSync(messagesDir)) {
    warnings.push('messages/ directory not found')
    return { locales: result, parity: false }
  }

  const files = fs.readdirSync(messagesDir).filter((f) => f.endsWith('.json'))
  const keyCounts: number[] = []

  for (const file of files) {
    const locale = path.basename(file, '.json')
    const filePath = path.join(messagesDir, file)
    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      const parsed = JSON.parse(raw)
      const topLevelKeys = Object.keys(parsed).length
      const fileSizeKb = Math.round(fs.statSync(filePath).size / 1024)
      result[locale] = { topLevelKeys, fileSizeKb }
      keyCounts.push(topLevelKeys)
    } catch (err) {
      result[locale] = { error: `JSON parse failed: ${(err as Error).message}` }
      warnings.push(`messages/${file}: JSON parse failed`)
    }
  }

  const parity = keyCounts.length > 0 && keyCounts.every((c) => c === keyCounts[0])
  return { locales: result, parity }
}

function buildMarkdownSummary(inv: Inventory): string {
  const ts = inv.generatedAt
  const commit = inv.gitCommit ?? 'unknown'
  const branch = inv.gitBranch ?? 'unknown'
  const { counts, locales, localeParity, warnings } = inv

  const lines: string[] = []
  lines.push('# Codebase Inventory Summary')
  lines.push('')
  lines.push(`_Generated: ${ts} · Commit: \`${commit}\` · Branch: \`${branch}\`_`)
  lines.push('')
  lines.push('## Counts')
  lines.push('')
  lines.push('| Category | Count |')
  lines.push('|----------|------:|')
  lines.push(`| API routes (total) | ${counts.apiRoutes} |`)
  lines.push(`| API routes (v1)    | ${counts.apiRoutesV1} |`)
  lines.push(`| Pages              | ${counts.pages} |`)
  lines.push(`| Cron routes        | ${counts.cronRoutes} |`)
  lines.push(`| Prisma models      | ${counts.prismaModels ?? 'N/A'} |`)
  lines.push(`| E2E specs          | ${counts.e2eSpecs} |`)
  lines.push(`| Locale files       | ${counts.locales} |`)
  lines.push('')
  lines.push('## i18n Locales')
  lines.push('')
  lines.push('| Locale | Top-level keys | Size (KB) |')
  lines.push('|--------|---------------:|----------:|')
  for (const [loc, info] of Object.entries(locales)) {
    if ('error' in info) {
      lines.push(`| ${loc} | ERROR | ERROR |`)
    } else {
      lines.push(`| ${loc} | ${info.topLevelKeys} | ${info.fileSizeKb} |`)
    }
  }
  lines.push('')
  lines.push(`**Locale parity:** ${localeParity ? 'PASS' : 'FAIL'}`)
  lines.push('')
  if (warnings.length > 0) {
    lines.push('## Warnings')
    lines.push('')
    for (const w of warnings) lines.push(`- ${w}`)
    lines.push('')
  }
  return lines.join('\n')
}

function main(): void {
  const warnings: string[] = []

  const gitCommit = safeGit(['rev-parse', '--short', 'HEAD'])
  const gitBranch = safeGit(['branch', '--show-current'])
  if (!gitCommit) warnings.push('git rev-parse failed (gitCommit=null)')
  if (!gitBranch) warnings.push('git branch --show-current failed (gitBranch=null)')

  const apiRoutes = countGlob('src/app/**/route.ts')
  const apiRoutesV1 = countGlob('src/app/api/v1/**/route.ts')
  const pages = countGlob('src/app/**/page.tsx')
  const cronRoutes = countGlob('src/app/api/v1/cron/**/route.ts')
  const prismaModels = countPrismaModels(warnings)
  const e2eSpecs = countGlob('e2e/**/*.spec.ts', ['e2e/helpers/**'])
  const { locales, parity: localeParity } = analyzeLocales(warnings)

  if (apiRoutes === 0) warnings.push('src/app API routes: 0 (directory missing?)')
  if (pages === 0) warnings.push('src/app pages: 0 (directory missing?)')

  const inv: Inventory = {
    generatedAt: new Date().toISOString(),
    gitCommit,
    gitBranch,
    counts: {
      apiRoutes,
      apiRoutesV1,
      pages,
      cronRoutes,
      prismaModels,
      e2eSpecs,
      locales: Object.keys(locales).length,
    },
    locales,
    localeParity,
    warnings,
  }

  // Write JSON
  try {
    fs.writeFileSync(OUT_JSON, JSON.stringify(inv, null, 2) + '\n', 'utf8')
  } catch (err) {
    process.stderr.write(`[inventory] Failed to write ${OUT_JSON}: ${(err as Error).message}\n`)
    process.exit(1)
  }

  // Write markdown summary
  try {
    fs.writeFileSync(OUT_MD, buildMarkdownSummary(inv), 'utf8')
  } catch (err) {
    process.stderr.write(`[inventory] Failed to write ${OUT_MD}: ${(err as Error).message}\n`)
    process.exit(1)
  }

  // Console output
  console.log('Codebase Inventory')
  console.log('──────────────────')
  console.log(`Commit:        ${gitCommit ?? 'N/A'} (${gitBranch ?? 'N/A'})`)
  console.log(`API routes:    ${apiRoutes} (v1: ${apiRoutesV1})`)
  console.log(`Pages:         ${pages}`)
  console.log(`Cron routes:   ${cronRoutes}`)
  console.log(`Prisma models: ${prismaModels ?? 'N/A'}`)
  console.log(`E2E specs:     ${e2eSpecs}`)
  console.log(`Locales:       ${Object.keys(locales).length} (parity: ${localeParity ? 'PASS' : 'FAIL'})`)
  if (warnings.length > 0) {
    console.log(`Warnings:      ${warnings.length}`)
    for (const w of warnings) console.log(`  - ${w}`)
  }
  console.log('')
  console.log(`Written: ${path.relative(ROOT, OUT_JSON)}`)
  console.log(`Written: ${path.relative(ROOT, OUT_MD)}`)
}

main()
