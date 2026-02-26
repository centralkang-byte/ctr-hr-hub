'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — HrChatbot (v3.2)
// 플로팅 HR 챗봇 (Shell — API 연동은 후속 STEP)
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  feedback?: 'up' | 'down' | null
  createdAt: Date
}

interface ChatSource {
  title: string
  reference: string
}

// ─── Component ──────────────────────────────────────────────

export function HrChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '안녕하세요! CTR HR 챗봇입니다. 근태, 휴가, 급여, 인사 정책 등에 대해 질문해 주세요.',
      createdAt: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      const trimmed = input.trim()
      if (!trimmed || isLoading) return

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date(),
      }

      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setIsLoading(true)

      // Stub: simulate AI response after 1s
      setTimeout(() => {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content:
            '죄송합니다, 현재 AI 응답 기능이 준비 중입니다. 곧 연동될 예정입니다.',
          sources: [
            { title: '취업규칙', reference: '제15조' },
          ],
          feedback: null,
          createdAt: new Date(),
        }
        setMessages((prev) => [...prev, aiMsg])
        setIsLoading(false)
      }, 1000)
    },
    [input, isLoading],
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
    (messageId: string, feedback: 'up' | 'down') => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, feedback } : msg,
        ),
      )
      // Stub: send feedback to API in later steps
    },
    [],
  )

  const handleNewChat = useCallback(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          '안녕하세요! CTR HR 챗봇입니다. 근태, 휴가, 급여, 인사 정책 등에 대해 질문해 주세요.',
        createdAt: new Date(),
      },
    ])
    setInput('')
  }, [])

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
            // Desktop: fixed size bottom-right
            'bottom-6 right-6 h-[500px] w-[360px]',
            // Mobile: fullscreen
            'max-md:inset-0 max-md:bottom-0 max-md:right-0 max-md:h-full max-md:w-full max-md:rounded-none',
          )}
        >
          {/* ─── Header ─── */}
          <div className="flex items-center justify-between border-b bg-ctr-primary px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <h2 className="text-sm font-semibold">HR 챗봇</h2>
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
                    {msg.sources && msg.sources.length > 0 && (
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

                    {/* Feedback buttons (AI messages only) */}
                    {msg.role === 'assistant' && msg.id !== 'welcome' && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleFeedback(msg.id, 'up')}
                          className={cn(
                            'rounded p-0.5 hover:bg-gray-200',
                            msg.feedback === 'up' && 'text-green-600',
                          )}
                          aria-label="도움이 되었어요"
                        >
                          <ThumbsUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFeedback(msg.id, 'down')}
                          className={cn(
                            'rounded p-0.5 hover:bg-gray-200',
                            msg.feedback === 'down' && 'text-red-600',
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
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* ─── Escalation Button ─── */}
          <div className="border-t px-4 py-2">
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              <UserCircle className="mr-1 inline h-3 w-3" />
              담당자에게 문의
            </button>
          </div>

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
