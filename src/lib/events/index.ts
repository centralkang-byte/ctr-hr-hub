// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Events Module Barrel Export
// src/lib/events/index.ts
// ═══════════════════════════════════════════════════════════

export { eventBus }                  from './event-bus'
export { DOMAIN_EVENTS }             from './types'
export type {
  DomainEventName,
  DomainEventMap,
  DomainEvent,
  DomainEventHandler,
  TxClient,
  EventContext,
  LeaveApprovedPayload,
  LeaveRejectedPayload,
  LeaveCancelledPayload,
  LeaveRequestedPayload,
  PayrollCalculatedPayload,
  PayrollApprovedPayload,
  PayrollPaidPayload,
} from './types'
export { bootstrapEventHandlers }    from './bootstrap'
