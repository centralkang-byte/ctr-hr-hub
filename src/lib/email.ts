// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Email Sending (AWS SES)
// dev: 콘솔 로깅, prod: SES 발송
// ═══════════════════════════════════════════════════════════

import { env } from '@/lib/env'

interface SendEmailInput {
  to: string
  subject: string
  htmlBody: string
}

function maskEmail(email: string): string {
  return email.replace(/^(.).*(@.*)$/, '$1***$2')
}

export async function sendEmail(input: SendEmailInput): Promise<{
  success: boolean
  messageId?: string
}> {
  if (env.NODE_ENV === 'development') {
    console.info('[EMAIL STUB]', {
      to: maskEmail(input.to),
      subject: input.subject,
      bodyLength: input.htmlBody.length,
    })
    return { success: true, messageId: `stub-${Date.now()}` }
  }

  // Production: AWS SES
  const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses')

  const ses = new SESClient({
    region: env.AWS_REGION,
    ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  })

  const command = new SendEmailCommand({
    Source: env.SES_FROM_EMAIL,
    Destination: { ToAddresses: [input.to] },
    Message: {
      Subject: { Data: input.subject, Charset: 'UTF-8' },
      Body: { Html: { Data: input.htmlBody, Charset: 'UTF-8' } },
    },
  })

  try {
    const result = await ses.send(command)
    // eslint-disable-next-line no-console -- email send confirmation (PII masked)
    console.info('[EMAIL SENT]', {
      to: maskEmail(input.to),
      subject: input.subject,
      messageId: result.MessageId,
    })
    return { success: true, messageId: result.MessageId }
  } catch (error) {
    console.error('[EMAIL FAILED]', {
      to: maskEmail(input.to),
      subject: input.subject,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return { success: false }
  }
}
