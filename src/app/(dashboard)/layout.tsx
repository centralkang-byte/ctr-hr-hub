// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Dashboard Layout (Server Component)
// 세션 확인 → Sidebar + Header + main content
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { BrandProvider } from '@/components/shared/BrandProvider'
import { CommandPalette } from '@/components/command-palette/CommandPalette'
import { HrChatbot } from '@/components/hr-chatbot/HrChatbot'
import { DashboardShell } from './DashboardShell'

// ─── Types ──────────────────────────────────────────────────

interface CompanyOption {
  id: string
  name: string
  nameEn: string | null
}

// ─── Layout ─────────────────────────────────────────────────

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  // Load companies for CompanySelector
  let companies: CompanyOption[] = []
  try {
    const canSeeAll = [ROLE.SUPER_ADMIN, ROLE.HR_ADMIN, ROLE.EXECUTIVE].includes(
      user.role as typeof ROLE.SUPER_ADMIN,
    )

    if (canSeeAll) {
      companies = await prisma.company.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, nameEn: true },
        orderBy: { name: 'asc' },
      })
    } else {
      const ownCompany = await prisma.company.findUnique({
        where: { id: user.companyId },
        select: { id: true, name: true, nameEn: true },
      })
      if (ownCompany) {
        companies = [ownCompany]
      }
    }
  } catch {
    // Fallback: empty companies list
  }

  return (
    <BrandProvider companyId={user.companyId}>
      <div className="flex h-screen overflow-hidden bg-ctr-gray-50">
        <DashboardShell user={user} companies={companies}>
          {children}
        </DashboardShell>
      </div>
      <CommandPalette />
      <HrChatbot />
    </BrandProvider>
  )
}
