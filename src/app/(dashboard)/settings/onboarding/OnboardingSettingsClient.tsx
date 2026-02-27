'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding Settings Client
// 온보딩 템플릿 관리 (CRUD + DnD 태스크 정렬)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Pencil, Trash2, GripVertical, Loader2 } from 'lucide-react'

import type { SessionUser, PaginationInfo } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ─── Local interfaces (matching API response) ────────────

interface OnboardingTaskLocal {
  id: string
  templateId: string
  title: string
  description: string | null
  assigneeType: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'BUDDY'
  dueDaysAfter: number
  sortOrder: number
  isRequired: boolean
  category: 'DOCUMENT' | 'TRAINING' | 'SETUP' | 'INTRODUCTION' | 'OTHER'
}

interface OnboardingTemplateLocal {
  id: string
  companyId: string
  name: string
  description: string | null
  targetType: 'NEW_HIRE' | 'TRANSFER' | 'REHIRE'
  isActive: boolean
  createdAt: string
  deletedAt: string | null
  onboardingTasks?: OnboardingTaskLocal[]
  _count?: { onboardingTasks: number }
}

// ─── Label maps ──────────────────────────────────────────

const TARGET_TYPE_LABELS: Record<string, string> = {
  NEW_HIRE: '신입',
  TRANSFER: '전배',
  REHIRE: '재입사',
}

const CATEGORY_COLORS: Record<string, string> = {
  DOCUMENT: 'bg-blue-100 text-blue-800',
  TRAINING: 'bg-green-100 text-green-800',
  SETUP: 'bg-yellow-100 text-yellow-800',
  INTRODUCTION: 'bg-purple-100 text-purple-800',
  OTHER: 'bg-gray-100 text-gray-800',
}

const CATEGORY_LABELS: Record<string, string> = {
  DOCUMENT: '문서',
  TRAINING: '교육',
  SETUP: '환경설정',
  INTRODUCTION: '소개',
  OTHER: '기타',
}

const ASSIGNEE_COLORS: Record<string, string> = {
  EMPLOYEE: 'bg-gray-100 text-gray-800',
  MANAGER: 'bg-blue-100 text-blue-800',
  HR: 'bg-green-100 text-green-800',
  BUDDY: 'bg-purple-100 text-purple-800',
}

const ASSIGNEE_LABELS: Record<string, string> = {
  EMPLOYEE: '직원',
  MANAGER: '매니저',
  HR: 'HR',
  BUDDY: '버디',
}

// ─── Zod schemas ─────────────────────────────────────────

const templateSchema = z.object({
  name: z.string().min(1, '템플릿명을 입력하세요'),
  description: z.string().optional(),
  targetType: z.enum(['NEW_HIRE', 'TRANSFER', 'REHIRE']),
})

type TemplateFormData = z.infer<typeof templateSchema>

const taskSchema = z.object({
  title: z.string().min(1, '태스크명을 입력하세요'),
  description: z.string().optional(),
  assigneeType: z.enum(['EMPLOYEE', 'MANAGER', 'HR', 'BUDDY']),
  dueDaysAfter: z.number().int().min(0, '0 이상 입력하세요'),
  category: z.enum(['DOCUMENT', 'TRAINING', 'SETUP', 'INTRODUCTION', 'OTHER']),
  isRequired: z.boolean(),
})

type TaskFormData = z.infer<typeof taskSchema>

// ─── SortableTaskItem ────────────────────────────────────

function SortableTaskItem({
  task,
  onDelete,
}: {
  task: OnboardingTaskLocal
  onDelete: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded border bg-white p-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm font-medium">{task.title}</span>
      <Badge
        variant="outline"
        className={`text-xs ${CATEGORY_COLORS[task.category] ?? ''}`}
      >
        {CATEGORY_LABELS[task.category] ?? task.category}
      </Badge>
      <Badge className={`text-xs ${ASSIGNEE_COLORS[task.assigneeType] ?? ''}`}>
        {ASSIGNEE_LABELS[task.assigneeType] ?? task.assigneeType}
      </Badge>
      <span className="text-xs text-gray-500">D+{task.dueDaysAfter}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
        onClick={() => onDelete(task.id)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────

export function OnboardingSettingsClient({ user }: { user: SessionUser }) {
  // ── State ──
  const [templates, setTemplates] = useState<OnboardingTemplateLocal[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | undefined>()
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Template dialog
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] =
    useState<OnboardingTemplateLocal | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Tasks dialog
  const [tasksDialogOpen, setTasksDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] =
    useState<OnboardingTemplateLocal | null>(null)
  const [tasks, setTasks] = useState<OnboardingTaskLocal[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)

  // Task add form
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [taskSubmitting, setTaskSubmitting] = useState(false)

  // ── DnD sensors ──
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // ── Template form ──
  const templateForm = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: { name: '', description: '', targetType: 'NEW_HIRE' },
  })

  // ── Task form ──
  const taskForm = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      assigneeType: 'EMPLOYEE',
      dueDaysAfter: 1,
      category: 'DOCUMENT',
      isRequired: true,
    },
  })

  // ── Fetch templates ──
  const fetchTemplates = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await apiClient.getList<OnboardingTemplateLocal>(
        '/api/v1/onboarding/templates',
        { page: p, limit: 20 },
      )
      setTemplates(res.data)
      setPagination(res.pagination)
    } catch {
      // silently handle – toast can be added later
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchTemplates(page)
  }, [page, fetchTemplates])

  // ── Fetch tasks for a template ──
  const fetchTasks = useCallback(async (templateId: string) => {
    setTasksLoading(true)
    try {
      const res = await apiClient.get<
        OnboardingTemplateLocal & { onboardingTasks: OnboardingTaskLocal[] }
      >(`/api/v1/onboarding/templates/${templateId}`)
      const sorted = [...(res.data.onboardingTasks ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      )
      setTasks(sorted)
    } catch {
      setTasks([])
    } finally {
      setTasksLoading(false)
    }
  }, [])

  // ── Template CRUD ──
  const openCreateDialog = () => {
    setEditingTemplate(null)
    templateForm.reset({ name: '', description: '', targetType: 'NEW_HIRE' })
    setTemplateDialogOpen(true)
  }

  const openEditDialog = (tpl: OnboardingTemplateLocal) => {
    setEditingTemplate(tpl)
    templateForm.reset({
      name: tpl.name,
      description: tpl.description ?? '',
      targetType: tpl.targetType,
    })
    setTemplateDialogOpen(true)
  }

  const handleTemplateSubmit = async (data: TemplateFormData) => {
    setSubmitting(true)
    try {
      if (editingTemplate) {
        await apiClient.put(
          `/api/v1/onboarding/templates/${editingTemplate.id}`,
          data,
        )
      } else {
        await apiClient.post('/api/v1/onboarding/templates', data)
      }
      setTemplateDialogOpen(false)
      void fetchTemplates(page)
    } catch {
      // error handling
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (tpl: OnboardingTemplateLocal) => {
    if (!confirm(`"${tpl.name}" 템플릿을 삭제하시겠습니까?`)) return
    try {
      await apiClient.delete(`/api/v1/onboarding/templates/${tpl.id}`)
      void fetchTemplates(page)
    } catch {
      // error handling
    }
  }

  // ── Tasks management ──
  const openTasksDialog = (tpl: OnboardingTemplateLocal) => {
    setSelectedTemplate(tpl)
    setTasksDialogOpen(true)
    void fetchTasks(tpl.id)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !selectedTemplate) return

    const oldIndex = tasks.findIndex((t) => t.id === active.id)
    const newIndex = tasks.findIndex((t) => t.id === over.id)
    const reordered = arrayMove(tasks, oldIndex, newIndex)
    setTasks(reordered)

    try {
      await apiClient.put(
        `/api/v1/onboarding/templates/${selectedTemplate.id}/tasks/reorder`,
        { taskIds: reordered.map((t) => t.id) },
      )
    } catch {
      // revert on error
      void fetchTasks(selectedTemplate.id)
    }
  }

  const handleAddTask = async (data: TaskFormData) => {
    if (!selectedTemplate) return
    setTaskSubmitting(true)
    try {
      await apiClient.post(
        `/api/v1/onboarding/templates/${selectedTemplate.id}/tasks`,
        { ...data, sortOrder: tasks.length },
      )
      taskForm.reset()
      setTaskFormOpen(false)
      void fetchTasks(selectedTemplate.id)
    } catch {
      // error handling
    } finally {
      setTaskSubmitting(false)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!selectedTemplate) return
    try {
      await apiClient.delete(
        `/api/v1/onboarding/templates/${selectedTemplate.id}/tasks/${taskId}`,
      )
      void fetchTasks(selectedTemplate.id)
    } catch {
      // error handling
    }
  }

  // ── DataTable columns ──
  type Row = Record<string, unknown>
  const columns: DataTableColumn<Row>[] = [
    { key: 'name', header: '템플릿명' },
    {
      key: 'targetType',
      header: '대상유형',
      render: (r) => {
        const row = r as unknown as OnboardingTemplateLocal
        return (
          <Badge variant="outline">
            {TARGET_TYPE_LABELS[row.targetType] ?? row.targetType}
          </Badge>
        )
      },
    },
    {
      key: 'taskCount',
      header: '태스크수',
      render: (r) => {
        const row = r as unknown as OnboardingTemplateLocal
        return (
          <span>{row._count?.onboardingTasks ?? row.onboardingTasks?.length ?? 0}</span>
        )
      },
    },
    {
      key: 'isActive',
      header: '상태',
      render: (r) => {
        const row = r as unknown as OnboardingTemplateLocal
        return row.isActive ? (
          <Badge className="bg-green-100 text-green-800">활성</Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-600">비활성</Badge>
        )
      },
    },
    {
      key: 'actions',
      header: '액션',
      render: (r) => {
        const row = r as unknown as OnboardingTemplateLocal
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                openEditDialog(row)
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700"
              onClick={(e) => {
                e.stopPropagation()
                void handleDelete(row)
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="온보딩 템플릿 관리"
        description="신입/전배/재입사 직원의 온보딩 프로세스를 관리합니다."
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="mr-1 h-4 w-4" />
            새 템플릿
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={templates as unknown as Record<string, unknown>[]}
        pagination={pagination}
        onPageChange={setPage}
        loading={loading}
        emptyMessage="등록된 온보딩 템플릿이 없습니다"
        emptyDescription="새 템플릿을 생성하여 온보딩 프로세스를 시작하세요."
        emptyAction={{ label: '새 템플릿 만들기', onClick: openCreateDialog }}
        rowKey={(row) => (row as unknown as OnboardingTemplateLocal).id}
        onRowClick={(row) =>
          openTasksDialog(row as unknown as OnboardingTemplateLocal)
        }
      />

      {/* ─── Template Create/Edit Dialog ─── */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? '템플릿 수정' : '새 템플릿 생성'}
            </DialogTitle>
            <DialogDescription>
              온보딩 템플릿의 기본 정보를 입력합니다.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={templateForm.handleSubmit(handleTemplateSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">템플릿명</Label>
              <Input
                id="name"
                placeholder="예: 신입 엔지니어 온보딩"
                {...templateForm.register('name')}
              />
              {templateForm.formState.errors.name && (
                <p className="text-xs text-red-500">
                  {templateForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">설명</Label>
              <Input
                id="description"
                placeholder="선택 사항"
                {...templateForm.register('description')}
              />
            </div>
            <div className="space-y-2">
              <Label>대상유형</Label>
              <Controller
                control={templateForm.control}
                name="targetType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="유형 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW_HIRE">신입</SelectItem>
                      <SelectItem value="TRANSFER">전배</SelectItem>
                      <SelectItem value="REHIRE">재입사</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTemplateDialogOpen(false)}
              >
                취소
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                )}
                {editingTemplate ? '수정' : '생성'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Tasks Dialog ─── */}
      <Dialog open={tasksDialogOpen} onOpenChange={setTasksDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate?.name} — 태스크 관리
            </DialogTitle>
            <DialogDescription>
              태스크를 드래그하여 순서를 변경할 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          {tasksLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-3">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={tasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {tasks.length === 0 ? (
                    <p className="py-4 text-center text-sm text-gray-500">
                      등록된 태스크가 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <SortableTaskItem
                          key={task.id}
                          task={task}
                          onDelete={handleDeleteTask}
                        />
                      ))}
                    </div>
                  )}
                </SortableContext>
              </DndContext>

              {/* ─── Add task section ─── */}
              {!taskFormOpen ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    taskForm.reset()
                    setTaskFormOpen(true)
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  태스크 추가
                </Button>
              ) : (
                <form
                  onSubmit={taskForm.handleSubmit(handleAddTask)}
                  className="space-y-3 rounded border bg-gray-50 p-3"
                >
                  <div className="space-y-2">
                    <Label htmlFor="taskTitle">태스크명</Label>
                    <Input
                      id="taskTitle"
                      placeholder="예: 보안 교육 수료"
                      {...taskForm.register('title')}
                    />
                    {taskForm.formState.errors.title && (
                      <p className="text-xs text-red-500">
                        {taskForm.formState.errors.title.message}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>담당자 유형</Label>
                      <Controller
                        control={taskForm.control}
                        name="assigneeType"
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EMPLOYEE">직원</SelectItem>
                              <SelectItem value="MANAGER">매니저</SelectItem>
                              <SelectItem value="HR">HR</SelectItem>
                              <SelectItem value="BUDDY">버디</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>카테고리</Label>
                      <Controller
                        control={taskForm.control}
                        name="category"
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DOCUMENT">문서</SelectItem>
                              <SelectItem value="TRAINING">교육</SelectItem>
                              <SelectItem value="SETUP">환경설정</SelectItem>
                              <SelectItem value="INTRODUCTION">소개</SelectItem>
                              <SelectItem value="OTHER">기타</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDaysAfter">완료 기한 (입사 후 일수)</Label>
                    <Input
                      id="dueDaysAfter"
                      type="number"
                      min={0}
                      {...taskForm.register('dueDaysAfter', { valueAsNumber: true })}
                    />
                    {taskForm.formState.errors.dueDaysAfter && (
                      <p className="text-xs text-red-500">
                        {taskForm.formState.errors.dueDaysAfter.message}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTaskFormOpen(false)}
                    >
                      취소
                    </Button>
                    <Button type="submit" size="sm" disabled={taskSubmitting}>
                      {taskSubmitting && (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      )}
                      추가
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
