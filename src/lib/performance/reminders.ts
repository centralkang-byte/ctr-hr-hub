// 평가 미이행 자동 알림 규칙 — STEP 2.5

type ReminderTarget = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN'

interface ReminderTrigger {
  days_before_deadline: number
  target: ReminderTarget | ReminderTarget[]
  event: string
}

interface ReminderRule {
  triggers: ReminderTrigger[]
}

export const EVAL_REMINDER_RULES: Record<string, ReminderRule> = {
  GOAL_SETTING: {
    triggers: [
      { days_before_deadline: 7, target: 'EMPLOYEE', event: 'EVAL_GOAL_REMINDER_7D' },
      { days_before_deadline: 3, target: 'EMPLOYEE', event: 'EVAL_GOAL_REMINDER_3D' },
      {
        days_before_deadline: 0,
        target: ['EMPLOYEE', 'MANAGER'],
        event: 'EVAL_GOAL_OVERDUE',
      },
    ],
  },
  SELF_EVAL: {
    triggers: [
      { days_before_deadline: 7, target: 'EMPLOYEE', event: 'EVAL_SELF_REMINDER_7D' },
      { days_before_deadline: 3, target: 'EMPLOYEE', event: 'EVAL_SELF_REMINDER_3D' },
      {
        days_before_deadline: 0,
        target: ['EMPLOYEE', 'MANAGER', 'HR_ADMIN'],
        event: 'EVAL_SELF_OVERDUE',
      },
    ],
  },
  MANAGER_EVAL: {
    triggers: [
      { days_before_deadline: 7, target: 'MANAGER', event: 'EVAL_MGR_REMINDER_7D' },
      { days_before_deadline: 3, target: 'MANAGER', event: 'EVAL_MGR_REMINDER_3D' },
      {
        days_before_deadline: 0,
        target: ['MANAGER', 'HR_ADMIN'],
        event: 'EVAL_MGR_OVERDUE',
      },
    ],
  },
}

export const EVAL_NOTIFICATION_EVENTS = [
  'EVAL_GOAL_REMINDER_7D',
  'EVAL_GOAL_REMINDER_3D',
  'EVAL_GOAL_OVERDUE',
  'EVAL_SELF_REMINDER_7D',
  'EVAL_SELF_REMINDER_3D',
  'EVAL_SELF_OVERDUE',
  'EVAL_MGR_REMINDER_7D',
  'EVAL_MGR_REMINDER_3D',
  'EVAL_MGR_OVERDUE',
] as const
