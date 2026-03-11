'use client'

import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import type { AssignmentRulesSetting } from '@/types/process-settings'

interface Props { companyId: string | null }

const DEFAULTS: AssignmentRulesSetting = {
  rules: [
    { code: 'PROMOTION', label: '승진', desc: '직급 상향 변경', requiresApproval: true },
    { code: 'TRANSFER', label: '전보', desc: '부서 이동', requiresApproval: true },
    { code: 'ROTATION', label: '순환보직', desc: '직무 순환 배치', requiresApproval: true },
    { code: 'SECONDMENT', label: '파견', desc: '타 법인/기관 파견', requiresApproval: true },
    { code: 'CONCURRENT', label: '겸직', desc: '2개 이상 직무 겸임', requiresApproval: true },
    { code: 'LEAVE_OF_ABSENCE', label: '휴직', desc: '육아/병가 등 장기 휴직', requiresApproval: true },
    { code: 'REINSTATEMENT', label: '복직', desc: '휴직 후 복귀', requiresApproval: false },
    { code: 'DEMOTION', label: '강등', desc: '직급 하향 변경', requiresApproval: true },
  ],
}

export function AssignmentRulesTab({ companyId }: Props) {
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<AssignmentRulesSetting>({
    category: 'organization',
    key: 'assignment-rules',
    companyId,
    defaults: DEFAULTS,
    description: '발령 유형별 승인 규칙',
    merge: (raw, defs) => ({
      rules: Array.isArray(raw.rules) ? (raw.rules as AssignmentRulesSetting['rules']) : defs.rules,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  const toggleApproval = (i: number) => {
    const next = structuredClone(settings)
    next.rules[i].requiresApproval = !next.rules[i].requiresApproval
    setSettings(next)
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1C1D21]">발령 규칙</h3>
          <p className="text-sm text-[#8181A5]">발령 유형 및 승인 절차 설정</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">법인 오버라이드</span>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[#F0F0F3]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F0F0F3] bg-[#F5F5FA]">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#8181A5]">코드</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#8181A5]">유형</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#8181A5]">설명</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[#8181A5]">승인 필요</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F3]">
            {settings.rules.map((t, i) => (
              <tr key={t.code} className="hover:bg-[#F5F5FA] transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-[#5E81F4]">{t.code}</td>
                <td className="px-4 py-3 text-sm font-medium text-[#1C1D21]">{t.label}</td>
                <td className="px-4 py-3 text-sm text-[#8181A5]">{t.desc}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleApproval(i)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${t.requiresApproval ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                  >
                    {t.requiresApproval ? '필수' : '불필요'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={revert} disabled={!hasChanges}>
          <RotateCcw className="mr-2 h-4 w-4" />되돌리기
        </Button>
        <Button className="bg-[#5E81F4] text-white hover:bg-[#4A6FE0]" onClick={save} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}저장
        </Button>
      </div>
    </div>
  )
}
