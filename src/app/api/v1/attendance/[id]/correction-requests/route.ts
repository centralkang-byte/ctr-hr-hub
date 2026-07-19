import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withAuth } from '@/lib/permissions'
import { badRequest } from '@/lib/errors'
import { extractRequestMeta } from '@/lib/audit'
import { createAttendanceCorrectionRequest } from '@/lib/attendance/correction-service'

export const POST = withAuth(async (req: NextRequest, context, user) => {
  const { id } = await context.params
  if (!id) throw badRequest('근태 기록 ID가 필요합니다.')

  let input: unknown
  try {
    input = await req.json()
  } catch {
    throw badRequest('요청 본문이 올바른 JSON 형식이 아닙니다.')
  }
  const created = await createAttendanceCorrectionRequest({
    attendanceId: id,
    input,
    user,
    meta: extractRequestMeta(req.headers),
  })
  return apiSuccess(created, 201)
})
