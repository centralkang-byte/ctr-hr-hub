// ═══════════════════════════════════════════════════════════
// CTR HR Hub — performPresignedUpload (presign → S3 POST)
// useFileUpload 가 호출하는 순수 오케스트레이션. fetch 주입 가능 → 단위 테스트.
// ═══════════════════════════════════════════════════════════

export interface PresignedPost {
  url: string
  fields: Record<string, string>
}

interface PresignResponse {
  uploadId: string
  post: PresignedPost
  contentType: string
}

export interface PerformUploadResult {
  uploadId: string
  filename: string
}

/**
 * 2단계 presigned 업로드: (1) 서버에서 presigned POST 발급 → (2) S3 로 직접 POST.
 * 정책 fields 를 먼저, 파일은 마지막에 append (S3 요구사항).
 * @param fetchImpl 테스트용 fetch 주입 (기본: 전역 fetch)
 */
export async function performPresignedUpload(
  presignEndpoint: string,
  file: File,
  fetchImpl: typeof fetch = fetch,
): Promise<PerformUploadResult> {
  const presignRes = await fetchImpl(presignEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      fileSize: file.size,
    }),
  })
  if (!presignRes.ok) {
    const body = await presignRes.json().catch(() => null)
    throw new Error(body?.error?.message ?? '업로드 준비에 실패했습니다.')
  }
  const { data } = (await presignRes.json()) as { data: PresignResponse }

  const form = new FormData()
  for (const [key, value] of Object.entries(data.post.fields)) {
    form.append(key, value)
  }
  form.append('file', file)

  const s3Res = await fetchImpl(data.post.url, { method: 'POST', body: form })
  if (!s3Res.ok) {
    throw new Error('파일 업로드에 실패했습니다. 다시 시도해 주세요.')
  }

  return { uploadId: data.uploadId, filename: file.name }
}
