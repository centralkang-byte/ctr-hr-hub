// Phase B-2: QUARTERLY_REVIEW_REOPENED Handler (stub)
// 알림 로직은 Phase B-3에서 구현

import type { DomainEventHandler, QuarterlyReviewReopenedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'

export const quarterlyReviewReopenedHandler: DomainEventHandler<'QUARTERLY_REVIEW_REOPENED'> = {
  eventName: DOMAIN_EVENTS.QUARTERLY_REVIEW_REOPENED,

  async handle(_payload: QuarterlyReviewReopenedPayload, _tx?: TxClient): Promise<void> {
    // Phase B-3: 직원+매니저에게 리뷰 재오픈 알림 (사유 포함)
  },
}
