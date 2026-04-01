// Phase B-2: QUARTERLY_REVIEW_CREATED Handler (stub)
// 알림 로직은 Phase B-3에서 구현

import type { DomainEventHandler, QuarterlyReviewCreatedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'

export const quarterlyReviewCreatedHandler: DomainEventHandler<'QUARTERLY_REVIEW_CREATED'> = {
  eventName: DOMAIN_EVENTS.QUARTERLY_REVIEW_CREATED,

  async handle(_payload: QuarterlyReviewCreatedPayload, _tx?: TxClient): Promise<void> {
    // Phase B-3: 매니저/직원에게 분기 리뷰 생성 알림
  },
}
