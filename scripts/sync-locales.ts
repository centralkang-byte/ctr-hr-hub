import fs from 'fs'
import path from 'path'

const LOCALES_DIR = path.join(process.cwd(), 'messages')
const MASTER = 'ko'
const TARGETS = ['en', 'zh', 'vi', 'es']

function getAllKeys(obj: any, prefix = ''): string[] {
  const keys: string[] = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...getAllKeys(obj[key], fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

function setNestedKey(obj: any, keyPath: string, value: string) {
  const parts = keyPath.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {}
    current = current[parts[i]]
  }
  if (current[parts[parts.length - 1]] === undefined) {
    current[parts[parts.length - 1]] = value
  }
}

function getNestedValue(obj: any, keyPath: string): string | undefined {
  const parts = keyPath.split('.')
  let current = obj
  for (const part of parts) {
    if (!current || !current[part]) return undefined
    current = current[part]
  }
  return typeof current === 'string' ? current : undefined
}

// Read master
const master = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${MASTER}.json`), 'utf8'))
const masterKeys = getAllKeys(master)

console.log(`Master (${MASTER}): ${masterKeys.length} keys`)

for (const locale of TARGETS) {
  const filePath = path.join(LOCALES_DIR, `${locale}.json`)
  const target = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const targetKeys = getAllKeys(target)
  
  let added = 0
  for (const key of masterKeys) {
    if (getNestedValue(target, key) === undefined) {
      // For 'en', try to use English translation if obvious, otherwise empty
      setNestedKey(target, key, '')
      added++
    }
  }
  
  // Remove keys not in master
  let removed = 0
  for (const key of targetKeys) {
    if (!masterKeys.includes(key)) {
      // Don't remove — might be locale-specific. Just log.
      console.log(`  [${locale}] Extra key: ${key}`)
    }
  }
  
  fs.writeFileSync(filePath, JSON.stringify(target, null, 2) + '\n', 'utf8')
  console.log(`${locale}: +${added} keys added, ${targetKeys.length + added} total`)
}
