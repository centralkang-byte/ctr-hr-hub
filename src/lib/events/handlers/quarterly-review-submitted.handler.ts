// Phase B-2: QUARTERLY_REVIEW_SUBMITTED Handler (stub)
// 알림 로직은 Phase B-3에서 구현

import type { DomainEventHandler, QuarterlyReviewSubmittedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'

export const quarterlyReviewSubmittedHandler: DomainEventHandler<'QUARTERLY_REVIEW_SUBMITTED'> = {
  eventName: DOMAIN_EVENTS.QUARTERLY_REVIEW_SUBMITTED,

  async handle(_payload: QuarterlyReviewSubmittedPayload, _tx?: TxClient): Promise<void> {
    // Phase B-3: 제출 상대방(직원→매니저, 매니저→직원)에게 알림
  },
}
