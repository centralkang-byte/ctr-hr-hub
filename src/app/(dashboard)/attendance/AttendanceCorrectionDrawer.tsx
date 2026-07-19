'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Correction Drawer
// 직원 근태 보정 요청: 법인 시간대 입력, DST 검증, 사유 제출
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { WdDrawer, WdField, WdRow } from '@/components/shared/WdDrawer'
import {
  ATTENDANCE_WALL_TIME_FORMAT,
  resolveAttendanceWallTime,
} from '@/lib/attendance/correction-time'
import { apiClient } from '@/lib/api'
import { isAppError } from '@/lib/errors'
import { formatToTz, isSupportedAttendanceTimezone } from '@/lib/timezone'
import { toast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────

export interface AttendanceCorrectionRecord {
  id: string
  date: string
  clockIn: string | null
  clockOut: string | null
}

interface AttendanceCorrectionDrawerProps {
  open: boolean
  record: AttendanceCorrectionRecord | null
  timezone: string
  onClose: () => void
  onSubmitted: () => void | Promise<void>
}

interface FieldErrors {
  clockIn?: string
  clockOut?: string
  reason?: string
  form?: string
}

type InstantErrorCode = 'gap' | 'fold' | 'unsupportedTimezone' | 'invalidDateTime'

type InstantResolution =
  | { ok: true; value: string | null }
  | { ok: false; error: InstantErrorCode }

// ─── Constants ──────────────────────────────────────────────

const REASON_MAX_LENGTH = 500
const INSTANT_ERROR_KEYS: Record<InstantErrorCode, string> = {
  gap: 'correctionDstGap',
  fold: 'correctionDstFold',
  unsupportedTimezone: 'correctionUnsupportedTimezone',
  invalidDateTime: 'correctionInvalidDateTime',
}

const CORRECTION_ERROR_KEYS: Record<string, string> = {
  ATTENDANCE_CORRECTION_DUPLICATE: 'correctionErrorDuplicate',
  ATTENDANCE_PERIOD_LOCKED: 'correctionErrorPeriodLocked',
  ATTENDANCE_CORRECTION_STALE: 'correctionErrorStale',
  ATTENDANCE_CORRECTION_DECISION_RACE: 'correctionErrorDecisionRace',
  ATTENDANCE_CLOCK_RACE: 'correctionErrorClockRace',
  ATTENDANCE_CORRECTION_INVALID: 'correctionErrorInvalid',
  ATTENDANCE_CORRECTION_CLAIM_REQUIRED: 'correctionErrorClaimRequired',
  ATTENDANCE_CORRECTION_NO_APPROVER: 'correctionErrorNoApprover',
}

// ─── Helpers ────────────────────────────────────────────────

function toWallTime(instant: string | null, timezone: string): string {
  if (!instant) return ''
  return formatToTz(instant, timezone, ATTENDANCE_WALL_TIME_FORMAT)
}

function resolveSubmittedInstant(params: {
  wallTime: string
  originalWallTime: string
  originalInstant: string | null
  timezone: string
}): InstantResolution {
  const { wallTime, originalWallTime, originalInstant, timezone } = params

  if (!wallTime) return { ok: true, value: null }
  if (originalInstant && wallTime === originalWallTime) {
    return { ok: true, value: originalInstant }
  }

  const resolution = resolveAttendanceWallTime(wallTime, timezone)
  if (resolution.status === 'unique') {
    return { ok: true, value: resolution.candidates[0] }
  }
  if (resolution.status === 'gap') {
    return { ok: false, error: 'gap' }
  }
  if (resolution.status === 'fold') {
    return { ok: false, error: 'fold' }
  }
  if (resolution.status === 'unsupported_timezone') {
    return { ok: false, error: 'unsupportedTimezone' }
  }
  return { ok: false, error: 'invalidDateTime' }
}

function ErrorMessage({ id, children }: { id: string; children?: string }) {
  if (!children) return null

  return (
    <p id={id} role="alert" className="flex items-center gap-1 text-xs text-destructive">
      <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  )
}

// ─── Component ──────────────────────────────────────────────

export function AttendanceCorrectionDrawer({
  open,
  record,
  timezone,
  onClose,
  onSubmitted,
}: AttendanceCorrectionDrawerProps) {
  const t = useTranslations('attendance')
  const tc = useTranslations('common')

  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const clockInRef = useRef<HTMLInputElement>(null)
  const clockOutRef = useRef<HTMLInputElement>(null)
  const reasonRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open || !record) return

    try {
      setClockIn(toWallTime(record.clockIn, timezone))
      setClockOut(toWallTime(record.clockOut, timezone))
      setErrors({})
    } catch {
      setClockIn('')
      setClockOut('')
      setErrors({ form: t('correctionTimeConversionFailed') })
    }
    setReason('')
  }, [open, record, t, timezone])

  const clearError = useCallback((field: keyof FieldErrors) => {
    setErrors((current) => {
      if (!current[field] && !current.form) return current
      return { ...current, [field]: undefined, form: undefined }
    })
  }, [])

  const showErrors = useCallback((nextErrors: FieldErrors) => {
    setErrors(nextErrors)
    requestAnimationFrame(() => {
      if (nextErrors.clockIn) clockInRef.current?.focus()
      else if (nextErrors.clockOut) clockOutRef.current?.focus()
      else if (nextErrors.reason) reasonRef.current?.focus()
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!record || submitting) return

    const nextErrors: FieldErrors = {}
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      nextErrors.reason = tc('required')
    } else if (trimmedReason.length > REASON_MAX_LENGTH) {
      nextErrors.reason = t('correctionReasonTooLong', { max: REASON_MAX_LENGTH })
    }

    if (!isSupportedAttendanceTimezone(timezone)) {
      nextErrors.form = t('correctionUnsupportedTimezone')
    }

    let originalClockInWall = ''
    let originalClockOutWall = ''
    if (!nextErrors.form) {
      try {
        originalClockInWall = toWallTime(record.clockIn, timezone)
        originalClockOutWall = toWallTime(record.clockOut, timezone)
      } catch {
        nextErrors.form = t('correctionTimeConversionFailed')
      }
    }

    if (nextErrors.form) {
      showErrors(nextErrors)
      return
    }

    const resolvedClockIn = resolveSubmittedInstant({
      wallTime: clockIn,
      originalWallTime: originalClockInWall,
      originalInstant: record.clockIn,
      timezone,
    })
    const resolvedClockOut = resolveSubmittedInstant({
      wallTime: clockOut,
      originalWallTime: originalClockOutWall,
      originalInstant: record.clockOut,
      timezone,
    })

    if (!resolvedClockIn.ok) {
      nextErrors.clockIn = t(INSTANT_ERROR_KEYS[resolvedClockIn.error])
    }
    if (!resolvedClockOut.ok) {
      nextErrors.clockOut = t(INSTANT_ERROR_KEYS[resolvedClockOut.error])
    }

    if (resolvedClockIn.ok && resolvedClockOut.ok) {
      if (resolvedClockIn.value === null && resolvedClockOut.value === null) {
        nextErrors.clockIn = t('correctionTimeRequired')
      } else if (
        resolvedClockIn.value === record.clockIn &&
        resolvedClockOut.value === record.clockOut
      ) {
        nextErrors.form = t('correctionNoChanges')
      } else if (resolvedClockIn.value && resolvedClockOut.value) {
        const elapsedMs =
          new Date(resolvedClockOut.value).getTime() -
          new Date(resolvedClockIn.value).getTime()
        if (elapsedMs < 0) {
          nextErrors.clockOut = t('correctionClockOrderInvalid')
        } else if (elapsedMs > 24 * 60 * 60 * 1000) {
          nextErrors.clockOut = t('correctionDurationTooLong')
        }
      }
    }

    if (!resolvedClockIn.ok || !resolvedClockOut.ok) {
      showErrors(nextErrors)
      return
    }

    if (Object.values(nextErrors).some(Boolean)) {
      showErrors(nextErrors)
      return
    }

    setSubmitting(true)
    try {
      await apiClient.post(`/api/v1/attendance/${record.id}/correction-requests`, {
        clockIn: resolvedClockIn.value,
        clockOut: resolvedClockOut.value,
        reason: trimmedReason,
      })
      toast({ title: t('correctionSubmitSuccess') })
      await onSubmitted()
      onClose()
    } catch (error) {
      const errorKey = isAppError(error) ? CORRECTION_ERROR_KEYS[error.code] : undefined
      toast({
        title: t('correctionSubmitFailed'),
        description: errorKey ? t(errorKey) : tc('retryDesc'),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }, [clockIn, clockOut, onClose, onSubmitted, reason, record, showErrors, submitting, t, tc, timezone])

  return (
    <WdDrawer
      open={open}
      onClose={onClose}
      eyebrow={t('myAttendance')}
      title={t('requestCorrection')}
      closeDisabled={submitting}
      className="[&>div:last-child>button]:min-h-11 md:[&>div:last-child>button]:min-h-9"
      secondary={{ label: tc('cancel'), onClick: onClose, disabled: submitting }}
      primary={{
        label: submitting ? t('submitting') : tc('submit'),
        onClick: handleSubmit,
        disabled: submitting || !record,
        icon: submitting
          ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
      }}
    >
      {record ? (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
          className="flex flex-col gap-4"
        >
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="mb-1 text-xs text-muted-foreground">{t('workDate')}</p>
            <p className="text-sm font-semibold text-foreground tabular-nums">{record.date}</p>
            <p className="mt-1 text-xs text-muted-foreground">{timezone}</p>
          </div>

          <WdRow>
            <WdField label={t('clockInTime')} htmlFor="attendance-correction-clock-in">
              <Input
                ref={clockInRef}
                id="attendance-correction-clock-in"
                name="attendanceCorrectionClockIn"
                type="datetime-local"
                autoComplete="off"
                step={60}
                value={clockIn}
                onChange={(event) => {
                  setClockIn(event.target.value)
                  clearError('clockIn')
                }}
                aria-invalid={Boolean(errors.clockIn)}
                aria-describedby={errors.clockIn ? 'attendance-correction-clock-in-error' : undefined}
                className="min-h-11 md:min-h-9"
                disabled={submitting}
              />
              <ErrorMessage id="attendance-correction-clock-in-error">
                {errors.clockIn}
              </ErrorMessage>
            </WdField>

            <WdField label={t('clockOutTime')} htmlFor="attendance-correction-clock-out">
              <Input
                ref={clockOutRef}
                id="attendance-correction-clock-out"
                name="attendanceCorrectionClockOut"
                type="datetime-local"
                autoComplete="off"
                step={60}
                value={clockOut}
                onChange={(event) => {
                  setClockOut(event.target.value)
                  clearError('clockOut')
                }}
                aria-invalid={Boolean(errors.clockOut)}
                aria-describedby={errors.clockOut ? 'attendance-correction-clock-out-error' : undefined}
                className="min-h-11 md:min-h-9"
                disabled={submitting}
              />
              <ErrorMessage id="attendance-correction-clock-out-error">
                {errors.clockOut}
              </ErrorMessage>
            </WdField>
          </WdRow>

          <WdField
            label={t('correctionReason')}
            required
            htmlFor="attendance-correction-reason"
            help={<span className="block text-right tabular-nums">{reason.length}/{REASON_MAX_LENGTH}</span>}
          >
            <Textarea
              ref={reasonRef}
              id="attendance-correction-reason"
              name="attendanceCorrectionReason"
              autoComplete="off"
              rows={4}
              maxLength={REASON_MAX_LENGTH}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                clearError('reason')
              }}
              placeholder={tc('placeholderReason')}
              aria-invalid={Boolean(errors.reason)}
              aria-describedby={errors.reason ? 'attendance-correction-reason-error' : undefined}
              disabled={submitting}
            />
            <ErrorMessage id="attendance-correction-reason-error">
              {errors.reason}
            </ErrorMessage>
          </WdField>

          <ErrorMessage id="attendance-correction-form-error">{errors.form}</ErrorMessage>
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      ) : null}
    </WdDrawer>
  )
}
