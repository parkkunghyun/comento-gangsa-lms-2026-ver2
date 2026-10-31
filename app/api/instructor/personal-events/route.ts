import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getGoogleSheetsClient, parseEmailCell } from '@/lib/google-sheets';

// 강사 개인 일정을 저장할 시트 정보 (강사일정 시트 사용)
const PERSONAL_EVENTS_SPREADSHEET_ID = process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
const PERSONAL_EVENTS_SHEET_NAME = '강사일정';

type PersonalEventType = '강의 선호' | '강의 불가';

function normalizeType(rawType: string, fallbackFromSummary: string): PersonalEventType {
  const t = (rawType || '').trim();
  if (t === '강의 선호' || t === '강의 불가') return t;
  // 하위호환: 기존 summary 기반 추론
  return fallbackFromSummary.includes('선호') ? '강의 선호' : '강의 불가';
}

/**
 * GET: 강사의 개인 일정 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const sheets = getGoogleSheetsClient();
    
    try {
      console.log('[개인 일정 API GET] 시트 조회 시작');
      console.log('[개인 일정 API GET] Spreadsheet ID:', PERSONAL_EVENTS_SPREADSHEET_ID);
      console.log('[개인 일정 API GET] Sheet Name:', PERSONAL_EVENTS_SHEET_NAME);
      console.log('[개인 일정 API GET] 사용자 이메일:', user.email);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: PERSONAL_EVENTS_SPREADSHEET_ID,
        range: `${PERSONAL_EVENTS_SHEET_NAME}!A:Z`,
      });

      const rows = response.data.values || [];
      const personalEvents = [];

      console.log('[개인 일정 API GET] 시트 데이터 행 수:', rows.length);
      console.log('[개인 일정 API GET] 첫 5개 행:', rows.slice(0, 5));

      // 헤더 행을 제외하고 데이터 행만 처리
      // 시트 구조: 강사이메일 | 일정이름 | 날짜 | 유형
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const emailCell = (row[0] || '').trim(); // A열: 단일 이메일 또는 "이메일1, 이메일2"
        const summary = (row[1] || '').trim();
        const date = (row[2] || '').trim();
        const rawType = (row[3] || '').trim();
        const type = normalizeType(rawType, summary);

        const rowEmails = parseEmailCell(emailCell);
        const isMatch = rowEmails.some((e) => e === user.email.toLowerCase());

        console.log(`[개인 일정 API GET] 행 ${i}: 이메일="${emailCell}", 일정="${summary}", 날짜="${date}", 유형="${type}"`);
        console.log(`[개인 일정 API GET] 이메일 매칭: row 이메일들 중 로그인 이메일 포함? ${isMatch}`);

        if (isMatch && summary && date) {
          personalEvents.push({
            rowIndex: i + 1, // 1-based 행 번호 (헤더 포함)
            summary,
            date,
            type,
          });
          console.log(`[개인 일정 API GET] ✓ 일정 추가됨: ${summary} (${date}) [${type}]`);
        }
      }

      console.log('[개인 일정 API GET] 최종 필터링된 개인 일정 개수:', personalEvents.length);
      console.log('[개인 일정 API GET] 반환할 일정:', personalEvents);

      return NextResponse.json({
        success: true,
        events: personalEvents,
      });
    } catch (error: any) {
      // 시트가 없으면 빈 배열 반환
      if (error.code === 400 || error.message?.includes('Unable to parse range')) {
        return NextResponse.json({
          success: true,
          events: [],
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Get personal events API error:', error);
    return NextResponse.json(
      { error: '개인 일정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PUT: 강사의 개인 일정 수정
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { rowIndex, summary, date, type } = body;

    if (!rowIndex || !summary || !date) {
      return NextResponse.json(
        { error: '행 번호, 일정 이름, 날짜는 필수입니다.' },
        { status: 400 }
      );
    }
    const eventType: PersonalEventType = normalizeType(String(type || ''), String(summary || ''));

    const sheets = getGoogleSheetsClient();
    
    try {
      // 행 수정 (B열: 일정이름, C열: 날짜, D열: 유형)
      await sheets.spreadsheets.values.update({
        spreadsheetId: PERSONAL_EVENTS_SPREADSHEET_ID,
        range: `${PERSONAL_EVENTS_SHEET_NAME}!B${rowIndex}:D${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[summary, date, eventType]],
        },
      });

      return NextResponse.json({
        success: true,
        message: `${eventType} 일정이 수정되었습니다.`,
      });
    } catch (error: any) {
      console.error('Error updating personal event:', error);
      return NextResponse.json(
        { error: '개인 일정 수정 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Update personal event API error:', error);
    return NextResponse.json(
      { error: '개인 일정 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 강사의 개인 일정 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const rowIndex = searchParams.get('rowIndex');

    if (!rowIndex) {
      return NextResponse.json(
        { error: '행 번호는 필수입니다.' },
        { status: 400 }
      );
    }

    const sheets = getGoogleSheetsClient();
    
    try {
      // 먼저 해당 행이 사용자의 일정인지 확인
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: PERSONAL_EVENTS_SPREADSHEET_ID,
        range: `${PERSONAL_EVENTS_SHEET_NAME}!A${rowIndex}`,
      });

      const row = response.data.values?.[0];
      const emailCell = (row?.[0] || '').trim();
      const rowEmails = parseEmailCell(emailCell);
      const isOwner = rowEmails.some((e) => e === user.email.toLowerCase());

      if (!isOwner) {
        return NextResponse.json(
          { error: '권한이 없습니다.' },
          { status: 403 }
        );
      }

      // 행 삭제
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: PERSONAL_EVENTS_SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: await getSheetId(sheets, PERSONAL_EVENTS_SPREADSHEET_ID, PERSONAL_EVENTS_SHEET_NAME),
                  dimension: 'ROWS',
                  startIndex: parseInt(rowIndex) - 1, // 0-based
                  endIndex: parseInt(rowIndex),
                },
              },
            },
          ],
        },
      });

      return NextResponse.json({
        success: true,
        message: '강의 불가 일정이 삭제되었습니다.',
      });
    } catch (error: any) {
      console.error('Error deleting personal event:', error);
      return NextResponse.json(
        { error: '개인 일정 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Delete personal event API error:', error);
    return NextResponse.json(
      { error: '개인 일정 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 시트 ID를 가져오는 헬퍼 함수
async function getSheetId(sheets: any, spreadsheetId: string, sheetName: string): Promise<number> {
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
  });
  const sheet = response.data.sheets?.find((s: any) => s.properties.title === sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }
  return sheet.properties.sheetId;
}

/**
 * POST: 강사의 개인 일정 추가
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { dates, summary, date, type } = body; // dates 배열 또는 단일 date 지원

    console.log('[개인 일정 API POST] 요청 데이터:', { dates, summary, type, date, userEmail: user.email });

    // dates 배열이 있으면 사용, 없으면 단일 date 사용 (하위 호환성)
    const datesToAdd = dates || (date ? [date] : []);
    
    if (datesToAdd.length === 0) {
      console.log('[개인 일정 API POST] 날짜 필드 누락');
      return NextResponse.json(
        { error: '날짜는 필수입니다.' },
        { status: 400 }
      );
    }

    // 유형/이름 처리 (하위 호환: 기존 summary로 유형 추론)
    const eventType: PersonalEventType = normalizeType(String(type || ''), String(summary || ''));
    const eventSummary = (summary || '').trim() || eventType;

    const sheets = getGoogleSheetsClient();
    
    try {
      console.log('[개인 일정 API POST] 시트 조회 시작');
      console.log('[개인 일정 API POST] Spreadsheet ID:', PERSONAL_EVENTS_SPREADSHEET_ID);
      console.log('[개인 일정 API POST] Sheet Name:', PERSONAL_EVENTS_SHEET_NAME);

      // 시트 존재 확인 및 헤더 추가
      let hasHeader = false;
      try {
        const headerResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: PERSONAL_EVENTS_SPREADSHEET_ID,
          range: `${PERSONAL_EVENTS_SHEET_NAME}!A1:D1`,
        });
        const headerRow = headerResponse.data.values?.[0] || [];
        hasHeader = headerRow.length >= 4;
        console.log('[개인 일정 API POST] 헤더 존재 여부:', hasHeader);
      } catch (error: any) {
        console.log('[개인 일정 API POST] 헤더 확인 오류:', error.message);
        hasHeader = false;
      }

      // 헤더가 없으면 추가
      if (!hasHeader) {
        console.log('[개인 일정 API POST] 헤더 추가 중...');
        // 기존 3열 헤더가 있을 수 있으니 update로 덮어씁니다.
        await sheets.spreadsheets.values.update({
          spreadsheetId: PERSONAL_EVENTS_SPREADSHEET_ID,
          valueInputOption: 'USER_ENTERED',
          range: `${PERSONAL_EVENTS_SHEET_NAME}!A1:D1`,
          requestBody: {
            values: [['강사이메일', '일정이름', '날짜', '유형']],
          },
        });
        console.log('[개인 일정 API POST] 헤더 추가 완료');
      }

      // 여러 개인 일정 추가
      const valuesToAdd = datesToAdd.map((d: string) => [user.email, eventSummary, d, eventType]);
      console.log('[개인 일정 API POST] 일정 추가 중...', { email: user.email, count: valuesToAdd.length, dates: datesToAdd });
      
      const appendResponse = await sheets.spreadsheets.values.append({
        spreadsheetId: PERSONAL_EVENTS_SPREADSHEET_ID,
        range: `${PERSONAL_EVENTS_SHEET_NAME}!A:D`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: valuesToAdd,
        },
      });
      console.log('[개인 일정 API POST] 일정 추가 완료:', appendResponse.data);

      return NextResponse.json({
        success: true,
        message: `${datesToAdd.length}개의 ${eventType} 일정이 추가되었습니다.`,
      });
    } catch (error: any) {
      // 시트가 없으면 생성 시도 (실제로는 수동으로 생성해야 할 수도 있음)
      console.error('Error saving personal event:', error);
      return NextResponse.json(
        { error: '개인 일정 추가 중 오류가 발생했습니다. 시트가 존재하는지 확인해주세요.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Create personal event API error:', error);
    return NextResponse.json(
      { error: '개인 일정 추가 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
