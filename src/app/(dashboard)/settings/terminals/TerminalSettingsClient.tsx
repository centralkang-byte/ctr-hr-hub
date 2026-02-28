'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Terminal Settings Client
// 출퇴근 단말기 관리 (CRUD + Secret 재발급)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, RefreshCw, Copy, Loader2 } from 'lucide-react'

import type { SessionUser, PaginationInfo } from '@/types'
import { apiClient } from '@/lib/api'
import { ko } from '@/lib/i18n/ko'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ─── Local interface (matching API response) ─────────────

interface TerminalLocal {
  id: string
  terminalCode: string
  terminalType: string
  locationName: string
  ipAddress: string | null
  isActive: boolean
  lastHeartbeatAt: string | null
  companyId: string
  createdAt: string
}

// ─── Form schema ─────────────────────────────────────────

const formSchema = z.object({
  terminalCode: z.string().min(1, '단말기 코드는 필수입니다').max(50),
  terminalType: z.enum(['BIOMETRIC', 'CARD', 'QR', 'FACE']),
  locationName: z.string().min(1, '설치 위치는 필수입니다').max(200),
  ipAddress: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

// ─── Terminal type label map ─────────────────────────────

const typeLabels: Record<string, string> = {
  BIOMETRIC: ko.terminal.biometric,
  CARD: ko.terminal.card,
  QR: ko.terminal.qr,
  FACE: ko.terminal.face,
}

// ─── Component ───────────────────────────────────────────

export function TerminalSettingsClient({ user }: { user: SessionUser }) {
  void user

  // ─── State ───
  const [terminals, setTerminals] = useState<TerminalLocal[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | undefined>()
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TerminalLocal | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<TerminalLocal | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [regenTarget, setRegenTarget] = useState<TerminalLocal | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  const [secretDialogOpen, setSecretDialogOpen] = useState(false)
  const [secretInfo, setSecretInfo] = useState<{ id: string; apiSecret: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // ─── Form ───
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      terminalCode: '',
      terminalType: 'BIOMETRIC',
      locationName: '',
      ipAddress: '',
    },
  })

  // ─── Fetch ───
  const fetchTerminals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<TerminalLocal>('/api/v1/terminals', {
        page,
        limit: 50,
      })
      setTerminals(res.data)
      setPagination(res.pagination)
    } catch {
      setTerminals([])
      setPagination(undefined)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void fetchTerminals()
  }, [fetchTerminals])

  // ─── Online status helper ───
  const isOnline = (t: TerminalLocal): boolean => {
    if (!t.lastHeartbeatAt) return false
    return Date.now() - new Date(t.lastHeartbeatAt).getTime() < 180_000
  }

  // ─── Open dialogs ───
  const openCreate = () => {
    setEditing(null)
    reset({
      terminalCode: '',
      terminalType: 'BIOMETRIC',
      locationName: '',
      ipAddress: '',
    })
    setDialogOpen(true)
  }

  const openEdit = (row: TerminalLocal) => {
    setEditing(row)
    reset({
      terminalCode: row.terminalCode,
      terminalType: row.terminalType as FormData['terminalType'],
      locationName: row.locationName,
      ipAddress: row.ipAddress ?? '',
    })
    setDialogOpen(true)
  }

  // ─── Submit (create / edit) ───
  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      if (editing) {
        const { terminalCode: _unused, ...updatePayload } = data
        void _unused
        await apiClient.put(`/api/v1/terminals/${editing.id}`, updatePayload)
        setDialogOpen(false)
        fetchTerminals()
      } else {
        const res = await apiClient.post<{ id: string; apiSecret: string }>(
          '/api/v1/terminals',
          data,
        )
        setDialogOpen(false)
        // Show the secret that is returned only on creation
        if (res.data) {
          setSecretInfo({ id: res.data.id, apiSecret: res.data.apiSecret })
          setSecretDialogOpen(true)
        }
        fetchTerminals()
      }
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete ───
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiClient.delete(`/api/v1/terminals/${deleteTarget.id}`)
      setDeleteTarget(null)
      fetchTerminals()
    } finally {
      setDeleting(false)
    }
  }

  // ─── Regenerate secret ───
  const confirmRegenerate = async () => {
    if (!regenTarget) return
    setRegenerating(true)
    try {
      const res = await apiClient.post<{ id: string; apiSecret: string }>(
        `/api/v1/terminals/${regenTarget.id}/regenerate-secret`,
        {},
      )
      setRegenTarget(null)
      if (res.data) {
        setSecretInfo({ id: res.data.id, apiSecret: res.data.apiSecret })
        setSecretDialogOpen(true)
      }
    } finally {
      setRegenerating(false)
    }
  }

  // ─── Copy secret ───
  const handleCopySecret = async () => {
    if (!secretInfo) return
    await navigator.clipboard.writeText(secretInfo.apiSecret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ─── Columns ───
  const columns: DataTableColumn<TerminalLocal>[] = [
    {
      key: 'terminalCode',
      header: ko.terminal.terminalCode,
    },
    {
      key: 'terminalType',
      header: ko.terminal.terminalType,
      render: (row: TerminalLocal) => (
        <Badge variant="outline">{typeLabels[row.terminalType] ?? row.terminalType}</Badge>
      ),
    },
    {
      key: 'locationName',
      header: ko.terminal.locationName,
    },
    {
      key: 'ipAddress',
      header: ko.terminal.ipAddress,
      render: (row: TerminalLocal) => (
        <span className="text-muted-foreground">{row.ipAddress ?? '\u2014'}</span>
      ),
    },
    {
      key: 'status',
      header: ko.terminal.isActive,
      render: (row: TerminalLocal) =>
        isOnline(row) ? (
          <Badge className="bg-emerald-100 text-emerald-700">{ko.terminal.online}</Badge>
        ) : (
          <Badge variant="secondary">{ko.terminal.offline}</Badge>
        ),
    },
    {
      key: 'actions',
      header: ko.common.actions,
      render: (row: TerminalLocal) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setRegenTarget(row)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(row)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  // ─── Render ───
  return (
    <div className="space-y-6">
      <PageHeader
        title={ko.terminal.settings}
        description="출퇴근 단말기를 등록하고 관리합니다."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            {ko.common.create}
          </Button>
        }
      />

      {/* ─── DataTable ─── */}
      <DataTable
        columns={columns as unknown as DataTableColumn<Record<string, unknown>>[]}
        data={terminals as unknown as Record<string, unknown>[]}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage={ko.common.noData}
        rowKey={(row) => (row as unknown as TerminalLocal).id}
      />

      {/* ─── Create / Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? `${ko.terminal.title} ${ko.common.edit}`
                : `${ko.terminal.title} ${ko.common.create}`}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? '단말기 정보를 수정합니다.'
                : '새 단말기를 등록합니다.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* terminalCode */}
            <div className="space-y-2">
              <Label htmlFor="terminal-code">{ko.terminal.terminalCode}</Label>
              <Input
                id="terminal-code"
                placeholder="예: TERM-001"
                disabled={!!editing}
                {...register('terminalCode')}
              />
              {errors.terminalCode && (
                <p className="text-sm text-destructive">
                  {errors.terminalCode.message}
                </p>
              )}
            </div>

            {/* terminalType */}
            <div className="space-y-2">
              <Label>{ko.terminal.terminalType}</Label>
              <Controller
                control={control}
                name="terminalType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={ko.common.selectPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BIOMETRIC">{ko.terminal.biometric}</SelectItem>
                      <SelectItem value="CARD">{ko.terminal.card}</SelectItem>
                      <SelectItem value="QR">{ko.terminal.qr}</SelectItem>
                      <SelectItem value="FACE">{ko.terminal.face}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.terminalType && (
                <p className="text-sm text-destructive">
                  {errors.terminalType.message}
                </p>
              )}
            </div>

            {/* locationName */}
            <div className="space-y-2">
              <Label htmlFor="terminal-location">{ko.terminal.locationName}</Label>
              <Input
                id="terminal-location"
                placeholder="예: 본사 1층 로비"
                {...register('locationName')}
              />
              {errors.locationName && (
                <p className="text-sm text-destructive">
                  {errors.locationName.message}
                </p>
              )}
            </div>

            {/* ipAddress (optional) */}
            <div className="space-y-2">
              <Label htmlFor="terminal-ip">
                {ko.terminal.ipAddress}{' '}
                <span className="text-muted-foreground text-xs">({ko.common.optional})</span>
              </Label>
              <Input
                id="terminal-ip"
                placeholder="예: 192.168.1.100"
                {...register('ipAddress')}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {ko.common.cancel}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                )}
                {ko.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Secret Display Dialog ─── */}
      <Dialog
        open={secretDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSecretDialogOpen(false)
            setSecretInfo(null)
            setCopied(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{ko.terminal.apiSecret}</DialogTitle>
            <DialogDescription>
              이 시크릿 키는 한 번만 표시됩니다. 안전한 곳에 복사해두세요.
            </DialogDescription>
          </DialogHeader>

          {secretInfo && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Terminal ID</Label>
                <p className="rounded-md bg-muted px-3 py-2 font-mono text-sm">
                  {secretInfo.id}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">{ko.terminal.apiSecret}</Label>
                <div className="flex items-center gap-2">
                  <p className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-sm break-all">
                    {secretInfo.apiSecret}
                  </p>
                  <Button variant="outline" size="icon" onClick={handleCopySecret}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {copied && (
                  <p className="text-sm text-emerald-600">복사되었습니다!</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                setSecretDialogOpen(false)
                setSecretInfo(null)
                setCopied(false)
              }}
            >
              {ko.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Regenerate Secret AlertDialog ─── */}
      <AlertDialog
        open={!!regenTarget}
        onOpenChange={(open: boolean) => !open && setRegenTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ko.terminal.regenerateSecret}</AlertDialogTitle>
            <AlertDialogDescription>
              시크릿 키를 재발급하면 기존 키는 즉시 무효화됩니다.
              &quot;{regenTarget?.terminalCode}&quot; 단말기의 시크릿 키를
              재발급하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ko.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRegenerate}
              disabled={regenerating}
            >
              {regenerating && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {ko.terminal.regenerateSecret}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete AlertDialog ─── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>단말기 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.terminalCode}&quot; 단말기를 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ko.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {ko.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
