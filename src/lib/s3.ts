// ═══════════════════════════════════════════════════════════
// CTR HR Hub — AWS S3 Client (Presigned URL)
// ═══════════════════════════════════════════════════════════

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '@/lib/env'

// ─── S3 Client Singleton ──────────────────────────────────

const globalForS3 = globalThis as unknown as {
  __s3Client: S3Client | undefined
}

function getS3Client(): S3Client {
  if (!globalForS3.__s3Client) {
    globalForS3.__s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    })
  }
  return globalForS3.__s3Client
}

// ─── Presigned Upload URL ─────────────────────────────────

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const client = getS3Client()
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(client, command, { expiresIn })
}

// ─── Presigned Download URL ───────────────────────────────

export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const client = getS3Client()
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  })
  return getSignedUrl(client, command, { expiresIn })
}

// ─── Delete Object ────────────────────────────────────────

export async function deleteObject(key: string): Promise<void> {
  const client = getS3Client()
  const command = new DeleteObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  })
  await client.send(command)
}

// ─── Build S3 Key ─────────────────────────────────────────

export function buildS3Key(
  companyId: string,
  entityType: string,
  entityId: string,
  filename: string,
): string {
  return `${companyId}/${entityType}/${entityId}/${filename}`
}
