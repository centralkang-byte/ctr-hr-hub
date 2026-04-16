'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Teams Channel Selector
// Teams 팀/채널 선택 드롭다운 (Graph API 연동)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { apiClient } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface TeamOption {
  id: string
  displayName: string
}

interface Props {
  teamId: string | null
  channelId: string | null
  onSelect: (teamId: string | null, channelId: string | null) => void
}

export function TeamsChannelSelector({ teamId, channelId, onSelect }: Props) {
  const t = useTranslations('teams')
  const { toast } = useToast()
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [channels, setChannels] = useState<TeamOption[]>([])

  const fetchTeams = useCallback(async () => {
    setLoadingTeams(true)
    try {
      const res = await apiClient.get<{
        teams?: TeamOption[]
        error?: string
      }>('/api/v1/teams/channels')
      if (res.data.error) {
        toast({ title: res.data.error, variant: 'destructive' })
      } else {
        setTeams(res.data.teams ?? [])
      }
    } catch {
      toast({ title: t('ui.channel.errorTeams'), variant: 'destructive' })
    } finally {
      setLoadingTeams(false)
    }
  }, [toast])

  const fetchChannels = useCallback(
    async (selectedTeamId: string) => {
      setLoadingChannels(true)
      try {
        const res = await apiClient.get<{
          channels?: TeamOption[]
          error?: string
        }>(`/api/v1/teams/channels?teamId=${selectedTeamId}`)
        if (res.data.error) {
          toast({ title: res.data.error, variant: 'destructive' })
        } else {
          setChannels(res.data.channels ?? [])
        }
      } catch {
        toast({ title: t('ui.channel.errorChannels'), variant: 'destructive' })
      } finally {
        setLoadingChannels(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    void fetchTeams()
  }, [fetchTeams])

  useEffect(() => {
    if (teamId) {
      void fetchChannels(teamId)
    }
  }, [teamId, fetchChannels])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('ui.channel.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team 선택 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('ui.channel.selectTeam')}</Label>
          {loadingTeams ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('ui.channel.loadingTeams')}
            </div>
          ) : (
            <select
              value={teamId ?? ''}
              onChange={(e) => {
                const val = e.target.value || null
                onSelect(val, null)
                setChannels([])
              }}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="">{t('ui.channel.teamPlaceholder')}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.displayName}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Channel 선택 */}
        {teamId && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('ui.channel.selectChannel')}</Label>
            {loadingChannels ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t('ui.channel.loadingChannels')}
              </div>
            ) : (
              <select
                value={channelId ?? ''}
                onChange={(e) => onSelect(teamId, e.target.value || null)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="">{t('ui.channel.channelPlaceholder')}</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.displayName}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {t('ui.channel.channelHelp')}
        </p>
      </CardContent>
    </Card>
  )
}
