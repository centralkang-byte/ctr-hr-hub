#!/usr/bin/env tsx
/**
 * Cron 카탈로그 자동 추출기.
 *
 * Run: npx tsx scripts/handover/extract-cron-catalog.ts
 * Output: docs/handover/02_운영런북/04_Cron_카탈로그.md
 *
 * 동작: vercel.json crons + src/app/api/v1/cron/<name>/route.ts 코드를 스캔해서
 *      등록 vs 미등록 cron을 자동으로 매핑한 markdown 표 생성.
 *
 * 재실행 안전: 매번 동일한 markdown을 덮어쓰기. 등록 상태가 바뀌면 그대로 반영됨.
 */

import * as fs from 'fs'
import * as path from 'path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const VERCEL_JSON = path.join(REPO_ROOT, 'vercel.json')
const CRON_DIR = path.join(REPO_ROOT, 'src/app/api/v1/cron')
const OUT_FILE = path.join(REPO_ROOT, 'docs/handover/02_운영런북/04_Cron_카탈로그.md')

interface RegisteredCron {
  path: string
  schedule: string
}

interface CronHandler {
  name: string
  routeFile: string
  exists: boolean
  registered: boolean
  schedule: string | null
  apiPath: string
  firstLineComment: string | null
}

function readRegisteredCrons(): RegisteredCron[] {
  const raw = fs.readFileSync(VERCEL_JSON, 'utf8')
  const json = JSON.parse(raw)
  return (json.crons ?? []) as RegisteredCron[]
}

function listCronHandlers(): string[] {
  if (!fs.existsSync(CRON_DIR)) return []
  return fs
    .readdirSync(CRON_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

function firstDocComment(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  // Capture the first non-empty comment-ish line up to ~80 chars.
  for (const line of lines.slice(0, 30)) {
    const t = line.trim()
    if (!t) continue
    if (t.startsWith('//')) return t.replace(/^\/\/\s?/, '').slice(0, 120)
    if (t.startsWith('/*')) return t.replace(/^\/\*+\s?/, '').replace(/\*\/$/, '').slice(0, 120)
    if (t.startsWith('*')) return t.replace(/^\*+\s?/, '').slice(0, 120)
    if (t.startsWith('import') || t.startsWith('export')) break
  }
  return null
}

function buildHandlers(
  registered: RegisteredCron[],
  handlerNames: string[],
): CronHandler[] {
  const registeredByName = new Map<string, RegisteredCron>()
  for (const r of registered) {
    // path like "/api/v1/cron/nudge-batch"
    const name = r.path.split('/').filter(Boolean).pop()!
    registeredByName.set(name, r)
  }

  const seen = new Set<string>()
  const handlers: CronHandler[] = []

  for (const name of handlerNames) {
    seen.add(name)
    const routeFile = path.join(CRON_DIR, name, 'route.ts')
    const reg = registeredByName.get(name)
    handlers.push({
      name,
      routeFile: path.relative(REPO_ROOT, routeFile),
      exists: fs.existsSync(routeFile),
      registered: !!reg,
      schedule: reg?.schedule ?? null,
      apiPath: `/api/v1/cron/${name}`,
      firstLineComment: firstDocComment(routeFile),
    })
  }

  // Detect registered crons whose handler dir is missing (orphan registration)
  for (const r of registered) {
    const name = r.path.split('/').filter(Boolean).pop()!
    if (!seen.has(name)) {
      handlers.push({
        name,
        routeFile: `src/app/api/v1/cron/${name}/route.ts`,
        exists: false,
        registered: true,
        schedule: r.schedule,
        apiPath: r.path,
        firstLineComment: null,
      })
    }
  }

  return handlers.sort((a, b) => a.name.localeCompare(b.name))
}

function scheduleToHuman(schedule: string | null): string {
  if (!schedule) return '—'
  const map: Record<string, string> = {
    '0 0 * * *': '매일 00:00 UTC',
    '0 1 * * *': '매일 01:00 UTC (한국 10:00)',
    '0 15 * * *': '매일 15:00 UTC (한국 00:00)',
  }
  return map[schedule] ? `\`${schedule}\` (${map[schedule]})` : `\`${schedule}\``
}

function renderMarkdown(handlers: CronHandler[]): string {
  const registered = handlers.filter((h) => h.registered)
  const unregistered = handlers.filter((h) => !h.registered)
  const orphan = handlers.filter((h) => !h.exists && h.registered)
  const generatedAt = new Date().toISOString().slice(0, 10)

  const rows = handlers.map((h) => {
    const status = h.registered
      ? h.exists
        ? '🟢 등록·동작'
        : '🔴 등록·코드 없음'
      : h.exists
        ? '🟡 코드 있음·미등록'
        : '⚪ 없음'
    return `| \`${h.name}\` | ${status} | ${scheduleToHuman(h.schedule)} | \`${h.apiPath}\` | \`${h.routeFile}\` |`
  })

  return `# Cron 카탈로그

> **자동 생성**: \`npx tsx scripts/handover/extract-cron-catalog.ts\`
> **생성일**: ${generatedAt}
> **원본**: \`vercel.json\` crons 배열 + \`src/app/api/v1/cron/\` 핸들러 디렉토리
> ⚠️ 본 문서는 수동 편집 금지. 코드·vercel.json 변경 시 스크립트 재실행.

---

## 요약

| 분류 | 개수 |
|------|------|
| 코드 존재 + vercel.json 등록 = **실제 동작** | ${handlers.filter((h) => h.exists && h.registered).length} |
| 코드 존재하나 **vercel.json 미등록** = **비동작** | ${unregistered.length} |
| vercel.json 등록되었으나 코드 없음 (orphan) | ${orphan.length} |
| **전체 cron 핸들러** | ${handlers.length} |

---

## Cron 매트릭스

| 이름 | 상태 | 스케줄 | API Path | 소스 파일 |
|------|------|--------|----------|----------|
${rows.join('\n')}

---

## 비동작 cron (미등록)

다음 cron들은 코드는 존재하지만 \`vercel.json\` crons 배열에 등록되지 않아 **자동 실행되지 않습니다**:

${
  unregistered.length === 0
    ? '_없음._'
    : unregistered
        .map(
          (h) =>
            `- **\`${h.name}\`** (${h.apiPath}) — ${h.firstLineComment ?? '문서 주석 없음'}`,
        )
        .join('\n')
}

**임시 수동 트리거 방법** (인프라팀 참고):

\`\`\`bash
# CRON_SECRET 환경 변수 필요 (.env.example 참조)
curl -X GET \\
  -H "Authorization: Bearer $CRON_SECRET" \\
  https://hr.ctr.co.kr/api/v1/cron/<cron-name>
\`\`\`

**등록 절차** (\`vercel.json\` crons 배열에 추가):

\`\`\`json
{
  "crons": [
    { "path": "/api/v1/cron/<cron-name>", "schedule": "0 0 * * *" }
  ]
}
\`\`\`

등록 후 \`git push origin main\` → Vercel auto-deploy → 다음 스케줄에 자동 발화.

---

## 알려진 위험

- **\`leave-promotion\`**: 한국 근로기준법 §61 사용촉진 통보용. cron 미동작 시 인사담당자가 수동으로 회계연도 종료 60/30/10일 전 통보·이력 기록 필요. (매뉴얼 \`docs/manuals/leave.md\` §9 #10·#11 참조)
- **\`eval-reminder\`**: 평가 마감 D-day 경과 시 HR 에스컬레이션 알림용. 미동작 시 평가 미제출자 발견 지연.
- **\`overdue-check\`**: 결재 over-due 알림. 미동작 시 결재함에서 stuck 발견 지연.
- **\`org-snapshot\`**: 조직도 일일 스냅샷. 미동작 시 분석 대시보드 일별 변화 추적 불가.
- **\`auto-acknowledge\`**: 자동 acknowledge 처리. 미동작 시 acknowledge 큐 누적.

---

## 운영 SOP

1. **매월 1일**: 본 카탈로그 재생성 후 등록 상태 변화 확인.
2. **신규 cron 추가 시**:
   - \`src/app/api/v1/cron/<name>/route.ts\` 작성
   - \`vercel.json\` crons에 path + schedule 추가
   - 본 카탈로그 재생성 후 PR 머지
   - 첫 실행 후 Sentry/Vercel logs로 동작 확인
3. **cron 삭제 시**:
   - \`vercel.json\`에서 먼저 제거 → 배포
   - 다음 스케줄 1회 skip 확인 후 코드 삭제
4. **장애 대응**: cron 실패 시 Vercel logs → Sentry → 수동 트리거 (위 curl 명령)

---

_본 문서 끝._
`
}

function main() {
  const registered = readRegisteredCrons()
  const handlerNames = listCronHandlers()
  const handlers = buildHandlers(registered, handlerNames)
  const md = renderMarkdown(handlers)
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, md)
  console.log(`✓ ${path.relative(REPO_ROOT, OUT_FILE)}`)
  console.log(`  Registered: ${handlers.filter((h) => h.registered).length}`)
  console.log(`  Unregistered: ${handlers.filter((h) => !h.registered).length}`)
  console.log(`  Orphan (registered, no code): ${handlers.filter((h) => !h.exists && h.registered).length}`)
}

main()
