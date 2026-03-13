'use client'

import { useState } from 'react'
import { Info, Lock, Shield } from 'lucide-react'

interface Props { companyId: string | null }

const ROLES = [
  { key: 'SUPER_ADMIN', label: '최고 관리자', desc: '전체 시스템 관리 권한', perms: ['*'] },
  { key: 'HR_ADMIN', label: 'HR 관리자', desc: '인사/급여/평가 관리', perms: ['hr.*', 'payroll.*', 'performance.*'] },
  { key: 'HR_SPECIALIST', label: 'HR 담당자', desc: '일상 HR 업무 처리', perms: ['hr.view', 'hr.edit', 'leave.*'] },
  { key: 'MANAGER', label: '매니저', desc: '팀원 관리, 승인', perms: ['team.view', 'approval.*'] },
  { key: 'EMPLOYEE', label: '일반 직원', desc: '본인 정보 조회/수정', perms: ['self.view', 'self.edit'] },
  { key: 'VIEWER', label: '조회 전용', desc: '읽기 전용 접근', perms: ['*.view'] },
]

export function RolesTab({ companyId }: Props) {
  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[#1C1D21]">역할/권한</h3>
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600"><Lock className="h-3 w-3" />글로벌 고정</span>
          </div>
          <p className="text-sm text-[#8181A5]">RBAC 역할 정의 ({ROLES.length}개 역할)</p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-[#4F46E5]/20 bg-[#4F46E5]/5 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" />
        <p className="text-xs text-[#8181A5]">역할/권한은 시스템에서 관리됩니다. 변경이 필요하면 시스템 관리자에게 문의하세요.</p>
      </div>
      <div className="space-y-3">{ROLES.map((r) => (
        <div key={r.key} className="flex items-start gap-4 rounded-xl border border-[#F0F0F3] p-4 hover:bg-[#F5F5FA] transition-colors">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4F46E5]/10"><Shield className="h-5 w-5 text-[#4F46E5]" /></div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-[#1C1D21]">{r.label}</span>
              <span className="text-xs text-[#4F46E5]">{r.key}</span>
            </div>
            <p className="text-xs text-[#8181A5]">{r.desc}</p>
            <div className="mt-2 flex flex-wrap gap-1">{r.perms.map((p) => (
              <span key={p} className="rounded bg-[#F5F5FA] px-2 py-0.5 text-xs text-[#8181A5]">{p}</span>
            ))}</div>
          </div>
        </div>
      ))}</div>
    </div>
  )
}
