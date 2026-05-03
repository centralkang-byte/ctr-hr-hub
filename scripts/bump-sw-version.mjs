// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Service Worker version stamper
// Generates public/sw.js from public/sw.template.js with a per-build
// CACHE_VERSION. Runs in predev/prebuild so every dev start and every
// CI deploy yields a byte-different sw.js — browsers detect the change
// and trigger the update flow handled by ServiceWorkerRegistrar.
//
// Version format: <sha7>-<timestamp>
//   - sha7: short commit SHA from VERCEL_GIT_COMMIT_SHA / GITHUB_SHA / 'dev'
//   - timestamp: Date.now() at script run, ensures redeploys/rollbacks of
//     the same commit still produce a new version (Codex Gate 1 finding).
// ═══════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const templatePath = resolve(root, 'public/sw.template.js')
const outputPath = resolve(root, 'public/sw.js')

const sha =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.GITHUB_SHA?.slice(0, 7) ??
  'dev'
const version = `${sha}-${Date.now()}`

const template = readFileSync(templatePath, 'utf8')
if (!template.includes('__CACHE_VERSION__')) {
  console.error(
    '✗ public/sw.template.js missing __CACHE_VERSION__ placeholder. Refusing to overwrite public/sw.js.',
  )
  process.exit(1)
}

const output = template.replaceAll('__CACHE_VERSION__', version)
writeFileSync(outputPath, output)
console.log(`✓ Generated public/sw.js (CACHE_VERSION=${version})`)
