// Phase B-2: QUARTERLY_REVIEW_COMPLETED Handler (stub)
// 알림 로직은 Phase B-3에서 구현

import type { DomainEventHandler, QuarterlyReviewCompletedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'

export const quarterlyReviewCompletedHandler: DomainEventHandler<'QUARTERLY_REVIEW_COMPLETED'> = {
  eventName: DOMAIN_EVENTS.QUARTERLY_REVIEW_COMPLETED,

  async handle(_payload: QuarterlyReviewCompletedPayload, _tx?: TxClient): Promise<void> {
    // Phase B-3: 직원+매니저에게 분기 리뷰 완료 알림
  },
}
