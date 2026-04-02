'use client'

// import { useState } from 'react'
import { Info, Lock, Shield } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Props { companyId: string | null }

const ROLES = [
  { key: 'SUPER_ADMIN', labelKey: 'roles.roleSuperAdmin', descKey: 'roles.roleSuperAdminDesc', perms: ['*'] },
  { key: 'HR_ADMIN', labelKey: 'roles.roleHrAdmin', descKey: 'roles.roleHrAdminDesc', perms: ['hr.*', 'payroll.*', 'performance.*'] },
  { key: 'HR_SPECIALIST', labelKey: 'roles.roleHrSpecialist', descKey: 'roles.roleHrSpecialistDesc', perms: ['hr.view', 'hr.edit', 'leave.*'] },
  { key: 'MANAGER', labelKey: 'roles.roleManager', descKey: 'roles.roleManagerDesc', perms: ['team.view', 'approval.*'] },
  { key: 'EMPLOYEE', labelKey: 'roles.roleEmployee', descKey: 'roles.roleEmployeeDesc', perms: ['self.view', 'self.edit'] },
  { key: 'VIEWER', labelKey: 'roles.roleViewer', descKey: 'roles.roleViewerDesc', perms: ['*.view'] },
]

export function RolesTab({
  companyId: _companyId }: Props) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{t('roles.title')}</h3>
            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600"><Lock className="h-3 w-3" />{tc('globalFixed')}</span>
          </div>
          <p className="text-sm text-muted-foreground">{t('roles.rbacDefinition', { count: ROLES.length })}</p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">{t('roles.systemManaged')}</p>
      </div>
      <div className="space-y-3">{ROLES.map((r) => (
        <div key={r.key} className="flex items-start gap-4 rounded-xl border border-border p-4 hover:bg-muted transition-colors">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Shield className="h-5 w-5 text-primary" /></div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-foreground">{t(r.labelKey)}</span>
              <span className="text-xs text-primary">{r.key}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t(r.descKey)}</p>
            <div className="mt-2 flex flex-wrap gap-1">{r.perms.map((p) => (
              <span key={p} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{p}</span>
            ))}</div>
          </div>
        </div>
      ))}</div>
    </div>
  )
}
