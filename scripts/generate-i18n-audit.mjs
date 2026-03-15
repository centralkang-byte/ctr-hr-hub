#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — i18n Audit Generator
// Scans src/ and produces scripts/i18n-audit.json
// Run: node scripts/generate-i18n-audit.mjs
// ═══════════════════════════════════════════════════════════

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, relative } from 'path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

function grep(pattern, extra = '', maxLines = 2000) {
  try {
    const cmd = `grep -rn ${pattern} src/ --include="*.tsx" --include="*.ts" ${extra} | head -${maxLines}`
    return execSync(cmd, { cwd: ROOT, encoding: 'utf-8' }).split('\n').filter(Boolean)
  } catch { return [] }
}

function parseGrepLine(line) {
  const m = line.match(/^([^:]+):(\d+):(.+)$/)
  if (!m) return null
  return { file: m[1], line: parseInt(m[2]), content: m[3].trim() }
}

function extractKorean(str) {
  const m = str.match(/['"]([^'"]*[가-힣][^'"]*)['"]/)
  return m ? m[1] : str
}

function getSection(filePath) {
  const p = filePath.replace(/\\/g, '/')
  if (p.includes('/home/') || p.includes('/dashboard/') && !p.includes('/analytics')) return 'home'
  if (p.includes('/my/')) return 'mySpace'
  if (p.includes('/team') || p.includes('/performance/') || p.includes('/goals/')) return 'teamManagement'
  if (p.includes('/employees/') || p.includes('/leave/') || p.includes('/attendance/') || p.includes('/onboarding/') || p.includes('/offboarding/') || p.includes('/discipline/') || p.includes('/succession/') || p.includes('/directory/')) return 'hrOperations'
  if (p.includes('/recruitment/')) return 'recruitment'
  if (p.includes('/compensation/') || p.includes('/benefits/') || p.includes('/training/')) return 'performance'
  if (p.includes('/payroll/')) return 'payroll'
  if (p.includes('/analytics/') || p.includes('/insights/')) return 'insights'
  if (p.includes('/compliance/')) return 'compliance'
  if (p.includes('/settings/')) return 'settings'
  return 'other'
}

function suggestKey(filePath, korean) {
  const p = filePath.replace(/\\/g, '/').replace('src/app/(dashboard)/', '').replace('src/app/', '').replace('src/components/', '')
  const parts = p.split('/').filter(Boolean).map(s => s.replace(/Client\.tsx$|\.tsx$|\.ts$/, ''))
  const slug = korean
    .replace(/[가-힣]+/g, (k) => k) // keep as-is for now; batch script will translate
    .replace(/[^\w가-힣]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase()
    .slice(0, 30)
  return [...parts.slice(0, 3), slug].join('.')
}

console.log('🔍 Scanning label strings…')
const labelLines = grep(
  `"label:\\s*['\\\"][^'\\\"]*[가-힣][^'\\\"]*['\\\"]"`,
  `| grep -v "node_modules|\\.test\\."`,
  2000
)
const labelEntries = labelLines.map(parseGrepLine).filter(Boolean)

const tabLabels = {
  home: [], mySpace: [], teamManagement: [], hrOperations: [], recruitment: [],
  performance: [], payroll: [], insights: [], compliance: [], settings: [], other: []
}
for (const e of labelEntries) {
  const section = getSection(e.file)
  tabLabels[section].push({
    file: e.file,
    line: e.line,
    current: extractKorean(e.content),
    suggestedKey: suggestKey(e.file, extractKorean(e.content))
  })
}

console.log('🔍 Scanning h1 titles…')
const h1Lines = execSync(
  `grep -rn "<h1[^>]*>.*[가-힣]" src/app/ --include="page.tsx" | grep -v "node_modules"`,
  { cwd: ROOT, encoding: 'utf-8' }
).split('\n').filter(Boolean)
const h1Titles = h1Lines.map(parseGrepLine).filter(Boolean).map(e => ({
  file: e.file, line: e.line,
  current: e.content.replace(/<[^>]+>/g, '').trim(),
  suggestedKey: suggestKey(e.file, e.content)
}))

console.log('🔍 Scanning EmptyState usage…')
const imported = execSync(`grep -rln "import.*EmptyState" src/ --include="*.tsx"`, { cwd: ROOT, encoding: 'utf-8' }).split('\n').filter(Boolean).sort()
const used = execSync(`grep -rln "<EmptyState" src/ --include="*.tsx"`, { cwd: ROOT, encoding: 'utf-8' }).split('\n').filter(Boolean).sort()
const usedSet = new Set(used)
const emptyStateTodo = imported.filter(f => !usedSet.has(f))

console.log('🔍 Scanning placeholders…')
const phLines = grep(`"placeholder=['\\\"][^'\\\"]*[가-힣][^'\\\"]*['\\\"]"`, '', 500)
const placeholders = phLines.map(parseGrepLine).filter(Boolean).map(e => ({
  file: e.file, line: e.line,
  current: extractKorean(e.content),
  suggestedKey: suggestKey(e.file, extractKorean(e.content))
}))

const totalLabels = Object.values(tabLabels).reduce((s, a) => s + a.length, 0)

const audit = {
  generatedAt: new Date().toISOString(),
  summary: {
    tabLabels: totalLabels,
    h1Titles: h1Titles.length,
    emptyStateFiles: emptyStateTodo.length,
    placeholders: placeholders.length,
    supportedLocales: ['ko', 'en', 'zh', 'vi', 'es'],
    removedLocales: ['ru', 'pt']
  },
  tabLabels,
  h1Titles,
  emptyStateFiles: emptyStateTodo.map(f => ({ file: f })),
  placeholders
}

const outPath = join(ROOT, 'scripts', 'i18n-audit.json')
writeFileSync(outPath, JSON.stringify(audit, null, 2), 'utf-8')
console.log(`\n✅ Audit written to: ${outPath}`)
console.log(`\nSummary:`)
console.log(`  Tab Labels:     ${totalLabels}`)
console.log(`  H1 Titles:      ${h1Titles.length}`)
console.log(`  EmptyState:     ${emptyStateTodo.length} files need <EmptyState JSX>`)
console.log(`  Placeholders:   ${placeholders.length}`)
console.log(`  Locales:        ${audit.summary.supportedLocales.join(', ')}`)
console.log(`  Removed:        ${audit.summary.removedLocales.join(', ')}`)
