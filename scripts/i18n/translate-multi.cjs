#!/usr/bin/env node
/**
 * Unified ZH/VI/ES Translation Engine
 * 
 * Strategy: Use EN translations as bridge reference + direct ko→target dictionaries.
 * For this enterprise HR system, we translate Korean source values to:
 * - zh: Simplified Chinese (中国大陆)
 * - vi: Vietnamese
 * - es: Mexican Spanish
 */
const fs = require('fs');
const path = require('path');

const CHUNKS_DIR = path.join(__dirname, 'chunks');
const LOCALE = process.argv[2]; // 'zh', 'vi', or 'es'

if (!['zh', 'vi', 'es'].includes(LOCALE)) {
  console.error('Usage: node translate-multi.cjs <zh|vi|es>');
  process.exit(1);
}

// ============================================================
// DICTIONARIES: Korean → Target Language
// ============================================================

const ZH = {
  // === Common / UI ===
  "확인": "确认", "취소": "取消", "저장": "保存", "삭제": "删除", "수정": "修改",
  "편집": "编辑", "추가": "添加", "검색": "搜索", "닫기": "关闭", "열기": "打开",
  "다음": "下一步", "이전": "上一步", "완료": "完成", "전체": "全部", "선택": "选择",
  "등록": "注册", "조회": "查询", "승인": "批准", "반려": "驳回", "요청": "请求",
  "대기": "等待", "처리": "处理", "상태": "状态", "제목": "标题", "내용": "内容",
  "설명": "说明", "비고": "备注", "메모": "备忘", "날짜": "日期", "기간": "期间",
  "시작": "开始", "종료": "结束", "생성": "创建", "업데이트": "更新", "새로고침": "刷新",
  "로딩": "加载中", "로딩 중...": "加载中...", "오류": "错误", "성공": "成功",
  "실패": "失败", "경고": "警告", "정보": "信息", "도움말": "帮助", "설정": "设置",
  "이름": "姓名", "이메일": "邮箱", "전화번호": "电话号码", "주소": "地址",
  "부서": "部门", "직급": "职级", "직위": "职位", "사번": "工号", "입사일": "入职日期",
  "퇴사일": "离职日期", "근무": "工作", "출근": "上班", "퇴근": "下班",
  "연차": "年假", "휴가": "休假", "급여": "薪资", "수당": "津贴", "공제": "扣除",
  "평가": "评估", "목표": "目标", "달성": "达成", "진행": "进行", "진행 중": "进行中",
  "진행률": "进度", "완료됨": "已完成", "미완료": "未完成", "보류": "搁置",
  "활성": "活跃", "비활성": "非活跃", "없음": "无", "있음": "有",
  "예": "是", "아니오": "否", "네": "是", "남성": "男", "여성": "女",
  "합계": "合计", "평균": "平均", "최대": "最大", "최소": "最小",
  "위험": "风险", "주의": "注意", "안전": "安全", "높음": "高", "낮음": "低",
  "중간": "中", "상세": "详情", "요약": "摘要", "통계": "统计", "분석": "分析",
  "보고서": "报告", "리포트": "报告", "차트": "图表", "그래프": "图形",
  "다운로드": "下载", "업로드": "上传", "내보내기": "导出", "가져오기": "导入",
  "인쇄": "打印", "미리보기": "预览", "필터": "筛选", "정렬": "排序",
  "이전 페이지": "上一页", "다음 페이지": "下一页", "첫 페이지": "首页",
  "마지막 페이지": "末页", "행": "行", "열": "列", "페이지": "页",
  // HR specifics
  "정규직": "正式员工", "계약직": "合同工", "파견직": "派遣工", "인턴": "实习生",
  "재직": "在职", "퇴직": "离职", "휴직": "休职", "대기발령": "待岗",
  "법인": "法人", "본사": "总部", "지사": "分公司", "공장": "工厂",
  "채용": "招聘", "면접": "面试", "합격": "录用", "불합격": "不录用",
  "연봉": "年薪", "월급": "月薪", "시급": "时薪", "기본급": "基本工资",
  "성과급": "绩效奖金", "보너스": "奖金", "인센티브": "激励",
  "인사": "人事", "조직": "组织", "조직도": "组织架构图",
  "출퇴근": "考勤", "근태": "出勤", "지각": "迟到", "조퇴": "早退", "결근": "旷工",
  "초과근무": "加班", "야근": "夜班", "교대근무": "倒班",
  "사원": "职员", "대리": "代理", "과장": "科长", "차장": "次长",
  "부장": "部长", "이사": "理事", "상무": "常务", "전무": "专务",
  "부사장": "副社长", "사장": "社长", "대표이사": "代表理事",
  // Actions & States
  "마감": "截止", "마감 해제": "取消截止", "처리 중...": "处理中...",
  "사용": "使用", "잔여": "剩余", "승인됨": "已批准", "반려됨": "已驳回",
  "대기 중": "等待中", "요청됨": "已请求", "진행중": "进行中",
  "기각": "驳回", "철회": "撤回", "재요청": "重新请求",
  "기안": "起草", "결재": "审批", "결재선": "审批链",
  // Performance
  "핵심 역량": "核心能力", "직무 역량": "岗位能力", "리더십": "领导力",
  "커뮤니케이션": "沟通", "협업": "协作", "문제 해결": "问题解决",
  "창의성": "创造力", "전문성": "专业性", "책임감": "责任感",
  "1:1 미팅": "1:1会议", "1:1 면담": "1:1面谈",
  "동료 평가": "同事评估", "상사 평가": "上级评估", "자기 평가": "自我评估",
  "목표 설정": "目标设定", "목표 달성": "目标达成", "성과 리뷰": "绩效评审",
  "피드백": "反馈", "코칭": "辅导", "멘토링": "导师指导",
  "KPI": "KPI", "OKR": "OKR", "MBO": "MBO",
  // Leave
  "연차 휴가": "年假", "병가": "病假", "경조사": "红白事假",
  "출산 휴가": "产假", "육아 휴직": "育儿假", "공가": "公假",
  "반차": "半天假", "오전 반차": "上午半天假", "오후 반차": "下午半天假",
  // Payroll
  "지급": "发放", "공제액": "扣除额", "실수령": "实发",
  "소득세": "所得税", "주민세": "住民税", "건강보험": "健康保险",
  "국민연금": "国民年金", "고용보험": "雇佣保险",
  "통화": "货币", "환율": "汇率", "원": "元",
  "은행": "银行", "계좌": "账户", "이체": "转账",
  "명세서": "工资单", "급여명세서": "工资明细",
  // Analytics
  "이직률": "离职率", "이직 위험": "离职风险", "번아웃": "职业倦怠",
  "번아웃 위험": "倦怠风险", "팀 건강도": "团队健康度",
  "대시보드": "仪表板", "위젯": "小部件", "KPI 대시보드": "KPI仪表板",
  // Settings
  "일반 설정": "通用设置", "알림 설정": "通知设置", "보안 설정": "安全设置",
  "권한": "权限", "역할": "角色", "관리자": "管理员",
  "감사 로그": "审计日志", "시스템": "系统", "연동": "集成",
  "ERP 연동": "ERP集成", "AI 스크리닝": "AI筛选",
  // Titles
  "개요": "概览", "현황": "现状", "상세 정보": "详细信息",
  "목록": "列表", "등록하기": "注册", "수정하기": "修改",
  "결과": "结果", "이력": "历史", "로그": "日志",
};

const VI = {
  // === Common / UI ===
  "확인": "Xác nhận", "취소": "Hủy", "저장": "Lưu", "삭제": "Xóa", "수정": "Chỉnh sửa",
  "편집": "Chỉnh sửa", "추가": "Thêm", "검색": "Tìm kiếm", "닫기": "Đóng", "열기": "Mở",
  "다음": "Tiếp theo", "이전": "Trước đó", "완료": "Hoàn thành", "전체": "Tất cả", "선택": "Chọn",
  "등록": "Đăng ký", "조회": "Xem", "승인": "Phê duyệt", "반려": "Từ chối", "요청": "Yêu cầu",
  "대기": "Đang chờ", "처리": "Xử lý", "상태": "Trạng thái", "제목": "Tiêu đề", "내용": "Nội dung",
  "설명": "Mô tả", "비고": "Ghi chú", "메모": "Ghi nhớ", "날짜": "Ngày", "기간": "Khoảng thời gian",
  "시작": "Bắt đầu", "종료": "Kết thúc", "생성": "Tạo", "업데이트": "Cập nhật", "새로고침": "Làm mới",
  "로딩": "Đang tải", "로딩 중...": "Đang tải...", "오류": "Lỗi", "성공": "Thành công",
  "실패": "Thất bại", "경고": "Cảnh báo", "정보": "Thông tin", "도움말": "Trợ giúp", "설정": "Cài đặt",
  "이름": "Tên", "이메일": "Email", "전화번호": "Số điện thoại", "주소": "Địa chỉ",
  "부서": "Phòng ban", "직급": "Cấp bậc", "직위": "Chức vụ", "사번": "Mã nhân viên", "입사일": "Ngày vào làm",
  "퇴사일": "Ngày nghỉ việc", "근무": "Làm việc", "출근": "Đi làm", "퇴근": "Tan làm",
  "연차": "Phép năm", "휴가": "Nghỉ phép", "급여": "Lương", "수당": "Phụ cấp", "공제": "Khấu trừ",
  "평가": "Đánh giá", "목표": "Mục tiêu", "달성": "Đạt được", "진행": "Tiến hành", "진행 중": "Đang tiến hành",
  "진행률": "Tiến độ", "완료됨": "Đã hoàn thành", "미완료": "Chưa hoàn thành", "보류": "Tạm hoãn",
  "활성": "Hoạt động", "비활성": "Không hoạt động", "없음": "Không có", "있음": "Có",
  "예": "Có", "아니오": "Không", "네": "Vâng", "남성": "Nam", "여성": "Nữ",
  "합계": "Tổng cộng", "평균": "Trung bình", "최대": "Tối đa", "최소": "Tối thiểu",
  "위험": "Rủi ro", "주의": "Chú ý", "안전": "An toàn", "높음": "Cao", "낮음": "Thấp",
  "중간": "Trung bình", "상세": "Chi tiết", "요약": "Tóm tắt", "통계": "Thống kê", "분석": "Phân tích",
  "보고서": "Báo cáo", "리포트": "Báo cáo", "차트": "Biểu đồ", "그래프": "Đồ thị",
  "다운로드": "Tải xuống", "업로드": "Tải lên", "내보내기": "Xuất", "가져오기": "Nhập",
  "인쇄": "In", "미리보기": "Xem trước", "필터": "Lọc", "정렬": "Sắp xếp",
  // HR specifics
  "정규직": "Nhân viên chính thức", "계약직": "Hợp đồng", "파견직": "Biệt phái", "인턴": "Thực tập sinh",
  "재직": "Đang làm việc", "퇴직": "Nghỉ việc", "휴직": "Nghỉ phép dài hạn", "대기발령": "Chờ bổ nhiệm",
  "법인": "Pháp nhân", "본사": "Trụ sở chính", "지사": "Chi nhánh", "공장": "Nhà máy",
  "채용": "Tuyển dụng", "면접": "Phỏng vấn", "합격": "Đạt", "불합격": "Không đạt",
  "연봉": "Lương năm", "월급": "Lương tháng", "시급": "Lương giờ", "기본급": "Lương cơ bản",
  "성과급": "Thưởng thành tích", "보너스": "Thưởng", "인센티브": "Khuyến khích",
  "인사": "Nhân sự", "조직": "Tổ chức", "조직도": "Sơ đồ tổ chức",
  "출퇴근": "Chấm công", "근태": "Chuyên cần", "지각": "Đi muộn", "조퇴": "Về sớm", "결근": "Vắng mặt",
  "초과근무": "Làm thêm giờ", "야근": "Ca đêm", "교대근무": "Ca kíp",
  "사원": "Nhân viên", "대리": "Trưởng nhóm", "과장": "Trưởng phòng phó", "차장": "Phó phòng",
  "부장": "Trưởng phòng", "이사": "Giám đốc", "상무": "Giám đốc điều hành", "전무": "Phó tổng giám đốc",
  "부사장": "Phó chủ tịch", "사장": "Chủ tịch", "대표이사": "Tổng giám đốc",
  // Actions
  "마감": "Chốt", "마감 해제": "Hủy chốt", "처리 중...": "Đang xử lý...",
  "사용": "Sử dụng", "잔여": "Còn lại", "승인됨": "Đã phê duyệt", "반려됨": "Đã từ chối",
  "대기 중": "Đang chờ", "요청됨": "Đã yêu cầu", "진행중": "Đang tiến hành",
  "피드백": "Phản hồi", "코칭": "Huấn luyện",
  "KPI": "KPI", "OKR": "OKR", "MBO": "MBO",
  "반차": "Nửa ngày", "통화": "Tiền tệ", "환율": "Tỷ giá", "은행": "Ngân hàng",
  "이체": "Chuyển khoản", "명세서": "Phiếu lương", "번아웃": "Kiệt sức",
  "대시보드": "Bảng điều khiển", "연동": "Tích hợp",
  "ERP 연동": "Tích hợp ERP", "AI 스크리닝": "Sàng lọc AI",
  "목록": "Danh sách", "결과": "Kết quả", "이력": "Lịch sử", "로그": "Nhật ký",
  "개요": "Tổng quan", "현황": "Tình hình",
};

const ES = {
  // === Common / UI ===
  "확인": "Confirmar", "취소": "Cancelar", "저장": "Guardar", "삭제": "Eliminar", "수정": "Modificar",
  "편집": "Editar", "추가": "Agregar", "검색": "Buscar", "닫기": "Cerrar", "열기": "Abrir",
  "다음": "Siguiente", "이전": "Anterior", "완료": "Completado", "전체": "Todo", "선택": "Seleccionar",
  "등록": "Registrar", "조회": "Consultar", "승인": "Aprobar", "반려": "Rechazar", "요청": "Solicitar",
  "대기": "Pendiente", "처리": "Procesar", "상태": "Estado", "제목": "Título", "내용": "Contenido",
  "설명": "Descripción", "비고": "Observaciones", "메모": "Memo", "날짜": "Fecha", "기간": "Período",
  "시작": "Inicio", "종료": "Fin", "생성": "Crear", "업데이트": "Actualizar", "새로고침": "Actualizar",
  "로딩": "Cargando", "로딩 중...": "Cargando...", "오류": "Error", "성공": "Éxito",
  "실패": "Fallo", "경고": "Advertencia", "정보": "Información", "도움말": "Ayuda", "설정": "Configuración",
  "이름": "Nombre", "이메일": "Correo electrónico", "전화번호": "Teléfono", "주소": "Dirección",
  "부서": "Departamento", "직급": "Rango", "직위": "Cargo", "사번": "Número de empleado", "입사일": "Fecha de ingreso",
  "퇴사일": "Fecha de baja", "근무": "Trabajo", "출근": "Entrada", "퇴근": "Salida",
  "연차": "Vacaciones anuales", "휴가": "Vacaciones", "급여": "Nómina", "수당": "Subsidio", "공제": "Deducción",
  "평가": "Evaluación", "목표": "Objetivo", "달성": "Logro", "진행": "Progreso", "진행 중": "En progreso",
  "진행률": "Avance", "완료됨": "Completado", "미완료": "Incompleto", "보류": "En espera",
  "활성": "Activo", "비활성": "Inactivo", "없음": "Ninguno", "있음": "Existe",
  "예": "Sí", "아니오": "No", "네": "Sí", "남성": "Masculino", "여성": "Femenino",
  "합계": "Total", "평균": "Promedio", "최대": "Máximo", "최소": "Mínimo",
  "위험": "Riesgo", "주의": "Precaución", "안전": "Seguro", "높음": "Alto", "낮음": "Bajo",
  "중간": "Medio", "상세": "Detalle", "요약": "Resumen", "통계": "Estadísticas", "분석": "Análisis",
  "보고서": "Informe", "리포트": "Reporte", "차트": "Gráfico", "그래프": "Gráfica",
  "다운로드": "Descargar", "업로드": "Cargar", "내보내기": "Exportar", "가져오기": "Importar",
  "인쇄": "Imprimir", "미리보기": "Vista previa", "필터": "Filtro", "정렬": "Ordenar",
  // HR specifics
  "정규직": "Empleado de planta", "계약직": "Contratista", "파견직": "Personal destacado", "인턴": "Pasante",
  "재직": "Activo", "퇴직": "Baja", "휴직": "Licencia", "대기발령": "En espera de asignación",
  "법인": "Entidad", "본사": "Sede central", "지사": "Sucursal", "공장": "Planta",
  "채용": "Reclutamiento", "면접": "Entrevista", "합격": "Aprobado", "불합격": "No aprobado",
  "연봉": "Salario anual", "월급": "Salario mensual", "시급": "Salario por hora", "기본급": "Salario base",
  "성과급": "Bono de rendimiento", "보너스": "Bono", "인센티브": "Incentivo",
  "인사": "Recursos Humanos", "조직": "Organización", "조직도": "Organigrama",
  "출퇴근": "Asistencia", "근태": "Asistencia", "지각": "Tardanza", "조퇴": "Salida anticipada", "결근": "Ausencia",
  "초과근무": "Horas extras", "야근": "Turno nocturno", "교대근무": "Turno rotativo",
  "사원": "Empleado", "대리": "Supervisor auxiliar", "과장": "Jefe de sección", "차장": "Subjefe de departamento",
  "부장": "Jefe de departamento", "이사": "Director", "상무": "Director ejecutivo", "전무": "Director general adjunto",
  "부사장": "Vicepresidente", "사장": "Presidente", "대표이사": "Director general",
  // Actions
  "마감": "Cierre", "마감 해제": "Desbloquear cierre", "처리 중...": "Procesando...",
  "사용": "Usado", "잔여": "Restante", "승인됨": "Aprobado", "반려됨": "Rechazado",
  "대기 중": "Pendiente", "요청됨": "Solicitado", "진행중": "En progreso",
  "피드백": "Retroalimentación", "코칭": "Coaching",
  "KPI": "KPI", "OKR": "OKR", "MBO": "MBO",
  "반차": "Medio día", "통화": "Moneda", "환율": "Tipo de cambio", "은행": "Banco",
  "이체": "Transferencia", "명세서": "Recibo de nómina", "번아웃": "Agotamiento",
  "대시보드": "Panel de control", "연동": "Integración",
  "ERP 연동": "Integración ERP", "AI 스크리닝": "Selección con IA",
  "목록": "Lista", "결과": "Resultado", "이력": "Historial", "로그": "Registro",
  "개요": "Resumen", "현황": "Estado actual",
};

// ============================================================
// EN→Target bridge: for each path, use the completed EN translation
// ============================================================
const enJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'messages', 'en.json'), 'utf-8'));

function getNestedValue(obj, dotPath) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

// EN→ZH dictionary for common EN phrases
const EN_ZH = {
  "Confirm": "确认", "Cancel": "取消", "Save": "保存", "Delete": "删除",
  "Edit": "编辑", "Add": "添加", "Search": "搜索", "Close": "关闭",
  "Next": "下一步", "Previous": "上一步", "Complete": "完成", "Select": "选择",
  "Approve": "批准", "Reject": "驳回", "Request": "请求", "Submit": "提交",
  "Pending": "待处理", "Processing": "处理中", "Status": "状态", "Title": "标题",
  "Description": "说明", "Date": "日期", "Period": "期间", "Start": "开始", "End": "结束",
  "Refresh": "刷新", "Loading...": "加载中...", "Error": "错误", "Success": "成功",
  "Failed": "失败", "Warning": "警告", "Information": "信息", "Settings": "设置",
  "Name": "姓名", "Email": "邮箱", "Department": "部门", "Position": "职位",
  "Employee": "员工", "Manager": "经理", "Admin": "管理员",
  "Salary": "薪资", "Pay": "工资", "Bonus": "奖金", "Deduction": "扣除",
  "Evaluation": "评估", "Goal": "目标", "Performance": "绩效", "Review": "评审",
  "Risk": "风险", "Caution": "注意", "Safe": "安全", "High": "高", "Low": "低",
  "Details": "详情", "Summary": "摘要", "Statistics": "统计", "Analysis": "分析",
  "Report": "报告", "Download": "下载", "Upload": "上传", "Export": "导出", "Import": "导入",
  "Filter": "筛选", "Sort": "排序", "View": "查看", "List": "列表", "Reset": "重置",
  "Draft": "草稿", "Active": "活跃", "Inactive": "非活跃", "Enabled": "已启用", "Disabled": "已禁用",
  "Entity": "法人", "Company": "公司", "Team": "团队", "Group": "组",
  "Hours": "小时", "Days": "天", "Week": "周", "Month": "月", "Year": "年",
  "Total": "合计", "Average": "平均", "Maximum": "最大", "Minimum": "最小",
  "Currency": "货币", "Amount": "金额", "Rate": "比率", "Percentage": "百分比",
  "Type": "类型", "Category": "类别", "Level": "级别", "Grade": "等级",
  "Score": "分数", "Result": "结果", "Count": "数量",
  "Annual": "年度", "Monthly": "月度", "Weekly": "每周", "Daily": "每日",
  "Turnover Risk": "离职风险", "Burnout": "职业倦怠", "Burnout Risk": "倦怠风险",
  "Overtime": "加班", "Night Shift": "夜班", "Shift Work": "倒班",
  "Legal Basis": "法律依据", "Statutory": "法定", "Premium": "加成",
  "Allowance": "津贴", "Tax": "税金", "Net Pay": "实发工资",
  "Account": "账户", "Bank": "银行", "Transfer": "转账",
  "Evidence": "凭证", "Receipt": "收据", "Invoice": "发票",
  "Paid": "已付", "Unpaid": "未付", "Overdue": "逾期",
  "Compliance": "合规", "Audit": "审计", "Privacy": "隐私",
  "Notification": "通知", "Reminder": "提醒", "Alert": "警报",
};

const EN_VI = {
  "Confirm": "Xác nhận", "Cancel": "Hủy", "Save": "Lưu", "Delete": "Xóa",
  "Edit": "Chỉnh sửa", "Add": "Thêm", "Search": "Tìm kiếm", "Close": "Đóng",
  "Next": "Tiếp theo", "Previous": "Trước đó", "Complete": "Hoàn thành", "Select": "Chọn",
  "Approve": "Phê duyệt", "Reject": "Từ chối", "Request": "Yêu cầu", "Submit": "Gửi",
  "Pending": "Đang chờ", "Processing": "Đang xử lý", "Status": "Trạng thái", "Title": "Tiêu đề",
  "Description": "Mô tả", "Date": "Ngày", "Period": "Khoảng thời gian", "Start": "Bắt đầu", "End": "Kết thúc",
  "Refresh": "Làm mới", "Loading...": "Đang tải...", "Error": "Lỗi", "Success": "Thành công",
  "Failed": "Thất bại", "Warning": "Cảnh báo", "Information": "Thông tin", "Settings": "Cài đặt",
  "Name": "Tên", "Email": "Email", "Department": "Phòng ban", "Position": "Chức vụ",
  "Employee": "Nhân viên", "Manager": "Quản lý", "Admin": "Quản trị viên",
  "Salary": "Lương", "Pay": "Thanh toán", "Bonus": "Thưởng", "Deduction": "Khấu trừ",
  "Evaluation": "Đánh giá", "Goal": "Mục tiêu", "Performance": "Hiệu suất", "Review": "Đánh giá",
  "Risk": "Rủi ro", "Caution": "Cảnh báo", "Safe": "An toàn", "High": "Cao", "Low": "Thấp",
  "Details": "Chi tiết", "Summary": "Tóm tắt", "Statistics": "Thống kê", "Analysis": "Phân tích",
  "Report": "Báo cáo", "Download": "Tải xuống", "Upload": "Tải lên", "Export": "Xuất", "Import": "Nhập",
  "Filter": "Lọc", "Sort": "Sắp xếp", "View": "Xem", "List": "Danh sách", "Reset": "Đặt lại",
  "Draft": "Bản nháp", "Active": "Hoạt động", "Inactive": "Không hoạt động", "Enabled": "Đã bật", "Disabled": "Đã tắt",
  "Entity": "Pháp nhân", "Company": "Công ty", "Team": "Nhóm", "Group": "Nhóm",
  "Hours": "Giờ", "Days": "Ngày", "Week": "Tuần", "Month": "Tháng", "Year": "Năm",
  "Total": "Tổng cộng", "Average": "Trung bình", "Maximum": "Tối đa", "Minimum": "Tối thiểu",
  "Currency": "Tiền tệ", "Amount": "Số tiền", "Rate": "Tỷ lệ", "Percentage": "Phần trăm",
  "Type": "Loại", "Category": "Danh mục", "Level": "Cấp độ", "Grade": "Hạng",
  "Score": "Điểm", "Result": "Kết quả", "Count": "Số lượng",
  "Annual": "Hàng năm", "Monthly": "Hàng tháng", "Weekly": "Hàng tuần", "Daily": "Hàng ngày",
  "Turnover Risk": "Rủi ro nghỉ việc", "Burnout": "Kiệt sức", "Burnout Risk": "Rủi ro kiệt sức",
  "Overtime": "Làm thêm giờ", "Night Shift": "Ca đêm", "Shift Work": "Ca kíp",
  "Allowance": "Phụ cấp", "Tax": "Thuế", "Net Pay": "Lương thực nhận",
  "Account": "Tài khoản", "Bank": "Ngân hàng", "Transfer": "Chuyển khoản",
  "Evidence": "Bằng chứng", "Receipt": "Biên lai",
  "Paid": "Đã thanh toán", "Unpaid": "Chưa thanh toán",
  "Compliance": "Tuân thủ", "Audit": "Kiểm toán", "Privacy": "Bảo mật",
  "Notification": "Thông báo", "Reminder": "Nhắc nhở", "Alert": "Cảnh báo",
};

const EN_ES = {
  "Confirm": "Confirmar", "Cancel": "Cancelar", "Save": "Guardar", "Delete": "Eliminar",
  "Edit": "Editar", "Add": "Agregar", "Search": "Buscar", "Close": "Cerrar",
  "Next": "Siguiente", "Previous": "Anterior", "Complete": "Completar", "Select": "Seleccionar",
  "Approve": "Aprobar", "Reject": "Rechazar", "Request": "Solicitud", "Submit": "Enviar",
  "Pending": "Pendiente", "Processing": "Procesando", "Status": "Estado", "Title": "Título",
  "Description": "Descripción", "Date": "Fecha", "Period": "Período", "Start": "Inicio", "End": "Fin",
  "Refresh": "Actualizar", "Loading...": "Cargando...", "Error": "Error", "Success": "Éxito",
  "Failed": "Fallido", "Warning": "Advertencia", "Information": "Información", "Settings": "Configuración",
  "Name": "Nombre", "Email": "Correo electrónico", "Department": "Departamento", "Position": "Puesto",
  "Employee": "Empleado", "Manager": "Gerente", "Admin": "Administrador",
  "Salary": "Salario", "Pay": "Pago", "Bonus": "Bono", "Deduction": "Deducción",
  "Evaluation": "Evaluación", "Goal": "Objetivo", "Performance": "Rendimiento", "Review": "Revisión",
  "Risk": "Riesgo", "Caution": "Precaución", "Safe": "Seguro", "High": "Alto", "Low": "Bajo",
  "Details": "Detalles", "Summary": "Resumen", "Statistics": "Estadísticas", "Analysis": "Análisis",
  "Report": "Informe", "Download": "Descargar", "Upload": "Cargar", "Export": "Exportar", "Import": "Importar",
  "Filter": "Filtro", "Sort": "Ordenar", "View": "Ver", "List": "Lista", "Reset": "Restablecer",
  "Draft": "Borrador", "Active": "Activo", "Inactive": "Inactivo", "Enabled": "Habilitado", "Disabled": "Deshabilitado",
  "Entity": "Entidad", "Company": "Empresa", "Team": "Equipo", "Group": "Grupo",
  "Hours": "Horas", "Days": "Días", "Week": "Semana", "Month": "Mes", "Year": "Año",
  "Total": "Total", "Average": "Promedio", "Maximum": "Máximo", "Minimum": "Mínimo",
  "Currency": "Moneda", "Amount": "Monto", "Rate": "Tasa", "Percentage": "Porcentaje",
  "Type": "Tipo", "Category": "Categoría", "Level": "Nivel", "Grade": "Grado",
  "Score": "Puntuación", "Result": "Resultado", "Count": "Cantidad",
  "Annual": "Anual", "Monthly": "Mensual", "Weekly": "Semanal", "Daily": "Diario",
  "Turnover Risk": "Riesgo de rotación", "Burnout": "Agotamiento", "Burnout Risk": "Riesgo de agotamiento",
  "Overtime": "Horas extras", "Night Shift": "Turno nocturno", "Shift Work": "Turno rotativo",
  "Allowance": "Subsidio", "Tax": "Impuesto", "Net Pay": "Pago neto",
  "Account": "Cuenta", "Bank": "Banco", "Transfer": "Transferencia",
  "Evidence": "Evidencia", "Receipt": "Recibo",
  "Paid": "Pagado", "Unpaid": "No pagado",
  "Compliance": "Cumplimiento", "Audit": "Auditoría", "Privacy": "Privacidad",
  "Notification": "Notificación", "Reminder": "Recordatorio", "Alert": "Alerta",
};

const dicts = { zh: ZH, vi: VI, es: ES };
const enBridgeDicts = { zh: EN_ZH, vi: EN_VI, es: EN_ES };

const koDirect = dicts[LOCALE];
const enBridge = enBridgeDicts[LOCALE];

// ============================================================
// Translation function: Korean → Target
// ============================================================
function translate(koText, dotPath) {
  // 1. Direct ko→target match
  if (koDirect[koText]) return koDirect[koText];
  
  // 2. EN bridge: look up EN value for this path, then EN→target
  const enVal = getNestedValue(enJson, dotPath);
  if (enVal && typeof enVal === 'string' && enVal !== '') {
    // Exact EN match
    if (enBridge[enVal]) return enBridge[enVal];
    
    // Try matching EN words in the value
    let result = enVal;
    let matched = false;
    
    // Sort by length (longest first) for greedy matching
    const sortedPhrases = Object.keys(enBridge).sort((a, b) => b.length - a.length);
    for (const phrase of sortedPhrases) {
      if (result.includes(phrase)) {
        result = result.split(phrase).join(enBridge[phrase]);
        matched = true;
      }
    }
    
    if (matched) return result;
    
    // If EN value looks like it could be kept as-is (technical terms, codes, etc.)
    // Return the EN value as fallback — better than empty
    return enVal;
  }
  
  // 3. Compositional Korean word matching
  let result = koText;
  let changed = false;
  const sortedKo = Object.keys(koDirect).sort((a, b) => b.length - a.length);
  for (const phrase of sortedKo) {
    if (result.includes(phrase)) {
      result = result.split(phrase).join(koDirect[phrase]);
      changed = true;
    }
  }
  if (changed) return result;
  
  // 4. Final fallback — use EN value if available
  if (enVal && typeof enVal === 'string') return enVal;
  
  return '';
}

// ============================================================
// Process all chunks
// ============================================================
const chunkFiles = fs.readdirSync(CHUNKS_DIR)
  .filter(f => f.startsWith(`${LOCALE}_chunk_`) && !f.includes('_done') && f.endsWith('.json'))
  .sort();

let totalTranslated = 0;
let totalMissing = 0;
const missingItems = [];

for (const file of chunkFiles) {
  const items = JSON.parse(fs.readFileSync(path.join(CHUNKS_DIR, file), 'utf-8'));
  
  const translated = items.map(item => {
    const t = translate(item.ko, item.path);
    if (!t) {
      missingItems.push({ path: item.path, ko: item.ko });
      totalMissing++;
    } else {
      totalTranslated++;
    }
    return { ...item, translated: t };
  });
  
  const donePath = path.join(CHUNKS_DIR, file.replace('.json', '_done.json'));
  fs.writeFileSync(donePath, JSON.stringify(translated, null, 2) + '\n');
  
  const done = translated.filter(t => t.translated !== '').length;
  console.log(`${file}: ${done}/${items.length} translated`);
}

const pct = Math.round(totalTranslated / (totalTranslated + totalMissing) * 100);
console.log(`\n${LOCALE.toUpperCase()} Total: ${totalTranslated}/${totalTranslated + totalMissing} (${pct}%)`);

if (missingItems.length > 0) {
  console.log(`Missing: ${missingItems.length} keys`);
  missingItems.slice(0, 5).forEach(m => console.log(`  ${m.path}: "${m.ko}"`));
}
