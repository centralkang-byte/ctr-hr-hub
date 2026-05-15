// ═══════════════════════════════════════════════════════════
// IS_PE01 / IS_SY02 row 타입 정의 — 마이그레이션 입력 스키마
// 224 컬럼 (IS_PE01) 중 현재 schema 로 매핑되는 컬럼만 선언.
// 미매핑 컬럼은 향후 확장 시 추가.
// ═══════════════════════════════════════════════════════════

/**
 * IS_PE01 인사정보 row (Excel header 1 = Korean, header 2 = ERP code name).
 * 실데이터는 header 2 (ERP code name) 를 key 로 파싱.
 */
export interface LegacyEmployeeRow {
  // ─── 신원 ───
  EMP_ID: number // 레거시 employee id (deterministic uuid 생성용)
  EMPCD: string // 사번 (employeeNo)
  HNAME: string // 한글명
  JNAME: string | null // 한자명
  ENAME: string | null // 영문명
  JUMINNO: string | null // 주민번호 (암호화 input — 평문 또는 legacy 암호화)
  SEXGB: string | null // 성별 (01=남, 02=여 또는 'M'/'F')
  BIRTHDAT: Date | string | null // 생년월일
  BIRDGB: number | string | null // 1=양력, 2=음력

  // ─── 조직 매핑 코드 (legacy) ───
  COMPYCD: number | string | null // 회사코드
  DEPTCD: number | string | null // 부서코드
  JIKJGCD: number | string | null // 고용형태
  JIKCKCD: number | string | null // 직책
  JIKWICD: number | string | null // 호칭
  JIKGUBCD: number | string | null // 직급
  JIKMUCD: number | string | null // 직무
  SUPERVISOR_ID: number | null // 상위자 EMP_ID
  WORK_AREA: number | string | null // 사업장 (E109)

  // ─── 재직 일자 ───
  FSTIGENTDAT: Date | string | null // 그룹입사일
  IGENTDAT: Date | string | null // 입사일
  RETDAT: Date | string | null // 퇴사일
  LSTBALDAT: Date | string | null // 최종발령일
  ADVANCEDAT: Date | string | null // 승진일
  MIDJSDAT: Date | string | null // 중간정산일
  STD_RETCAL_DAT: Date | string | null // 퇴직산정기준일
  REGULARGB: string | null // 재직구분 (01=재직, 02=퇴사 등)
  IGENTGB: string | null // 입사구분

  // ─── 연락처 ───
  HANDPON: string | null // 휴대폰
  HOMETEL: string | null // 집전화
  OFFICE_PHONE: string | null // 사내전화
  FAX_NUM: string | null // 팩스
  EMAIL: string | null

  // ─── 결혼/특수 ───
  MARRGB: string | null // 결혼여부 (E310: Y/N)
  MARRDAT: Date | string | null // 결혼기념일
  CAR_LICENSE: string | null // 차량번호

  // ─── 주소 ───
  HUNPOST: string | null // 주민등록 우편번호
  HUNADDR1: string | null
  HUNADDR2: string | null
  SILPOST: string | null // 실거주지 우편번호
  SILADDR1: string | null
  SILADDR2: string | null
  FOREIGN_ADDR1: string | null
  FOREIGN_ADDR2: string | null
  TERRITORY_CODE: string | null // 국적 (M143)

  // ─── 4대보험 (한국) ───
  MEDYN: string | null // 건강보험 가입여부
  MEDIGRADE: number | null // 보수월액
  MEDINO: string | null // 증번호
  MEDIDIV: string | null // 조합기호
  MEDIFYMD: Date | string | null // 취득일
  MEDITYMD: Date | string | null // 상실일
  MEDETC: string | null // 미가입사유
  MEDIAMT: number | null // 보험료
  LONG_MEDIAMT: number | null // 장기요양

  NATYN: string | null
  NATGRADE: number | null
  NATFYMD: Date | string | null
  NATTYMD: Date | string | null
  NATETC: string | null
  NATAMT: number | null

  EMPLYN: string | null
  EMPLGRADE: number | null
  EMPLFYMD: Date | string | null
  EMPLTYMD: Date | string | null
  EMPLETC: string | null
  EMPLAMT: number | null
  EMPL_CMP_AMT: number | null // 회사 부담분

  // ─── 계좌 ───
  BANKCD1: string | null // 급여계좌 은행
  PAYACNTNO1: string | null
  PAYNAME1: string | null
  BANKCD2: string | null // 경비계좌
  PAYACNTNO2: string | null
  PAYNAME2: string | null
  BANKCD3: string | null // 연금계좌
  PAYACNTNO3: string | null
  PAYNAME3: string | null

  // ─── 보훈/장애/노조 ───
  BOHUNCD: string | null // 보훈유형 (E203)
  BOHUN_BENEFIT: string | null // 보훈혜택 (E235)
  BOHUNNO: string | null // 보훈번호
  BOHUN_REL: string | null // 보훈자관계 (E401)
  BOHUN_ORG: string | null // 소관보훈지청
  HANDICAP_TYPE: string | null // 장애유형 (E206)
  HANDICAP_CLASS: string | null // 장애등급 (E207)
  HANDICAP_DAT: Date | string | null // 장애인정일
  NOJOYN: string | null // 노조가입 (E318)
  NOJODAT: Date | string | null
  NOJOGRADE: string | null // 노조간부등급

  // ─── 병역 ───
  MIL_GROUP: string | null // 군별 (E302)
  MIL_NO_CAUSE: string | null // 미필사유 (E307)
  MIL_CLASS: string | null // 계급 (E303)
  MIL_GRADE: string | null
  MIL_NO: string | null // 군번
  MIL_DIS: string | null // 전역구분 (E305)
  MIL_FROM: Date | string | null // 입대일
  MIL_TO: Date | string | null // 제대일
  MIL_SECTION: string | null // 역종 (E306)

  // 임의 확장
  [key: string]: unknown
}

/** IS_SY02 분류 헤더 row */
export interface LegacyCodeGroupRow {
  CODETP: string // 분류코드 (예: "E108")
  DESCRIPTION: string // 분류명
  REFERENCE_1: string | null
  REFERENCE_2: string | null
  REFERENCE_3: string | null
  REFERENCE_4: string | null
  REFERENCE_5: string | null
  TYPE: string | null // C=customizable
  REMARK: string | null
}

/** IS_SY02 상세 row */
export interface LegacyCodeItemRow {
  CODETP: string
  CODEID: string // 상세 코드값 (예: "01")
  DESCRIPTION: string // 상세 코드명
  REMARK: string | null
  DISPLAY_NUM: number
  ENABLED: string // 'Y' | 'N'
  START_DATE_ACTIVE: Date | string | null
  END_DATE_ACTIVE: Date | string | null
  REFERENCE_1: string | null
  REFERENCE_2: string | null
  REFERENCE_3: string | null
  REFERENCE_4: string | null
  REFERENCE_5: string | null
}

/** 마이그레이션 실행 결과 */
export interface MigrationResult {
  total: number
  success: number
  errors: number
  skipped: number
  errorDetails: Array<{ row: number; legacyId?: string | number; reason: string }>
}

/** 모든 스크립트 공통 옵션 */
export interface MigrationOptions {
  /** 입력 xlsx 파일 절대경로 */
  inputPath: string
  /** true 면 DB 변경 없이 검증만 */
  dryRun: boolean
  /** Prisma 트랜잭션 timeout (ms) */
  txTimeoutMs?: number
}
