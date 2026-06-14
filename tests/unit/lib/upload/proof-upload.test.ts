import { describe, it, expect } from 'vitest'
import {
  sanitizeFilename,
  isAllowedProofContentType,
} from '@/lib/upload/proof-upload'

describe('sanitizeFilename', () => {
  it('경로 구분자를 제거하고 basename 만 남긴다', () => {
    expect(sanitizeFilename('a/b/c.pdf')).toBe('c.pdf')
    expect(sanitizeFilename('a\\b\\c.pdf')).toBe('c.pdf')
  })

  it('CJK 파일명을 보존한다', () => {
    expect(sanitizeFilename('증빙서류.pdf')).toBe('증빙서류.pdf')
  })

  it('공백·괄호 등 안전하지 않은 문자를 _ 로 치환한다', () => {
    const out = sanitizeFilename('my file (1).pdf')
    expect(out).not.toMatch(/[ ()]/)
    expect(out.endsWith('.pdf')).toBe(true)
  })

  it('제어문자를 _ 로 치환한다', () => {
    const ctrl = String.fromCharCode(1)
    expect(sanitizeFilename(`a${ctrl}b.pdf`)).toBe('a_b.pdf')
  })

  it('확장자를 소문자·영숫자로 정규화한다', () => {
    expect(sanitizeFilename('photo.JPG')).toBe('photo.jpg')
  })

  it('빈/점only 결과는 fallback 으로 대체한다', () => {
    expect(sanitizeFilename('...')).toBe('upload')
    expect(sanitizeFilename('')).toBe('upload')
  })

  it('확장자 없는 이름도 처리한다', () => {
    expect(sanitizeFilename('README')).toBe('README')
  })

  it('지나치게 긴 이름을 잘라낸다 (이름부 100자 + 확장자)', () => {
    const out = sanitizeFilename('a'.repeat(300) + '.pdf')
    expect(out.length).toBeLessThanOrEqual(105)
    expect(out.endsWith('.pdf')).toBe(true)
  })
})

describe('isAllowedProofContentType', () => {
  it('pdf·jpeg·png·webp 를 허용한다', () => {
    expect(isAllowedProofContentType('application/pdf')).toBe(true)
    expect(isAllowedProofContentType('image/jpeg')).toBe(true)
    expect(isAllowedProofContentType('image/png')).toBe(true)
    expect(isAllowedProofContentType('image/webp')).toBe(true)
  })

  it('svg·gif·txt·실행파일 등은 거부한다 (XSS·비정형 방지)', () => {
    expect(isAllowedProofContentType('image/svg+xml')).toBe(false)
    expect(isAllowedProofContentType('image/gif')).toBe(false)
    expect(isAllowedProofContentType('text/plain')).toBe(false)
    expect(isAllowedProofContentType('application/x-msdownload')).toBe(false)
    expect(isAllowedProofContentType('')).toBe(false)
  })
})
