// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GDPR Compliance Utilities
// PII Logger, Retention Enforcement, Data Export, Anonymization
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

/**
 * Log PII access (fire-and-forget)
 */
export function logPiiAccess(
  actorId: string,
  targetId: string,
  companyId: string,
  accessType: string,
  fieldName: string,
  headers?: Headers,
): void {
  const ipAddress = headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? headers?.get('x-real-ip')
    ?? null
  const userAgent = headers?.get('user-agent') ?? null

  prisma.piiAccessLog.create({
    data: { companyId, actorId, targetId, accessType, fieldName, ipAddress, userAgent },
  }).catch(() => {})
}

/**
 * Enforce retention policy — anonymize or delete records past retention period
 */
export async function enforceRetention(companyId: string, policyId: string) {
  const policy = await prisma.dataRetentionPolicy.findFirst({
    where: { id: policyId, companyId, isActive: true },
  })
  if (!policy) return { processed: 0 }

  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - policy.retentionMonths)

  let processed = 0

  // Handle different categories
  switch (policy.category) {
    case 'AUDIT_LOGS': {
      if (policy.autoDelete) {
        const result = await prisma.auditLog.deleteMany({
          where: { companyId, createdAt: { lt: cutoffDate } },
        })
        processed = result.count
      }
      break
    }
    case 'RECRUITMENT_DATA': {
      if (policy.anonymize) {
        const applicants = await prisma.applicant.findMany({
          where: {
            applications: { some: { posting: { companyId } } },
            createdAt: { lt: cutoffDate },
          },
          select: { id: true },
        })
        for (const applicant of applicants) {
          await prisma.applicant.update({
            where: { id: applicant.id },
            data: { name: 'ANONYMIZED', email: `anon-${applicant.id}@removed.local`, phone: null },
          })
          processed++
        }
      }
      break
    }
    default:
      break
  }

  await prisma.dataRetentionPolicy.update({
    where: { id: policyId },
    data: { lastRunAt: new Date() },
  })

  return { processed }
}

/**
 * Generate full data export for data portability requests (GDPR Art. 20)
 */
export async function generateDataExport(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      department: { select: { name: true } },
      jobGrade: { select: { name: true } },
      attendances: { take: 100, orderBy: { clockIn: 'desc' } },
      leaveRequests: { take: 100, orderBy: { createdAt: 'desc' } },
      compensationHistories: { take: 50, orderBy: { effectiveDate: 'desc' } },
      trainingEnrollments: {
        take: 50,
        include: { course: { select: { title: true, category: true } } },
      },
      performanceEvals: { take: 50, orderBy: { createdAt: 'desc' } },
      gdprConsents: true,
    },
  })
  if (!employee) return null

  return {
    exportedAt: new Date().toISOString(),
    personalData: {
      name: employee.name,
      nameEn: employee.nameEn,
      email: employee.email,
      phone: employee.phone,
      birthDate: employee.birthDate,
      gender: employee.gender,
      nationality: employee.nationality,
      hireDate: employee.hireDate,
      department: employee.department.name,
      jobGrade: employee.jobGrade.name,
    },
    attendanceRecords: employee.attendances.map((a) => ({
      date: a.clockIn,
      clockIn: a.clockIn,
      clockOut: a.clockOut,
      status: a.status,
    })),
    leaveRecords: employee.leaveRequests.map((l) => ({
      policyId: l.policyId,
      startDate: l.startDate,
      endDate: l.endDate,
      status: l.status,
    })),
    compensationHistory: employee.compensationHistories.map((c) => ({
      changeType: c.changeType,
      effectiveDate: c.effectiveDate,
      newBaseSalary: Number(c.newBaseSalary),
    })),
    trainingRecords: employee.trainingEnrollments.map((t) => ({
      course: t.course.title,
      category: t.course.category,
      status: t.status,
      completedAt: t.completedAt,
    })),
    consents: employee.gdprConsents.map((c) => ({
      purpose: c.purpose,
      status: c.status,
      consentedAt: c.consentedAt,
      revokedAt: c.revokedAt,
    })),
  }
}

/**
 * Anonymize employee PII fields (GDPR Art. 17 - Right to Erasure)
 */
export async function anonymizeEmployeeData(employeeId: string) {
  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      name: 'ANONYMIZED',
      nameEn: null,
      email: `anon-${employeeId}@removed.local`,
      phone: null,
      emergencyContact: null,
      emergencyContactPhone: null,
      birthDate: null,
      gender: null,
      nationality: null,
      photoUrl: null,
    },
  })
}

/**
 * Calculate GDPR deadline (30 days from request date)
 */
export function calculateGdprDeadline(requestDate: Date): Date {
  const deadline = new Date(requestDate)
  deadline.setDate(deadline.getDate() + 30)
  return deadline
}
