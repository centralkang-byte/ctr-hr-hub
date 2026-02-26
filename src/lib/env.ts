// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Type-safe Environment Variables
// process.env 직접 접근 금지 — 이 파일 통해서만 접근
// ═══════════════════════════════════════════════════════════

function getRequired(key: string): string {
  const value = process.env[key]
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`필수 환경변수 ${key}이(가) 설정되지 않았습니다.`)
    }
    return ''
  }
  return value
}

function getOptional(key: string, defaultValue = ''): string {
  return process.env[key] ?? defaultValue
}

function getOptionalInt(key: string, defaultValue: number): number {
  const raw = process.env[key]
  if (!raw) return defaultValue
  const parsed = parseInt(raw, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

// ─── Required ─────────────────────────────────────────────

export const env = {
  // Database
  DATABASE_URL: getRequired('DATABASE_URL'),

  // NextAuth
  NEXTAUTH_URL: getRequired('NEXTAUTH_URL'),
  NEXTAUTH_SECRET: getRequired('NEXTAUTH_SECRET'),

  // Microsoft Entra ID (M365 SSO)
  AZURE_AD_CLIENT_ID: getRequired('AZURE_AD_CLIENT_ID'),
  AZURE_AD_CLIENT_SECRET: getRequired('AZURE_AD_CLIENT_SECRET'),
  AZURE_AD_TENANT_ID: getRequired('AZURE_AD_TENANT_ID'),

  // Redis (optional)
  REDIS_URL: getOptional('REDIS_URL', 'redis://localhost:6379'),

  // AWS S3
  AWS_ACCESS_KEY_ID: getOptional('AWS_ACCESS_KEY_ID'),
  AWS_SECRET_ACCESS_KEY: getOptional('AWS_SECRET_ACCESS_KEY'),
  AWS_REGION: getOptional('AWS_REGION', 'ap-northeast-2'),
  S3_BUCKET: getOptional('S3_BUCKET', 'ctr-hr-hub'),

  // Claude AI
  ANTHROPIC_API_KEY: getOptional('ANTHROPIC_API_KEY'),

  // Embedding (HR Chatbot RAG)
  EMBEDDING_PROVIDER: getOptional('EMBEDDING_PROVIDER', 'openai'),
  OPENAI_API_KEY: getOptional('OPENAI_API_KEY'),

  // Firebase (Push Notification)
  FIREBASE_PROJECT_ID: getOptional('FIREBASE_PROJECT_ID'),
  FIREBASE_PRIVATE_KEY: getOptional('FIREBASE_PRIVATE_KEY'),
  FIREBASE_CLIENT_EMAIL: getOptional('FIREBASE_CLIENT_EMAIL'),

  // AWS SES (Email)
  SES_FROM_EMAIL: getOptional('SES_FROM_EMAIL', 'noreply@ctr.co.kr'),

  // Terminal
  TERMINAL_API_SECRET: getOptional('TERMINAL_API_SECRET'),
  TERMINAL_HEARTBEAT_INTERVAL: getOptionalInt('TERMINAL_HEARTBEAT_INTERVAL', 60),

  // App
  NODE_ENV: getOptional('NODE_ENV', 'development'),
} as const
