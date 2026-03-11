/**
 * scripts/qa/build-dynamic-urls.ts
 *
 * DB에서 실제 ID를 조회하여 동적 라우트 URL 목록을 생성.
 * 실행: npx tsx scripts/qa/build-dynamic-urls.ts
 */
import { PrismaClient } from '../../src/generated/prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

type Role = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'SUPER_ADMIN'
interface UrlEntry { path: string; role: Role; group: string }

async function main() {
  console.log('🔍 Querying DB for real IDs...')

  const [
    employee,
    payrollRun,
    perfCycle,
    onboarding,
    offboarding,
    jobPosting,
    nomination,
    discipline,
    reward,
    oneOnOne,
    pulse,
    analyticsEmp,
  ] = await Promise.all([
    prisma.employee.findFirst({ select: { id: true } }),
    prisma.payrollRun.findFirst({ select: { id: true } }),
    prisma.performanceCycle.findFirst({ select: { id: true } }),
    prisma.employeeOnboarding.findFirst({ select: { id: true } }),
    prisma.employeeOffboarding.findFirst({ select: { id: true } }),
    prisma.jobPosting.findFirst({ select: { id: true } }),
    prisma.peerReviewNomination.findFirst({ select: { id: true } }).catch(() => null),
    prisma.disciplinaryAction.findFirst({ select: { id: true } }).catch(() => null),
    prisma.rewardRecord.findFirst({ select: { id: true } }).catch(() => null),
    prisma.oneOnOneMeeting.findFirst({ select: { id: true } }).catch(() => null),
    prisma.pulseSurvey.findFirst({ select: { id: true } }).catch(() => null),
    prisma.employee.findFirst({ select: { id: true }, skip: 1 }),
  ])

  const urls: UrlEntry[] = []

  if (employee) {
    urls.push(
      { path: `/employees/${employee.id}`, role: 'HR_ADMIN', group: 'employees' },
      { path: `/employees/${employee.id}/contracts`, role: 'HR_ADMIN', group: 'employees' },
      { path: `/employees/${employee.id}/work-permits`, role: 'HR_ADMIN', group: 'employees' },
    )
  }

  if (payrollRun) {
    urls.push(
      { path: `/payroll/${payrollRun.id}/review`, role: 'HR_ADMIN', group: 'payroll' },
      { path: `/payroll/${payrollRun.id}/approve`, role: 'HR_ADMIN', group: 'payroll' },
      { path: `/payroll/${payrollRun.id}/publish`, role: 'HR_ADMIN', group: 'payroll' },
      { path: `/payroll/me/${payrollRun.id}`, role: 'EMPLOYEE', group: 'payroll' },
    )
  }

  if (perfCycle) {
    urls.push(
      { path: `/performance/cycles/${perfCycle.id}`, role: 'HR_ADMIN', group: 'performance' },
      { path: `/performance/peer-review/${perfCycle.id}/setup`, role: 'HR_ADMIN', group: 'performance' },
      { path: `/performance/peer-review/results/${perfCycle.id}`, role: 'HR_ADMIN', group: 'performance' },
      { path: `/performance/pulse/${perfCycle.id}/results`, role: 'HR_ADMIN', group: 'performance' },
    )
  }

  if (nomination) {
    urls.push(
      { path: `/performance/peer-review/evaluate/${nomination.id}`, role: 'EMPLOYEE', group: 'performance' },
    )
  }

  if (onboarding) {
    urls.push(
      { path: `/onboarding/${onboarding.id}`, role: 'HR_ADMIN', group: 'onboarding' },
    )
  }

  if (offboarding) {
    urls.push(
      { path: `/offboarding/${offboarding.id}`, role: 'HR_ADMIN', group: 'offboarding' },
    )
  }

  if (jobPosting) {
    urls.push(
      { path: `/recruitment/${jobPosting.id}`, role: 'HR_ADMIN', group: 'recruitment' },
      { path: `/recruitment/${jobPosting.id}/edit`, role: 'HR_ADMIN', group: 'recruitment' },
      { path: `/recruitment/${jobPosting.id}/pipeline`, role: 'HR_ADMIN', group: 'recruitment' },
      { path: `/recruitment/${jobPosting.id}/applicants`, role: 'HR_ADMIN', group: 'recruitment' },
      { path: `/recruitment/${jobPosting.id}/applicants/new`, role: 'HR_ADMIN', group: 'recruitment' },
      { path: `/recruitment/${jobPosting.id}/interviews`, role: 'HR_ADMIN', group: 'recruitment' },
      { path: `/recruitment/${jobPosting.id}/interviews/new`, role: 'HR_ADMIN', group: 'recruitment' },
    )
  }

  if (discipline) {
    urls.push({ path: `/discipline/${discipline.id}`, role: 'HR_ADMIN', group: 'discipline' })
  }

  if (reward) {
    urls.push({ path: `/discipline/rewards/${reward.id}`, role: 'HR_ADMIN', group: 'discipline' })
  }

  if (oneOnOne) {
    urls.push({ path: `/performance/one-on-one/${oneOnOne.id}`, role: 'MANAGER', group: 'performance' })
  }

  if (pulse) {
    urls.push(
      { path: `/performance/pulse/${pulse.id}/respond`, role: 'EMPLOYEE', group: 'performance' },
    )
  }

  if (analyticsEmp) {
    urls.push(
      { path: `/analytics/predictive/${analyticsEmp.id}`, role: 'HR_ADMIN', group: 'analytics' },
    )
  }

  const outFile = path.join(__dirname, 'dynamic-urls.json')
  fs.writeFileSync(outFile, JSON.stringify(urls, null, 2))

  console.log(`\n✅ ${urls.length} dynamic URLs resolved:`)
  urls.forEach(u => console.log(`  ${u.path} [${u.role}]`))
  console.log(`\nSaved to ${outFile}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
