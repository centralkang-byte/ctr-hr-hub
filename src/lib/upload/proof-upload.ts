// ═══════════════════════════════════════════════════════════
// CTR HR Hub — LoA proof upload constants + pure helpers
// 휴직(LoA) 증빙 파일 업로드 공통값. presigned POST 발급/소비 경로에서 공유.
// ═══════════════════════════════════════════════════════════

/** FileUpload.purpose 값 (휴직 증빙) */
export const LOA_PROOF_PURPOSE = 'LOA_PROOF'

/** presigned POST 만료 (초) — 짧게 유지해 재사용/덮어쓰기 창을 최소화 */
export const PROOF_UPLOAD_EXPIRY_SECONDS = 300

/** 증빙 허용 MIME — pdf + 사진. SVG/GIF 제외(XSS·비정형). */
export const LOA_PROOF_CONTENT_TYPES: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]

/** 파일 입력 accept 속성 (클라이언트 1차 필터) */
export const LOA_PROOF_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp'

/** 증빙 허용 형식인지 (서버/클라이언트 공통) */
export function isAllowedProofContentType(contentType: string): boolean {
  return LOA_PROOF_CONTENT_TYPES.includes(contentType)
}

// ─── Filename Sanitization (pure) ────────────────────────
// basename 만 추출, NFC 정규화, 안전문자(글자·숫자·.·_·-)만 유지(그 외는 _ 로
// 치환 — 제어문자·공백·경로구분자 포함), 확장자 보존, 길이 제한.
// 빈 결과는 fallback. S3 key 는 uuid 디렉터리라 충돌 불가 — 이 값은 표시/다운로드용.
export function sanitizeFilename(filename: string): string {
  const base = (filename.split(/[/\\]/).pop() ?? '').normalize('NFC')
  const dot = base.lastIndexOf('.')
  const ext =
    dot > 0
      ? base
          .slice(dot + 1)
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 10)
          .toLowerCase()
      : ''
  const rawName = dot > 0 ? base.slice(0, dot) : base
  const name =
    rawName
      .replace(/[^\p{L}\p{N}._-]+/gu, '_')
      .replace(/^[._]+/, '')
      .slice(0, 100) || 'upload'
  return ext ? `${name}.${ext}` : name
}
