'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Terminal Settings Client
// 출퇴근 단말기 관리 (CRUD + Secret 재발급)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, RefreshCw, Copy, Loader2 } from 'lucide-react'

import type { SessionUser, PaginationInfo } from '@/types'
import { apiClient } from '@/lib/api'
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

// ─── Component ───────────────────────────────────────────

export function TerminalSettingsClient({ user }: { user: SessionUser }) {
  void user

  const t = useTranslations('terminal')
  const tc = useTranslations('common')

  // ─── Translated label maps ───
  const typeLabels: Record<string, string> = {
    BIOMETRIC: t('biometric'),
    CARD: t('card'),
    QR: t('qr'),
    FACE: t('face'),
  }

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
  const isOnline = (terminal: TerminalLocal): boolean => {
    if (!terminal.lastHeartbeatAt) return false
    return Date.now() - new Date(terminal.lastHeartbeatAt).getTime() < 180_000
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
      header: t('terminalCode'),
    },
    {
      key: 'terminalType',
      header: t('terminalType'),
      render: (row: TerminalLocal) => (
        <Badge variant="outline">{typeLabels[row.terminalType] ?? row.terminalType}</Badge>
      ),
    },
    {
      key: 'locationName',
      header: t('locationName'),
    },
    {
      key: 'ipAddress',
      header: t('ipAddress'),
      render: (row: TerminalLocal) => (
        <span className="text-muted-foreground">{row.ipAddress ?? '\u2014'}</span>
      ),
    },
    {
      key: 'status',
      header: t('isActive'),
      render: (row: TerminalLocal) =>
        isOnline(row) ? (
          <Badge className="bg-emerald-100 text-emerald-700">{t('online')}</Badge>
        ) : (
          <Badge variant="secondary">{t('offline')}</Badge>
        ),
    },
    {
      key: 'actions',
      header: tc('actions'),
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
        title={t('settings')}
        description={t('description')}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            {tc('create')}
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
        emptyMessage={tc('noData')}
        rowKey={(row) => (row as unknown as TerminalLocal).id}
      />

      {/* ─── Create / Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('terminalEdit') : t('terminalCreate')}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? t('editDescription')
                : t('createDescription')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* terminalCode */}
            <div className="space-y-2">
              <Label htmlFor="terminal-code">{t('terminalCode')}</Label>
              <Input
                id="terminal-code"
                placeholder={t('exampleCode')}
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
              <Label>{t('terminalType')}</Label>
              <Controller
                control={control}
                name="terminalType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={tc('selectPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BIOMETRIC">{t('biometric')}</SelectItem>
                      <SelectItem value="CARD">{t('card')}</SelectItem>
                      <SelectItem value="QR">{t('qr')}</SelectItem>
                      <SelectItem value="FACE">{t('face')}</SelectItem>
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
              <Label htmlFor="terminal-location">{t('locationName')}</Label>
              <Input
                id="terminal-location"
                placeholder={t('exampleLocation')}
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
                {t('ipAddress')}{' '}
                <span className="text-muted-foreground text-xs">({tc('optional')})</span>
              </Label>
              <Input
                id="terminal-ip"
                placeholder={t('exampleIp')}
                {...register('ipAddress')}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                )}
                {tc('save')}
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
            <DialogTitle>{t('apiSecret')}</DialogTitle>
            <DialogDescription>
              {t('secretDescription')}
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
                <Label className="text-muted-foreground text-xs">{t('apiSecret')}</Label>
                <div className="flex items-center gap-2">
                  <p className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-sm break-all">
                    {secretInfo.apiSecret}
                  </p>
                  <Button variant="outline" size="icon" onClick={handleCopySecret}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {copied && (
                  <p className="text-sm text-emerald-600">{t('secretCopied')}</p>
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
              {tc('confirm')}
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
            <AlertDialogTitle>{t('regenerateSecret')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('regenerateConfirm', { code: regenTarget?.terminalCode ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRegenerate}
              disabled={regenerating}
            >
              {regenerating && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {t('regenerateSecret')}
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
            <AlertDialogTitle>{t('deleteTerminal')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteTerminalConfirm', { code: deleteTarget?.terminalCode ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {tc('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
