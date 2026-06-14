// ═══════════════════════════════════════════════════════════
// CTR HR Hub — AWS S3 Client (Presigned URL)
// ═══════════════════════════════════════════════════════════

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createPresignedPost, type PresignedPost } from '@aws-sdk/s3-presigned-post'
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

// ─── Direct Upload (Server → S3) ──────────────────────────

export async function uploadBuffer(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const client = getS3Client()
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
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

// ─── Presigned POST (size-enforced upload) ────────────────
// PUT presign cannot cap the uploaded size; a presigned POST policy can.
// content-length-range enforces the byte cap AT S3 ingestion, and the exact
// Key + Content-Type conditions prevent overwriting another object or
// switching the declared type. Use for untrusted browser uploads.

export async function createPresignedUploadPost(
  key: string,
  contentType: string,
  maxSize: number,
  expiresIn = 300,
): Promise<PresignedPost> {
  const client = getS3Client()
  return createPresignedPost(client, {
    Bucket: env.S3_BUCKET,
    Key: key,
    Conditions: [
      ['eq', '$Content-Type', contentType],
      ['content-length-range', 1, maxSize],
    ],
    Fields: { 'Content-Type': contentType },
    Expires: expiresIn,
  })
}

// ─── Get Object Range (first bytes — for magic-byte validation) ──
// 객체의 앞부분 바이트를 가져온다 (실제 업로드 내용 검증용). 객체가 없으면 null.
// 404/NoSuchKey 만 null 로 처리하고, 권한·네트워크 등 그 외 오류는 rethrow 하여
// "없음"으로 위장된 5xx 가 400 으로 새지 않게 한다.

export async function getObjectRange(
  key: string,
  bytes: number,
): Promise<{ bytes: Uint8Array; etag: string | undefined } | null> {
  try {
    const res = await getS3Client().send(
      new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Range: `bytes=0-${bytes - 1}` }),
    )
    const arr = await res.Body?.transformToByteArray()
    if (!arr) return null
    // Range GET 도 전체 객체의 ETag 를 반환 → 검증한 버전 고정에 사용.
    return { bytes: arr, etag: res.ETag }
  } catch (e) {
    const status = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode
    const name = (e as { name?: string })?.name
    if (status === 404 || name === 'NoSuchKey' || name === 'NotFound') return null
    throw e
  }
}

// ─── Copy Object (불변 키로 복사) ─────────────────────────
// 소비 시 업로드 키를 presigned POST 로 덮어쓸 수 없는 server-only prefix 로
// 복사해 증빙 파일을 불변화한다. CopySource 는 세그먼트별 URL 인코딩(CJK 안전).
// ifMatch(ETag) 지정 시 동일 버전만 복사 — 검증↔복사 사이 변조 시 412 로 실패.

export async function copyObject(
  srcKey: string,
  destKey: string,
  ifMatch: string,
): Promise<void> {
  const source = `${env.S3_BUCKET}/${srcKey.split('/').map(encodeURIComponent).join('/')}`
  await getS3Client().send(
    new CopyObjectCommand({
      Bucket: env.S3_BUCKET,
      CopySource: source,
      Key: destKey,
      MetadataDirective: 'COPY',
      CopySourceIfMatch: ifMatch,
    }),
  )
}
