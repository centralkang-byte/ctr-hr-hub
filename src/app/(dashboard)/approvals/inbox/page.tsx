// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Approval Inbox → Redirect to My Tasks
// 승인함이 나의 업무 승인 탭으로 통합됨 (2026-04-07 One Hub)
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'

export default function ApprovalInboxPage() {
  redirect('/my/tasks?tab=approvals')
}
