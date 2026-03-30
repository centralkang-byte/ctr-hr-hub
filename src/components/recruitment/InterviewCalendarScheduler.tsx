'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Interview Calendar Scheduler
// 캘린더 스케줄링: 슬롯 조회 → 선택 → 예약/변경/취소
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { format } from 'date-fns'
import {
  Calendar,
  Clock,
  Video,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

// ─── Types ──────────────────────────────────────────────────

interface TimeSlot {
  start: string
  end: string
}

interface AvailableSlotsResponse {
  slots: TimeSlot[]
  interviewerName: string
  durationMinutes: number
  businessDays: string[]
}

interface InterviewCalendarSchedulerProps {
  interviewId: string
  scheduledAt: string | null
  calendarEventId: string | null
  meetingLink: string | null
  durationMinutes: number
  onScheduled: () => void
}

// ─── Component ─────────────────────────────────────────────

export function InterviewCalendarScheduler({
  interviewId,
  scheduledAt,
  calendarEventId,
  meetingLink,
  durationMinutes,
  onScheduled,
}: InterviewCalendarSchedulerProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [interviewerName, setInterviewerName] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [mode, setMode] = useState<'view' | 'reschedule'>('view')
  const { confirm, dialogProps } = useConfirmDialog()

  const hasEvent = !!calendarEventId

  const fetchSlots = async () => {
    setLoading(true)
    setSelectedSlot(null)
    try {
      const res = await apiClient.get<AvailableSlotsResponse>(
        `/api/v1/recruitment/interviews/${interviewId}/calendar/available-slots`,
      )
      setSlots(res.data.slots)
      setInterviewerName(res.data.interviewerName)
    } catch {
      setSlots([])
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = () => {
    setOpen(true)
    if (!hasEvent) {
      setMode('view')
      fetchSlots()
    }
  }

  const handleSchedule = async () => {
    if (!selectedSlot) return
    setSubmitting(true)
    try {
      if (hasEvent) {
        await apiClient.put(
          `/api/v1/recruitment/interviews/${interviewId}/calendar`,
          { slotStart: selectedSlot.start, slotEnd: selectedSlot.end },
        )
      } else {
        await apiClient.post(
          `/api/v1/recruitment/interviews/${interviewId}/calendar`,
          {
            slotStart: selectedSlot.start,
            slotEnd: selectedSlot.end,
            isOnline: true,
          },
        )
      }
      setOpen(false)
      onScheduled()
    } catch {
      // Error handled by apiClient
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    confirm({ title: '캘린더 이벤트를 취소하시겠습니까?', onConfirm: async () => {
      setSubmitting(true)
      try {
        await apiClient.delete(
          `/api/v1/recruitment/interviews/${interviewId}/calendar`,
        )
        setOpen(false)
        onScheduled()
      } catch {
        // Error handled by apiClient
      } finally {
        setSubmitting(false)
      }
    }})
  }

  // Group slots by date
  const slotsByDate = slots.reduce<Record<string, TimeSlot[]>>((acc, slot) => {
    const date = slot.start.split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(slot)
    return acc
  }, {})

  return (
    <>
      <Button
        variant={hasEvent ? 'outline' : 'default'}
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          handleOpen()
        }}
        style={{
          borderRadius: 6,
          fontSize: 12,
          padding: '4px 10px',
          gap: 4,
          ...(hasEvent
            ? {}
            : { backgroundColor: '#5E81F4', color: '#fff' }),
        }}
      >
        <Calendar size={14} />
        {hasEvent ? '일정 관리' : '일정 예약'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          style={{ maxWidth: 560, borderRadius: 16, padding: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader style={{ padding: '24px 24px 0' }}>
            <DialogTitle style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
              {hasEvent && mode === 'view'
                ? '면접 일정 관리'
                : '면접 일정 예약'}
            </DialogTitle>
            {interviewerName && (
              <p style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
                면접관: {interviewerName} · {durationMinutes}분
              </p>
            )}
          </DialogHeader>

          <div
            style={{
              padding: '20px 24px',
              maxHeight: 420,
              overflowY: 'auto',
            }}
          >
            {/* Existing event view */}
            {hasEvent && mode === 'view' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  style={{
                    padding: 16,
                    backgroundColor: '#EDF1FE',
                    borderRadius: 12,
                    border: '1px solid #C8E6C9',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Clock size={16} className="text-primary" />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1B5E20' }}>
                      {scheduledAt
                        ? format(new Date(scheduledAt), 'yyyy-MM-dd HH:mm')
                        : '-'}
                    </span>
                  </div>

                  {meetingLink && (
                    <a
                      href={meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13,
                        color: '#5E81F4',
                        textDecoration: 'none',
                      }}
                    >
                      <Video size={14} />
                      Teams 미팅 링크
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMode('reschedule')
                      fetchSlots()
                    }}
                    style={{ borderRadius: 8, flex: 1 }}
                  >
                    <RefreshCw size={14} className="mr-1" />
                    일정 변경
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={submitting}
                    style={{
                      borderRadius: 8,
                      flex: 1,
                      borderColor: '#FCA5A5',
                      color: '#DC2626',
                    }}
                  >
                    {submitting ? (
                      <Loader2 size={14} className="mr-1 animate-spin" />
                    ) : (
                      <Trash2 size={14} className="mr-1" />
                    )}
                    일정 취소
                  </Button>
                </div>
              </div>
            )}

            {/* Slot selection */}
            {(!hasEvent || mode === 'reschedule') && (
              <>
                {loading ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 40,
                      color: '#999',
                    }}
                  >
                    <Loader2 size={20} className="animate-spin mr-2" />
                    가용 시간 조회 중...
                  </div>
                ) : slots.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 40,
                      color: '#999',
                      fontSize: 14,
                    }}
                  >
                    가용 시간이 없습니다
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {Object.entries(slotsByDate).map(([date, dateSlots]) => (
                      <div key={date}>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#1A1A1A',
                            marginBottom: 8,
                          }}
                        >
                          {format(new Date(date), 'yyyy-MM-dd (EEE)')}
                        </p>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 6,
                          }}
                        >
                          {dateSlots.map((slot) => {
                            const isSelected =
                              selectedSlot?.start === slot.start
                            return (
                              <button
                                key={slot.start}
                                type="button"
                                onClick={() => setSelectedSlot(slot)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 6,
                                  border: isSelected
                                    ? '2px solid #5E81F4'
                                    : '1px solid #E5E7EB',
                                  backgroundColor: isSelected
                                    ? '#EDF1FE'
                                    : '#FFFFFF',
                                  color: isSelected ? '#5E81F4' : '#374151',
                                  fontSize: 13,
                                  fontWeight: isSelected ? 600 : 400,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {format(new Date(slot.start), 'HH:mm')}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {(!hasEvent || mode === 'reschedule') && (
            <DialogFooter
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #E8E8E8',
              }}
            >
              <Button
                variant="outline"
                onClick={() => {
                  if (mode === 'reschedule') {
                    setMode('view')
                  } else {
                    setOpen(false)
                  }
                }}
                style={{ borderRadius: 8 }}
              >
                {mode === 'reschedule' ? '돌아가기' : '취소'}
              </Button>
              <Button
                onClick={handleSchedule}
                disabled={!selectedSlot || submitting}
                style={{
                  borderRadius: 8,
                  backgroundColor: '#5E81F4',
                  color: '#FFFFFF',
                }}
              >
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {hasEvent ? '일정 변경' : '일정 예약'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog {...dialogProps} />
      </>
  )
}
