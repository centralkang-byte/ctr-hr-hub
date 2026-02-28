'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/compensation'

interface PayrollAdjustDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  runId: string
  item: {
    id: string
    employeeName: string
    baseSalary: number
    overtimePay: number
    bonus: number
    allowances: number
    deductions: number
    grossPay: number
    netPay: number
  }
  onAdjusted: () => void
}

export default function PayrollAdjustDialog({
  open,
  onOpenChange,
  runId,
  item,
  onAdjusted,
}: PayrollAdjustDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const adjustmentReason = form.get('adjustmentReason') as string

    const body: Record<string, unknown> = { adjustmentReason }

    const fields = ['baseSalary', 'overtimePay', 'bonus', 'allowances', 'deductions'] as const
    for (const field of fields) {
      const val = form.get(field) as string
      if (val) body[field] = Number(val)
    }

    try {
      await apiClient.put(`/api/v1/payroll/runs/${runId}/items/${item.id}`, body)
      onOpenChange(false)
      onAdjusted()
    } catch {
      // error handled by apiClient
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>급여 수동 조정 — {item.employeeName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>기본급</Label>
              <Input name="baseSalary" type="number" defaultValue={item.baseSalary} />
              <p className="text-xs text-slate-400 mt-0.5">현재: {formatCurrency(item.baseSalary)}</p>
            </div>
            <div>
              <Label>초과근무수당</Label>
              <Input name="overtimePay" type="number" defaultValue={item.overtimePay} />
            </div>
            <div>
              <Label>상여금</Label>
              <Input name="bonus" type="number" defaultValue={item.bonus} />
            </div>
            <div>
              <Label>수당</Label>
              <Input name="allowances" type="number" defaultValue={item.allowances} />
            </div>
            <div>
              <Label>공제액 (수동)</Label>
              <Input name="deductions" type="number" defaultValue={item.deductions} />
            </div>
          </div>
          <div>
            <Label htmlFor="adjustmentReason">조정 사유 *</Label>
            <Textarea
              id="adjustmentReason"
              name="adjustmentReason"
              required
              placeholder="조정 사유를 입력하세요"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? '저장 중...' : '저장'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
