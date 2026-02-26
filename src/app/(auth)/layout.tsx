// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Auth Layout
// 인증 페이지 래퍼 (사이드바 없음)
// ═══════════════════════════════════════════════════════════

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-screen">{children}</div>
}
