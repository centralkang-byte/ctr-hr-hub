import { describe, it, expect, vi } from 'vitest'
import { performPresignedUpload } from '@/lib/upload/perform-upload'

const PRESIGN_OK = {
  ok: true,
  json: async () => ({
    data: {
      uploadId: 'u1',
      post: {
        url: 'https://s3.example/bucket',
        fields: {
          key: 'co/loa-proof/x/proof.pdf',
          'Content-Type': 'application/pdf',
          Policy: 'base64policy',
          'X-Amz-Signature': 'sig',
        },
      },
      contentType: 'application/pdf',
    },
  }),
}

function makeFile(): File {
  return new File(['hello'], 'proof.pdf', { type: 'application/pdf' })
}

describe('performPresignedUpload', () => {
  it('presign → S3 POST 성공 시 uploadId·filename 반환', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(PRESIGN_OK)
      .mockResolvedValueOnce({ ok: true })

    const result = await performPresignedUpload(
      '/api/v1/leave-of-absence/proof/presigned',
      makeFile(),
      fetchImpl as unknown as typeof fetch,
    )

    expect(result).toEqual({ uploadId: 'u1', filename: 'proof.pdf' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('presign 요청 본문에 filename·contentType·fileSize 를 보낸다', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(PRESIGN_OK)
      .mockResolvedValueOnce({ ok: true })

    await performPresignedUpload('/presign', makeFile(), fetchImpl as unknown as typeof fetch)

    const [, init] = fetchImpl.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ filename: 'proof.pdf', contentType: 'application/pdf', fileSize: 5 })
  })

  it('S3 POST 는 정책 fields + 파일(file, 마지막)을 FormData 로 보낸다', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(PRESIGN_OK)
      .mockResolvedValueOnce({ ok: true })

    await performPresignedUpload('/presign', makeFile(), fetchImpl as unknown as typeof fetch)

    const [url, init] = fetchImpl.mock.calls[1]
    expect(url).toBe('https://s3.example/bucket')
    expect(init.method).toBe('POST')
    const form = init.body as FormData
    expect(form.get('key')).toBe('co/loa-proof/x/proof.pdf')
    expect(form.get('Content-Type')).toBe('application/pdf')
    expect(form.get('file')).toBeInstanceOf(File)
  })

  it('presign 실패 시 서버 에러 메시지로 throw', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: '증빙은 PDF 또는 이미지 파일만 업로드할 수 있습니다.' } }),
    })

    await expect(
      performPresignedUpload('/presign', makeFile(), fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow('증빙은 PDF 또는 이미지 파일만 업로드할 수 있습니다.')
  })

  it('S3 업로드 실패 시 throw (파일은 연결되지 않음)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(PRESIGN_OK)
      .mockResolvedValueOnce({ ok: false })

    await expect(
      performPresignedUpload('/presign', makeFile(), fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow('파일 업로드에 실패했습니다. 다시 시도해 주세요.')
  })
})
