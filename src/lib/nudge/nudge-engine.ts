// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Nudge Engine (Core)
// src/lib/nudge/nudge-engine.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: nudge rule execution engine — schedules and deduplicates reminders
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// 작동 방식:
//   1. 각 룰의 thresholds.triggerAfterDays 이전 cutoffDate 계산
//   2. 룰에게 findOverdueItems() 요청
//   3. 각 항목에 대해:
//      a. 기존 nudge 횟수 조회 (Notification 테이블)
//      b. maxNudges 초과 시 skip
//      c. 마지막 nudge로부터 repeatEveryDays 미경과 시 skip
//      d. 조건 충족 시 sendNotification()
// ═══════════════════════════════════════════════════════════

import { subDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { sendNotification } from '@/lib/notifications'
import { getNudgeRulesSettings } from '@/lib/settings/get-setting'
import type {
  NudgeRule,
  NudgeThresholds,
  NudgeEngineConfig,
  NudgeResult,
  NudgeRunSummary,
  OverdueItem,
} from './types'

// ------------------------------------
// Nudge History Key
// ------------------------------------

/**
 * Notification.triggerType 패턴으로 nudge 이력 추적.
 * 형식: `nudge:{ruleId}:{sourceId}`
 */
function nudgeTriggerType(ruleId: string, sourceId: string): string {
  return `nudge:${ruleId}:${sourceId}`
}

// ------------------------------------
// History Query
// ------------------------------------

interface NudgeHistory {
  count: number
  lastSentAt: Date | null
}

async function getNudgeHistory(
  employeeId: string,
  triggerType: string,
): Promise<NudgeHistory> {
  const records = await prisma.notification.findMany({
    where: { employeeId, triggerType },
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return {
    count: records.length,
    lastSentAt: records[0]?.createdAt ?? null,
  }
}

// ------------------------------------
// Per-Item Nudge Evaluation
// ------------------------------------

async function evaluateItem(
  rule: NudgeRule,
  item: OverdueItem,
  oncePer24h: boolean,
): Promise<NudgeResult[]> {
  const results: NudgeResult[] = []
  const daysOverdue = Math.floor(
    (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  )
  const triggerType = nudgeTriggerType(rule.ruleId, item.sourceId)

  for (const recipientId of item.recipientIds) {
    const history = await getNudgeHistory(recipientId, triggerType)

    // Guard 1: maxNudges 초과
    if (history.count >= rule.thresholds.maxNudges) {
      results.push({ ruleId: rule.ruleId, sourceId: item.sourceId, recipientId, sent: false, reason: 'max_nudges_reached' })
      continue
    }

    // Guard 2: 24h oncePer24h 방지
    if (oncePer24h && history.lastSentAt) {
      const since = (Date.now() - history.lastSentAt.getTime()) / (1000 * 60 * 60)
      if (since < 24) {
        results.push({ ruleId: rule.ruleId, sourceId: item.sourceId, recipientId, sent: false, reason: 'cooldown' })
        continue
      }
    }

    // Guard 3: repeatEveryDays 간격 미충족
    if (history.count > 0 && history.lastSentAt) {
      const repeatCutoff = subDays(new Date(), rule.thresholds.repeatEveryDays)
      if (history.lastSentAt > repeatCutoff) {
        results.push({ ruleId: rule.ruleId, sourceId: item.sourceId, recipientId, sent: false, reason: 'cooldown' })
        continue
      }
    }

    // ✅ Send nudge
    sendNotification({
      employeeId:  recipientId,
      triggerType,
      title:       rule.buildTitle(item),
      body:        rule.buildBody(item, daysOverdue),
      titleKey:    rule.getTitleKey?.(item),
      bodyKey:     rule.getBodyKey?.(item),
      bodyParams:  rule.getBodyParams?.(item, daysOverdue),
      link:        item.actionUrl,
      priority:    'high',
      metadata: {
        ruleId:      rule.ruleId,
        sourceId:    item.sourceId,
        sourceModel: item.sourceModel,
        daysOverdue,
        nudgeCount:  history.count + 1,
        ...item.meta,
      },
    })

    results.push({ ruleId: rule.ruleId, sourceId: item.sourceId, recipientId, sent: true })
  }

  return results
}

// ------------------------------------
// Nudge Engine
// ------------------------------------

export class NudgeEngine {
  private readonly rules: NudgeRule[]
  private readonly oncePer24h: boolean

  constructor(config: NudgeEngineConfig) {
    this.rules    = config.rules
    this.oncePer24h = config.oncePer24h ?? true
  }

  /**
   * 특정 사용자에 대해 모든 룰을 평가하고 nudge 발송.
   * D-3: login 또는 dashboard load 시 호출됨.
   *
   * @param companyId  법인 ID (IDOR 방지)
   * @param assigneeId 로그인한 담당자 employeeId
   */
  async run(companyId: string, assigneeId: string): Promise<NudgeRunSummary> {
    const evaluatedAt = new Date()
    const allResults: NudgeResult[] = []
    let totalChecked = 0

    // Load configurable thresholds from SYSTEM/nudge-rules (S-Fix-5)
    const nudgeSettings = await getNudgeRulesSettings(companyId)
    const thresholdOverrides: Record<string, NudgeThresholds> = {
      'leave-pending-approval': nudgeSettings.leavePending,
      'payroll-review-pending': nudgeSettings.payrollReview,
    }

    for (const rule of this.rules) {
      // Use settings-based thresholds if available, fallback to rule defaults
      const thresholds = thresholdOverrides[rule.ruleId] ?? rule.thresholds

      // cutoffDate: 이 시각보다 오래된 항목만 nudge 대상
      const cutoffDate = subDays(new Date(), thresholds.triggerAfterDays)

      const items = await rule.findOverdueItems(companyId, assigneeId, cutoffDate)
      totalChecked += items.length

      for (const item of items) {
        // Temporarily apply settings thresholds for evaluateItem
        const originalThresholds = rule.thresholds
        rule.thresholds = thresholds
        const itemResults = await evaluateItem(rule, item, this.oncePer24h)
        rule.thresholds = originalThresholds
        allResults.push(...itemResults)
      }
    }

    return {
      evaluatedAt,
      companyId,
      assigneeId,
      totalRules:   this.rules.length,
      totalChecked,
      totalSent:    allResults.filter((r) => r.sent).length,
      results:      allResults,
    }
  }
}
