// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Application Stage State Machine (Recruitment)
// src/lib/recruitment/stage-machine.ts
//
// 채용 파이프라인 지원자 단계 상태 머신
//
// State Machine Diagram:
//
//   APPLIED ──→ SCREENING ──→ INTERVIEW_1 ──→ INTERVIEW_2 ──→ FINAL ──→ OFFER ──→ OFFER_ACCEPTED ──→ HIRED
//     │              │             │                │            │          │            │
//     │              │             ├── (skip) ──────┤            │          │            │
//     ├── (skip) ────┘             │                │            │          ├──→ OFFER_DECLINED
//     │                            ├── (skip) ──────────────────→┤          │
//     │                            │                │            │          │
//     ↓              ↓             ↓                ↓            ↓          ↓
//   REJECTED     REJECTED      REJECTED         REJECTED     REJECTED   REJECTED
//
// Forward skips allowed:
//   APPLIED → INTERVIEW_1
//   INTERVIEW_1 → FINAL
//
// Backward moves: FORBIDDEN
// Terminal states: HIRED, REJECTED
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: recruitment pipeline stage transitions
// Last verified: 2026-04-01
// ═══════════════════════════════════════════════════════════════

import type { ApplicationStage } from '@/generated/prisma/client'

// ─── Types ────────────────────────────────────────────────

export interface StageTransitionInput {
  currentStage: ApplicationStage
  targetStage: ApplicationStage
  rejectionReason?: string
}

export interface StageTransitionResult {
  allowed: boolean
  error?: string
}

// ─── Transitions ──────────────────────────────────────────

const TRANSITIONS: Record<ApplicationStage, ApplicationStage[]> = {
  APPLIED:        ['SCREENING', 'INTERVIEW_1', 'REJECTED'],
  SCREENING:      ['INTERVIEW_1', 'REJECTED'],
  INTERVIEW_1:    ['INTERVIEW_2', 'FINAL', 'REJECTED'],
  INTERVIEW_2:    ['FINAL', 'REJECTED'],
  FINAL:          ['OFFER', 'REJECTED'],
  OFFER:          ['OFFER_ACCEPTED', 'OFFER_DECLINED', 'REJECTED'],
  OFFER_ACCEPTED: ['HIRED'],
  OFFER_DECLINED: [],    // terminal
  HIRED:          [],    // terminal
  REJECTED:       [],    // terminal
}

// ─── Core Validator ───────────────────────────────────────

export function validateStageTransition(input: StageTransitionInput): StageTransitionResult {
  const { currentStage, targetStage, rejectionReason } = input

  // Terminal state check
  if (currentStage === 'HIRED' || currentStage === 'REJECTED') {
    return {
      allowed: false,
      error: `${currentStage}은(는) 최종 상태입니다. 더 이상 단계를 변경할 수 없습니다.`,
    }
  }

  // Transition allowed check
  const allowed = TRANSITIONS[currentStage] ?? []
  if (!allowed.includes(targetStage)) {
    return {
      allowed: false,
      error: `${currentStage} → ${targetStage} 단계 전환은 허용되지 않습니다.`,
    }
  }

  // REJECTED requires rejection reason
  if (targetStage === 'REJECTED' && !rejectionReason?.trim()) {
    return {
      allowed: false,
      error: '반려 시 사유를 입력해주세요.',
    }
  }

  return { allowed: true }
}

// ─── Helpers ──────────────────────────────────────────────

/**
 * Check if a stage is terminal (no further transitions possible).
 */
export function isTerminalStage(stage: ApplicationStage): boolean {
  return stage === 'HIRED' || stage === 'REJECTED' || stage === 'OFFER_DECLINED'
}
