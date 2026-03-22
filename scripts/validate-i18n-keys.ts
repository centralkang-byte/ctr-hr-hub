/**
 * i18n 키 검증 스크립트 — 빌드 타임에 누락 키를 잡는 근원적 해결
 *
 * 사용법:
 *   npx tsx scripts/validate-i18n-keys.ts          # 검증만 (CI용, exit 1 on failure)
 *   npx tsx scripts/validate-i18n-keys.ts --fix     # 누락 키 자동 추가 (ko 기준 → 다른 locale 빈 문자열)
 *
 * 동작:
 *   1. src/ 전체에서 useTranslations('namespace') 호출을 추출
 *   2. 해당 변수의 t('key'), t('key.nested') 호출을 추출
 *   3. messages/ko.json 기준으로 키 존재 여부 검증
 *   4. 다른 locale(en/zh/vi/es)에 ko 대비 누락 키 검증
 */

import fs from 'fs'
import path from 'path'
import { glob } from 'glob'

const MESSAGES_DIR = path.join(process.cwd(), 'messages')
const SRC_DIR = path.join(process.cwd(), 'src')
const MASTER_LOCALE = 'ko'
const ALL_LOCALES = ['ko', 'en', 'zh', 'vi', 'es']
const FIX_MODE = process.argv.includes('--fix')

// ─── JSON helpers ────────────────────────────────────────

function loadJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function getAllKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return []
  const keys: string[] = []
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const full = prefix ? `${prefix}.${key}` : key
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      keys.push(...getAllKeys(val, full))
    } else {
      keys.push(full)
    }
  }
  return keys
}

function hasKey(obj: unknown, keyPath: string): boolean {
  const parts = keyPath.split('.')
  let current = obj as Record<string, unknown>
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) return false
    current = current[part] as Record<string, unknown>
  }
  return true
}

function setNestedKey(obj: Record<string, unknown>, keyPath: string, value: string) {
  const parts = keyPath.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {}
    }
    current = current[parts[i]] as Record<string, unknown>
  }
  const lastKey = parts[parts.length - 1]
  if (current[lastKey] === undefined) {
    current[lastKey] = value
  }
}

// ─── Source code extraction ──────────────────────────────

interface TranslationUsage {
  namespace: string
  key: string
  file: string
  line: number
}

function extractTranslationKeys(filePath: string): TranslationUsage[] {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const usages: TranslationUsage[] = []

  // Step 1: Find useTranslations calls and map variable → namespace
  const varToNamespace = new Map<string, string>()
  const useTranslationsRegex = /const\s+(\w+)\s*=\s*useTranslations\(\s*['"]([^'"]+)['"]\s*\)/g

  for (const line of lines) {
    let match
    while ((match = useTranslationsRegex.exec(line)) !== null) {
      varToNamespace.set(match[1], match[2])
    }
  }

  if (varToNamespace.size === 0) return usages

  // Step 2: Find t('key') calls for each variable
  for (const [varName, namespace] of varToNamespace) {
    // Match: varName('key'), varName('key.nested'), varName(`template`)
    // Skip dynamic keys: varName(variable), varName(`${expr}`)
    const callRegex = new RegExp(`\\b${varName}\\(\\s*'([^']+)'\\s*[,)]`, 'g')
    const callRegex2 = new RegExp(`\\b${varName}\\(\\s*"([^"]+)"\\s*[,)]`, 'g')

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum]
      let match
      while ((match = callRegex.exec(line)) !== null) {
        usages.push({
          namespace,
          key: match[1],
          file: filePath,
          line: lineNum + 1,
        })
      }
      while ((match = callRegex2.exec(line)) !== null) {
        usages.push({
          namespace,
          key: match[1],
          file: filePath,
          line: lineNum + 1,
        })
      }
    }
  }

  return usages
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log('i18n 키 검증 시작...\n')

  // Load all locale files
  const localeData: Record<string, Record<string, unknown>> = {}
  for (const locale of ALL_LOCALES) {
    localeData[locale] = loadJson(path.join(MESSAGES_DIR, `${locale}.json`))
  }

  // Find all source files
  const files = await glob('**/*.{tsx,ts}', {
    cwd: SRC_DIR,
    absolute: true,
    ignore: ['**/*.d.ts', '**/*.test.*', '**/node_modules/**'],
  })

  // Extract all translation key usages
  const allUsages: TranslationUsage[] = []
  for (const file of files) {
    allUsages.push(...extractTranslationKeys(file))
  }

  // Deduplicate: unique namespace.key pairs
  const uniqueKeys = new Map<string, TranslationUsage[]>()
  for (const usage of allUsages) {
    const fullKey = `${usage.namespace}.${usage.key}`
    if (!uniqueKeys.has(fullKey)) uniqueKeys.set(fullKey, [])
    uniqueKeys.get(fullKey)!.push(usage)
  }

  console.log(`[scan] files: ${files.length}`)
  console.log(`[keys] unique: ${uniqueKeys.size}`)
  console.log(`[calls] total: ${allUsages.length}\n`)

  // Phase 1: Check code keys against master (ko.json)
  const missingInMaster: Array<{ fullKey: string; usages: TranslationUsage[] }> = []
  for (const [fullKey, usages] of uniqueKeys) {
    const [namespace, ...keyParts] = fullKey.split('.')
    const key = keyParts.join('.')
    const namespaceObj = localeData[MASTER_LOCALE][namespace]
    if (!hasKey(namespaceObj, key)) {
      missingInMaster.push({ fullKey, usages })
    }
  }

  // Phase 2: Check locale sync (ko keys missing in other locales)
  const masterKeys = getAllKeys(localeData[MASTER_LOCALE])
  const missingInLocales: Record<string, string[]> = {}
  for (const locale of ALL_LOCALES.filter(l => l !== MASTER_LOCALE)) {
    const missing: string[] = []
    for (const key of masterKeys) {
      if (!hasKey(localeData[locale], key)) {
        missing.push(key)
      }
    }
    if (missing.length > 0) {
      missingInLocales[locale] = missing
    }
  }

  // ─── Report ──────────────────────────────────────────

  let hasErrors = false

  if (missingInMaster.length > 0) {
    hasErrors = true
    console.log(`[FAIL] ko.json missing ${missingInMaster.length} keys:\n`)
    for (const { fullKey, usages } of missingInMaster) {
      const loc = usages[0]
      const relFile = path.relative(process.cwd(), loc.file)
      console.log(`   ${fullKey}`)
      console.log(`     -> ${relFile}:${loc.line}`)
    }
    // show all missing keys (no truncation)
    console.log()
  }

  if (Object.keys(missingInLocales).length > 0) {
    hasErrors = true
    console.log('[FAIL] locale sync issues:\n')
    for (const [locale, missing] of Object.entries(missingInLocales)) {
      console.log(`   ${locale}.json: ${missing.length} keys missing vs ko.json`)
      for (const key of missing.slice(0, 5)) {
        console.log(`     - ${key}`)
      }
      if (missing.length > 5) {
        console.log(`     ... and ${missing.length - 5} more`)
      }
    }
    console.log()
  }

  // ─── Fix mode ────────────────────────────────────────

  if (FIX_MODE && Object.keys(missingInLocales).length > 0) {
    console.log('[fix] Adding missing keys...\n')
    for (const [locale, missing] of Object.entries(missingInLocales)) {
      const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
      const data = localeData[locale]
      for (const keyPath of missing) {
        // ko 값을 placeholder로 복사 (번역 필요 표시)
        const parts = keyPath.split('.')
        let koVal = localeData[MASTER_LOCALE] as unknown
        for (const p of parts) {
          koVal = (koVal as Record<string, unknown>)?.[p]
        }
        const value = typeof koVal === 'string' ? `[TODO:${locale}] ${koVal}` : ''
        setNestedKey(data as Record<string, unknown>, keyPath, value)
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
      console.log(`   ${locale}.json: ${missing.length} keys added`)
    }
    console.log()
  }

  // ─── Summary ─────────────────────────────────────────

  if (!hasErrors) {
    console.log('[PASS] All i18n keys exist in all locales.\n')
    process.exit(0)
  } else {
    if (!FIX_MODE) {
      console.log('Tip: npx tsx scripts/validate-i18n-keys.ts --fix\n')
    }
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('i18n validation error:', err)
  process.exit(1)
})
