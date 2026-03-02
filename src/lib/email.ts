// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Email Sending Stub (AWS SES)
// 실제 SES 연동은 추후 구현 — 현재는 로깅만
// ═══════════════════════════════════════════════════════════

import { env } from '@/lib/env'

interface SendEmailInput {
  to: string
  subject: string
  htmlBody: string
}

/**
 * AWS SES 이메일 발송 stub
 * 프로덕션에서는 @aws-sdk/client-ses 연동 필요
 */
export async function sendEmail(input: SendEmailInput): Promise<{
  success: boolean
  messageId?: string
}> {
  if (env.NODE_ENV === 'development') {
    console.log('[EMAIL STUB]', {
      from: env.SES_FROM_EMAIL,
      to: input.to,
      subject: input.subject,
      bodyLength: input.htmlBody.length,
    })
    return { success: true, messageId: `stub-${Date.now()}` }
  }

  // TODO: AWS SES 연동
  // const ses = new SESClient({ region: env.AWS_REGION })
  // const command = new SendEmailCommand({
  //   Source: env.SES_FROM_EMAIL,
  //   Destination: { ToAddresses: [input.to] },
  //   Message: {
  //     Subject: { Data: input.subject },
  //     Body: { Html: { Data: input.htmlBody } },
  //   },
  // })
  // const result = await ses.send(command)
  // return { success: true, messageId: result.MessageId }

  console.log('[EMAIL]', { to: input.to, subject: input.subject })
  return { success: true, messageId: `placeholder-${Date.now()}` }
}
