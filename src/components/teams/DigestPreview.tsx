'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Weekly Digest Preview + Manual Send
// ═══════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, Loader2, Send } from 'lucide-react'

import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { AdaptiveCardPreview } from './AdaptiveCardPreview'

interface DigestData {
  weekRange: string
  newHires: number
  onLeave: number
  pendingEvals: number
  attritionRisks: number
  pendingApprovals: number
  highlights: string[]
}

export function DigestPreview() {
  const t = useTranslations('teams')
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [digest, setDigest] = useState<DigestData | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [card, setCard] = useState<any>(null)

  const fetchPreview = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ digest: DigestData; card: unknown }>(
        '/api/v1/teams/digest',
      )
      setDigest(res.data.digest)
      setCard(res.data.card)
    } catch {
      toast({ title: t('ui.digestSettings.loadError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await apiClient.post<{ success: boolean; message?: string }>(
        '/api/v1/teams/digest',
        {},
      )
      if (res.data.success) {
        toast({ title: t('ui.digestSettings.sendSuccess') })
      } else {
        toast({
          title: res.data.message ?? t('ui.digestSettings.sendError'),
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: t('ui.digestSettings.sendFetchError'), variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span>{t('ui.digestSettings.previewTitle')}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchPreview} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Eye className="mr-1 h-3 w-3" />
              )}
              {t('ui.digestSettings.previewBtn')}
            </Button>
            <Button size="sm" onClick={handleSend} disabled={sending || !card}>
              {sending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-1 h-3 w-3" />
              )}
              {t('ui.digestSettings.sendBtn')}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!digest && !loading && (
          <p className="text-sm text-muted-foreground">
            {t('ui.digestSettings.previewEmpty')}
          </p>
        )}

        {digest && (
          <div className="space-y-4">
            {/* 통계 요약 */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: t('digest.newHires'), value: digest.newHires },
                { label: t('digest.onLeave'), value: digest.onLeave },
                { label: t('digest.pendingEvals'), value: digest.pendingEvals },
                { label: t('digest.attritionRisk'), value: digest.attritionRisks },
                { label: t('digest.pendingApprovals'), value: digest.pendingApprovals },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-lg border border-border p-3 text-center"
                >
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold text-foreground">{value}</p>
                </div>
              ))}
            </div>

            {/* 주요 알림 */}
            {digest.highlights.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{t('ui.digestSettings.alerts')}</p>
                <ul className="space-y-1">
                  {digest.highlights.map((h, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      &bull; {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Adaptive Card 미리보기 */}
            {card && <AdaptiveCardPreview card={card} title={t('ui.digestSettings.cardPreviewTitle')} />}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
