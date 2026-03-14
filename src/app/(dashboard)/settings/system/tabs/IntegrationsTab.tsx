'use client'

import { useState } from 'react'
import { Info, Plug, ExternalLink } from 'lucide-react'

interface Props { companyId: string | null }

const INTEGRATIONS = [
  { key: 'teams', label: 'Microsoft Teams', desc: '웹훅 알림 연동', status: 'available', icon: '🔗' },
  { key: 'sso', label: 'SSO/SAML', desc: 'Single Sign-On 인증', status: 'available', icon: '🔐' },
  { key: 'erp', label: 'ERP 연동', desc: 'SAP, Oracle 등 ERP 데이터 동기화', status: 'planned', icon: '🏢' },
  { key: 'api', label: 'API 키 관리', desc: '외부 시스템 연동용 API 키', status: 'planned', icon: '🔑' },
  { key: 'slack', label: 'Slack', desc: 'Slack 채널 알림 연동', status: 'planned', icon: '💬' },
  { key: 'calendar', label: 'Google Calendar', desc: '일정 동기화', status: 'planned', icon: '📅' },
]

export function IntegrationsTab({ companyId }: Props) {
  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#1C1D21]">연동</h3>
        <p className="text-sm text-[#8181A5]">외부 시스템 연동 설정</p>
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-[#5E81F4]/20 bg-[#5E81F4]/5 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#5E81F4]" />
        <p className="text-xs text-[#8181A5]">ℹ️ 연동 기능은 향후 업데이트에서 지원 예정입니다.</p>
      </div>
      <div className="space-y-3">{INTEGRATIONS.map((int) => (
        <div key={int.key} className="flex items-center gap-4 rounded-xl border border-[#F0F0F3] p-4 hover:bg-[#F5F5FA] transition-colors">
          <span className="text-2xl">{int.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#1C1D21]">{int.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${int.status === 'available' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                {int.status === 'available' ? '사용 가능' : '예정'}
              </span>
            </div>
            <p className="text-xs text-[#8181A5]">{int.desc}</p>
          </div>
          {int.status === 'available' && <Plug className="h-4 w-4 text-[#8181A5]" />}
        </div>
      ))}</div>
    </div>
  )
}
