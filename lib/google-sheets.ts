import { google } from 'googleapis';
import { randomBytes } from 'crypto';

/**
 * 시트 셀에 적힌 이메일 문자열을 파싱합니다.
 * 쉼표(,) 또는 줄바꿈으로 구분된 여러 이메일을 배열로 반환.
 * 예: "a@x.com, b@y.com" 또는 "a@x.com,\nb@y.com" -> ["a@x.com", "b@y.com"]
 */
export function parseEmailCell(cell: string): string[] {
  if (!cell || typeof cell !== 'string') return [];
  // 전각 쉼표·캐리지리턴 정규화 후, 쉼표/세미콜론/줄바꿈 기준으로 분리
  const normalized = cell
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u3000\uFF0C，]/g, ','); // 전각 공백, 전각 쉼표
  const parts = normalized.split(/[,;\n]+/);
  return parts
    .map((e) => e.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase()) // 제로너비 문자 제거 후 trim
    .filter((e) => e.length > 0 && e.includes('@'));
}

/** 강사 목록 시트: 1ygeuJ... 스프레드시트의 강사정보 시트 (A=이메일, B=이름, C=암호코드) - 로그인/캘린더 매칭용 */
const INSTRUCTOR_LIST_SPREADSHEET_ID = () => process.env.GOOGLE_INSTRUCTOR_SPREADSHEET_ID || process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
const INSTRUCTOR_LIST_SHEET_NAME = () => process.env.GOOGLE_INSTRUCTOR_SHEET_NAME || '강사정보';

/** EM 강사 현황 시트: 1MKm00... / 기업교육_외부강사 (A=성함, B=소속, F=진행가능교육/상태, G=전화, H=이메일, I=강사료, M=비고) */
const EM_INSTRUCTOR_STATUS_SPREADSHEET_ID_FULL = '1MKm00PfsR4CWBF-xo9qThN8lElrZVg6wuC7blbZXL68';
const INSTRUCTOR_STATUS_SPREADSHEET_ID = () => {
  const id = (process.env.GOOGLE_INSTRUCTOR_STATUS_SPREADSHEET_ID || process.env.GOOGLE_LOGIN_SPREADSHEET_ID || '').trim();
  return id.length >= 44 ? id : EM_INSTRUCTOR_STATUS_SPREADSHEET_ID_FULL;
};
const INSTRUCTOR_STATUS_SHEET_NAME = () =>
  process.env.GOOGLE_INSTRUCTOR_STATUS_SHEET_NAME || '기업교육_외부강사';

/** F열 값이 아래면 강사 현황 목록에서 제외 */
const INSTRUCTOR_STATUS_EXCLUDED = new Set(['중단', '대기중', '양성단계']);

/** 테스트용 강사 (로컬/스테이징 확인용 — 배포 전 제거) */
const TEST_INSTRUCTORS: Array<{ name: string; email: string; emailCell: string }> = [
  {
    name: '박경현2',
    email: 'rudgus4620@gmail.com',
    emailCell: 'rudgus4620@gmail.com',
  },
];

/** 강사 개선점 시트: 1ygeuJ... 내 시트 (gid=1929592205) - A=교육일, B=기업명, C=작성일, D=개선될 점, E=멘토 */
const IMPROVEMENT_SHEET_SPREADSHEET_ID = () => process.env.GOOGLE_INSTRUCTOR_SPREADSHEET_ID || process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
const IMPROVEMENT_SHEET_GID = 1929592205;
const IMPROVEMENT_SHEET_NAME = () => process.env.GOOGLE_IMPROVEMENT_SHEET_NAME || '';

/** 섭외 짧은 링크 시트: 같은 스프레드시트 내 시트명 "섭외_짧은링크" - A=code, B=accept_url, C=decline_url, D=request_id (시트는 미리 생성 필요) */
const SHORT_LINK_SHEET_SPREADSHEET_ID = () => process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
const SHORT_LINK_SHEET_NAME = '섭외_짧은링크';

/**
 * EM현황 시트에서 이메일로 이름을 조회합니다.
 * 스프레드시트: 1MKm00... / EM현황 (A=이메일, B=이름)
 */
export async function getEMNameFromStatusSheet(
  email: string
): Promise<string | null> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId =
    process.env.GOOGLE_EM_STATUS_SPREADSHEET_ID ||
    process.env.GOOGLE_INSTRUCTOR_STATUS_SPREADSHEET_ID ||
    EM_INSTRUCTOR_STATUS_SPREADSHEET_ID_FULL;
  const sheetName = process.env.GOOGLE_EM_STATUS_SHEET_NAME || 'EM현황';
  const target = email.trim().toLowerCase();
  if (!target) return null;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:B`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const emEmail = String(row[0] || '').trim().toLowerCase();
      const emName = String(row[1] || '').trim();
      if (emEmail === target && emName) return emName;
    }
    return null;
  } catch (error) {
    console.error('Error fetching EM name from EM현황:', error);
    return null;
  }
}

/**
 * EM 정보를 Google Spreadsheet에서 조회합니다 (이름과 비밀번호로).
 * @param name EM 이름
 * @param password 비밀번호
 * @returns EM 정보 또는 null
 */
export async function findEMByNameAndPassword(
  name: string,
  password: string
): Promise<{ email: string; name: string } | null> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
  const sheetName = 'EM로그인';

  try {
    // 시트의 모든 데이터를 가져옵니다
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:C`, // A열(이메일), B열(이름), C열(비번)
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }

    // 헤더 행을 제외하고 데이터 행만 처리
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // 컬럼 인덱스: A열(0) - 이메일, B열(1) - 이름, C열(2) - 비번
      const emEmail = row[0]?.trim() || '';
      const emName = row[1]?.trim() || '';
      const emPassword = row[2]?.trim() || '';

      // 이름과 비밀번호가 모두 일치하는 경우
      if (emName === name && emPassword === password) {
        return {
          email: emEmail,
          name: emName,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching EM data:', error);
    throw error;
  }
}

/**
 * EM 정보를 Google Spreadsheet에서 조회합니다 (아이디와 비밀번호로).
 *
 * 시트 구조(EM로그인):
 * - A열: 이메일
 * - B열: 이름
 * - C열: 아이디
 * - D열: 비번
 */
export async function findEMByIdAndPassword(
  emId: string,
  password: string
): Promise<{ email: string; name: string } | null> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId =
    process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID ||
    '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
  const sheetName = 'EM로그인';

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:D`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const emEmail = (row[0] || '').toString().trim();
      const emName = (row[1] || '').toString().trim();
      const storedId = (row[2] || '').toString().trim();
      const storedPassword = (row[3] || '').toString().trim();

      if (storedId === emId && storedPassword === password) {
        return {
          email: emEmail || emId, // 공용 계정 등 이메일이 비어있을 수 있어 fallback
          name: emName || emId,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching EM data (id/password):', error);
    throw error;
  }
}

/**
 * EM 로그인 시트에서 이메일로 해당 EM의 아이디/비번을 갱신합니다.
 * 시트 구조(EM로그인): A=이메일, B=이름, C=아이디, D=비번
 * @param email EM 이메일 (행 식별용)
 * @param currentPassword 현재 비밀번호 (검증용)
 * @param newId 새 아이디
 * @param newPassword 새 비밀번호
 * @returns 성공 여부
 */
export async function updateEMCredentialsByEmail(
  email: string,
  currentPassword: string,
  newId: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId =
    process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID ||
    '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
  const sheetName = 'EM로그인';

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:D`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return { ok: false, error: 'EM 데이터를 찾을 수 없습니다.' };
    }

    const emailTrim = (email || '').toString().trim();
    const currentTrim = (currentPassword || '').toString().trim();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const emEmail = (row[0] || '').toString().trim();
      const storedPassword = (row[3] || '').toString().trim();

      if (emEmail !== emailTrim) continue;
      if (storedPassword !== currentTrim) {
        return { ok: false, error: '현재 비밀번호가 일치하지 않습니다.' };
      }

      const rowIndex = i + 1; // 1-based
      const range = `${sheetName}!C${rowIndex}:D${rowIndex}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[(newId || '').toString().trim(), (newPassword || '').toString().trim()]],
        },
      });
      return { ok: true };
    }

    return { ok: false, error: '해당 이메일의 EM 정보를 찾을 수 없습니다.' };
  } catch (error) {
    console.error('Error updating EM credentials:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '아이디/비밀번호 변경 중 오류가 발생했습니다.',
    };
  }
}

/**
 * Google Sheets API 클라이언트를 생성합니다.
 */
export function getGoogleSheetsClient() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!serviceAccountEmail || !serviceAccountPrivateKey) {
    throw new Error('Google Service Account credentials are not configured');
  }

  // Private Key의 개행 문자를 처리
  const privateKey = serviceAccountPrivateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/spreadsheets', // 쓰기 권한 추가 (섭외 로그 기록용)
    ],
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * 강사 정보를 Google Spreadsheet에서 조회합니다 (이름과 이메일로).
 * @param name 강사 이름
 * @param email 강사 이메일
 * @returns 강사 정보 또는 null
 */
export async function findInstructor(name: string, email: string) {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = INSTRUCTOR_STATUS_SPREADSHEET_ID();
  const sheetName = INSTRUCTOR_STATUS_SHEET_NAME();

  try {
    // 시트의 모든 데이터를 가져옵니다
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }

    // 헤더 행을 제외하고 데이터 행만 처리
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // A=성함, H=이메일
      const instructorName = row[0]?.trim();
      const instructorEmail = row[7]?.trim();

      // 이름과 이메일이 모두 일치하는 경우
      if (
        instructorName === name &&
        instructorEmail === email
      ) {
        return {
          name: instructorName,
          mobile: row[6]?.trim() || '', // G열 - 이동통신
          email: instructorEmail,
          fee: row[8]?.trim() || '', // I열 - 강사료
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching instructor data:', error);
    throw error;
  }
}

/**
 * 강사 정보를 이메일과 핀코드로 조회합니다.
 * @param email 강사 이메일 (H열)
 * @param pinCode 핀코드 (V열, 인덱스 21)
 * @returns 강사 정보 또는 null
 */
export async function findInstructorByEmailAndPin(email: string, pinCode: string): Promise<{
  name: string;
  email: string;
  mobile: string;
  fee: string;
  rowIndex: number;
} | null> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = INSTRUCTOR_LIST_SPREADSHEET_ID();
  const sheetName = INSTRUCTOR_LIST_SHEET_NAME();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }

    // 헤더 행을 제외하고 데이터 행만 처리 (A=이메일,B=이름,C=암호코드 또는 H=이메일,V=핀코드 레이아웃 지원)
    const loginEmailLower = email.trim().toLowerCase();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const a0 = String(row[0] || '').trim();
      const hasSimpleLayout = a0.includes('@');
      const emailCell = hasSimpleLayout ? a0 : (row[7] || '').trim();
      const instructorEmails = parseEmailCell(emailCell);
      const storedPinCode = hasSimpleLayout ? (row[2] || '').trim() : (row[21] || '').trim();

      const emailMatches = instructorEmails.some((e) => e === loginEmailLower);
      if (emailMatches && storedPinCode === pinCode) {
        return {
          name: (hasSimpleLayout ? (row[1] || '').trim() : (row[2] || '').trim()),
          email: emailCell,
          mobile: hasSimpleLayout ? '' : (row[6] || '').trim(),
          fee: hasSimpleLayout ? '' : (row[8] || '').trim(),
          rowIndex: i + 1,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching instructor by email and pin:', error);
    throw error;
  }
}

/**
 * 이메일로 강사 정보를 조회합니다 (핀코드 수정용).
 * @param email 강사 이메일 (H열)
 * @returns 강사 정보 또는 null
 */
export async function findInstructorByEmail(email: string): Promise<{
  name: string;
  email: string;
  rowIndex: number;
} | null> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = INSTRUCTOR_LIST_SPREADSHEET_ID();
  const sheetName = INSTRUCTOR_LIST_SHEET_NAME();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }

    // 헤더 행을 제외하고 데이터 행만 처리
    const searchEmailLower = email.trim().toLowerCase();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const a0 = String(row[0] || '').trim();
      const hasSimpleLayout = a0.includes('@');
      const emailCell = hasSimpleLayout ? a0 : (row[7] || '').trim();
      const instructorEmails = parseEmailCell(emailCell);

      if (instructorEmails.some((e) => e === searchEmailLower)) {
        return {
          name: (hasSimpleLayout ? (row[1] || '').trim() : (row[2] || '').trim()),
          email: emailCell,
          rowIndex: i + 1,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching instructor by email:', error);
    throw error;
  }
}

/**
 * 강사 핀코드를 업데이트합니다.
 * @param rowIndex 시트의 행 번호 (1-based)
 * @param pinCode 새로운 핀코드
 */
export async function updateInstructorPinCode(rowIndex: number, pinCode: string): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = INSTRUCTOR_LIST_SPREADSHEET_ID();
  const sheetName = INSTRUCTOR_LIST_SHEET_NAME();

  try {
    // 강사정보 시트: C열 = 암호코드
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!C${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[pinCode]],
      },
    });
  } catch (error) {
    console.error('Error updating instructor pin code:', error);
    throw error;
  }
}

/**
 * 이메일로 강사 이름을 조회합니다.
 * @param email 강사 이메일 (H열)
 * @returns 강사 이름 (A열) 또는 null
 */
export async function getInstructorNameByEmail(email: string): Promise<string | null> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = INSTRUCTOR_STATUS_SPREADSHEET_ID();
  const sheetName = INSTRUCTOR_STATUS_SHEET_NAME();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }

    // 헤더 행을 제외하고 데이터 행만 처리
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const instructorEmail = (row[7] || '').trim().toLowerCase(); // H열 - 이메일
      const instructorName = (row[0] || '').trim(); // A열 - 성함

      // 이메일이 일치하는 경우 강사 이름 반환
      if (instructorEmail === email.toLowerCase() && instructorName) {
        return instructorName;
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching instructor name by email:', error);
    return null;
  }
}

/**
 * 여러 이메일로 강사 이름을 일괄 조회합니다.
 * @param emails 강사 이메일 배열
 * @returns 이메일을 키로 하는 강사 이름 맵
 */
export async function getInstructorNamesByEmails(emails: string[]): Promise<{ [email: string]: string }> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = INSTRUCTOR_LIST_SPREADSHEET_ID();
  const sheetName = INSTRUCTOR_LIST_SHEET_NAME();

  const emailToNameMap: { [email: string]: string } = {};

  try {
    console.log(`[강사 이름 조회] 조회할 이메일 개수: ${emails.length}`);
    console.log(`[강사 이름 조회] 시트 ID: ${spreadsheetId}, 시트명: ${sheetName}`);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('[강사 이름 조회] 시트 데이터가 없습니다.');
      return emailToNameMap;
    }

    console.log(`[강사 이름 조회] 시트 행 개수: ${rows.length}`);

    // 이메일을 소문자로 변환하여 비교용 맵 생성 (공백 제거)
    const emailLookup = new Set(emails.map(e => (e || '').trim().toLowerCase()).filter(e => e));

    console.log(`[강사 이름 조회] 조회 대상 이메일:`, Array.from(emailLookup));

    // 헤더 행을 제외하고 데이터 행만 처리 (A=이메일,B=이름 또는 C=이름,H=이메일 레이아웃 지원)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const a0 = String(row[0] || '').trim();
      const hasSimpleLayout = a0.includes('@');
      const emailCell = hasSimpleLayout ? a0 : (row[7] || '').trim();
      const instructorName = (hasSimpleLayout ? (row[1] || '').trim() : (row[2] || '').trim());

      if (!emailCell || !instructorName) continue;

      const rowEmails = parseEmailCell(emailCell);
      for (const normalizedEmail of rowEmails) {
        if (emailLookup.has(normalizedEmail)) {
          emailToNameMap[normalizedEmail] = instructorName;
          console.log(`[강사 이름 조회] 매칭 성공: ${normalizedEmail} -> ${instructorName}`);
        }
      }
    }

    console.log(`[강사 이름 조회] 최종 매칭 결과:`, emailToNameMap);
    return emailToNameMap;
  } catch (error) {
    console.error('[강사 이름 조회] 에러:', error);
    return emailToNameMap;
  }
}

/**
 * 모든 강사 목록을 조회합니다 (기업교육_외부강사 A열).
 * @returns 강사 이름 목록
 */
export async function getAllInstructorNames(): Promise<string[]> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = INSTRUCTOR_STATUS_SPREADSHEET_ID();
  const sheetName = INSTRUCTOR_STATUS_SHEET_NAME();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const instructorNames = new Set<string>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const statusOrTrack = (row[5] || '').trim();
      if (INSTRUCTOR_STATUS_EXCLUDED.has(statusOrTrack)) continue;
      const instructorName = normalizeName(row[0] || ''); // A열 - 성함

      if (instructorName) {
        instructorNames.add(instructorName);
      }
    }

    return Array.from(instructorNames).sort();
  } catch (error) {
    console.error('Error fetching instructor names:', error);
    throw error;
  }
}

/**
 * 정산 데이터 타입
 */
export interface SettlementData {
  mentorName: string; // B열 - 멘토명
  className: string; // E열 - 클래스명
  time: string; // I열 - 시간
  amount: string; // N열 - 정산 금액
  settlementDate: string; // O열 - 정산일자
}

/**
 * 그룹화된 정산 데이터 타입
 */
export interface GroupedSettlementData {
  date: string; // O열 - 정산일자
  classes: SettlementData[]; // 클래스 단위 데이터
  totalAmount: number; // N열 금액 합계
}

/**
 * 이름을 정규화합니다 (공백 제거, 대소문자 통일)
 */
function normalizeName(name: string): string {
  return name?.trim().replace(/\s+/g, ' ') || '';
}

/**
 * 날짜를 정규화합니다 (YY-MM-DD 형식을 YYYY-MM-DD로 변환)
 * @param dateString 날짜 문자열 (예: "25-10-28", "2025-10-28", "26-8-28")
 * @returns 정규화된 날짜 문자열 (YYYY-MM-DD)
 */
function normalizeDate(dateString: string): string {
  if (!dateString) return '';
  
  const trimmed = dateString.trim();
  
  // YY-MM-DD 형식인 경우 (예: "25-10-28", "26-8-28")
  const yyFormat = /^(\d{2})-(\d{1,2})-(\d{1,2})$/;
  const match = trimmed.match(yyFormat);
  
  if (match) {
    const [, year, month, day] = match;
    // 2자리 연도를 4자리로 변환 (00-50은 2000년대, 51-99는 1900년대로 가정)
    const fullYear = parseInt(year) <= 50 ? `20${year.padStart(2, '0')}` : `19${year.padStart(2, '0')}`;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // 이미 YYYY-MM-DD 형식인 경우 그대로 반환
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  return trimmed;
}

function getSettlementSpreadsheetConfig() {
  return {
    spreadsheetId:
      process.env.GOOGLE_SETTLEMENT_SPREADSHEET_ID ||
      '1aF4ZsnVXUH-gJ-4jZPSD0GFIVGYGCzNpo4-wiHLic4k',
    sheetName: process.env.GOOGLE_SETTLEMENT_SHEET_NAME || '정산시트',
  };
}

/** 정산시트 행을 SettlementData로 파싱 (헤더 제외) */
function parseSettlementRows(rows: string[][]): SettlementData[] {
  const settlements: SettlementData[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // B=멘토명, E=클래스명, I=시간, N=정산금액, O=정산일자
    const mentorName = normalizeName(row[1] || '');
    const className = String(row[4] ?? '').trim();
    const time = String(row[8] ?? '').trim();
    const amount = String(row[13] ?? '').trim();
    const settlementDate = String(row[14] ?? '').trim();

    if (!mentorName || !settlementDate) continue;

    settlements.push({
      mentorName,
      className,
      time,
      amount,
      settlementDate: normalizeDate(settlementDate),
    });
  }

  return settlements;
}

/** 정산 데이터를 정산일자 기준으로 그룹핑·합계 */
function groupSettlementsByDate(settlements: SettlementData[]): GroupedSettlementData[] {
  const grouped: { [key: string]: SettlementData[] } = {};
  settlements.forEach((item) => {
    const date = item.settlementDate;
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(item);
  });

  return Object.keys(grouped)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .map((date) => {
      const classes = grouped[date];
      const totalAmount = classes.reduce((sum, item) => {
        const amount = parseFloat(String(item.amount).replace(/,/g, '')) || 0;
        return sum + amount;
      }, 0);
      return { date, classes, totalAmount };
    });
}

/** 정산시트 전체 행을 한 번 조회 */
async function fetchSettlementSheetRows(): Promise<string[][]> {
  const sheets = getGoogleSheetsClient();
  const { spreadsheetId, sheetName } = getSettlementSpreadsheetConfig();

  console.log('Fetching settlement sheet:', spreadsheetId, sheetName);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!A:Z`,
  });

  return (response.data.values as string[][]) || [];
}

/**
 * 모든 강사의 정산 데이터를 조회합니다 (EM용).
 * 정산시트만 읽어 멘토명별로 그룹핑합니다 (강사 현황 시트에 의존하지 않음).
 */
export async function getAllInstructorSettlements(): Promise<{
  [instructorName: string]: GroupedSettlementData[];
}> {
  try {
    const rows = await fetchSettlementSheetRows();
    if (rows.length === 0) {
      console.log('No rows found in settlement spreadsheet');
      return {};
    }

    const all = parseSettlementRows(rows);
    const byMentor: { [name: string]: SettlementData[] } = {};
    all.forEach((item) => {
      if (!byMentor[item.mentorName]) byMentor[item.mentorName] = [];
      byMentor[item.mentorName].push(item);
    });

    const result: { [instructorName: string]: GroupedSettlementData[] } = {};
    Object.keys(byMentor)
      .sort()
      .forEach((name) => {
        result[name] = groupSettlementsByDate(byMentor[name]);
      });

    console.log(
      `Loaded settlements for ${Object.keys(result).length} mentors from ${all.length} rows`
    );
    return result;
  } catch (error) {
    console.error('Error fetching all settlement data:', error);
    throw error;
  }
}

/**
 * 특정 강사의 정산 데이터를 조회하고 O열 기준으로 그룹핑합니다.
 * @param instructorName 강사 이름 (로그인 시 사용한 성함)
 * @returns 그룹화된 정산 데이터 목록
 */
export async function getInstructorSettlements(
  instructorName: string
): Promise<GroupedSettlementData[]> {
  try {
    const normalizedInstructorName = normalizeName(instructorName);
    console.log('Looking for settlements for instructor:', normalizedInstructorName);

    const rows = await fetchSettlementSheetRows();
    if (rows.length === 0) {
      console.log('No rows found in settlement spreadsheet');
      return [];
    }

    const settlements = parseSettlementRows(rows).filter(
      (item) => item.mentorName === normalizedInstructorName
    );

    console.log(
      `Found ${settlements.length} settlements for ${normalizedInstructorName} (total rows: ${rows.length})`
    );

    return groupSettlementsByDate(settlements);
  } catch (error) {
    console.error('Error fetching settlement data:', error);
    throw error;
  }
}

/**
 * 강사 이름과 이메일을 함께 조회합니다.
 * A열에 "yuho89@gmail.com, frendjoo@hanmail.net"처럼 쉼표로 2개 있으면 해당 강사 메일 2개로 인식해 일정/선호·불가 조회에 모두 사용됩니다.
 * @param externalOnly 외부 강사만 조회할지 여부 (D열이 "내부"가 아닌 강사만)
 * @returns 강사 정보 목록 (이름, 이메일)
 */
/**
 * 강사정보 시트에서 로그인 이메일로 해당 강사의 이메일 셀 값(A열)을 조회합니다.
 * A열이 "yuho89@gmail.com, frendjoo@hanmail.net"처럼 한 강사에 복수 이메일이면 그대로 반환해,
 * 일정 조회 시 두 이메일 모두 사용할 수 있게 합니다.
 * 로그인 이메일이 단일 주소이거나 "a@x.com, b@y.com" 전체 문자열이어도 매칭됩니다.
 */
export async function getInstructorEmailCellByLoginEmail(loginEmail: string): Promise<string | null> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = INSTRUCTOR_LIST_SPREADSHEET_ID();
  const sheetName = INSTRUCTOR_LIST_SHEET_NAME();
  const raw = loginEmail.trim().toLowerCase().replace(/^mailto:/, '');
  const loginEmails = parseEmailCell(raw);
  const loginSet = new Set(loginEmails.length > 0 ? loginEmails : [raw]);
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:C`,
    });
    const rows = response.data.values;
    if (!rows || rows.length < 2) return null;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const emailCell = String(row[0] ?? '').trim();
      if (!emailCell) continue;
      const cellEmails = parseEmailCell(emailCell);
      const hasMatch = cellEmails.some((e) => loginSet.has(e));
      if (hasMatch) return emailCell;
    }
    return null;
  } catch (error) {
    console.error('getInstructorEmailCellByLoginEmail error:', error);
    return null;
  }
}

/**
 * 강사 이름과 이메일을 함께 조회합니다.
 * 기업교육_외부강사 시트 기준 (A=성함, F=상태/진행가능교육, H=이메일).
 * F열이 중단/대기중/양성단계인 인원은 제외합니다.
 * @param _externalOnly 하위 호환용 (무시). 상태 제외는 항상 적용.
 */
export async function getAllInstructorsWithEmail(
  _externalOnly: boolean = false
): Promise<Array<{ name: string; email: string }>> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = INSTRUCTOR_STATUS_SPREADSHEET_ID();
  const sheetName = INSTRUCTOR_STATUS_SHEET_NAME();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const instructors: Array<{ name: string; email: string }> = [];
    const seen = new Set<string>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const instructorName = normalizeName((row[0] || '').trim()); // A열: 성함
      const statusOrTrack = (row[5] || '').trim(); // F열
      const emailCell = String(row[7] || '').trim(); // H열: 이메일
      const emails = parseEmailCell(emailCell);
      const instructorEmail = emails[0] || emailCell.replace(/[\r\n\s]+/g, '');

      if (INSTRUCTOR_STATUS_EXCLUDED.has(statusOrTrack)) continue;
      if (!instructorName || !instructorEmail.includes('@') || seen.has(instructorName)) continue;

      seen.add(instructorName);
      instructors.push({ name: instructorName, email: instructorEmail });
    }

    return instructors.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching instructors with email:', error);
    throw error;
  }
}

const COACH_INFO_SPREADSHEET_ID = () =>
  process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
const COACH_INFO_SHEET_NAME = '실습코치_정보';

/**
 * 실습코치 목록 조회 (실습코치_정보 시트: A=이메일, B=이름)
 */
export async function getAllCoachesWithEmail(): Promise<Array<{ name: string; email: string }>> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = COACH_INFO_SPREADSHEET_ID();
  const sheetName = COACH_INFO_SHEET_NAME;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:B`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const coaches: Array<{ name: string; email: string }> = [];
    const seen = new Set<string>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const emailCell = String(row[0] || '').trim();
      const coachName = normalizeName(String(row[1] || '').trim());
      const emails = parseEmailCell(emailCell);
      const coachEmail = emails[0] || emailCell;

      if (!coachName || !coachEmail || !coachEmail.includes('@')) continue;
      const key = coachEmail.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      coaches.push({ name: coachName, email: coachEmail });
    }

    return coaches.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching coaches with email:', error);
    throw error;
  }
}

/**
 * 이메일 배열로 실습코치 이름 조회 (실습코치_정보 시트)
 */
export async function getCoachNamesByEmails(emails: string[]): Promise<{ [email: string]: string }> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = COACH_INFO_SPREADSHEET_ID();
  const sheetName = COACH_INFO_SHEET_NAME;
  const emailToNameMap: { [email: string]: string } = {};

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:B`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return emailToNameMap;

    const emailLookup = new Set(emails.map((e) => (e || '').trim().toLowerCase()).filter(Boolean));

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const emailCell = String(row[0] || '').trim();
      const coachName = String(row[1] || '').trim();
      if (!emailCell || !coachName) continue;

      const rowEmails = parseEmailCell(emailCell);
      for (const normalizedEmail of rowEmails) {
        if (emailLookup.has(normalizedEmail)) {
          emailToNameMap[normalizedEmail] = coachName;
        }
      }
    }

    return emailToNameMap;
  } catch (error) {
    console.error('Error fetching coach names by emails:', error);
    return emailToNameMap;
  }
}

/**
 * 매니저(EM) 목록을 조회합니다.
 * 1ygeuJ... / EM로그인: A=이메일, B=이름
 */
export async function getAllManagers(): Promise<Array<{ name: string; email: string }>> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId =
    process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID ||
    INSTRUCTOR_LIST_SPREADSHEET_ID();
  const sheetName = 'EM로그인';

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:B`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const managers: Array<{ name: string; email: string }> = [];
    const seen = new Set<string>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const emails = parseEmailCell(String(row[0] || ''));
      const managerEmail = emails[0] || String(row[0] || '').trim();
      const managerName = normalizeName(String(row[1] || ''));

      if (managerName && managerEmail.includes('@') && !seen.has(managerName)) {
        seen.add(managerName);
        managers.push({
          name: managerName,
          email: managerEmail,
        });
      }
    }

    return managers.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching managers from EM로그인:', error);
    throw error;
  }
}

/**
 * 강사정보 시트에서 이름→이메일 셀 조회 (A=이메일, B=이름).
 * 복수 이메일은 원본 셀 문자열로 반환합니다.
 */
export async function getInstructorEmailCellByName(name: string): Promise<string | null> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = INSTRUCTOR_LIST_SPREADSHEET_ID();
  const sheetName = INSTRUCTOR_LIST_SHEET_NAME();
  const target = normalizeName(name);
  if (!target) return null;

  const testHit = TEST_INSTRUCTORS.find((t) => normalizeName(t.name) === target);
  if (testHit) return testHit.emailCell;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:B`,
    });
    const rows = response.data.values;
    if (!rows || rows.length < 2) return null;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const emailCell = String(row[0] || '').trim();
      const instructorName = normalizeName(String(row[1] || ''));
      if (instructorName === target && parseEmailCell(emailCell).length > 0) {
        return emailCell;
      }
    }
    return null;
  } catch (error) {
    console.error('getInstructorEmailCellByName error:', error);
    return null;
  }
}

/**
 * 강사정보 시트 전체 목록 (A=이메일, B=이름). 메일 섭외용.
 */
export async function getInstructorsFromInfoSheet(): Promise<
  Array<{ name: string; email: string; emailCell: string }>
> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = INSTRUCTOR_LIST_SPREADSHEET_ID();
  const sheetName = INSTRUCTOR_LIST_SHEET_NAME();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:B`,
    });
    const rows = response.data.values;
    if (!rows || rows.length < 2) return [];

    const list: Array<{ name: string; email: string; emailCell: string }> = [];
    const seen = new Set<string>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const emailCell = String(row[0] || '').trim();
      const instructorName = normalizeName(String(row[1] || ''));
      const emails = parseEmailCell(emailCell);
      if (!instructorName || emails.length === 0 || seen.has(instructorName)) continue;
      seen.add(instructorName);
      list.push({
        name: instructorName,
        email: emails[0],
        emailCell,
      });
    }

    return list
      .concat(
        TEST_INSTRUCTORS.filter((t) => !seen.has(normalizeName(t.name))).map((t) => ({
          name: t.name,
          email: t.email,
          emailCell: t.emailCell,
        }))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('getInstructorsFromInfoSheet error:', error);
    throw error;
  }
}

/**
 * 섭외 로그를 기록합니다.
 * @param instructorName 강사 이름
 * @param instructorEmail 강사 이메일
 * @param projectName 프로젝트/클래스명 (선택사항)
 */
export async function logRecruitment(
  instructorName: string,
  instructorEmail: string,
  projectName?: string
): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '1MKm00PfsR4CWBF-xo9qThN8lElrZVg6wuC7blbZXL68';
  const sheetName = '외부강사_섭외_월별통계';

  try {
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // 시트에 데이터 추가
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          date, // A열: 날짜
          instructorName, // B열: 강사 이름
          instructorEmail, // C열: 강사 이메일
          projectName || '', // D열: 프로젝트명 (선택사항)
          '완료', // E열: 상태
        ]],
      },
    });

    console.log(`Recruitment logged for ${instructorName}`);
  } catch (error) {
    console.error('Error logging recruitment:', error);
    throw error;
  }
}

/**
 * 섭외 로그 데이터 타입
 */
export interface RecruitmentLogData {
  requestId: string; // A열: 요청ID
  educationName: string; // B열: 교육명
  educationDate: string; // C열: 교육일자
  instructorName: string; // D열: 강사명
  result: 'APPROVED' | 'DECLINED' | 'CANCELLED' | 'REQUESTED'; // E열: 결과
  declineReason?: string; // F열: 거절사유
  responseDateTime?: string; // G열: 응답일시
  eventId?: string; // H열: 이벤트ID
  managerEmail?: string; // I열: 담당EM (옵션)
  requestMonth: string; // I열: 요청월
}

/**
 * 강사별 섭외율 통계 타입
 */
export interface InstructorRecruitmentStats {
  instructorName: string;
  totalRequests: number;
  approvedCount: number;
  declinedCount: number;
  approvalRate: number;
  declineRate: number;
  educationDates: string[];
  declineReasons: DeclineReasonInfo[];
  monthlyStats: {
    [month: string]: {
      approved: number;
      declined: number;
      total: number;
    };
  };
}

/**
 * 거절 사유 정보 타입
 */
export interface DeclineReasonInfo {
  educationName: string;
  educationDate: string;
  declineReason: string;
  requestMonth: string;
}

/**
 * 외부강사_섭외_로그 시트에서 모든 섭외 로그를 조회합니다.
 * @returns 섭외 로그 데이터 목록
 */
export async function getAllRecruitmentLogs(): Promise<RecruitmentLogData[]> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || process.env.GOOGLE_LOGIN_SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID || '1MKm00PfsR4CWBF-xo9qThN8lElrZVg6wuC7blbZXL68';
  const sheetName = '외부강사_섭외_로그';

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const logs: RecruitmentLogData[] = [];

    // 헤더 행을 제외하고 데이터 행만 처리
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      const requestId = (row[0] || '').trim(); // A열: 요청ID
      const educationName = (row[1] || '').trim(); // B열: 교육명
      const educationDate = (row[2] || '').trim(); // C열: 교육일자
      const instructorName = (row[3] || '').trim(); // D열: 강사명
      const result = (row[4] || '').trim().toUpperCase(); // E열: 결과
      const declineReason = (row[5] || '').trim(); // F열: 거절사유
      const responseDateTime = (row[6] || '').trim(); // G열: 응답일시
      const eventId = (row[7] || '').trim(); // H열: 이벤트ID
      const requestMonth = (row[8] || '').trim(); // I열: 요청월

      // 필수 필드가 있는 경우만 추가
      if (requestId && educationName) {
        if (result === 'APPROVED' || result === 'DECLINED' || result === 'CANCELLED' || result === 'REQUESTED') {
          logs.push({
            requestId,
            educationName,
            educationDate,
            instructorName: normalizeName(instructorName),
            result: result as 'APPROVED' | 'DECLINED' | 'CANCELLED' | 'REQUESTED',
            declineReason: declineReason || undefined,
            responseDateTime: responseDateTime || undefined,
            eventId: eventId || undefined,
            requestMonth: requestMonth || '',
          });
        }
      }
    }

    return logs;
  } catch (error) {
    console.error('Error fetching recruitment logs:', error);
    throw error;
  }
}

/**
 * 강사 상세 정보 타입 (강사 현황_v2 시트)
 */
export interface InstructorDetail {
  status: string; // A열: 상태
  name: string; // B열: 이름
  email: string; // C열: 이메일
  mobile: string; // D열: 전화번호
  affiliation: string; // E열: 소속
  specialty: string; // F열: 전문분야
  experience: string; // G열: 경력
  fee: string; // H열: 강사료
  availability: string; // I열: 가능일정
  notes: string; // J열: 특이사항
}

/**
 * 강사 상세 정보를 조회합니다 (강사 현황_v2 시트).
 * @returns 강사 상세 정보 목록
 */
export async function getAllInstructorDetails(): Promise<InstructorDetail[]> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '1MKm00PfsR4CWBF-xo9qThN8lElrZVg6wuC7blbZXL68';
  const sheetName = '강사 현황_v2';

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const instructors: InstructorDetail[] = [];

    // 헤더 행을 제외하고 데이터 행만 처리
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      const status = (row[0] || '').trim(); // A열: 상태
      const name = (row[1] || '').trim(); // B열: 이름
      const email = (row[2] || '').trim(); // C열: 이메일
      const mobile = (row[3] || '').trim(); // D열: 전화번호
      const affiliation = (row[4] || '').trim(); // E열: 소속
      const specialty = (row[5] || '').trim(); // F열: 전문분야
      const experience = (row[6] || '').trim(); // G열: 경력
      const fee = (row[7] || '').trim(); // H열: 강사료
      const availability = (row[8] || '').trim(); // I열: 가능일정
      const notes = (row[9] || '').trim(); // J열: 특이사항

      // 이름이 있는 경우만 추가
      if (name) {
        instructors.push({
          status,
          name: normalizeName(name),
          email,
          mobile,
          affiliation,
          specialty,
          experience,
          fee,
          availability,
          notes,
        });
      }
    }

    return instructors.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching instructor details:', error);
    throw error;
  }
}

/**
 * 강사별 섭외율 통계를 계산합니다.
 * @returns 강사별 섭외율 통계
 */
export async function getInstructorRecruitmentStats(): Promise<InstructorRecruitmentStats[]> {
  const logs = await getAllRecruitmentLogs();

  // 강사별로 그룹화
  const instructorMap = new Map<string, RecruitmentLogData[]>();

  logs.forEach((log) => {
    // CANCELLED는 제외
    if (log.result === 'CANCELLED') {
      return;
    }

    const instructorName = log.instructorName;
    if (!instructorMap.has(instructorName)) {
      instructorMap.set(instructorName, []);
    }
    instructorMap.get(instructorName)!.push(log);
  });

  // 통계 계산
  const stats: InstructorRecruitmentStats[] = [];

  instructorMap.forEach((logs, instructorName) => {
    const approvedCount = logs.filter((log) => log.result === 'APPROVED').length;
    const declinedCount = logs.filter((log) => log.result === 'DECLINED').length;
    const totalRequests = logs.length;
    const approvalRate = totalRequests > 0 ? (approvedCount / totalRequests) * 100 : 0;
    const declineRate = totalRequests > 0 ? (declinedCount / totalRequests) * 100 : 0;

    // 교육일자 목록 (중복 제거, 정렬)
    const educationDates = Array.from(
      new Set(logs.map((log) => log.educationDate).filter((date) => date))
    ).sort();

    // 거절 사유 목록 수집
    const declineReasons: DeclineReasonInfo[] = logs
      .filter((log) => log.result === 'DECLINED' && log.declineReason)
      .map((log) => ({
        educationName: log.educationName || '',
        educationDate: log.educationDate || '',
        declineReason: log.declineReason || '',
        requestMonth: log.requestMonth || '',
      }));

    // 월별 통계
    const monthlyStats: { [month: string]: { approved: number; declined: number; total: number } } = {};
    logs.forEach((log) => {
      const month = log.requestMonth || '';
      if (!monthlyStats[month]) {
        monthlyStats[month] = { approved: 0, declined: 0, total: 0 };
      }
      if (log.result === 'APPROVED') {
        monthlyStats[month].approved++;
      } else if (log.result === 'DECLINED') {
        monthlyStats[month].declined++;
      }
      monthlyStats[month].total++;
    });

    stats.push({
      instructorName,
      totalRequests,
      approvedCount,
      declinedCount,
      approvalRate: Math.round(approvalRate * 10) / 10, // 소수점 첫째자리까지
      declineRate: Math.round(declineRate * 10) / 10,
      educationDates,
      declineReasons,
      monthlyStats,
    });
  });

  // 강사명으로 정렬
  return stats.sort((a, b) => a.instructorName.localeCompare(b.instructorName));
}

/**
 * 전체 월별 섭외율 통계를 계산합니다.
 * @returns 월별 통계 (월 -> { approved, declined, total })
 */
export async function getOverallMonthlyRecruitmentStats(): Promise<{
  [month: string]: { approved: number; declined: number; total: number };
}> {
  const logs = await getAllRecruitmentLogs();

  // 월별 통계
  const monthlyStats: { [month: string]: { approved: number; declined: number; total: number } } = {};

  logs.forEach((log) => {
    // CANCELLED는 제외
    if (log.result === 'CANCELLED') {
      return;
    }

    const month = log.requestMonth || '';
    if (!month) {
      return;
    }

    if (!monthlyStats[month]) {
      monthlyStats[month] = { approved: 0, declined: 0, total: 0 };
    }

    if (log.result === 'APPROVED') {
      monthlyStats[month].approved++;
    } else if (log.result === 'DECLINED') {
      monthlyStats[month].declined++;
    }
    monthlyStats[month].total++;
  });

  return monthlyStats;
}

/**
 * 강사 정보 목록 (기업교육_외부강사: A=성함, B=소속, G=전화, H=이메일, I=강사료, M=비고)
 */
export interface InstructorInfo {
  rowIndex: number;
  name: string;
  affiliation: string;
  mobile: string;
  email: string;
  fee: string;
  notes: string;
  [key: string]: string | number;
}

/**
 * EM 강사 현황 시트에서 모든 강사 정보를 조회합니다.
 * 시트: GOOGLE_INSTRUCTOR_STATUS_SPREADSHEET_ID / GOOGLE_INSTRUCTOR_STATUS_SHEET_NAME
 * (기본: 1MKm00... / 기업교육_외부강사)
 * 레이아웃: A=성함, B=소속, F=진행가능교육(또는 상태), G=전화, H=이메일, I=강사료, M=비고
 * @param excludeInactive F열이 중단/대기중/양성단계인 경우 제외 (기본 true)
 */
export async function getAllInstructorInfo(excludeInactive: boolean = true): Promise<InstructorInfo[]> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = INSTRUCTOR_STATUS_SPREADSHEET_ID();
  const sheetName = INSTRUCTOR_STATUS_SHEET_NAME();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const instructors: InstructorInfo[] = [];
    const seenNames = new Set<string>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = normalizeName((row[0] || '').trim()); // A열: 성함
      const affiliation = (row[1] || '').trim(); // B열: 소속
      const statusOrTrack = (row[5] || '').trim(); // F열: 진행 가능한 교육 / 상태

      if (excludeInactive && INSTRUCTOR_STATUS_EXCLUDED.has(statusOrTrack)) continue;
      if (!name || seenNames.has(name)) continue;
      seenNames.add(name);

      instructors.push({
        rowIndex: i + 1,
        name,
        affiliation,
        mobile: (row[6] || '').trim(), // G열: 이동통신
        email: (row[7] || '').trim(), // H열: 이메일
        fee: (row[8] || '').trim(), // I열: 강사료_표준교육
        notes: (row[12] || '').trim(), // M열: 비고
      });
    }

    for (const t of TEST_INSTRUCTORS) {
      const n = normalizeName(t.name);
      if (!n || seenNames.has(n)) continue;
      seenNames.add(n);
      instructors.push({
        rowIndex: -1,
        name: t.name,
        affiliation: '테스트',
        mobile: '',
        email: t.email,
        fee: '',
        notes: '테스트용',
      });
    }

    return instructors.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching instructor info:', error);
    throw error;
  }
}

/**
 * 강사 정보를 시트에 업데이트합니다
 * @param rowIndex 시트의 행 번호 (1-based)
 * @param columnIndex 업데이트할 컬럼 인덱스 (0-based, A=0, B=1, ...)
 * @param value 업데이트할 값
 */
export async function updateInstructorCell(
  rowIndex: number,
  columnIndex: number,
  value: string
): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = INSTRUCTOR_STATUS_SPREADSHEET_ID();
  const sheetName = INSTRUCTOR_STATUS_SHEET_NAME();

  try {
    // 컬럼 인덱스를 알파벳으로 변환 (A, B, C, ...)
    const columnLetter = String.fromCharCode(65 + columnIndex); // A=65
    
    // 범위 지정 (예: C5, D5 등)
    const range = `'${sheetName}'!${columnLetter}${rowIndex}`;
    
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[value]],
      },
    });
  } catch (error) {
    console.error('Error updating instructor cell:', error);
    throw error;
  }
}

/** 강사 실적 시트: 1qtyBpb2... (강사 일정/만족도 관리 대시보드) 내 "강사 실적" - A=강사명, B=주요 고객사, C=출강 횟수 */
const INSTRUCTOR_PERFORMANCE_SHEET_NAME = '강사 실적';
const INSTRUCTOR_PERFORMANCE_SPREADSHEET_ID = () =>
  process.env.GOOGLE_SATISFACTION_SPREADSHEET_ID ||
  process.env.GOOGLE_INSTRUCTOR_PERFORMANCE_SPREADSHEET_ID ||
  '1qtyBpb2GHAJPDBfiQl3itPl73i0VuZlR8ZjUQUGBHxg';

export interface InstructorPerformanceRow {
  name: string;
  mainClients: string;
  sessionCount: string;
}

/**
 * 강사 실적 시트에서 고객사·출강 횟수 조회 (강사 일정/만족도 대시보드 스프레드시트)
 */
export async function getInstructorPerformance(): Promise<InstructorPerformanceRow[]> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = INSTRUCTOR_PERFORMANCE_SPREADSHEET_ID();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${INSTRUCTOR_PERFORMANCE_SHEET_NAME}!A:C`,
    });
    const rows = response.data.values || [];
    if (rows.length < 2) return [];

    const result: InstructorPerformanceRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = (row[0] ?? '').trim();
      if (!name) continue;
      result.push({
        name,
        mainClients: (row[1] ?? '').trim(),
        sessionCount: (row[2] ?? '').trim(),
      });
    }
    return result;
  } catch (error) {
    console.error('Error fetching instructor performance:', error);
    return [];
  }
}

/**
 * 교육 일정 데이터 타입 (class_schedule(등록) 시트)
 */
export interface ClassScheduleData {
  rowIndex: number; // 시트의 행 번호 (0-based, 헤더 제외)
  educationDate: string; // 교육일
  isTentative: string; // 가일정 여부
  clientName: string; // 고객사명
  className: string; // 클래스명
  dri: string; // DRI
  instructor: string; // 강사
  coach: string; // 코치
}

/**
 * class_schedule(등록) 시트에서 교육 일정을 조회합니다.
 * @param year 필터링할 연도 (기본값: 2026)
 * @returns 교육 일정 데이터 목록
 */
export async function getClassSchedules(year: number = 2026): Promise<ClassScheduleData[]> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '1MKm00PfsR4CWBF-xo9qThN8lElrZVg6wuC7blbZXL68';
  const sheetName = 'class_schedule(등록)';

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const schedules: ClassScheduleData[] = [];

    // 헤더 행을 제외하고 데이터 행만 처리
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      const educationDate = (row[0] || '').trim(); // A열: 교육일
      const isTentative = (row[1] || '').trim(); // B열: 가일정 여부
      const clientName = (row[2] || '').trim(); // C열: 고객사명
      const className = (row[3] || '').trim(); // D열: 클래스명
      const dri = (row[4] || '').trim(); // E열: DRI
      const instructor = (row[5] || '').trim(); // F열: 강사
      const coach = (row[6] || '').trim(); // G열: 코치

      // 연도 필터링 (교육일에서 연도 추출)
      if (educationDate) {
        const dateMatch = educationDate.match(/(\d{4})/);
        if (dateMatch) {
          const scheduleYear = parseInt(dateMatch[1]);
          if (scheduleYear !== year) {
            continue;
          }
        }
      }

      // 교육일이 있는 경우만 추가
      if (educationDate) {
        schedules.push({
          rowIndex: i, // 0-based, 헤더 제외
          educationDate,
          isTentative,
          clientName,
          className,
          dri,
          instructor,
          coach,
        });
      }
    }

    return schedules;
  } catch (error) {
    console.error('Error fetching class schedules:', error);
    throw error;
  }
}

/**
 * 기업명을 클래스명에서 추출합니다.
 * @param className 클래스명 (예: "[핑거]생성형AI교육_데이터 분석 과정")
 * @returns 기업명 (예: "핑거")
 */
export function extractCompanyName(className: string): string {
  if (!className) return '';
  const match = className.match(/\[([^\]]+)\]/);
  return match && match[1] ? match[1].trim() : '';
}

/**
 * 섭외 요청을 외부강사_섭외_로그 시트에 생성합니다.
 * @param requestId 요청 ID
 * @param schedules 선택된 교육 일정 목록
 * @param instructorName 강사 이름
 * @returns 수락 링크와 거절 링크
 */
export async function createRecruitmentRequest(
  requestId: string,
  schedules: ClassScheduleData[],
  instructorName: string,
  담당EM: string
): Promise<{ acceptLink: string; declineLink: string }> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
  const sheetName = '외부강사_섭외_로그';

  try {
    // GAS URL 생성 (수락/거절 링크 기본 URL, 환경변수 GAS_RECRUITMENT_BASE_URL로 변경 가능)
    const gasBaseUrl = (process.env.GAS_RECRUITMENT_BASE_URL || '').trim() || 'https://script.google.com/macros/s/AKfycbw34JuzTA7N4qEPOGAsut1cffhG5A_GWH16FeqvYDuy9yhE6FQY8_7mG-K9axprUCNS/exec';
    const acceptLink = `${gasBaseUrl}?action=accept&requestId=${requestId}`;
    const declineLink = `${gasBaseUrl}?action=decline&requestId=${requestId}`;

    // 현재 날짜로 요청월 계산
    const now = new Date();
    const requestMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 각 일정에 대해 시트에 추가
    const values: any[][] = [];
    for (const schedule of schedules) {
      const companyName = extractCompanyName(schedule.className) || schedule.clientName;
      // 가일정이면 교육일을 '미정'으로 기록
      const educationDateValue = schedule.isTentative === 'O' ? '미정' : schedule.educationDate;

      // 시트 구조:
      // 요청ID | 기업명 | 교육명 | 교육일 | 멘토명 | 상태 | 응답일 | 거절사유 | 담당EM | 요청월(옵션)
      values.push([
        requestId, // A열: 요청ID
        companyName, // B열: 기업명
        schedule.className, // C열: 교육명
        educationDateValue, // D열: 교육일 (가일정이면 '미정')
        instructorName, // E열: 멘토명
        'REQUESTED', // F열: 상태
        '', // G열: 응답일
        '', // H열: 거절사유
        담당EM || '', // I열: 담당EM
        requestMonth, // J열: 요청월(옵션)
      ]);
    }

    // 시트에 데이터 추가
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    return { acceptLink, declineLink };
  } catch (error) {
    console.error('Error creating recruitment request:', error);
    throw error;
  }
}

/**
 * B2U 섭외 요청을 외부강사_섭외_로그 시트에 1건 추가합니다.
 * 시트 구조는 createRecruitmentRequest와 동일. 기업명은 'B2U', 교육명은 대학교육 제목.
 */
export async function createB2URecruitmentRequest(
  requestId: string,
  educationDate: string,
  educationTitle: string,
  instructorName: string,
  담당EM: string
): Promise<{ acceptLink: string; declineLink: string }> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
  const sheetName = '외부강사_섭외_로그';

  const gasBaseUrl = (process.env.GAS_RECRUITMENT_BASE_URL || '').trim() || 'https://script.google.com/macros/s/AKfycbw34JuzTA7N4qEPOGAsut1cffhG5A_GWH16FeqvYDuy9yhE6FQY8_7mG-K9axprUCNS/exec';
  const acceptLink = `${gasBaseUrl}?action=accept&requestId=${requestId}`;
  const declineLink = `${gasBaseUrl}?action=decline&requestId=${requestId}`;

  const now = new Date();
  const requestMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const values: any[][] = [
    [
      requestId,
      'B2U',
      educationTitle || '',
      educationDate || '',
      instructorName,
      'REQUESTED',
      '',
      '',
      담당EM || '',
      requestMonth,
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });

  return { acceptLink, declineLink };
}

const SHORT_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/**
 * 섭외 짧은 링크용 6자리 코드 생성 (혼동 가능 문자 제외: I,O,0,1,l 제외)
 */
export function generateShortCode(): string {
  let code = '';
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += SHORT_CODE_CHARS[bytes[i]! % SHORT_CODE_CHARS.length];
  }
  return code;
}

/**
 * 짧은 링크 매핑 저장 (시트 "섭외_짧은링크" 필요: A=code, B=accept_url, C=decline_url, D=request_id)
 */
export async function appendShortLink(
  code: string,
  acceptUrl: string,
  declineUrl: string,
  requestId: string
): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = SHORT_LINK_SHEET_SPREADSHEET_ID();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHORT_LINK_SHEET_NAME}!A:D`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[code, acceptUrl, declineUrl, requestId]],
    },
  });
}

/**
 * 짧은 코드로 수락/거절 실제 URL 조회
 */
export async function getShortLinkByCode(
  code: string
): Promise<{ acceptUrl: string; declineUrl: string } | null> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = SHORT_LINK_SHEET_SPREADSHEET_ID();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHORT_LINK_SHEET_NAME}!A:D`,
  });
  const rows = response.data.values;
  if (!rows || rows.length === 0) return null;
  const normalized = code.trim();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if ((row[0] || '').trim() === normalized) {
      return {
        acceptUrl: (row[1] || '').trim(),
        declineUrl: (row[2] || '').trim(),
      };
    }
  }
  return null;
}

/**
 * 스프레드시트에서 gid(시트 ID)에 해당하는 시트의 제목을 반환합니다.
 */
async function getSheetTitleByGid(spreadsheetId: string, gid: number): Promise<string> {
  const sheets = getGoogleSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = res.data.sheets?.find((s) => s.properties?.sheetId === gid);
  const title = sheet?.properties?.title;
  if (!title) {
    throw new Error(`시트를 찾을 수 없습니다. (gid=${gid})`);
  }
  return title;
}

/** 대시보드용 강사 시트 gid (이메일, 이름, 암호코드, 내부/외부) */
const DASHBOARD_INSTRUCTOR_SHEET_GID = 1939207226;
const DASHBOARD_INSTRUCTOR_SPREADSHEET_ID = '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';

export interface DashboardInstructorMap {
  emailToName: Record<string, string>;
  externalEmails: Set<string>;
  /** 강사 이름 → 외부 여부 (D열 '외부'면 true) */
  nameToIsExternal: Record<string, boolean>;
}

/**
 * 지정한 gid 시트에서 강사 목록을 읽습니다.
 * 컬럼: A=이메일, B=이름, C=암호코드, D=내부/외부
 * 이메일 셀은 쉼표/줄바꿈으로 복수 가능 (parseEmailCell 사용).
 * @returns emailToName(이메일→이름), externalEmails(D열 '외부'인 강사 이메일 집합)
 */
export async function getInstructorsFromSheetByGid(
  spreadsheetId: string = DASHBOARD_INSTRUCTOR_SPREADSHEET_ID,
  gid: number = DASHBOARD_INSTRUCTOR_SHEET_GID
): Promise<DashboardInstructorMap> {
  const sheets = getGoogleSheetsClient();
  const sheetName = await getSheetTitleByGid(spreadsheetId, gid);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:D`,
  });
  const rows = response.data.values || [];
  const emailToName: Record<string, string> = {};
  const externalEmails = new Set<string>();
  const nameToIsExternal: Record<string, boolean> = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const emailCell = (row[0] ?? '').toString().trim();
    const name = (row[1] ?? '').toString().trim();
    const affiliation = (row[3] ?? '').toString().trim();
    if (!emailCell || !name) continue;
    const emails = parseEmailCell(emailCell);
    const isExternal = affiliation === '외부';
    nameToIsExternal[name] = isExternal;
    emails.forEach((email) => {
      if (!email) return;
      emailToName[email] = name;
      if (isExternal) externalEmails.add(email);
    });
  }
  return { emailToName, externalEmails, nameToIsExternal };
}

/**
 * 강사 개선점 시트에 한 행을 추가합니다.
 * 시트 구조: 교육일(A) | 기업명(B) | 작성일(C) | 개선될 점(D) | 멘토(E)
 * 시트는 GOOGLE_IMPROVEMENT_SHEET_NAME으로 지정하거나, 미설정 시 gid=1929592205인 탭 사용
 */
export async function appendImprovementFeedback(
  educationDate: string,
  companyName: string,
  improvementText: string,
  mentorName: string
): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = IMPROVEMENT_SHEET_SPREADSHEET_ID();
  let sheetName = IMPROVEMENT_SHEET_NAME().trim();
  if (!sheetName) {
    sheetName = await getSheetTitleByGid(spreadsheetId, IMPROVEMENT_SHEET_GID);
  }

  const writtenAt = new Date();
  const writtenAtStr = `${writtenAt.getFullYear()}. ${writtenAt.getMonth() + 1}. ${writtenAt.getDate()} ${writtenAt.getHours()}:${String(writtenAt.getMinutes()).padStart(2, '0')}:${String(writtenAt.getSeconds()).padStart(2, '0')}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:E`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[educationDate, companyName || '', writtenAtStr, improvementText || '', mentorName]],
    },
  });
}

export interface ImprovementFeedbackRow {
  educationDate: string;
  companyName: string;
  writtenAt: string;
  improvementText: string;
  mentorName: string;
}

/**
 * 강사 개선점(피드백) 시트에서 전체 목록을 조회합니다.
 * 시트 구조: 교육일(A) | 기업명(B) | 작성일(C) | 개선될 점(D) | 멘토(E)
 */
export async function getImprovementFeedbackList(): Promise<ImprovementFeedbackRow[]> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = IMPROVEMENT_SHEET_SPREADSHEET_ID();
  let sheetName = IMPROVEMENT_SHEET_NAME().trim();
  if (!sheetName) {
    sheetName = await getSheetTitleByGid(spreadsheetId, IMPROVEMENT_SHEET_GID);
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:E`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  const list: ImprovementFeedbackRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    list.push({
      educationDate: (row[0] || '').trim(),
      companyName: (row[1] || '').trim(),
      writtenAt: (row[2] || '').trim(),
      improvementText: (row[3] || '').trim(),
      mentorName: (row[4] || '').trim(),
    });
  }
  return list;
}

/**
 * 외부강사_섭외_로그 시트에서 섭외 요청 목록을 조회합니다.
 * @returns 섭외 요청 데이터 목록
 */
export async function getRecruitmentRequests(): Promise<RecruitmentLogData[]> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
  const sheetName = '외부강사_섭외_로그';

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const requests: RecruitmentLogData[] = [];

    // 헤더 행을 제외하고 데이터 행만 처리
    // 시트 구조:
    // 요청ID | 기업명 | 교육명 | 교육일 | 멘토명 | 상태 | 응답일 | 거절사유 | 담당EM | 요청월(옵션)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      const requestId = (row[0] || '').trim(); // A열: 요청ID
      const companyName = (row[1] || '').trim(); // B열: 기업명
      const educationName = (row[2] || '').trim(); // C열: 교육명
      const educationDate = (row[3] || '').trim(); // D열: 교육일
      const instructorName = (row[4] || '').trim(); // E열: 멘토명
      const status = (row[5] || '').trim().toUpperCase(); // F열: 상태
      const responseDate = (row[6] || '').trim(); // G열: 응답일
      const declineReason = (row[7] || '').trim(); // H열: 거절사유
      const col8 = (row[8] || '').trim(); // I열: 담당EM(신규) 또는 요청월(구버전)
      const col9 = (row[9] || '').trim(); // J열: 요청월(신규)
      const isMonth = (v: string) => /^\d{4}-\d{2}$/.test(v);
      const managerEmail = isMonth(col8) ? '' : col8;
      const requestMonth = col9 || (isMonth(col8) ? col8 : '');

      // 요청ID가 있는 경우만 추가
      if (requestId) {
        requests.push({
          requestId,
          educationName: educationName || companyName, // 교육명이 없으면 기업명 사용
          educationDate,
          instructorName: normalizeName(instructorName),
          result: (status === 'APPROVED' || status === 'ACCEPTED' ? 'APPROVED' : status === 'DECLINED' ? 'DECLINED' : status === 'CANCELLED' ? 'CANCELLED' : 'REQUESTED') as 'APPROVED' | 'DECLINED' | 'CANCELLED' | 'REQUESTED',
          declineReason: declineReason || undefined,
          responseDateTime: responseDate || undefined,
          managerEmail: managerEmail || undefined,
          requestMonth: requestMonth || '',
        });
      }
    }

    return requests;
  } catch (error) {
    console.error('Error fetching recruitment requests:', error);
    throw error;
  }
}

/**
 * shortId로 requestId를 찾습니다.
 * shortId가 requestId의 일부이거나 동일한 경우를 처리합니다.
 * @param shortId 짧은 ID
 * @returns requestId 또는 null
 */
export async function findRequestIdByShortId(shortId: string): Promise<string | null> {
  try {
    const requests = await getRecruitmentRequests();
    // shortId가 requestId에 포함되어 있는지 확인
    const matched = requests.find(req => 
      req.requestId.includes(shortId) || 
      req.requestId === shortId ||
      req.requestId.replace(/^R-/, '') === shortId
    );
    return matched ? matched.requestId : null;
  } catch (error) {
    console.error('Error finding requestId by shortId:', error);
    return null;
  }
}

/**
 * 승인된 섭외 요청을 처리하여 class_schedule(등록) 시트의 F열(강사)에 강사 이름을 추가합니다.
 * @param requestId 요청 ID
 * @returns 업데이트된 일정 개수
 */
export async function processApprovedRecruitment(requestId: string): Promise<number> {
  const sheets = getGoogleSheetsClient();
  const recruitmentSpreadsheetId = process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
  const scheduleSpreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '1MKm00PfsR4CWBF-xo9qThN8lElrZVg6wuC7blbZXL68';
  const recruitmentSheetName = '외부강사_섭외_로그';
  const scheduleSheetName = 'class_schedule(등록)';

  try {
    // 1. 외부강사_섭외_로그 시트에서 해당 requestId의 승인된 요청 조회
    const recruitmentResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: recruitmentSpreadsheetId,
      range: `${recruitmentSheetName}!A:Z`,
    });

    const recruitmentRows = recruitmentResponse.data.values;
    if (!recruitmentRows || recruitmentRows.length === 0) {
      return 0;
    }

    // 승인된 요청 필터링 (requestId 일치, 상태가 APPROVED 또는 ACCEPTED)
    const approvedRequests: Array<{
      educationName: string;
      educationDate: string;
      instructorName: string;
    }> = [];

    for (let i = 1; i < recruitmentRows.length; i++) {
      const row = recruitmentRows[i];
      const reqId = (row[0] || '').trim();
      const status = (row[5] || '').trim().toUpperCase();
      const educationName = (row[2] || '').trim(); // C열: 교육명
      const educationDate = (row[3] || '').trim(); // D열: 교육일
      const instructorName = (row[4] || '').trim(); // E열: 멘토명

      if (reqId === requestId && (status === 'APPROVED' || status === 'ACCEPTED') && educationName && educationDate && instructorName) {
        approvedRequests.push({
          educationName,
          educationDate,
          instructorName,
        });
      }
    }

    if (approvedRequests.length === 0) {
      return 0;
    }

    // 2. class_schedule(등록) 시트에서 일치하는 행 찾기
    const scheduleResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: scheduleSpreadsheetId,
      range: `${scheduleSheetName}!A:Z`,
    });

    const scheduleRows = scheduleResponse.data.values;
    if (!scheduleRows || scheduleRows.length === 0) {
      return 0;
    }

    // 날짜 파싱 헬퍼 함수
    const parseDate = (dateStr: string): Date | null => {
      if (!dateStr) return null;
      
      const trimmed = dateStr.trim();
      
      // YYYY. M. D 형식 (예: "2026. 1. 18", "2026.1.18")
      const match1 = trimmed.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
      if (match1) {
        const [, year, month, day] = match1;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      
      // YYYY-MM-DD 형식 (예: "2026-01-18")
      const match2 = trimmed.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (match2) {
        const [, year, month, day] = match2;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      
      // YYYY/MM/DD 형식 (예: "2026/01/18")
      const match3 = trimmed.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
      if (match3) {
        const [, year, month, day] = match3;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      
      // YY-MM-DD 형식 (예: "26-01-18" -> 2026년으로 가정)
      const match4 = trimmed.match(/(\d{2})-(\d{1,2})-(\d{1,2})/);
      if (match4) {
        const [, year, month, day] = match4;
        const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
        return new Date(fullYear, parseInt(month) - 1, parseInt(day));
      }
      
      return null;
    };

    let updatedCount = 0;

    // 각 승인된 요청에 대해 일치하는 일정 찾기
    for (const approvedRequest of approvedRequests) {
      const requestDate = parseDate(approvedRequest.educationDate);
      if (!requestDate) {
        console.log(`Failed to parse date: ${approvedRequest.educationDate}`);
        continue;
      }

      console.log(`Processing approved request: EducationName=${approvedRequest.educationName}, Date=${approvedRequest.educationDate}, Instructor=${approvedRequest.instructorName}`);

      // class_schedule(등록) 시트에서 일치하는 행 찾기
      for (let i = 1; i < scheduleRows.length; i++) {
        const row = scheduleRows[i];
        const scheduleDateStr = (row[0] || '').trim(); // A열: 교육일
        const scheduleClassName = (row[3] || '').trim(); // D열: 클래스명
        const currentInstructor = (row[5] || '').trim(); // F열: 강사

        if (!scheduleDateStr || !scheduleClassName) {
          continue;
        }

        const scheduleDate = parseDate(scheduleDateStr);
        if (!scheduleDate) {
          continue;
        }

        // 날짜 비교 (A열: 교육일)
        const datesMatch = 
          requestDate.getFullYear() === scheduleDate.getFullYear() &&
          requestDate.getMonth() === scheduleDate.getMonth() &&
          requestDate.getDate() === scheduleDate.getDate();

        if (!datesMatch) {
          continue;
        }

        // 클래스명 비교 (D열: 클래스명과 교육명 비교)
        // 공백 제거 후 비교하여 더 정확한 매칭
        const normalizedScheduleClassName = scheduleClassName.replace(/\s+/g, '').toLowerCase();
        const normalizedEducationName = approvedRequest.educationName.replace(/\s+/g, '').toLowerCase();
        
        const namesMatch = normalizedScheduleClassName.includes(normalizedEducationName) || 
                          normalizedEducationName.includes(normalizedScheduleClassName) ||
                          normalizedScheduleClassName === normalizedEducationName;

        if (namesMatch) {
          console.log(`✓ Matching found: Date=${scheduleDateStr}, ClassName=${scheduleClassName}, EducationName=${approvedRequest.educationName}, Instructor=${approvedRequest.instructorName}`);
          
          // F열(강사) 업데이트
          const rowNumber = i + 1; // 1-based
          let newInstructorValue = approvedRequest.instructorName;

          // 기존 강사가 있으면 추가 (쉼표로 구분)
          if (currentInstructor && currentInstructor.trim() !== '') {
            const instructors = currentInstructor.split(',').map((s: string) => s.trim()).filter((s: string) => s);
            if (!instructors.includes(approvedRequest.instructorName)) {
              instructors.push(approvedRequest.instructorName);
              newInstructorValue = instructors.join(', ');
            } else {
              // 이미 있으면 업데이트하지 않음
              console.log(`  → Instructor ${approvedRequest.instructorName} already exists, skipping`);
              continue;
            }
          }

          // 시트 업데이트
          try {
            await sheets.spreadsheets.values.update({
              spreadsheetId: scheduleSpreadsheetId,
              range: `${scheduleSheetName}!F${rowNumber}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: [[newInstructorValue]],
              },
            });
            console.log(`  → Updated row ${rowNumber}, F column with: ${newInstructorValue}`);
            updatedCount++;
          } catch (updateError) {
            console.error(`  → Error updating row ${rowNumber}:`, updateError);
          }
        }
      }
    }

    return updatedCount;
  } catch (error) {
    console.error('Error processing approved recruitment:', error);
    throw error;
  }
}

/**
 * 모든 승인된 섭외 요청을 처리합니다.
 * @returns 업데이트된 일정 개수
 */
export async function processAllApprovedRecruitments(): Promise<number> {
  const sheets = getGoogleSheetsClient();
  const recruitmentSpreadsheetId = process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
  const recruitmentSheetName = '외부강사_섭외_로그';

  try {
    // 모든 requestId 수집
    const recruitmentResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: recruitmentSpreadsheetId,
      range: `${recruitmentSheetName}!A:Z`,
    });

    const recruitmentRows = recruitmentResponse.data.values;
    if (!recruitmentRows || recruitmentRows.length === 0) {
      return 0;
    }

    // 고유한 requestId 수집 (승인된 것만)
    const uniqueRequestIds = new Set<string>();
    for (let i = 1; i < recruitmentRows.length; i++) {
      const row = recruitmentRows[i];
      const reqId = (row[0] || '').trim();
      const status = (row[5] || '').trim().toUpperCase();
      
      if (reqId && (status === 'APPROVED' || status === 'ACCEPTED')) {
        uniqueRequestIds.add(reqId);
      }
    }

    // 각 requestId에 대해 처리
    let totalUpdated = 0;
    for (const requestId of uniqueRequestIds) {
      try {
        const count = await processApprovedRecruitment(requestId);
        totalUpdated += count;
      } catch (error) {
        console.error(`Error processing requestId ${requestId}:`, error);
        // 개별 오류는 무시하고 계속 진행
      }
    }

    return totalUpdated;
  } catch (error) {
    console.error('Error processing all approved recruitments:', error);
    throw error;
  }
}
