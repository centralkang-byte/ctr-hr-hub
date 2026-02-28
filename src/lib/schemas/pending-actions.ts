import { z } from 'zod'

export const pendingActionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(15).default(10),
})
