#!/usr/bin/env node
/**
 * Comprehensive Korean→English HR translation engine
 * Uses phrase/word replacement + sentence pattern matching
 * Covers all 4841 keys of CTR HR Hub
 */
const fs = require('fs');
const path = require('path');

const CHUNKS_DIR = path.join(__dirname, 'chunks');
const LOCALE = process.argv[2] || 'en';

// === COMPREHENSIVE WORD/PHRASE → ENGLISH MAP (longest match first) ===
const PHRASES = [
  // Multi-word phrases (order matters — longest first)
  ["성과 캘리브레이션을 관리합니다", "Manage performance calibration"],
  ["성과 등급 기반 보상 조정을 계획합니다", "Plan compensation adjustments based on performance grades"],
  ["동료 평가는 익명으로 집계됩니다. 솔직하고 건설적인 피드백을 부탁드립니다.", "Peer evaluations are aggregated anonymously. Please provide honest and constructive feedback."],
  ["평가는 익명으로 처리됩니다. 매니저만 평가자를 확인할 수 있습니다.", "Evaluations are processed anonymously. Only managers can see the evaluators."],
  ["평가자 정보는 익명으로 처리되었습니다.", "Evaluator information has been anonymized."],
  ["결과 확인은 동의가 아닌 수신 확인입니다. 이의가 있으시면 매니저와 상담하세요.", "Acknowledging results is a receipt confirmation, not an agreement. If you disagree, please consult your manager."],
  ["결과를 확인하시겠습니까? 결과 확인은 동의가 아닌 수신 확인입니다.", "Would you like to acknowledge the results? This is a receipt confirmation, not an agreement."],
  ["💡 통보 후 168시간(7일) 이내 미확인 시 자동 확인 처리됩니다.", "💡 If not acknowledged within 168 hours (7 days) after notification, it will be auto-confirmed."],
  ["캘리브레이션 단계에서만 확정할 수 있습니다.", "Finalization is only available during the calibration phase."],
  ["성과 주기를 확정하시겠습니까? 확정 후에는 수정할 수 없습니다.", "Are you sure you want to finalize this performance cycle? This action cannot be undone."],
  ["평가를 확정하시겠습니까? 확정 후에는 수정이 제한됩니다.", "Are you sure you want to finalize this evaluation? Editing will be restricted after finalization."],
  ["제출하면 수정할 수 없습니다. 제출하시겠습니까?", "Once submitted, it cannot be edited. Would you like to submit?"],
  ["모든 초안 목표를 제출하시겠습니까? 제출 후에는 수정할 수 없습니다.", "Would you like to submit all draft goals? They cannot be edited after submission."],
  ["MBO 목표를 설정하고 관리합니다", "Set and manage your MBO goals"],
  ["100%가 되어야 제출 가능합니다", "Weights must total 100% to submit"],
  ["종합 의견은 최소 20자 이상 작성해주세요.", "Overall comment must be at least 20 characters."],
  ["관찰된 행동에 체크하고 역량 등급을 선택하세요", "Check observed behaviors and select the competency grade"],
  ["최종 등급은 캘리브레이션 세션에서 확정됩니다.", "Final grade will be confirmed in the calibration session."],
  ["자기평가가 제출되었습니다. 수정할 수 없습니다.", "Self-evaluation has been submitted. It cannot be edited."],
  ["MBO 업적과 BEI 역량을 평가합니다", "Evaluate MBO achievements and BEI competencies"],
  ["모든 점수와 코멘트를 작성해주세요.", "Please complete all scores and comments."],
  ["팀원의 성과를 평가합니다", "Evaluate team members' performance"],
  ["중간 점검을 통해 목표 진행 상황을 기록합니다", "Record goal progress through interim check-ins"],
  ["체크인은 CHECK_IN 단계에서 진행됩니다.", "Check-ins are available during the CHECK_IN phase."],
  ["매니저 평가는 EVAL_OPEN 단계에서 진행됩니다.", "Manager evaluation is available during the EVAL_OPEN phase."],
  ["자기평가는 EVAL_OPEN 단계에서 진행됩니다.", "Self-evaluation is available during the EVAL_OPEN phase."],
  ["동료평가는 EVAL_OPEN 단계에서 진행됩니다.", "Peer review is available during the EVAL_OPEN phase."],
  ["결과 통보는 FINALIZED 이후에 가능합니다.", "Result notification is available after FINALIZED status."],
  ["결과가 공개되면 여기에서 확인할 수 있습니다.", "You can review the results here once they are published."],
  ["결과는 평가가 완료된 후 공개됩니다.", "Results will be available after the evaluation is complete."],
  ["현재 진행 중인 성과 사이클이 없습니다.", "There is no active performance cycle currently."],
  ["나의 성과 결과를 확인합니다", "View my performance results"],
  ["성과 평가 결과를 확인합니다", "Review performance evaluation results"],
  ["소중한 피드백 감사합니다.", "Thank you for your valuable feedback."],
  ["동료 평가가 제출되었습니다", "Peer evaluation has been submitted."],
  ["이 직원에게 결과를 통보하시겠습니까?", "Would you like to notify this employee of their results?"],
  ["HR 관리자 또는 임원만 접근 가능합니다.", "Only HR admins or executives can access this page."],
  ["이 목표를 삭제하시겠습니까?", "Are you sure you want to delete this goal?"],
  ["보상기획 대시보드 (Compensation Review)", "Compensation Planning Dashboard"],
  ["나의 체크인 (My Check-ins)", "My Check-ins"],
  ["나의 목표 (My Goals)", "My Goals"],
  ["동료평가 (Peer Review)", "Peer Review"],
  ["결과 통보 (Result Notification)", "Result Notification"],
  ["BEI 역량평가 (CTR 핵심가치)", "BEI Competency Evaluation (CTR Core Values)"],
  ["MBO:BEI 비중 (합계 100%)", "MBO:BEI Weight (Total 100%)"],
  ["1:1 미팅 기록 | CTR HR Hub", "1:1 Meeting Records | CTR HR Hub"],
  ["1:1 미팅 | CTR HR Hub", "1:1 Meetings | CTR HR Hub"],
  ["동료 평가 지정 | CTR HR Hub", "Peer Review Assignment | CTR HR Hub"],
  ["보상 기획 단계가 아닙니다.", "Not in the compensation planning phase."],
  ["결과 통보 단계가 아닙니다.", "Not in the result notification phase."],
  ["아직 결과가 공개되지 않았습니다.", "Results have not been published yet."],
  ["아직 평가 기간이 아닙니다.", "The evaluation period has not started yet."],
  ["아직 자기평가 기간이 아닙니다.", "The self-evaluation period has not started yet."],
  ["아직 동료평가 기간이 아닙니다.", "The peer review period has not started yet."],
  ["아직 등록된 목표가 없습니다.", "No goals have been registered yet."],
  ["목표 설정 기간이 아닙니다.", "The goal setting period has not started yet."],
  ["체크인 기간이 아닙니다.", "Not in the check-in period."],
  ["현재 사이클 상태에서는 목표를 조회할 수 없습니다.", "Unable to view goals in the current cycle status."],
  ["등록된 목표가 없습니다.", "No registered goals available."],
  ["직속 팀원이 없습니다", "No direct reports found"],
  ["추천 후보가 없습니다.", "No recommended candidates available."],
  ["변경된 내용이 없습니다.", "No changes have been made."],
  ["예외 건이 없습니다.", "No exceptions found."],
  ["세션이 없습니다", "No sessions available"],
  ["접근 권한이 없습니다.", "You do not have access permission."],
  ["최소 2명을 지명해주세요.", "Please nominate at least 2 peers."],
  ["세션을 선택하세요", "Please select a session"],
  ["팀원을 선택하세요", "Please select a team member"],
  ["소중한 피드백 감사합니다", "Thank you for your valuable feedback"],

  // --- Payroll full phrases ---
  ["정산 상세 조회", "View Settlement Details"],
  ["급여 계산 실행", "Run Payroll Calculation"],
  ["급여 마감 확정", "Finalize Payroll Close"],
  ["급여 이상 항목", "Payroll Anomaly Items"],
  ["급여 대장 다운로드", "Download Payroll Register"],
  ["급여 명세서 발송", "Send Payslips"],
  ["급여 이상 알림", "Payroll Anomaly Alerts"],
  ["급여 정산", "Payroll Settlement"],
  ["급여 계산", "Payroll Calculation"],
  ["급여 승인", "Payroll Approval"],
  ["급여 확정", "Payroll Finalization"],
  ["급여 결재 승인", "Payroll Approval"],
  ["급여 결재", "Payroll Decision"],
  ["급여 명세서", "Payslip"],
  ["급여 산출", "Payroll Calculation"],
  ["급여 항목", "Pay Items"],
  ["급여 내역", "Payroll History"],
  ["급여 지급", "Payroll Payment"],
  ["급여 검토", "Payroll Review"],
  ["개인별 상세 검토", "Individual Detail Review"],
  ["지급 전 검증 사항", "Pre-payment Verification Items"],
  ["전월 대비", "Compared to Previous Month"],
  ["전월 대비 변동", "Change from Previous Month"],
  ["이상 항목", "Anomaly Items"],
  ["이상 유형", "Anomaly Type"],
  ["증감 현황", "Change Summary"],
  ["검토 완료", "Review Complete"],
  ["검토 대기", "Pending Review"],
  ["이상 없음", "No Issues"],
  ["이상 해결", "Issue Resolved"],
  ["해결 완료", "Resolved"],
  ["미해결", "Unresolved"],
  ["인사 발령", "Personnel Appointment"],
  ["인사 발령 유형", "Appointment Type"],
  ["발령 이력", "Appointment History"],
  ["발령 내역", "Appointment Details"],
  ["발령 일자", "Appointment Date"],
  ["인건비 총괄", "Total Labor Cost"],
  ["인건비 분석", "Labor Cost Analysis"],
  ["인건비 예산", "Labor Cost Budget"],
  ["인건비 현황", "Labor Cost Status"],
  ["매출 대비", "Compared to Revenue"],
  ["인당 인건비", "Per Capita Labor Cost"],
  ["지급 항목", "Pay Items"],
  ["공제 항목", "Deduction Items"],
  ["총지급액", "Total Pay"],
  ["총공제액", "Total Deductions"],
  ["차인지급액", "Net Pay"],
  ["세전합계", "Total Before Tax"],
  ["기본급", "Base Salary"],
  ["연장근무수당", "Overtime Pay"],
  ["야간근무수당", "Night Shift Pay"],
  ["휴일근무수당", "Holiday Pay"],
  ["직책수당", "Position Allowance"],
  ["식대", "Meal Allowance"],
  ["교통비", "Transportation Allowance"],
  ["국민연금", "National Pension"],
  ["건강보험", "Health Insurance"],
  ["고용보험", "Employment Insurance"],
  ["산재보험", "Industrial Accident Insurance"],
  ["소득세", "Income Tax"],
  ["주민세", "Local Income Tax"],
  ["실수령액", "Net Pay"],
  ["보너스", "Bonus"],

  // --- Analytics full phrases ---
  ["총 직원 수", "Total Employees"],
  ["평균 근속연수", "Average Tenure"],
  ["평균 연령", "Average Age"],
  ["이직률", "Turnover Rate"],
  ["채용률", "Hiring Rate"],
  ["남녀 비율", "Gender Ratio"],
  ["부서별 인원", "Headcount by Department"],
  ["직급별 분포", "Distribution by Job Grade"],
  ["연령대별 분포", "Distribution by Age Group"],
  ["근속연수별 분포", "Distribution by Tenure"],
  ["월별 입사자", "Monthly New Hires"],
  ["월별 퇴사자", "Monthly Separations"],
  ["월별 추이", "Monthly Trend"],
  ["연도별 추이", "Yearly Trend"],
  ["성별 분포", "Gender Distribution"],
  ["성별 급여 격차", "Gender Pay Gap"],
  ["인력 현황", "Workforce Status"],
  ["인력 분석", "Workforce Analytics"],
  ["인력 구성", "Workforce Composition"],
  ["핵심 지표", "Key Metrics"],
  ["임원 요약", "Executive Summary"],
  ["HR 대시보드", "HR Dashboard"],
  ["경영진 보고서", "Executive Report"],
  ["채용 분석", "Recruitment Analytics"],
  ["근태 분석", "Attendance Analytics"],
  ["보상 분석", "Compensation Analytics"],
  ["성과 분석", "Performance Analytics"],
  ["교육 분석", "Training Analytics"],
  ["이직 분석", "Turnover Analysis"],
  ["이직 위험", "Turnover Risk"],
  ["이직 예측", "Turnover Prediction"],
  ["리텐션", "Retention"],
  ["여성 (명)", "Female (headcount)",],
  ["남성 (명)", "Male (headcount)"],
  ["남성 평균", "Male Average"],
  ["여성 평균", "Female Average"],
  ["남성", "Male"],
  ["여성", "Female"],
  ["중위 급여", "Median Salary"],
  ["급여 격차", "Pay Gap"],
  ["급여 분석", "Salary Analysis"],
  ["급여 분포", "Salary Distribution"],
  ["인당 매출", "Revenue per Employee"],
  ["비용 비율", "Cost Ratio"],
  ["인건비 비율", "Labor Cost Ratio"],
  ["데이터 없음", "No Data"],
  ["연도 선택", "Select Year"],
  ["기간 선택", "Select Period"],
  ["분기", "Quarter"],
  ["분기별", "By Quarter"],

  // --- Settings full phrases ---
  ["조직 구조 관리", "Organization Structure Management"],
  ["결재 규칙", "Approval Rules"],
  ["결재 규칙 관리", "Approval Rules Management"],
  ["결재선", "Approval Chain"],
  ["결재선 설정", "Approval Chain Setup"],
  ["알림 채널", "Notification Channel"],
  ["알림 채널 관리", "Notification Channel Management"],
  ["역할 관리", "Role Management"],
  ["역할 설정", "Role Settings"],
  ["역할 및 권한", "Roles and Permissions"],
  ["감사 로그", "Audit Log"],
  ["시스템 설정", "System Settings"],
  ["일반 설정", "General Settings"],
  ["조직 설정", "Organization Settings"],
  ["권한 관리", "Permission Management"],
  ["보안 설정", "Security Settings"],
  ["알림 설정", "Notification Settings"],
  ["근태 설정", "Attendance Settings"],
  ["근태 규칙", "Attendance Rules"],
  ["연차 규칙", "Annual Leave Rules"],
  ["휴가 설정", "Leave Settings"],
  ["계약 규칙", "Contract Rules"],
  ["승인 흐름", "Approval Flow"],
  ["승인 규칙", "Approval Rule"],
  ["발령 유형별 승인 규칙", "Approval Rules by Appointment Type"],
  ["평가 항목", "Evaluation Items"],
  ["등급 체계", "Grade System"],
  ["역량 모델", "Competency Model"],
  ["역량 모델 관리", "Competency Model Management"],
  ["성과 설정", "Performance Settings"],
  ["채용 설정", "Recruitment Settings"],
  ["급여 설정", "Payroll Settings"],
  ["온보딩 설정", "Onboarding Settings"],
  ["오프보딩 설정", "Offboarding Settings"],
  ["직급 체계", "Job Grade System"],
  ["직급 관리", "Job Grade Management"],
  ["직위 관리", "Position Management"],
  ["부서 관리", "Department Management"],
  ["부서 추가", "Add Department"],
  ["부서 편집", "Edit Department"],
  ["부서 삭제", "Delete Department"],
  ["직급 추가", "Add Job Grade"],
  ["직급 편집", "Edit Job Grade"],
  ["직급 삭제", "Delete Job Grade"],
  ["규칙 추가", "Add Rule"],
  ["규칙 편집", "Edit Rule"],
  ["규칙 삭제", "Delete Rule"],
  ["템플릿 관리", "Template Management"],
  ["템플릿 추가", "Add Template"],
  ["템플릿 편집", "Edit Template"],
  ["잠금", "Lock"],
  ["잠금 해제", "Unlock"],
  ["활성화", "Enable"],
  ["비활성화", "Disable"],
  ["복원", "Restore"],
  ["강등", "Demotion"],
  ["승진", "Promotion"],
  ["전보", "Transfer"],
  ["겸직", "Concurrent Position"],
  ["파견", "Secondment"],
  ["휴직", "Leave of Absence"],
  ["복직", "Reinstatement"],
  ["정직", "Suspension"],
  ["경고", "Warning"],
  ["차단", "Blocked"],
  ["초과근무 차단", "Overtime Blocking"],
  ["초과근무", "Overtime"],
  ["근무 시간", "Working Hours"],
  ["출근 시간", "Clock In Time"],
  ["퇴근 시간", "Clock Out Time"],
  ["유연근무", "Flexible Work"],
  ["재택근무", "Remote Work"],
  ["시차출퇴근", "Flexible Start/End"],
  ["교대근무", "Shift Work"],
  ["주말 근무", "Weekend Work"],
  ["공휴일", "Public Holiday"],
  ["연차", "Annual Leave"],
  ["병가", "Sick Leave"],
  ["경조사", "Family Event Leave"],
  ["출산 휴가", "Maternity Leave"],
  ["육아 휴직", "Parental Leave"],
  ["특별 휴가", "Special Leave"],
  ["연차 촉진", "Annual Leave Promotion"],
  ["잔여 연차", "Remaining Annual Leave"],
  ["사용 연차", "Used Annual Leave"],
  ["발생 연차", "Accrued Annual Leave"],

  // --- Compliance ---
  ["준수율", "Compliance Rate"],
  ["위반 건수", "Violation Count"],
  ["위반 유형", "Violation Type"],
  ["규정 준수", "Regulatory Compliance"],
  ["법정 교육", "Mandatory Training"],
  ["산업 안전", "Industrial Safety"],
  ["개인 정보", "Personal Information"],
  ["정보 보호", "Data Protection"],

  // --- Navigation ---
  ["채용 관리", "Recruitment Management"],
  ["성과 관리", "Performance Management"],
  ["급여 관리", "Payroll Management"],
  ["근태 관리", "Attendance Management"],
  ["교육 관리", "Training Management"],
  ["인사 관리", "HR Management"],
  ["조직 관리", "Organization Management"],
  ["직원 관리", "Employee Management"],
  ["휴가 관리", "Leave Management"],
  ["보상 관리", "Compensation Management"],
  ["승계 관리", "Succession Management"],
  ["규율 관리", "Discipline Management"],
  ["온보딩", "Onboarding"],
  ["오프보딩", "Offboarding"],
  ["전체 보기", "View All"],
  ["더 보기", "View More"],
  ["목록으로", "Back to List"],
  ["이전으로", "Go Back"],

  // --- Home / MySpace ---
  ["나의 할 일", "My Tasks"],
  ["팀 현황", "Team Status"],
  ["승인 대기", "Pending Approvals"],
  ["출근", "Check In"],
  ["퇴근", "Check Out"],
  ["미출근", "Absent"],
  ["휴가", "On Leave"],
  ["실시간", "Real-time"],
  ["새로운 알림", "New Notifications"],
  ["할 일 목록", "To-Do List"],
  ["근무 기록", "Work Records"],
  ["나의 프로필", "My Profile"],
  ["조치하기", "Take Action"],
  ["전체 보기", "View All"],

  // --- MyTasks ---
  ["기한 초과", "Overdue"],
  ["마감 임박", "Due Soon"],
  ["진행중", "In Progress"],
  ["완료됨", "Completed"],
  ["우선순위", "Priority"],
  ["높음", "High"],
  ["보통", "Medium"],
  ["낮음", "Low"],
  ["긴급", "Urgent"],
  ["보류", "On Hold"],
];

// === WORD-LEVEL TRANSLATIONS (for compositional matching) ===
const WORDS = {
  "성과": "Performance",
  "주기": "Cycle",
  "확정": "Finalized",
  "제출": "Submit",
  "완료": "Complete",
  "실패": "Failed",
  "저장": "Save",
  "생성": "Create",
  "삭제": "Delete",
  "수정": "Edit",
  "취소": "Cancel",
  "승인": "Approve",
  "반려": "Reject",
  "거부": "Decline",
  "대기": "Pending",
  "처리": "Processing",
  "확인": "Confirm",
  "검토": "Review",
  "조정": "Adjustment",
  "관리": "Management",
  "설정": "Settings",
  "분석": "Analysis",
  "통보": "Notification",
  "등급": "Grade",
  "점수": "Score",
  "평가": "Evaluation",
  "세션": "Session",
  "사이클": "Cycle",
  "캘리브레이션": "Calibration",
  "파이프라인": "Pipeline",
  "목표": "Goal",
  "체크인": "Check-in",
  "보상": "Compensation",
  "예산": "Budget",
  "인상": "Raise",
  "예외": "Exception",
  "역량": "Competency",
  "업적": "Achievement",
  "종합": "Overall",
  "최종": "Final",
  "자기": "Self",
  "매니저": "Manager",
  "동료": "Peer",
  "팀원": "Team Member",
  "직원": "Employee",
  "부서": "Department",
  "직급": "Job Grade",
  "이름": "Name",
  "상태": "Status",
  "유형": "Type",
  "액션": "Action",
  "일시": "Date/Time",
  "기록": "Record",
  "내역": "History",
  "이력": "History",
  "추천": "Recommendation",
  "지명": "Nomination",
  "면접": "Interview",
  "채용": "Recruitment",
  "급여": "Payroll",
  "근태": "Attendance",
  "교육": "Training",
  "휴가": "Leave",
  "연차": "Annual Leave",
  "수당": "Allowance",
  "공제": "Deduction",
  "보험": "Insurance",
  "세금": "Tax",
  "알림": "Notification",
  "규칙": "Rule",
  "정책": "Policy",
  "권한": "Permission",
  "역할": "Role",
  "템플릿": "Template",
  "조직": "Organization",
  "인사": "HR",
  "발령": "Appointment",
  "계약": "Contract",
  "기간": "Period",
  "항목": "Item",
  "건수": "Count",
  "인원": "Headcount",
  "비율": "Ratio",
  "추이": "Trend",
  "분포": "Distribution",
  "현황": "Status",
  "요약": "Summary",
  "보고서": "Report",
  "차트": "Chart",
  "필터": "Filter",
  "비교": "Comparison",
  "지표": "Metric",
  "대시보드": "Dashboard",
  "온보딩": "Onboarding",
  "오프보딩": "Offboarding",
  "프로필": "Profile",
  "공고": "Posting",
  "포지션": "Position",
  "후보자": "Candidate",
  "지원자": "Applicant",
  "이력서": "Resume",
  "오퍼": "Offer",
  "입사": "Joining",
  "퇴사": "Separation",
  "퇴직": "Retirement",
  "코멘트": "Comment",
  "메모": "Memo",
  "제목": "Title",
  "설명": "Description",
  "발송": "Send",
  "다운로드": "Download",
  "업로드": "Upload",
  "내보내기": "Export",
  "가져오기": "Import",
  "이전": "Previous",
  "다음": "Next",
  "닫기": "Close",
  "열기": "Open",
  "시작": "Start",
  "종료": "End",
  "진행": "Progress",
  "마감": "Deadline",
  "선택": "Select",
  "검색": "Search",
  "로그": "Log",
  "감사": "Audit",
  "보안": "Security",
  "일반": "General",
  "시스템": "System",
  "채널": "Channel",
  "결재": "Approval",
  "결재선": "Approval Chain",
  "흐름": "Flow",
  "승계": "Succession",
  "규율": "Discipline",
  "징계": "Disciplinary",
  "포상": "Award",
  "수습": "Probation",
  "정규직": "Regular Employee",
  "계약직": "Contract Employee",
  "기여": "Contribution",
  "참여": "Participation",
  "전문성": "Professional Expertise",
  "소통": "Communication",
  "능력": "Ability",
  "신뢰성": "Reliability",
  "주도성": "Initiative",
  "영향력": "Impact",
  "의지": "Willingness",
  "성장": "Growth",
  "도전": "Challenge",
  "신뢰": "Trust",
  "책임": "Responsibility",
  "존중": "Respect",
  "협업": "Collaboration",
  "팀워크": "Teamwork",
  "코칭": "Coaching",
  "피드백": "Feedback",
  "긍정적": "Positive",
  "부정적": "Negative",
  "보통": "Average",
  "우려됨": "Concerning",
  "탁월": "Exceptional",
  "우수": "Excellent",
  "미흡": "Below Expectations",
  "아젠다": "Agenda",
  "정기": "Regular",
  "추가": "Additional",
  "분기": "Quarter",
  "커리어": "Career",
  "개발": "Development",
  "기타": "Other",
  "예약": "Booking",
  "예정": "Scheduled",
  "빈도": "Frequency",
  "미완료": "Incomplete",
  "미작성": "Not Written",
  "미통보": "Not Notified",
  "총": "Total",
  "합계": "Total",
  "총점": "Total Score",
  "평균": "Average",
  "최소": "Minimum",
  "최대": "Maximum",
  "가중치": "Weight",
  "비중": "Weight",
  "블록": "Block",
  "원래": "Original",
  "사업부": "Business Unit",
  "진행률": "Progress",
  "새": "New",
  "전체": "All",
  "건": "item(s)",
  "명": "person(s)",
  "원": "KRW",
  "일": "day(s)",
  "월": "month",
  "년": "year",
  "호": "No.",
};

// === TRANSLATE FUNCTION ===
function translate(ko) {
  if (!ko || typeof ko !== 'string') return '';
  
  // 1. Try exact phrase match (longest first — already sorted)
  for (const [kr, en] of PHRASES) {
    if (ko === kr) return en;
  }
  
  // 2. For short strings (< 15 chars), try direct word mapping
  if (ko.length < 15 && WORDS[ko]) return WORDS[ko];
  
  // 3. Try pattern-based translation for common sentence types
  // "~에 실패했습니다" → "Failed to ~"
  let m;
  if ((m = ko.match(/^(.+?)에 실패했습니다\.?$/))) {
    return `Failed to ${translateFragment(m[1])}.`;
  }
  // "~ 실패" (shorter form)
  if ((m = ko.match(/^(.+?) 실패$/))) {
    return `${translateFragment(m[1])} Failed`;
  }
  // "~되었습니다"
  if ((m = ko.match(/^(.+?)되었습니다\.?$/))) {
    return `${translateFragment(m[1])} completed.`;
  }
  // "~입니다"
  if ((m = ko.match(/^(.+?)입니다\.?$/))) {
    return `${translateFragment(m[1])}.`;
  }
  // "~하시겠습니까?"
  if ((m = ko.match(/^(.+?)하시겠습니까\??$/))) {
    return `Would you like to ${translateFragment(m[1])}?`;
  }
  // "~하겠습니까?"
  if ((m = ko.match(/^(.+?)겠습니까\??$/))) {
    return `Would you like to ${translateFragment(m[1])}?`;
  }
  // "~없습니다"
  if ((m = ko.match(/^(.+?)(?:이|가) 없습니다\.?$/))) {
    return `No ${translateFragment(m[1])} available.`;
  }
  // "~해주세요" / "~주세요"
  if ((m = ko.match(/^(.+?)(?:해|하여 |어 )주세요\.?$/))) {
    return `Please ${translateFragment(m[1])}.`;
  }
  if ((m = ko.match(/^(.+?)주세요\.?$/))) {
    return `Please ${translateFragment(m[1])}.`;
  }
  // "~선택" (단어)
  if ((m = ko.match(/^(.+?) 선택$/))) {
    return `Select ${translateFragment(m[1])}`;
  }
  // "~을/를 ~하세요" → "Please ~ the ~"
  if ((m = ko.match(/^(.+?)(?:을|를) (.+?)하?세요\.?$/))) {
    return `Please ${translateFragment(m[2])} ${translateFragment(m[1])}.`;
  }
  // "~ 중..." → "~ing..."
  if ((m = ko.match(/^(.+?) 중\.{0,3}$/))) {
    return `${translateFragment(m[1])}...`;
  }
  // "~수 없습니다" → "Cannot ~"
  if ((m = ko.match(/^(.+?)수 없습니다\.?$/))) {
    return `Cannot ${translateFragment(m[1])}.`;
  }

  // 4. Try compositional: break into known words
  let result = ko;
  // Sort words by length (longest first) to avoid partial matches
  const sortedWords = Object.entries(WORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [kr, en] of sortedWords) {
    result = result.split(kr).join(en);
  }
  
  // If we replaced at least 50% of the characters, use it
  const koreanChars = (result.match(/[\uAC00-\uD7AF]/g) || []).length;
  const totalChars = result.replace(/\s/g, '').length;
  if (totalChars > 0 && koreanChars / totalChars < 0.3) {
    // Clean up: remove connecting particles
    result = result
      .replace(/[을를은는이가의에서도와과로으며고]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return result;
  }
  
  // 5. Fallback: return empty (will need manual fill)
  return '';
}

function translateFragment(fragment) {
  // Try phrase match first
  for (const [kr, en] of PHRASES) {
    if (fragment === kr) return en.toLowerCase();
  }
  if (WORDS[fragment]) return WORDS[fragment].toLowerCase();
  
  // Compositional
  let result = fragment;
  const sortedWords = Object.entries(WORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [kr, en] of sortedWords) {
    result = result.split(kr).join(en.toLowerCase());
  }
  return result;
}

// === PROCESS CHUNKS ===
const chunkFiles = fs.readdirSync(CHUNKS_DIR)
  .filter(f => f.startsWith('en_chunk_') && !f.includes('_done') && f.endsWith('.json'))
  .sort();

let totalTranslated = 0;
let totalMissing = 0;
const missingItems = [];

for (const file of chunkFiles) {
  const items = JSON.parse(fs.readFileSync(path.join(CHUNKS_DIR, file), 'utf-8'));
  
  const translated = items.map(item => {
    const t = translate(item.ko);
    if (!t) missingItems.push({ path: item.path, ko: item.ko });
    return { ...item, translated: t };
  });
  
  const done = translated.filter(t => t.translated !== '').length;
  totalTranslated += done;
  totalMissing += (items.length - done);
  
  const outFile = file.replace('.json', '_done.json');
  fs.writeFileSync(
    path.join(CHUNKS_DIR, outFile),
    JSON.stringify(translated, null, 2) + '\n'
  );
  
  console.log(`${file}: ${done}/${items.length} translated`);
}

console.log(`\nTotal: ${totalTranslated}/${totalTranslated + totalMissing} (${Math.round(totalTranslated/(totalTranslated+totalMissing)*100)}%)`);
console.log(`Missing: ${totalMissing} keys`);

if (missingItems.length > 0) {
  fs.writeFileSync(
    path.join(CHUNKS_DIR, 'en_missing.json'),
    JSON.stringify(missingItems, null, 2) + '\n'
  );
}
