'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — HrChatbot (v4.0)
// RAG 파이프라인 연동, 세션관리, 출처표시, 에스컬레이션
// ═══════════════════════════════════════════════════════════

import {
  useCallback,
  useRef,
  useState,
  useEffect,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  MessageSquare,
  X,
  Send,
  ThumbsUp,
  ThumbsDown,
  UserCircle,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  confidenceScore?: number | null
  escalated?: boolean
  feedback?: 'POSITIVE' | 'NEGATIVE' | null
  createdAt: Date
  needsEscalation?: boolean
}

interface ChatSource {
  title: string
  reference: string
  chunkId?: string
}

interface ChatSession {
  id: string
  title: string | null
  updatedAt: string
  _count?: { messages: number }
}

// ─── Component ──────────────────────────────────────────────

export function HrChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [showSessions, setShowSessions] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const welcomeMessage: ChatMessage = {
    id: 'welcome',
    role: 'assistant',
    content:
      '안녕하세요! CTR HR 챗봇입니다. 근태, 휴가, 급여, 인사 정책 등에 대해 질문해 주세요.',
    createdAt: new Date(),
  }

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Load sessions when opened
  useEffect(() => {
    if (isOpen) {
      apiClient
        .get<ChatSession[]>('/api/v1/hr-chat/sessions')
        .then((res) => setSessions(res.data))
        .catch(() => {})
    }
  }, [isOpen])

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const createNewSession = useCallback(async () => {
    try {
      const res = await apiClient.post<ChatSession>(
        '/api/v1/hr-chat/sessions',
        { title: '새 대화' },
      )
      setCurrentSessionId(res.data.id)
      setMessages([welcomeMessage])
      setSessions((prev) => [res.data, ...prev])
      setShowSessions(false)
    } catch {
      // fallback: local-only
      setMessages([welcomeMessage])
      setCurrentSessionId(null)
    }
  }, [])

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const res = await apiClient.get<ChatMessage[]>(
        `/api/v1/hr-chat/sessions/${sessionId}/messages`,
      )
      const msgs = res.data
      setCurrentSessionId(sessionId)
      setMessages(
        msgs.length > 0
          ? msgs.map((m) => ({
              ...m,
              createdAt: new Date(m.createdAt),
              feedback: m.feedback ?? null,
            }))
          : [welcomeMessage],
      )
      setShowSessions(false)
    } catch {
      // silently fail
    }
  }, [])

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const trimmed = input.trim()
      if (!trimmed || isLoading) return

      // Ensure we have a session
      let sessionId = currentSessionId
      if (!sessionId) {
        try {
          const sessionRes = await apiClient.post<ChatSession>(
            '/api/v1/hr-chat/sessions',
            { title: trimmed.slice(0, 50) },
          )
          sessionId = sessionRes.data.id
          setCurrentSessionId(sessionId)
          setSessions((prev) => [sessionRes.data, ...prev])
        } catch {
          return
        }
      }

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setIsLoading(true)

      try {
        const res = await apiClient.post<{
          userMessage: ChatMessage
          assistantMessage: ChatMessage
          needsEscalation?: boolean
        }>(`/api/v1/hr-chat/sessions/${sessionId}/messages`, {
          content: trimmed,
        })
        const result = res.data

        const aiMsg: ChatMessage = {
          ...result.assistantMessage,
          createdAt: new Date(result.assistantMessage.createdAt),
          feedback: result.assistantMessage.feedback ?? null,
          needsEscalation: result.needsEscalation,
        }

        // Replace the temp user message and add AI response
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== userMsg.id)
          return [
            ...filtered,
            {
              ...result.userMessage,
              createdAt: new Date(result.userMessage.createdAt),
            },
            aiMsg,
          ]
        })
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: '죄송합니다. 응답을 생성하는 중 오류가 발생했습니다.',
            createdAt: new Date(),
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [input, isLoading, currentSessionId],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit(e as unknown as FormEvent)
      }
    },
    [handleSubmit],
  )

  const handleFeedback = useCallback(
    async (messageId: string, feedback: 'POSITIVE' | 'NEGATIVE') => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, feedback } : msg,
        ),
      )
      try {
        await apiClient.put(`/api/v1/hr-chat/messages/${messageId}/feedback`, {
          feedback,
        })
      } catch {
        // silently fail
      }
    },
    [],
  )

  const handleEscalate = useCallback(async (messageId: string) => {
    try {
      await apiClient.post(
        `/api/v1/hr-chat/messages/${messageId}/escalate`,
        {},
      )
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, escalated: true, needsEscalation: false }
            : msg,
        ),
      )
    } catch {
      // silently fail
    }
  }, [])

  const handleNewChat = useCallback(() => {
    createNewSession()
  }, [createNewSession])

  return (
    <>
      {/* ─── Floating Button ─── */}
      <button
        type="button"
        onClick={toggleOpen}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center',
          'rounded-full bg-ctr-primary text-white shadow-lg',
          'transition-transform hover:scale-105 active:scale-95',
          isOpen && 'hidden',
        )}
        aria-label="HR 챗봇 열기"
      >
        <MessageSquare className="h-6 w-6" />
      </button>

      {/* ─── Chat Panel ─── */}
      {isOpen && (
        <div
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden rounded-lg border bg-background shadow-xl',
            'bottom-6 right-6 h-[500px] w-[360px]',
            'max-md:inset-0 max-md:bottom-0 max-md:right-0 max-md:h-full max-md:w-full max-md:rounded-none',
          )}
        >
          {/* ─── Header ─── */}
          <div className="flex items-center justify-between border-b bg-ctr-primary px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSessions((p) => !p)}
                  className="flex items-center gap-1 text-sm font-semibold hover:opacity-80"
                >
                  HR 챗봇
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showSessions && (
                  <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-lg border bg-white shadow-lg">
                    <div className="max-h-48 overflow-y-auto p-1">
                      {sessions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => loadSession(s.id)}
                          className={cn(
                            'w-full rounded px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-100',
                            s.id === currentSessionId && 'bg-blue-50 font-medium',
                          )}
                        >
                          {s.title ?? '대화'}
                        </button>
                      ))}
                      {sessions.length === 0 && (
                        <p className="px-3 py-2 text-xs text-gray-500">
                          대화 내역이 없습니다.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleNewChat}
                className="rounded p-1 hover:bg-white/20"
                aria-label="새 대화"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleOpen}
                className="rounded p-1 hover:bg-white/20"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ─── Messages ─── */}
          <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-2',
                    msg.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ctr-primary text-white">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] space-y-1',
                      msg.role === 'user' ? 'items-end' : 'items-start',
                    )}
                  >
                    <div
                      className={cn(
                        'rounded-lg px-3 py-2 text-sm',
                        msg.role === 'user'
                          ? 'bg-ctr-primary text-white'
                          : 'bg-gray-100 text-foreground',
                      )}
                    >
                      {msg.content}
                    </div>

                    {/* Source citations */}
                    {msg.sources &&
                      Array.isArray(msg.sources) &&
                      msg.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {msg.sources.map((src, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700"
                            >
                              {src.title} {src.reference}
                            </span>
                          ))}
                        </div>
                      )}

                    {/* Low confidence warning */}
                    {msg.needsEscalation && !msg.escalated && (
                      <div className="rounded bg-amber-50 px-2 py-1.5">
                        <div className="flex items-center gap-1 text-xs text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          정확도가 낮을 수 있습니다.
                        </div>
                        <button
                          type="button"
                          onClick={() => handleEscalate(msg.id)}
                          className="mt-1 text-xs font-medium text-amber-800 underline hover:text-amber-900"
                        >
                          담당자에게 문의
                        </button>
                      </div>
                    )}

                    {msg.escalated && (
                      <div className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">
                        HR 담당자에게 전달되었습니다.
                      </div>
                    )}

                    {/* Feedback buttons */}
                    {msg.role === 'assistant' && msg.id !== 'welcome' && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleFeedback(msg.id, 'POSITIVE')}
                          className={cn(
                            'rounded p-0.5 hover:bg-gray-200',
                            msg.feedback === 'POSITIVE' && 'text-green-600',
                          )}
                          aria-label="도움이 되었어요"
                        >
                          <ThumbsUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFeedback(msg.id, 'NEGATIVE')}
                          className={cn(
                            'rounded p-0.5 hover:bg-gray-200',
                            msg.feedback === 'NEGATIVE' && 'text-red-600',
                          )}
                          aria-label="도움이 안 되었어요"
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200">
                      <UserCircle className="h-3.5 w-3.5 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ctr-primary text-white">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-lg bg-gray-100 px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* ─── Input ─── */}
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 border-t px-4 py-3"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="질문을 입력하세요..."
              rows={1}
              className="flex-1 resize-none rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || isLoading}
              className="bg-ctr-primary hover:bg-ctr-primary/90"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  )
}
