'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Offboarding Settings Client
// 오프보딩 체크리스트 관리 (CRUD + DnD 태스크 정렬)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
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

interface OffboardingTaskLocal {
  id: string
  checklistId: string
  title: string
  description: string | null
  assigneeType: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'IT' | 'FINANCE'
  dueDaysBefore: number
  sortOrder: number
  isRequired: boolean
}

interface OffboardingChecklistLocal {
  id: string
  companyId: string
  name: string
  targetType: 'VOLUNTARY' | 'INVOLUNTARY' | 'RETIREMENT' | 'CONTRACT_END'
  isActive: boolean
  createdAt: string
  offboardingTasks?: OffboardingTaskLocal[]
  _count?: { offboardingTasks: number }
}

// ─── SortableTaskItem ────────────────────────────────────

function SortableTaskItem({
  task,
  onDelete,
  assigneeLabels,
  assigneeColors,
  requiredLabel,
}: {
  task: OffboardingTaskLocal
  onDelete: (id: string) => void
  assigneeLabels: Record<string, string>
  assigneeColors: Record<string, string>
  requiredLabel: string
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
      <Badge className={`text-xs ${assigneeColors[task.assigneeType] ?? ''}`}>
        {assigneeLabels[task.assigneeType] ?? task.assigneeType}
      </Badge>
      <span className="text-xs text-gray-500">D-{task.dueDaysBefore}</span>
      {task.isRequired && (
        <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
          {requiredLabel}
        </Badge>
      )}
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

export function OffboardingSettingsClient({ user }: { user: SessionUser }) {
  const t = useTranslations('offboarding')
  const tCommon = useTranslations('common')

  const TARGET_TYPE_LABELS: Record<string, string> = {
    VOLUNTARY: t('resignVoluntary'),
    INVOLUNTARY: t('resignInvoluntary'),
    RETIREMENT: t('resignRetirement'),
    CONTRACT_END: t('resignContractEnd'),
  }

  const ASSIGNEE_COLORS: Record<string, string> = {
    EMPLOYEE: 'bg-gray-100 text-gray-800',
    MANAGER: 'bg-blue-100 text-blue-800',
    HR: 'bg-green-100 text-green-800',
    IT: 'bg-purple-100 text-purple-800',
    FINANCE: 'bg-orange-100 text-orange-800',
  }

  const ASSIGNEE_LABELS: Record<string, string> = {
    EMPLOYEE: t('assigneeEmployee'),
    MANAGER: t('assigneeManager'),
    HR: t('assigneeHr'),
    IT: t('assigneeIt'),
    FINANCE: t('assigneeFinance'),
  }

  // ── Zod schemas ──
  const checklistSchema = z.object({
    name: z.string().min(1, t('checklistNameLabel')),
    targetType: z.enum(['VOLUNTARY', 'INVOLUNTARY', 'RETIREMENT', 'CONTRACT_END']),
  })

  type ChecklistFormData = z.infer<typeof checklistSchema>

  const taskSchema = z.object({
    title: z.string().min(1, t('taskNameLabel')),
    description: z.string().optional(),
    assigneeType: z.enum(['EMPLOYEE', 'MANAGER', 'HR', 'IT', 'FINANCE']),
    dueDaysBefore: z.number().int().min(0),
    isRequired: z.boolean(),
  })

  type TaskFormData = z.infer<typeof taskSchema>

  // ── State ──
  const [checklists, setChecklists] = useState<OffboardingChecklistLocal[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | undefined>()
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false)
  const [editingChecklist, setEditingChecklist] =
    useState<OffboardingChecklistLocal | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [tasksDialogOpen, setTasksDialogOpen] = useState(false)
  const [selectedChecklist, setSelectedChecklist] =
    useState<OffboardingChecklistLocal | null>(null)
  const [tasks, setTasks] = useState<OffboardingTaskLocal[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)

  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [taskSubmitting, setTaskSubmitting] = useState(false)

  // ── DnD sensors ──
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const checklistForm = useForm<ChecklistFormData>({
    resolver: zodResolver(checklistSchema),
    defaultValues: { name: '', targetType: 'VOLUNTARY' },
  })

  const taskForm = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      assigneeType: 'EMPLOYEE',
      dueDaysBefore: 1,
      isRequired: true,
    },
  })

  const fetchChecklists = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await apiClient.getList<OffboardingChecklistLocal>(
        '/api/v1/offboarding/checklists',
        { page: p, limit: 20 },
      )
      setChecklists(res.data)
      setPagination(res.pagination)
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchChecklists(page)
  }, [page, fetchChecklists])

  const fetchTasks = useCallback(async (checklistId: string) => {
    setTasksLoading(true)
    try {
      const res = await apiClient.get<
        OffboardingChecklistLocal & { offboardingTasks: OffboardingTaskLocal[] }
      >(`/api/v1/offboarding/checklists/${checklistId}`)
      const sorted = [...(res.data.offboardingTasks ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      )
      setTasks(sorted)
    } catch {
      setTasks([])
    } finally {
      setTasksLoading(false)
    }
  }, [])

  const openCreateDialog = () => {
    setEditingChecklist(null)
    checklistForm.reset({ name: '', targetType: 'VOLUNTARY' })
    setChecklistDialogOpen(true)
  }

  const openEditDialog = (cl: OffboardingChecklistLocal) => {
    setEditingChecklist(cl)
    checklistForm.reset({
      name: cl.name,
      targetType: cl.targetType,
    })
    setChecklistDialogOpen(true)
  }

  const handleChecklistSubmit = async (data: ChecklistFormData) => {
    setSubmitting(true)
    try {
      if (editingChecklist) {
        await apiClient.put(
          `/api/v1/offboarding/checklists/${editingChecklist.id}`,
          data,
        )
      } else {
        await apiClient.post('/api/v1/offboarding/checklists', data)
      }
      setChecklistDialogOpen(false)
      void fetchChecklists(page)
    } catch {
      // error handling
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (cl: OffboardingChecklistLocal) => {
    if (!confirm(t('deleteChecklistConfirm', { name: cl.name }))) return
    try {
      await apiClient.delete(`/api/v1/offboarding/checklists/${cl.id}`)
      void fetchChecklists(page)
    } catch {
      // error handling
    }
  }

  const openTasksDialog = (cl: OffboardingChecklistLocal) => {
    setSelectedChecklist(cl)
    setTasksDialogOpen(true)
    void fetchTasks(cl.id)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !selectedChecklist) return

    const oldIndex = tasks.findIndex((tsk) => tsk.id === active.id)
    const newIndex = tasks.findIndex((tsk) => tsk.id === over.id)
    const reordered = arrayMove(tasks, oldIndex, newIndex)
    setTasks(reordered)

    try {
      await apiClient.put(
        `/api/v1/offboarding/checklists/${selectedChecklist.id}/tasks/reorder`,
        { taskIds: reordered.map((tsk) => tsk.id) },
      )
    } catch {
      void fetchTasks(selectedChecklist.id)
    }
  }

  const handleAddTask = async (data: TaskFormData) => {
    if (!selectedChecklist) return
    setTaskSubmitting(true)
    try {
      await apiClient.post(
        `/api/v1/offboarding/checklists/${selectedChecklist.id}/tasks`,
        { ...data, sortOrder: tasks.length },
      )
      taskForm.reset()
      setTaskFormOpen(false)
      void fetchTasks(selectedChecklist.id)
    } catch {
      // error handling
    } finally {
      setTaskSubmitting(false)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!selectedChecklist) return
    try {
      await apiClient.delete(
        `/api/v1/offboarding/checklists/${selectedChecklist.id}/tasks/${taskId}`,
      )
      void fetchTasks(selectedChecklist.id)
    } catch {
      // error handling
    }
  }

  // ── DataTable columns ──
  type Row = Record<string, unknown>
  const columns: DataTableColumn<Row>[] = [
    { key: 'name', header: t('checklistNameLabel') },
    {
      key: 'targetType',
      header: t('targetTypeLabel'),
      render: (r) => {
        const row = r as unknown as OffboardingChecklistLocal
        return (
          <Badge variant="outline">
            {TARGET_TYPE_LABELS[row.targetType] ?? row.targetType}
          </Badge>
        )
      },
    },
    {
      key: 'taskCount',
      header: t('taskCountLabel'),
      render: (r) => {
        const row = r as unknown as OffboardingChecklistLocal
        return (
          <span>{row._count?.offboardingTasks ?? row.offboardingTasks?.length ?? 0}</span>
        )
      },
    },
    {
      key: 'isActive',
      header: t('statusLabel'),
      render: (r) => {
        const row = r as unknown as OffboardingChecklistLocal
        return row.isActive ? (
          <Badge className="bg-green-100 text-green-800">{t('active')}</Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-600">{t('inactive')}</Badge>
        )
      },
    },
    {
      key: 'actions',
      header: t('actions'),
      render: (r) => {
        const row = r as unknown as OffboardingChecklistLocal
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('checklistManagement')}
        description={t('checklistManagementDesc')}
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="mr-1 h-4 w-4" />
            {t('newChecklist')}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={checklists as unknown as Record<string, unknown>[]}
        pagination={pagination}
        onPageChange={setPage}
        loading={loading}
        emptyMessage={t('noChecklists')}
        emptyDescription={t('noChecklistsDesc')}
        emptyAction={{ label: t('createNewChecklist'), onClick: openCreateDialog }}
        rowKey={(row) => (row as unknown as OffboardingChecklistLocal).id}
        onRowClick={(row) =>
          openTasksDialog(row as unknown as OffboardingChecklistLocal)
        }
      />

      {/* ─── Checklist Create/Edit Dialog ─── */}
      <Dialog open={checklistDialogOpen} onOpenChange={setChecklistDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingChecklist ? t('editChecklist') : t('createChecklist')}
            </DialogTitle>
            <DialogDescription>
              {t('checklistBasicInfo')}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={checklistForm.handleSubmit(handleChecklistSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">{t('checklistNameLabel')}</Label>
              <Input
                id="name"
                placeholder={t('checklistNamePlaceholder')}
                {...checklistForm.register('name')}
              />
              {checklistForm.formState.errors.name && (
                <p className="text-xs text-red-500">
                  {checklistForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('targetTypeLabel')}</Label>
              <Controller
                control={checklistForm.control}
                name="targetType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('targetTypePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VOLUNTARY">{t('resignVoluntary')}</SelectItem>
                      <SelectItem value="INVOLUNTARY">{t('resignInvoluntary')}</SelectItem>
                      <SelectItem value="RETIREMENT">{t('resignRetirement')}</SelectItem>
                      <SelectItem value="CONTRACT_END">{t('resignContractEnd')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setChecklistDialogOpen(false)}
              >
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                )}
                {editingChecklist ? tCommon('edit') : tCommon('create')}
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
              {selectedChecklist?.name} — {t('taskManagement')}
            </DialogTitle>
            <DialogDescription>
              {t('taskDragHint')}
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
                  items={tasks.map((tsk) => tsk.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {tasks.length === 0 ? (
                    <p className="py-4 text-center text-sm text-gray-500">
                      {t('noTasksInChecklist')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <SortableTaskItem
                          key={task.id}
                          task={task}
                          onDelete={handleDeleteTask}
                          assigneeLabels={ASSIGNEE_LABELS}
                          assigneeColors={ASSIGNEE_COLORS}
                          requiredLabel={t('requiredTask')}
                        />
                      ))}
                    </div>
                  )}
                </SortableContext>
              </DndContext>

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
                  {t('addTask')}
                </Button>
              ) : (
                <form
                  onSubmit={taskForm.handleSubmit(handleAddTask)}
                  className="space-y-3 rounded border bg-gray-50 p-3"
                >
                  <div className="space-y-2">
                    <Label htmlFor="taskTitle">{t('taskNameLabel')}</Label>
                    <Input
                      id="taskTitle"
                      placeholder={t('taskNamePlaceholder')}
                      {...taskForm.register('title')}
                    />
                    {taskForm.formState.errors.title && (
                      <p className="text-xs text-red-500">
                        {taskForm.formState.errors.title.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taskDescription">{t('taskDescriptionLabel')}</Label>
                    <Input
                      id="taskDescription"
                      placeholder={t('taskDescriptionPlaceholder')}
                      {...taskForm.register('description')}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>{t('assigneeType')}</Label>
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
                              <SelectItem value="EMPLOYEE">{t('assigneeEmployee')}</SelectItem>
                              <SelectItem value="MANAGER">{t('assigneeManager')}</SelectItem>
                              <SelectItem value="HR">{t('assigneeHr')}</SelectItem>
                              <SelectItem value="IT">{t('assigneeIt')}</SelectItem>
                              <SelectItem value="FINANCE">{t('assigneeFinance')}</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dueDaysBefore">{t('dueDaysBefore')}</Label>
                      <Input
                        id="dueDaysBefore"
                        type="number"
                        min={0}
                        {...taskForm.register('dueDaysBefore', { valueAsNumber: true })}
                      />
                      {taskForm.formState.errors.dueDaysBefore && (
                        <p className="text-xs text-red-500">
                          {taskForm.formState.errors.dueDaysBefore.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTaskFormOpen(false)}
                    >
                      {tCommon('cancel')}
                    </Button>
                    <Button type="submit" size="sm" disabled={taskSubmitting}>
                      {taskSubmitting && (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      )}
                      {tCommon('add')}
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
