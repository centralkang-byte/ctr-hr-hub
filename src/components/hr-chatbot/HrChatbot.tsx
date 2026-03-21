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
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('ai')
  const tCommon = useTranslations('common')
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
    content: t('chatbotWelcome'),
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
        { title: t('chatbotNewSession') },
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
            content: t('chatbotError'),
            createdAt: new Date(),
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [input, isLoading, currentSessionId, t],
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
          'fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex h-14 w-14 items-center justify-center',
          'rounded-full bg-ctr-primary text-white shadow-lg',
          'transition-transform hover:scale-105 active:scale-95',
          isOpen && 'hidden',
        )}
        aria-label={t('chatbotTitle')}
      >
        <MessageSquare className="h-6 w-6" />
      </button>

      {/* ─── Chat Panel ─── */}
      {isOpen && (
        <div
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden rounded-xl border bg-background shadow-xl',
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
                  {t('chatbotTitle')}
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
                            'w-full rounded px-3 py-2 text-left text-xs text-[#333] hover:bg-[#F5F5F5]',
                            s.id === currentSessionId && 'bg-[#EDF1FE] font-medium',
                          )}
                        >
                          {s.title ?? t('chatbotDefaultTitle')}
                        </button>
                      ))}
                      {sessions.length === 0 && (
                        <p className="px-3 py-2 text-xs text-[#666]">
                          {t('chatbotNoHistory')}
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
                aria-label={t('chatbotNewSession')}
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleOpen}
                className="rounded p-1 hover:bg-white/20"
                aria-label={tCommon('close')}
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
                          : 'bg-[#F5F5F5] text-foreground',
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
                              className="inline-flex items-center gap-1 rounded bg-[#EDF1FE] px-1.5 py-0.5 text-xs text-[#4B6DE0]"
                            >
                              {src.title} {src.reference}
                            </span>
                          ))}
                        </div>
                      )}

                    {/* Low confidence warning */}
                    {msg.needsEscalation && !msg.escalated && (
                      <div className="rounded bg-[#FEF3C7] px-2 py-1.5">
                        <div className="flex items-center gap-1 text-xs text-[#B45309]">
                          <AlertTriangle className="h-3 w-3" />
                          {t('chatbotLowConfidence')}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleEscalate(msg.id)}
                          className="mt-1 text-xs font-medium text-[#92400E] underline hover:text-[#78350F]"
                        >
                          {t('chatbotEscalate')}
                        </button>
                      </div>
                    )}

                    {msg.escalated && (
                      <div className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">
                        {t('chatbotEscalated')}
                      </div>
                    )}

                    {/* Feedback buttons */}
                    {msg.role === 'assistant' && msg.id !== 'welcome' && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleFeedback(msg.id, 'POSITIVE')}
                          className={cn(
                            'rounded p-0.5 hover:bg-[#E8E8E8]',
                            msg.feedback === 'POSITIVE' && 'text-green-600',
                          )}
                          aria-label={t('feedbackPositive')}
                        >
                          <ThumbsUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFeedback(msg.id, 'NEGATIVE')}
                          className={cn(
                            'rounded p-0.5 hover:bg-[#E8E8E8]',
                            msg.feedback === 'NEGATIVE' && 'text-[#DC2626]',
                          )}
                          aria-label={t('feedbackNegative')}
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E8E8E8]">
                      <UserCircle className="h-3.5 w-3.5 text-[#555]" />
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
                  <div className="rounded-lg bg-[#F5F5F5] px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#666]" />
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
              placeholder={t('chatbotPlaceholder')}
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
