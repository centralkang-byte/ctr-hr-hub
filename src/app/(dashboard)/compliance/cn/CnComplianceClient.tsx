'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Shield } from 'lucide-react'
import SocialInsuranceConfigTab from '@/components/compliance/cn/SocialInsuranceConfigTab'
import SocialInsuranceReportTab from '@/components/compliance/cn/SocialInsuranceReportTab'
import EmployeeRegistryTab from '@/components/compliance/cn/EmployeeRegistryTab'

type TabKey = 'config' | 'report' | 'registry'

export default function CnComplianceClient() {
  const t = useTranslations('compliance')
  const [activeTab, setActiveTab] = useState<TabKey>('config')

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'config', label: t('cn.config') },
    { key: 'report', label: '월간보고' },
    { key: 'registry', label: t('cn.employeeRegistry') },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('cn.title')}</h1>
          <p className="text-sm text-slate-500">{t('cn.socialInsurance')}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={
              activeTab === tab.key
                ? 'px-4 py-2.5 text-sm font-medium border-b-2 border-blue-600 text-blue-600'
                : 'px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'config' && <SocialInsuranceConfigTab />}
        {activeTab === 'report' && <SocialInsuranceReportTab />}
        {activeTab === 'registry' && <EmployeeRegistryTab />}
      </div>
    </div>
  )
}
