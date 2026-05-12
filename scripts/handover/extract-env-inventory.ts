#!/usr/bin/env tsx
/**
 * 환경 변수 인벤토리 자동 추출기.
 *
 * Run: npx tsx scripts/handover/extract-env-inventory.ts
 * Output: docs/handover/03_보안_환경변수_인벤토리.md (보안 문서가 import)
 *
 * 동작:
 *   1. .env.example 의 모든 변수 추출 (값 X, 변수명만)
 *   2. src/**\/*.ts(x) 안 process.env.XXX 참조 grep → 사용 위치 매핑
 *   3. 변수를 카테고리별로 묶어서 markdown 표 생성
 *
 * 재실행 안전: 매번 동일한 markdown을 덮어쓰기.
 */

import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const ENV_EXAMPLE = path.join(REPO_ROOT, '.env.example')
const SRC_DIR = path.join(REPO_ROOT, 'src')
const OUT_FILE = path.join(REPO_ROOT, 'docs/handover/03_보안_환경변수_인벤토리.md')

interface EnvVar {
  name: string
  category: string
  exampleHasIt: boolean
  usageCount: number
  topUsageFiles: string[]
  publicClient: boolean
  required: '필수' | '선택' | '미확정'
}

function categorize(name: string): string {
  if (name.startsWith('DATABASE_') || name.startsWith('DIRECT_') || name === 'DATABASE_POOL_SIZE') return '데이터베이스 (Supabase)'
  if (name.startsWith('NEXTAUTH_') || name.startsWith('AZURE_AD_')) return '인증 (NextAuth + Azure AD)'
  if (name.startsWith('AWS_') || name === 'S3_BUCKET' || name === 'SES_FROM_EMAIL') return 'AWS (S3 + SES)'
  if (name.startsWith('ANTHROPIC_') || name.startsWith('OPENAI_') || name === 'EMBEDDING_PROVIDER') return 'AI (Anthropic + OpenAI)'
  if (name.startsWith('REDIS_') || name.startsWith('UPSTASH_')) return '캐시 (Redis / Upstash)'
  if (name.startsWith('SENTRY_') || name === 'NEXT_PUBLIC_SENTRY_DSN') return '모니터링 (Sentry)'
  if (name.startsWith('FIREBASE_')) return '푸시 알림 (Firebase)'
  if (name.startsWith('TEAMS_')) return 'Teams 알림'
  if (name.startsWith('VAPID_') || name === 'WEB_PUSH_EMAIL') return '웹 푸시 (VAPID)'
  if (name === 'CRON_SECRET') return 'Cron 인증'
  if (name.startsWith('TERMINAL_')) return '출퇴근 단말기'
  if (name.startsWith('NEXT_PUBLIC_')) return '클라이언트 노출 (NEXT_PUBLIC_*)'
  if (name === 'NODE_ENV' || name === 'VERCEL_ENV' || name === 'VERCEL_URL') return 'Vercel 플랫폼'
  return '기타'
}

function isLikelyRequired(name: string): '필수' | '선택' | '미확정' {
  const required = [
    'DATABASE_URL', 'DIRECT_URL',
    'NEXTAUTH_URL', 'NEXTAUTH_SECRET',
    'AZURE_AD_CLIENT_ID', 'AZURE_AD_CLIENT_SECRET', 'AZURE_AD_TENANT_ID',
    'CRON_SECRET',
  ]
  const optional = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'REDIS_URL']
  if (required.includes(name)) return '필수'
  if (optional.includes(name)) return '선택'
  return '미확정'
}

function readEnvExample(): Set<string> {
  if (!fs.existsSync(ENV_EXAMPLE)) return new Set()
  const lines = fs.readFileSync(ENV_EXAMPLE, 'utf8').split('\n')
  const vars = new Set<string>()
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=/)
    if (m) vars.add(m[1])
  }
  return vars
}

function grepProcessEnv(): Map<string, { count: number; files: Set<string> }> {
  // execFileSync: no shell, args passed as array — injection-safe.
  // Patterns and paths are hardcoded constants, no user input.
  const usage = new Map<string, { count: number; files: Set<string> }>()
  let out = ''
  try {
    out = execFileSync(
      'grep',
      [
        '-rno',
        '--include=*.ts',
        '--include=*.tsx',
        'process\\.env\\.[A-Z_][A-Z0-9_]*',
        SRC_DIR,
      ],
      { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
    )
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    if (e.status !== 1) console.warn('grep warning:', e.message)
    return usage
  }
  for (const line of out.split('\n')) {
    if (!line) continue
    const [file, _lineNo, ...rest] = line.split(':')
    const match = rest.join(':')
    const m = match.match(/process\.env\.([A-Z_][A-Z0-9_]*)/)
    if (!m) continue
    const varName = m[1]
    const rel = path.relative(REPO_ROOT, file)
    if (!usage.has(varName)) usage.set(varName, { count: 0, files: new Set() })
    const u = usage.get(varName)!
    u.count++
    u.files.add(rel)
  }
  return usage
}

function buildEnvVars(envExampleVars: Set<string>, usage: Map<string, { count: number; files: Set<string> }>): EnvVar[] {
  const allNames = new Set<string>([...envExampleVars, ...usage.keys()])
  const out: EnvVar[] = []
  for (const name of [...allNames].sort()) {
    const u = usage.get(name)
    const topFiles = u ? [...u.files].slice(0, 3) : []
    out.push({
      name,
      category: categorize(name),
      exampleHasIt: envExampleVars.has(name),
      usageCount: u?.count ?? 0,
      topUsageFiles: topFiles,
      publicClient: name.startsWith('NEXT_PUBLIC_'),
      required: isLikelyRequired(name),
    })
  }
  return out
}

function renderMarkdown(vars: EnvVar[]): string {
  const generatedAt = new Date().toISOString().slice(0, 10)
  const byCategory = new Map<string, EnvVar[]>()
  for (const v of vars) {
    if (!byCategory.has(v.category)) byCategory.set(v.category, [])
    byCategory.get(v.category)!.push(v)
  }

  const total = vars.length
  const inExample = vars.filter((v) => v.exampleHasIt).length
  const used = vars.filter((v) => v.usageCount > 0).length
  const inExampleButUnused = vars.filter((v) => v.exampleHasIt && v.usageCount === 0)
  const usedButNotInExample = vars.filter((v) => !v.exampleHasIt && v.usageCount > 0)
  const publicVars = vars.filter((v) => v.publicClient)

  let md = `# 환경 변수 인벤토리

> **자동 생성**: \`npx tsx scripts/handover/extract-env-inventory.ts\`
> **생성일**: ${generatedAt}
> **원본**: \`.env.example\` + \`src/**/*.ts(x)\` 내 \`process.env.*\` 참조
> ⚠️ 본 문서는 수동 편집 금지. \`.env.example\` 또는 코드 변경 시 스크립트 재실행.
> 본 문서는 \`docs/handover/03_보안_접근권한.md\` 의 일부로 import 됩니다.

---

## 요약

| 분류 | 개수 |
|------|------|
| 전체 환경 변수 | ${total} |
| \`.env.example\` 등록 | ${inExample} |
| 코드에서 실제 사용 중 | ${used} |
| .env.example에 있으나 코드 미사용 (cleanup 후보) | ${inExampleButUnused.length} |
| 코드에서 사용하나 .env.example 누락 (⚠️ 신규 추가 필요) | ${usedButNotInExample.length} |
| **클라이언트 노출** (\`NEXT_PUBLIC_*\`) | ${publicVars.length} |

---

## ⚠️ 즉시 조치 필요

`

  if (usedButNotInExample.length > 0) {
    md += `### .env.example 누락 (코드에서 사용 중)

다음 변수들은 코드에서 참조되지만 \`.env.example\` 에 문서화되지 않았습니다. **인계 전 .env.example 에 추가 필수**:

| 변수명 | 사용 위치 | 사용 횟수 |
|--------|----------|----------|
${usedButNotInExample
  .map(
    (v) =>
      `| \`${v.name}\` | ${v.topUsageFiles.map((f) => `\`${f}\``).join(', ')} | ${v.usageCount} |`,
  )
  .join('\n')}

`
  } else {
    md += `_.env.example 누락 항목 없음._\n\n`
  }

  if (inExampleButUnused.length > 0) {
    md += `### 미사용 변수 (cleanup 후보)

\`.env.example\` 에 있지만 \`src/\` 어디서도 참조하지 않는 변수들. **삭제 검토 또는 사용처 추적**:

${inExampleButUnused.map((v) => `- \`${v.name}\``).join('\n')}

`
  }

  md += `---

## 카테고리별 환경 변수

`

  for (const [category, list] of byCategory) {
    md += `### ${category} (${list.length}개)\n\n`
    md += `| 변수명 | 필수 | env.example | 코드 사용 | 클라이언트 노출 |\n`
    md += `|--------|:----:|:-----------:|:---------:|:---------------:|\n`
    for (const v of list) {
      const reqEmoji = v.required === '필수' ? '✅' : v.required === '선택' ? '⬜' : '❓'
      const exEmoji = v.exampleHasIt ? '✅' : '❌'
      const useEmoji = v.usageCount > 0 ? `✅ (${v.usageCount})` : '❌'
      const pubEmoji = v.publicClient ? '🌐 노출' : '🔒 서버'
      md += `| \`${v.name}\` | ${reqEmoji} | ${exEmoji} | ${useEmoji} | ${pubEmoji} |\n`
    }
    md += '\n'
  }

  md += `---

## 시크릿 회수·교체 SOP

인계 시점에 **반드시** 회전해야 하는 시크릿 (CEO 개인 계정 의존):

| 변수 | 회수 절차 | 교체 빈도 |
|------|----------|----------|
| \`NEXTAUTH_SECRET\` | \`openssl rand -base64 32\` 재생성 → Vercel env 갱신 → 배포 → 모든 세션 invalidate | 인계 직후 |
| \`AZURE_AD_CLIENT_SECRET\` | Azure Portal → 앱 등록 → 새 client secret 생성 → 이전 만료 | 인계 직후 + 6개월마다 |
| \`AWS_ACCESS_KEY_ID\` / \`AWS_SECRET_ACCESS_KEY\` | IAM 사용자 새 키 발급 → Vercel 갱신 → 이전 키 삭제 | 인계 직후 + 6개월마다 |
| \`ANTHROPIC_API_KEY\` | Anthropic console → 새 키 발급 → 이전 키 revoke | 인계 직후 |
| \`OPENAI_API_KEY\` | OpenAI console → 새 키 발급 → 이전 키 revoke | 인계 직후 |
| \`CRON_SECRET\` | \`openssl rand -base64 32\` → Vercel env 갱신 → 배포 | 인계 직후 + 6개월마다 |
| \`FIREBASE_PRIVATE_KEY\` | Firebase console → 서비스 계정 새 키 발급 → 이전 키 삭제 | 인계 직후 |
| \`TEAMS_BOT_PASSWORD\` / \`TEAMS_WEBHOOK_SECRET\` | Azure AD bot 새 password → Vercel 갱신 | 인계 직후 |
| \`VAPID_PRIVATE_KEY\` | \`web-push generate-vapid-keys\` → 클라이언트에 새 public 키 배포 | 변경 시 모든 구독자 재구독 필요 — 신중 |

## 환경 변수 수정 절차 (Session 212 패턴)

\`\`\`bash
# 1. 추가
vercel env add VAR_NAME production

# 2. 확인
vercel env ls

# 3. 회수
vercel env rm VAR_NAME production

# 4. 로컬 .env 동기화
vercel env pull .env.local

# 5. 변경 후 재배포
vercel redeploy <deployment-id> --prod
\`\`\`

⚠️ \`vercel env add/rm\`은 preview/development 환경에도 함께 영향 줄 수 있음 — environment 명시 필수.

---

_본 문서 끝._
`

  return md
}

function main() {
  const envExampleVars = readEnvExample()
  const usage = grepProcessEnv()
  const vars = buildEnvVars(envExampleVars, usage)
  const md = renderMarkdown(vars)
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, md)
  console.log(`✓ ${path.relative(REPO_ROOT, OUT_FILE)}`)
  console.log(`  Total: ${vars.length}`)
  console.log(`  In .env.example: ${vars.filter((v) => v.exampleHasIt).length}`)
  console.log(`  Used in code: ${vars.filter((v) => v.usageCount > 0).length}`)
  console.log(`  Missing from .env.example: ${vars.filter((v) => !v.exampleHasIt && v.usageCount > 0).length}`)
}

main()
