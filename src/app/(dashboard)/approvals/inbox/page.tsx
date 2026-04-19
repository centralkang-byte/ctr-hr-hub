// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Approval Inbox → Redirect to My Tasks
// 승인함이 나의 업무 승인 탭으로 통합됨 (2026-04-07 One Hub)
// 쿼리 파라미터는 /my/tasks로 forward — 북마크/외부 링크의 filter 등 유지
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'

export default async function ApprovalInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = new URLSearchParams()
  qs.set('tab', 'approvals')
  for (const [k, v] of Object.entries(params)) {
    if (k === 'tab') continue
    if (typeof v === 'string' && v !== '') qs.set(k, v)
    else if (Array.isArray(v)) {
      for (const x of v) if (x) qs.append(k, x)
    }
  }
  redirect(`/my/tasks?${qs.toString()}`)
}
