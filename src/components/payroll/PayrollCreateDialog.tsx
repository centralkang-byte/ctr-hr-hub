'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient } from '@/lib/api'

const RUN_TYPE_LABELS: Record<string, string> = {
  MONTHLY: '월급',
  BONUS: '상여금',
  SEVERANCE: '퇴직금',
  SPECIAL: '특별',
}

interface PayrollCreateDialogProps {
  onCreated: () => void
}

export default function PayrollCreateDialog({ onCreated }: PayrollCreateDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [runType, setRunType] = useState('MONTHLY')

  const now = new Date()
  const defaultYearMonth = format(now, 'yyyy-MM')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const yearMonth = (form.get('yearMonth') as string) || defaultYearMonth
    const [year, month] = yearMonth.split('-').map(Number)
    const periodDate = new Date(year, month - 1, 1)

    try {
      await apiClient.post('/api/v1/payroll/runs', {
        name: form.get('name') || `${yearMonth} ${RUN_TYPE_LABELS[runType]}`,
        runType,
        yearMonth,
        periodStart: startOfMonth(periodDate).toISOString(),
        periodEnd: endOfMonth(periodDate).toISOString(),
        payDate: form.get('payDate') || undefined,
      })
      setOpen(false)
      onCreated()
    } catch {
      // error handled by apiClient
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="h-4 w-4 mr-1" />
          급여 실행 생성
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>급여 실행 생성</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="yearMonth">급여 기간</Label>
            <Input
              id="yearMonth"
              name="yearMonth"
              type="month"
              defaultValue={defaultYearMonth}
              required
            />
          </div>
          <div>
            <Label htmlFor="runType">유형</Label>
            <Select value={runType} onValueChange={setRunType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RUN_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="name">실행명 (선택)</Label>
            <Input
              id="name"
              name="name"
              placeholder={`${defaultYearMonth} ${RUN_TYPE_LABELS[runType]}`}
            />
          </div>
          <div>
            <Label htmlFor="payDate">지급 예정일 (선택)</Label>
            <Input id="payDate" name="payDate" type="date" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? '생성 중...' : '생성'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
