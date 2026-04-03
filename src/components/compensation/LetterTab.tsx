'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation Letter Tab
// 연봉 조정 통보서 목록 + 배치 생성/발송
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { FileText, Send, Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { TABLE_STYLES } from '@/lib/styles'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/format/date'

// ─── Types ──────────────────────────────────────────────────

interface LetterItem {
  id: string
  employeeId: string
  employeeName: string
  employeeNo: string
  department: string
  version: number
  status: 'GENERATED' | 'SENT' | 'FAILED'
  sentAt: string | null
  sentToEmail: string | null
  failureReason: string | null
  createdAt: string
}

interface Props {
  cycleId: string
}

// ─── Constants ──────────────────────────────────────────────

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  GENERATED: 'secondary',
  SENT: 'default',
  FAILED: 'destructive',
}

// ─── Component ──────────────────────────────────────────────

export default function LetterTab({ cycleId }: Props) {
  const t = useTranslations('compensation')
  const [letters, setLetters] = useState<LetterItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)

  const fetchLetters = useCallback(async () => {
    if (!cycleId) return
    try {
      setLoading(true)
      const res = await apiClient.getList<LetterItem>('/api/v1/compensation/letters', {
        cycleId,
        limit: 100,
      })
      setLetters(res.data)
      setTotal(res.total ?? res.data.length)
    } catch (err) {
      toast({
        title: t('loadError'),
        description: err instanceof Error ? err.message : t('tryAgain'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [cycleId, t])

  useEffect(() => {
    fetchLetters()
  }, [fetchLetters])

  // ─── 전체 선택 ───

  const allSelected = letters.length > 0 && selectedIds.size === letters.length
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(letters.map((l) => l.id)))
    }
  }

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  // ─── 배치 생성 ───

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      // cycleId에 해당하는 모든 확정된 직원에 대해 생성
      const employeeIds = letters.length > 0
        ? letters.map((l) => l.employeeId)
        : [] // 첫 생성 시에는 서버가 cycleId 기준으로 자동 조회

      const res = await apiClient.post<{ generated: number; regenerated: number }>(
        '/api/v1/compensation/letters',
        { cycleId, employeeIds },
      )
      toast({
        title: t('generateSuccess', { count: res.data.generated + res.data.regenerated }),
      })
      setShowGenerateDialog(false)
      setSelectedIds(new Set())
      fetchLetters()
    } catch (err) {
      toast({
        title: t('generateError'),
        description: err instanceof Error ? err.message : t('tryAgain'),
        variant: 'destructive',
      })
    } finally {
      setGenerating(false)
    }
  }

  // ─── 배치 발송 ───

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await apiClient.post<{ sent: number; failed: number; failures: Array<{ employeeName: string; reason: string }> }>(
        '/api/v1/compensation/letters/send',
        { letterIds: [...selectedIds] },
      )
      const msg = res.data.failed > 0
        ? t('sendPartialSuccess', { sent: res.data.sent, failed: res.data.failed })
        : t('sendSuccess', { count: res.data.sent })
      toast({ title: msg })

      if (res.data.failures.length > 0) {
        toast({
          title: t('sendFailures'),
          description: res.data.failures.map((f) => `${f.employeeName}: ${f.reason}`).join(', '),
          variant: 'destructive',
        })
      }

      setShowSendDialog(false)
      setSelectedIds(new Set())
      fetchLetters()
    } catch (err) {
      toast({
        title: t('sendError'),
        description: err instanceof Error ? err.message : t('tryAgain'),
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  // ─── 다운로드 ───

  const handleDownload = async (letterId: string) => {
    try {
      const res = await apiClient.get<{ downloadUrl: string; filename: string }>(
        `/api/v1/compensation/letters/${letterId}`,
      )
      window.open(res.data.downloadUrl, '_blank')
    } catch (err) {
      toast({
        title: t('downloadError'),
        description: err instanceof Error ? err.message : t('tryAgain'),
        variant: 'destructive',
      })
    }
  }

  // ─── 렌더링 ───

  if (loading) return <TableSkeleton />

  if (!cycleId) {
    return (
      <EmptyState
        icon={<FileText className="h-12 w-12" />}
        title={t('noCycle')}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* ─── 액션바 ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowGenerateDialog(true)} disabled={generating}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            {t('generateLetters')}
          </Button>
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowSendDialog(true)}
              disabled={sending}
            >
              <Send className="mr-1.5 h-4 w-4" />
              {t('sendLetters')} ({selectedIds.size})
            </Button>
          )}
        </div>
        {total > 0 && (
          <p className="text-sm text-muted-foreground">
            {t('totalLetters', { count: total })}
          </p>
        )}
      </div>

      {/* ─── 빈 상태 ─── */}
      {letters.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title={t('noLetters')}
          description={t('noLettersDesc')}
        />
      ) : (
        /* ─── 테이블 ─── */
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className={TABLE_STYLES.headerCell}>{t('employeeName')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('department')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('letterStatusLabel')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('createdAt')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('sentAt')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {letters.map((letter) => (
                <tr key={letter.id} className={TABLE_STYLES.row}>
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedIds.has(letter.id)}
                      onCheckedChange={() => toggleOne(letter.id)}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {letter.employeeName}
                    <span className="ml-1 text-muted-foreground text-xs">({letter.employeeNo})</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{letter.department}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[letter.status]}>
                      {t(`letterStatus.${letter.status}`)}
                    </Badge>
                    {letter.failureReason && (
                      <span className="ml-1 text-xs text-destructive" title={letter.failureReason}>
                        !
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(letter.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {letter.sentAt ? formatDate(letter.sentAt) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(letter.id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── 생성 확인 다이얼로그 ─── */}
      <AlertDialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('generateLettersTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('generateLettersConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={generating}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerate} disabled={generating}>
              {generating ? t('generating') : t('generate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── 발송 확인 다이얼로그 ─── */}
      <AlertDialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sendLettersTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sendLettersConfirm', { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={sending}>
              {sending ? t('sending') : t('send')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
