const fs = require('fs');
const fixList = [
  { f: 'src/app/(dashboard)/settings/organization/tabs/AssignmentRulesTab.tsx', l: 27, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/organization/tabs/CompanyInfoTab.tsx', l: 4, action: 'remove_import', match: 'Save' },
  { f: 'src/app/(dashboard)/settings/organization/tabs/CompanyInfoTab.tsx', l: 6, action: 'remove_import', match: 'SettingFieldWithOverride' },
  { f: 'src/app/(dashboard)/settings/organization/tabs/CompanyInfoTab.tsx', l: 7, action: 'remove_import', match: 'Input' },
  { f: 'src/app/(dashboard)/settings/organization/tabs/CompanyInfoTab.tsx', l: 8, action: 'remove_import', match: 'Button' },
  { f: 'src/app/(dashboard)/settings/organization/tabs/JobFamiliesTab.tsx', l: 11, action: 'replace', match: 'companyId', replace: '_companyId' },
  { f: 'src/app/(dashboard)/settings/organization/tabs/JobGradesTab.tsx', l: 4, action: 'remove_import', match: 'Save' },
  { f: 'src/app/(dashboard)/settings/organization/tabs/JobGradesTab.tsx', l: 5, action: 'remove_import', match: 'SettingFieldWithOverride' },
  { f: 'src/app/(dashboard)/settings/organization/tabs/JobGradesTab.tsx', l: 6, action: 'remove_import', match: 'Input' },
  { f: 'src/app/(dashboard)/settings/organization/tabs/JobGradesTab.tsx', l: 7, action: 'remove_import', match: 'Button' },
  { f: 'src/app/(dashboard)/settings/organization/tabs/JobGradesTab.tsx', l: 14, action: 'replace', match: 'companyId', replace: '_companyId' },
  { f: 'src/app/(dashboard)/settings/page.tsx', l: 4, action: 'remove_import', match: 'Search' },
  { f: 'src/app/(dashboard)/settings/payroll/PayrollSettingsClient.tsx', l: 3, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/payroll/PayrollSettingsClient.tsx', l: 4, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/payroll/PayrollSettingsClient.tsx', l: 5, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/payroll/PayrollSettingsClient.tsx', l: 6, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/payroll/tabs/BonusRulesTab.tsx', l: 4, action: 'remove_import', match: 'Info' },
  { f: 'src/app/(dashboard)/settings/payroll/tabs/BonusRulesTab.tsx', l: 34, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/payroll/tabs/MeritMatrixTab.tsx', l: 6, action: 'remove_import', match: 'Input' },
  { f: 'src/app/(dashboard)/settings/payroll/tabs/TaxFreeTab.tsx', l: 31, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/performance/PerformanceSettingsClient.tsx', l: 3, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/performance/PerformanceSettingsClient.tsx', l: 4, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/performance/PerformanceSettingsClient.tsx', l: 5, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/performance/PerformanceSettingsClient.tsx', l: 6, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/performance/tabs/EvalCycleTab.tsx', l: 25, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/recruitment/RecruitmentSettingsClient.tsx', l: 3, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/recruitment/RecruitmentSettingsClient.tsx', l: 4, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/recruitment/RecruitmentSettingsClient.tsx', l: 5, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/recruitment/RecruitmentSettingsClient.tsx', l: 6, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/recruitment/tabs/AiScreeningTab.tsx', l: 26, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/recruitment/tabs/PipelineTab.tsx', l: 27, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/system/SystemSettingsClient.tsx', l: 3, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/system/SystemSettingsClient.tsx', l: 4, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/system/SystemSettingsClient.tsx', l: 5, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/system/SystemSettingsClient.tsx', l: 6, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/system/tabs/AuditLogTab.tsx', l: 58, action: 'replace', match: 'companyId', replace: '_companyId' },
  { f: 'src/app/(dashboard)/settings/system/tabs/AuditLogTab.tsx', l: 59, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/system/tabs/IntegrationsTab.tsx', l: 3, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/system/tabs/IntegrationsTab.tsx', l: 4, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/system/tabs/IntegrationsTab.tsx', l: 19, action: 'replace', match: 'companyId', replace: '_companyId' },
  { f: 'src/app/(dashboard)/settings/system/tabs/IntegrationsTab.tsx', l: 20, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/system/tabs/NotificationChannelsTab.tsx', l: 25, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/system/tabs/RolesTab.tsx', l: 3, action: 'comment_out' },
  { f: 'src/app/(dashboard)/settings/system/tabs/RolesTab.tsx', l: 19, action: 'replace', match: 'companyId', replace: '_companyId' },
  { f: 'src/app/(dashboard)/settings/system/tabs/RolesTab.tsx', l: 20, action: 'comment_out' },
  { f: 'src/app/(dashboard)/succession/SuccessionClient.tsx', l: 3, action: 'comment_out' },
  { f: 'src/app/(dashboard)/succession/SuccessionClient.tsx', l: 4, action: 'comment_out' },
  { f: 'src/app/(dashboard)/succession/SuccessionClient.tsx', l: 5, action: 'comment_out' },
  { f: 'src/app/(dashboard)/succession/SuccessionClient.tsx', l: 15, action: 'comment_out' },
  { f: 'src/app/(dashboard)/team/skills/TeamSkillsClient.tsx', l: 6, action: 'comment_out' },
  { f: 'src/app/(dashboard)/team/skills/TeamSkillsClient.tsx', l: 15, action: 'comment_out' },
  { f: 'src/app/(dashboard)/team/skills/TeamSkillsClient.tsx', l: 60, action: 'replace', match: 'user', replace: '_user' },
  { f: 'src/app/(dashboard)/team/skills/TeamSkillsClient.tsx', l: 112, action: 'replace', match: '], [skills', replace: ', currentMember], [skills' },
  { f: 'src/app/(dashboard)/training/TrainingClient.tsx', l: 3, action: 'comment_out' },
  { f: 'src/app/(dashboard)/training/TrainingClient.tsx', l: 4, action: 'comment_out' },
  { f: 'src/app/(dashboard)/training/TrainingClient.tsx', l: 5, action: 'comment_out' },
  { f: 'src/app/(dashboard)/training/TrainingClient.tsx', l: 16, action: 'comment_out' },
  { f: 'src/app/(dashboard)/training/enrollments/TrainingEnrollmentsClient.tsx', l: 3, action: 'comment_out' },
  { f: 'src/app/(dashboard)/training/enrollments/TrainingEnrollmentsClient.tsx', l: 4, action: 'comment_out' },
  { f: 'src/app/(dashboard)/training/enrollments/TrainingEnrollmentsClient.tsx', l: 32, action: 'comment_out' },
  { f: 'src/app/api/v1/analytics/calculate/route.ts', l: 10, action: 'remove_import', match: 'apiError' },
  { f: 'src/app/api/v1/analytics/executive/summary/route.ts', l: 18, action: 'replace', match: 'user', replace: '_user' },
  { f: 'src/app/api/v1/analytics/executive/summary/route.ts', l: 22, action: 'comment_out' },
  { f: 'src/app/api/v1/analytics/team-health/overview/route.ts', l: 268, action: 'replace', match: '(b: any', replace: '(_b: any' },
  { f: 'src/app/api/v1/analytics/workforce/overview/route.ts', l: 7, action: 'comment_out' },
  { f: 'src/app/api/v1/analytics/workforce/overview/route.ts', l: 27, action: 'comment_out' },
  { f: 'src/app/api/v1/compensation/salary-bands/route.ts', l: 11, action: 'comment_out' },
  { f: 'src/app/api/v1/compliance/cn/social-insurance/calculate/route.ts', l: 8, action: 'remove_import', match: 'handlePrismaError' },
  { f: 'src/app/api/v1/compliance/kr/severance-interim/calculate/route.ts', l: 15, action: 'replace', match: 'user', replace: '_user' },
  { f: 'src/app/api/v1/dashboard/widgets/[widgetId]/route.ts', l: 164, action: 'replace', match: 'companyId', replace: '_companyId' },
  { f: 'src/app/api/v1/holidays/route.ts', l: 4, action: 'remove_import', match: 'notFound' },
  { f: 'src/app/api/v1/hr-chat/messages/[id]/escalate/route.ts', l: 6, action: 'comment_out' },
  { f: 'src/app/api/v1/leave/admin/route.ts', l: 26, action: 'comment_out' },
  { f: 'src/app/api/v1/leave/type-defs/route.ts', l: 31, action: 'replace', match: 'user', replace: '_user' },
  { f: 'src/app/api/v1/leave/type-defs/route.ts', l: 56, action: 'replace', match: 'user', replace: '_user' },
  { f: 'src/app/api/v1/m365/status/route.ts', l: 22, action: 'replace', match: 'user', replace: '_user' },
  { f: 'src/app/api/v1/notifications/[id]/read/route.ts', l: 6, action: 'remove_import', match: 'NextResponse' },
  { f: 'src/app/api/v1/offboarding/me/route.ts', l: 9, action: 'remove_import', match: 'notFound' },
  { f: 'src/app/api/v1/onboarding/instances/route.ts', l: 15, action: 'replace', match: 'user', replace: '_user' },
  { f: 'src/app/api/v1/payroll/dashboard/route.ts', l: 51, action: 'replace', match: 'user', replace: '_user' },
  { f: 'src/app/api/v1/payroll/exchange-rates/route.ts', l: 11, action: 'remove_import', match: 'apiError' },
  { f: 'src/app/api/v1/payroll/import-logs/route.ts', l: 10, action: 'remove_import', match: 'apiError' },
  { f: 'src/app/api/v1/payroll/runs/[id]/review/route.ts', l: 11, action: 'remove_import', match: 'AnomalySeverity' },
  { f: 'src/app/api/v1/payroll/runs/route.ts', l: 6, action: 'remove_import', match: 'NextRequest' },
  { f: 'src/app/api/v1/payroll/simulation/export/route.ts', l: 22, action: 'remove_import', match: 'fmtKRW' },
  { f: 'src/app/api/v1/payroll/simulation/export/route.ts', l: 27, action: 'remove_import', match: 'signedKRW' },
  { f: 'src/app/api/v1/performance/cycles/[id]/participants/route.ts', l: 9, action: 'remove_import', match: 'apiSuccess' },
  { f: 'src/app/api/v1/performance/evaluations/manager/route.ts', l: 70, action: 'comment_out' },
  { f: 'src/app/api/v1/performance/peer-review/candidates/route.ts', l: 25, action: 'replace', match: 'user', replace: '_user' },
  { f: 'src/app/api/v1/profile/change-requests/route.ts', l: 23, action: 'comment_out' },
  { f: 'src/app/api/v1/recruitment/applications/[id]/convert-to-employee/route.ts', l: 97, action: 'comment_out' },
  { f: 'src/app/api/v1/recruitment/talent-pool/route.ts', l: 36, action: 'replace', match: 'user', replace: '_user' },
  { f: 'src/app/api/v1/settings/evaluation/route.ts', l: 25, action: 'replace', match: 'user', replace: '_user' },
  { f: 'src/app/api/v1/settings/notification-triggers/[id]/route.ts', l: 8, action: 'remove_import', match: 'apiError' },
  { f: 'src/app/api/v1/settings/notification-triggers/route.ts', l: 8, action: 'remove_import', match: 'apiError' },
  { f: 'src/app/api/v1/sidebar/counts/route.ts', l: 31, action: 'comment_out' },
  { f: 'src/app/api/v1/year-end/hr/settlements/route.ts', l: 10, action: 'remove_import', match: 'apiPaginated' },
  { f: 'src/components/attendance/ShiftRosterBoard.tsx', l: 135, action: 'replace', match: 'user', replace: '_user' },
  { f: 'src/components/common/EmployeeCell.tsx', l: 209, action: 'comment_out' },
  { f: 'src/components/common/EmployeeCell.tsx', l: 316, action: 'comment_out' },
  { f: 'src/components/compensation/SimulationTab.tsx', l: 62, action: 'comment_out' },
  { f: 'src/components/compliance/gdpr/DataRequestsTab.tsx', l: 5, action: 'remove_import', match: 'CheckCircle2' },
  { f: 'src/components/hr-chatbot/HrChatbot.tsx', l: 124, action: 'replace', match: '[messages]', replace: '[messages, welcomeMessage]' },
  { f: 'src/components/hr-chatbot/HrChatbot.tsx', l: 146, action: 'replace', match: '[status, sessionId, fetchMessages]', replace: '[status, sessionId, fetchMessages, welcomeMessage]' },
  { f: 'src/components/hr-chatbot/HrDocumentManager.tsx', l: 8, action: 'remove_import', match: 'Pencil' },
  { f: 'src/components/hr-chatbot/HrDocumentManager.tsx', l: 49, action: 'replace', match: 'user', replace: '_user' },
  { f: 'src/components/layout/MobileDrawer.tsx', l: 8, action: 'remove_import', match: 'useCallback' },
  { f: 'src/components/layout/Sidebar.tsx', l: 20, action: 'remove_import', match: 'LucideIcon' },
  { f: 'src/components/manager-hub/ManagerInsightsHub.tsx', l: 69, action: 'replace', match: 'user', replace: '_user' },
  { f: 'src/components/payroll/PayrollCalendar.tsx', l: 8, action: 'remove_import', match: 'PipelineEntry' },
  { f: 'src/components/recruitment/CandidateTimeline.tsx', l: 10, action: 'remove_import', match: 'XCircle' },
  { f: 'src/components/recruitment/CandidateTimeline.tsx', l: 107, action: 'comment_out' },
  { f: 'src/components/settings/ApprovalFlowEditor.tsx', l: 3, action: 'remove_import', match: 'useState' },
  { f: 'src/config/navigation.ts', l: 28, action: 'comment_out' },
  { f: 'src/config/navigation.ts', l: 30, action: 'comment_out' },
  { f: 'src/config/navigation.ts', l: 31, action: 'comment_out' },
  { f: 'src/config/navigation.ts', l: 34, action: 'comment_out' },
  { f: 'src/config/navigation.ts', l: 41, action: 'comment_out' },
  { f: 'src/config/navigation.ts', l: 52, action: 'comment_out' },
  { f: 'src/config/navigation.ts', l: 53, action: 'comment_out' },
  { f: 'src/config/navigation.ts', l: 54, action: 'comment_out' },
  { f: 'src/config/navigation.ts', l: 55, action: 'comment_out' },
  { f: 'src/config/navigation.ts', l: 56, action: 'comment_out' },
  { f: 'src/config/navigation.ts', l: 57, action: 'comment_out' },
  { f: 'src/config/navigation.ts', l: 58, action: 'comment_out' },
  { f: 'src/config/navigation.ts', l: 59, action: 'comment_out' },
  { f: 'src/config/navigation.ts', l: 60, action: 'comment_out' },
  { f: 'src/config/navigation.ts', l: 63, action: 'comment_out' },
  { f: 'src/config/navigation.ts', l: 68, action: 'comment_out' },
  { f: 'src/config/navigation.ts', l: 116, action: 'comment_out' },
  { f: 'src/hooks/use-toast.ts', l: 21, action: 'comment_out' },
  { f: 'src/hooks/useNavigation.ts', l: 9, action: 'remove_import', match: 'NavItem' },
  { f: 'src/lib/analytics/predictive/teamHealth.ts', l: 229, action: 'replace', match: 'companyId', replace: '_companyId' },
  { f: 'src/lib/analytics/predictive/turnoverRisk.ts', l: 7, action: 'remove_import', match: 'subYears' },
  { f: 'src/lib/analytics/queries.ts', l: 8, action: 'comment_out' },
  { f: 'src/lib/analytics/queries.ts', l: 9, action: 'comment_out' },
  { f: 'src/lib/attendance/workTypeEngine.ts', l: 73, action: 'comment_out' },
  { f: 'src/lib/integrations/m365-account.ts', l: 42, action: 'replace', match: 'displayName', replace: '_displayName' },
  { f: 'src/lib/integrations/m365-account.ts', l: 100, action: 'replace', match: 'email', replace: '_email' },
  { f: 'src/lib/leave/accrualEngine.ts', l: 29, action: 'comment_out' },
  { f: 'src/lib/nudge/nudge-engine.ts', l: 22, action: 'remove_import', match: 'subHours' },
  { f: 'src/lib/nudge/rules/leave-pending.rule.ts', l: 33, action: 'replace', match: 'item', replace: '_item' },
  { f: 'src/lib/nudge/rules/offboarding-overdue.rule.ts', l: 34, action: 'replace', match: 'interface ActionPayload {}', replace: '// interface ActionPayload {}' },
  { f: 'src/lib/nudge/rules/payroll-review.rule.ts', l: 35, action: 'replace', match: 'item', replace: '_item' },
  { f: 'src/lib/onboarding/create-onboarding-plan.ts', l: 17, action: 'comment_out' },
  { f: 'src/lib/payroll/anomaly-detector.ts', l: 159, action: 'comment_out' },
  { f: 'src/lib/payroll/calculator.ts', l: 11, action: 'comment_out' },
  { f: 'src/lib/payroll/calculator.ts', l: 18, action: 'comment_out' },
  { f: 'src/lib/payroll/calculator.ts', l: 111, action: 'comment_out' },
  { f: 'src/lib/payroll/yearEndReceiptPdf.ts', l: 97, action: 'comment_out' },
  { f: 'src/lib/payroll/yearEndReceiptPdf.ts', l: 98, action: 'comment_out' },
  { f: 'src/lib/pending-actions.ts', l: 67, action: 'comment_out' },
  { f: 'src/lib/unified-task/mappers/performance.mapper.ts', l: 117, action: 'comment_out' },
  { f: 'src/middleware.ts', l: 37, action: 'replace', match: 'request', replace: '_request' },
  { f: 'src/app/api/v1/settings/approval-flows/route.ts', l: 16, action: 'comment_out' }
];

fixList.forEach(item => {
  if (!fs.existsSync(item.f)) return;
  const lines = fs.readFileSync(item.f, 'utf8').split('\n');
  const lineIdx = item.l - 1;
  if (!lines[lineIdx]) return;
  
  if (item.action === 'comment_out') {
    lines[lineIdx] = '// ' + lines[lineIdx];
  } else if (item.action === 'remove_import') {
    // Basic regex to remove imported item
    let txt = lines[lineIdx];
    // e.g. import { Save, SettingFieldWithOverride } from 'lucide-react'
    const matchRe = new RegExp(`\\b${item.match}\\b\\s*,?\\s*`, 'g');
    txt = txt.replace(matchRe, '');
    // clean up empty braces or trailing commas
    txt = txt.replace(/\{\s*,\s*/g, '{ ').replace(/,\s*\}/g, ' }').replace(/\{\s*\}/g, '');
    // if empty import statement
    if (txt.match(/^import\s+from/)) {
        txt = '// ' + lines[lineIdx];
    } else if (txt.trim() === 'import') {
        txt = '// ' + lines[lineIdx];
    } else if (txt.match(/^import\s+['"]/)) {
        // still ok
    }
    
    // Quick handle for standalone removed imports
    if(item.match === lines[lineIdx].trim() || lines[lineIdx].includes(`import ${item.match} from`)) {
       txt = '// ' + lines[lineIdx];
    }
    lines[lineIdx] = txt;
  } else if (item.action === 'replace') {
    lines[lineIdx] = lines[lineIdx].replace(item.match, item.replace);
  }
  
  fs.writeFileSync(item.f, lines.join('\n'));
});
console.log("Done fixing ESLint warnings");
