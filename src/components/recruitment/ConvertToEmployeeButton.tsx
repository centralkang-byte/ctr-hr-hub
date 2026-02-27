'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api'

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-ctr-primary hover:bg-ctr-primary/90">
          직원 전환
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{applicantName} — 직원 전환</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>사번 (선택 — 미입력 시 자동 생성)</Label>
            <Input
              placeholder="예: CTR-2025-0042"
              value={form.employeeNo}
              onChange={(e) => setForm((f) => ({ ...f, employeeNo: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>입사일 *</Label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <Button
            onClick={handleConvert}
            disabled={loading || !form.startDate}
            className="w-full bg-ctr-primary"
          >
            {loading ? '처리 중...' : '직원으로 전환'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
