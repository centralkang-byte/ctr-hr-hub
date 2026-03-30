'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { BUTTON_VARIANTS,  MODAL_STYLES } from '@/lib/styles'

interface Props {
  applicationId: string
  applicantName: string
}

export default function ConvertToEmployeeButton({ applicationId, applicantName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    employeeNo: '',
    startDate: '',
    companyId: '',
    departmentId: '',
    jobGradeId: '',
  })

  const handleConvert = async () => {
    setLoading(true)
    try {
      await apiClient.post(
        `/api/v1/recruitment/applications/${applicationId}/convert-to-employee`,
        {
          employeeNo: form.employeeNo,
          startDate: form.startDate,
          companyId: form.companyId || undefined,
          departmentId: form.departmentId || undefined,
          jobGradeId: form.jobGradeId || undefined,
        },
      )
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`px-3 py-1.5 text-sm font-medium ${BUTTON_VARIANTS.primary} rounded-lg transition-colors duration-150`}
      >
        직원 전환
      </button>

      {open && (
        <div className={MODAL_STYLES.container}>
          <div className="bg-card rounded-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-bold text-foreground tracking-[-0.02em]">
                {applicantName} — 직원 전환
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-background text-[#999] transition-colors duration-150"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  사번 (선택 — 미입력 시 자동 생성)
                </label>
                <input
                  placeholder="예: CTR-2025-0042"
                  value={form.employeeNo}
                  onChange={(e) => setForm((f) => ({ ...f, employeeNo: e.target.value }))}
                  className="w-full px-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">입사일 *</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
                />
              </div>
              <button
                onClick={handleConvert}
                disabled={loading || !form.startDate}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ${BUTTON_VARIANTS.primary} rounded-lg transition-colors duration-150 disabled:opacity-50`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    처리 중...
                  </>
                ) : (
                  '직원으로 전환'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
