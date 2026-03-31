'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Weekly Digest Preview + Manual Send
// ═══════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
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
      toast({ title: '오류', description: '다이제스트를 불러올 수 없습니다.', variant: 'destructive' })
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
        toast({ title: '성공', description: '다이제스트가 전송되었습니다.' })
      } else {
        toast({
          title: '실패',
          description: res.data.message ?? '전송에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: '오류', description: '전송 중 오류가 발생했습니다.', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span>다이제스트 미리보기</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchPreview} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Eye className="mr-1 h-3 w-3" />
              )}
              미리보기
            </Button>
            <Button size="sm" onClick={handleSend} disabled={sending || !card}>
              {sending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-1 h-3 w-3" />
              )}
              수동 전송
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!digest && !loading && (
          <p className="text-sm text-muted-foreground">
            미리보기 버튼을 클릭하여 이번 주 다이제스트를 확인하세요.
          </p>
        )}

        {digest && (
          <div className="space-y-4">
            {/* 통계 요약 */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: '신규입사', value: digest.newHires },
                { label: '휴가중', value: digest.onLeave },
                { label: '평가 대기', value: digest.pendingEvals },
                { label: '이탈 위험', value: digest.attritionRisks },
                { label: '승인 대기', value: digest.pendingApprovals },
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
                <p className="text-sm font-medium text-foreground">주요 알림</p>
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
            {card && <AdaptiveCardPreview card={card} title="Teams 카드 미리보기" />}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
