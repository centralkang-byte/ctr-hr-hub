// ═══════════════════════════════════════════════════════════
// CTR HR Hub — In-Process Event Bus
// src/lib/events/event-bus.ts
// ═══════════════════════════════════════════════════════════
//
// 설계: 동기 인-프로세스 pub/sub
//   - 외부 메시지 큐 없음 (1K~3K 직원 규모 충분)
//   - 핸들러는 publish() 호출 순서대로 순차 실행
//   - tx가 전달되면 핸들러는 같은 트랜잭션 안에서 실행됨
//   - tx가 없으면 순수 side-effect (알림, 감사로그) 실행
//
// 핸들러 등록: bootstrap.ts에서 앱 시작 시 1회 실행
// ═══════════════════════════════════════════════════════════

import type {
  DomainEventName,
  DomainEventMap,
  DomainEventHandler,
  TxClient,
} from './types'

// ------------------------------------
// Handler Registry
// ------------------------------------

/** eventName → handler[] 맵 */
type HandlerRegistry = {
  [K in DomainEventName]?: DomainEventHandler<K>[]
}

class EventBus {
  private readonly registry: HandlerRegistry = {}

  // ── Registration ─────────────────────────────────────────

  /**
   * 핸들러 등록.
   * 같은 이벤트에 여러 핸들러 등록 가능 — 순서대로 실행됨.
   */
  subscribe<K extends DomainEventName>(handler: DomainEventHandler<K>): void {
    const name = handler.eventName as K
    if (!this.registry[name]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(this.registry as any)[name] = []
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this.registry[name] as DomainEventHandler<K>[]).push(handler)
  }

  // ── Publishing ───────────────────────────────────────────

  /**
   * 이벤트 발행 — 등록된 모든 핸들러를 순차 실행.
   *
   * @param name    이벤트 이름
   * @param payload 이벤트 페이로드
   * @param tx      Prisma 트랜잭션 클라이언트 (선택적)
   *                전달되면 핸들러가 같은 트랜잭션 내에서 실행됨
   */
  async publish<K extends DomainEventName>(
    name: K,
    payload: DomainEventMap[K],
    tx?: TxClient,
  ): Promise<void> {
    const handlers = this.registry[name] as DomainEventHandler<K>[] | undefined
    if (!handlers || handlers.length === 0) return

    for (const handler of handlers) {
      await handler.handle(payload, tx)
    }
  }

  // ── Introspection (테스트/디버그용) ───────────────────────

  /** 특정 이벤트에 등록된 핸들러 수 반환 */
  handlerCount(name: DomainEventName): number {
    return (this.registry[name]?.length ?? 0) as number
  }

  /** 모든 핸들러 해제 (테스트 teardown용) */
  clearAll(): void {
    for (const key of Object.keys(this.registry) as DomainEventName[]) {
      delete this.registry[key]
    }
  }
}

// ------------------------------------
// Singleton Export
// ------------------------------------

/**
 * 앱 전역 EventBus 싱글턴.
 * Next.js hot-reload 환경에서도 global cache 패턴으로 단일 인스턴스 보장.
 */
const globalForEventBus = globalThis as unknown as { __eventBus?: EventBus }

export const eventBus: EventBus =
  globalForEventBus.__eventBus ?? (globalForEventBus.__eventBus = new EventBus())

export type { EventBus }
