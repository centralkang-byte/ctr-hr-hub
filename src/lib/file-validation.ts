// ═══════════════════════════════════════════════════════════
// CTR HR Hub — File Upload Security Validation
// ═══════════════════════════════════════════════════════════

// ─── Allowed MIME Types ──────────────────────────────────

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  // Images
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  // Documents
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  // Text
  'text/plain': ['.txt'],
}

// ─── Magic Bytes Signatures ──────────────────────────────

const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [0x50, 0x4B, 0x03, 0x04], // PK ZIP
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4B, 0x03, 0x04],
  'application/vnd.ms-excel': [0xD0, 0xCF, 0x11, 0xE0], // OLE
  'application/msword': [0xD0, 0xCF, 0x11, 0xE0],
}

// ─── File Size Limits ────────────────────────────────────

const FILE_SIZE_LIMITS: Record<string, number> = {
  'image/jpeg': 10 * 1024 * 1024,   // 10MB
  'image/png': 10 * 1024 * 1024,
  'image/gif': 10 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'image/svg+xml': 2 * 1024 * 1024,  // 2MB (XML-based)
  'application/pdf': 20 * 1024 * 1024, // 20MB
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 50 * 1024 * 1024, // 50MB
  'application/vnd.ms-excel': 50 * 1024 * 1024,
  'text/csv': 50 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 20 * 1024 * 1024,
  'application/msword': 20 * 1024 * 1024,
  'text/plain': 5 * 1024 * 1024,
}

const DEFAULT_SIZE_LIMIT = 10 * 1024 * 1024 // 10MB

// ─── Validation Result ──────────────────────────────────

export interface FileValidationResult {
  valid: boolean
  error?: string
}

// ─── Validate MIME Type ──────────────────────────────────

export function validateMimeType(contentType: string): FileValidationResult {
  if (!ALLOWED_MIME_TYPES[contentType]) {
    return {
      valid: false,
      error: `허용되지 않는 파일 형식입니다: ${contentType}`,
    }
  }
  return { valid: true }
}

// ─── Validate File Extension ─────────────────────────────

export function validateFileExtension(
  filename: string,
  contentType: string,
): FileValidationResult {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0]
  if (!ext) {
    return { valid: false, error: '파일 확장자를 확인할 수 없습니다.' }
  }

  const allowedExtensions = ALLOWED_MIME_TYPES[contentType]
  if (!allowedExtensions?.includes(ext)) {
    return {
      valid: false,
      error: `파일 확장자(${ext})가 MIME 타입(${contentType})과 일치하지 않습니다.`,
    }
  }

  return { valid: true }
}

// ─── Validate File Size ──────────────────────────────────

export function validateFileSize(
  size: number,
  contentType: string,
): FileValidationResult {
  const limit = FILE_SIZE_LIMITS[contentType] ?? DEFAULT_SIZE_LIMIT
  if (size > limit) {
    const limitMB = Math.round(limit / (1024 * 1024))
    return {
      valid: false,
      error: `파일 크기가 제한(${limitMB}MB)을 초과했습니다.`,
    }
  }
  return { valid: true }
}

// ─── Validate Magic Bytes ────────────────────────────────

export function validateMagicBytes(
  buffer: Uint8Array,
  contentType: string,
): FileValidationResult {
  const expected = MAGIC_BYTES[contentType]
  if (!expected) {
    // No magic bytes to check (e.g., CSV, TXT, SVG)
    return { valid: true }
  }

  if (buffer.length < expected.length) {
    return { valid: false, error: '파일이 손상되었거나 유효하지 않습니다.' }
  }

  for (let i = 0; i < expected.length; i++) {
    if (buffer[i] !== expected[i]) {
      return {
        valid: false,
        error: '파일 헤더가 선언된 MIME 타입과 일치하지 않습니다.',
      }
    }
  }

  return { valid: true }
}

// ─── Comprehensive File Validation ──────────────────────

export function validateFile(params: {
  filename: string
  contentType: string
  size?: number
  buffer?: Uint8Array
}): FileValidationResult {
  const { filename, contentType, size, buffer } = params

  // 1. MIME type check
  const mimeResult = validateMimeType(contentType)
  if (!mimeResult.valid) return mimeResult

  // 2. Extension check
  const extResult = validateFileExtension(filename, contentType)
  if (!extResult.valid) return extResult

  // 3. Size check
  if (size !== undefined) {
    const sizeResult = validateFileSize(size, contentType)
    if (!sizeResult.valid) return sizeResult
  }

  // 4. Magic bytes check
  if (buffer) {
    const magicResult = validateMagicBytes(buffer, contentType)
    if (!magicResult.valid) return magicResult
  }

  return { valid: true }
}
