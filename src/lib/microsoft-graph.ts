// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Microsoft Graph API Client
// Teams 메시지 발송, 채널 포스팅, 프레전스 조회
// ═══════════════════════════════════════════════════════════

import { env } from '@/lib/env'

let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Azure AD 앱 전용 액세스 토큰 발급 (client_credentials flow)
 */
export async function getGraphAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }

  const tenantId = env.AZURE_AD_TENANT_ID
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.AZURE_AD_CLIENT_ID,
        client_secret: env.AZURE_AD_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    },
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Graph token 발급 실패: ${res.status} ${body}`)
  }

  const data = (await res.json()) as {
    access_token: string
    expires_in: number
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  return data.access_token
}

async function graphFetch(path: string, options: RequestInit = {}) {
  const token = await getGraphAccessToken()
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  return res
}

/**
 * Teams 1:1 채팅 메시지 전송
 */
export async function sendTeamsMessage(
  userAadId: string,
  content: string,
  adaptiveCard?: Record<string, unknown>,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // 1. 채팅 생성 또는 기존 채팅 조회
    const chatRes = await graphFetch('/chats', {
      method: 'POST',
      body: JSON.stringify({
        chatType: 'oneOnOne',
        members: [
          {
            '@odata.type': '#microsoft.graph.aadUserConversationMember',
            roles: ['owner'],
            'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${env.TEAMS_BOT_ID}`,
          },
          {
            '@odata.type': '#microsoft.graph.aadUserConversationMember',
            roles: ['owner'],
            'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${userAadId}`,
          },
        ],
      }),
    })

    if (!chatRes.ok) {
      const err = await chatRes.text()
      return { success: false, error: `채팅 생성 실패: ${err}` }
    }

    const chat = (await chatRes.json()) as { id: string }

    // 2. 메시지 발송
    const body: Record<string, unknown> = adaptiveCard
      ? {
          body: { contentType: 'html', content },
          attachments: [
            {
              id: crypto.randomUUID(),
              contentType: 'application/vnd.microsoft.card.adaptive',
              content: JSON.stringify(adaptiveCard),
            },
          ],
        }
      : { body: { contentType: 'html', content } }

    const msgRes = await graphFetch(`/chats/${chat.id}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    })

    if (!msgRes.ok) {
      const err = await msgRes.text()
      return { success: false, error: `메시지 발송 실패: ${err}` }
    }

    const msg = (await msgRes.json()) as { id: string }
    return { success: true, messageId: msg.id }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Teams 채널에 메시지 포스팅
 */
export async function postToChannel(
  teamId: string,
  channelId: string,
  content: string,
  adaptiveCard?: Record<string, unknown>,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const body: Record<string, unknown> = adaptiveCard
      ? {
          body: { contentType: 'html', content },
          attachments: [
            {
              id: crypto.randomUUID(),
              contentType: 'application/vnd.microsoft.card.adaptive',
              content: JSON.stringify(adaptiveCard),
            },
          ],
        }
      : { body: { contentType: 'html', content } }

    const res = await graphFetch(
      `/teams/${teamId}/channels/${channelId}/messages`,
      { method: 'POST', body: JSON.stringify(body) },
    )

    if (!res.ok) {
      const err = await res.text()
      return { success: false, error: `채널 포스팅 실패: ${err}` }
    }

    const msg = (await res.json()) as { id: string }
    return { success: true, messageId: msg.id }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 사용자 프레전스(재석 상태) 조회
 */
export async function getUserPresence(
  userAadId: string,
): Promise<{
  availability: string
  activity: string
} | null> {
  try {
    const res = await graphFetch(`/users/${userAadId}/presence`)
    if (!res.ok) return null
    const data = (await res.json()) as {
      availability: string
      activity: string
    }
    return data
  } catch {
    return null
  }
}

/**
 * Teams 연결 테스트 — /me 엔드포인트로 토큰 유효성 확인
 */
export async function testTeamsConnection(): Promise<{
  success: boolean
  tenantName?: string
  error?: string
}> {
  try {
    const res = await graphFetch('/organization')
    if (!res.ok) {
      return { success: false, error: `연결 실패: ${res.status}` }
    }
    const data = (await res.json()) as {
      value: { displayName: string }[]
    }
    return {
      success: true,
      tenantName: data.value?.[0]?.displayName ?? 'Unknown',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Teams 팀/채널 목록 조회
 */
export async function listTeamsChannels(teamId?: string): Promise<{
  teams?: { id: string; displayName: string }[]
  channels?: { id: string; displayName: string }[]
  error?: string
}> {
  try {
    if (!teamId) {
      // 팀 목록 조회
      const res = await graphFetch('/groups?$filter=resourceProvisioningOptions/Any(x:x eq \'Team\')&$select=id,displayName')
      if (!res.ok) {
        return { error: `팀 목록 조회 실패: ${res.status}` }
      }
      const data = (await res.json()) as {
        value: { id: string; displayName: string }[]
      }
      return { teams: data.value }
    }

    // 특정 팀의 채널 목록 조회
    const res = await graphFetch(`/teams/${teamId}/channels?$select=id,displayName`)
    if (!res.ok) {
      return { error: `채널 목록 조회 실패: ${res.status}` }
    }
    const data = (await res.json()) as {
      value: { id: string; displayName: string }[]
    }
    return { channels: data.value }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
