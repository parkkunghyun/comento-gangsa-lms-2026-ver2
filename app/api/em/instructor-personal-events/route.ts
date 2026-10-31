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
  return fallbackFromSummary.includes('선호') ? '강의 선호' : '강의 불가';
}

/**
 * POST: EM이 특정 강사의 개인 일정 조회
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const instructorEmailParam = (body.instructorEmail || '').trim();

    if (!instructorEmailParam) {
      return NextResponse.json(
        { error: '강사 이메일이 필요합니다.' },
        { status: 400 }
      );
    }

    const instructorEmails = parseEmailCell(instructorEmailParam);
    const instructorEmailSet = new Set(instructorEmails);

    const sheets = getGoogleSheetsClient();
    
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: PERSONAL_EVENTS_SPREADSHEET_ID,
        range: `${PERSONAL_EVENTS_SHEET_NAME}!A:Z`,
      });

      const rows = response.data.values || [];
      const personalEvents = [];

      // 헤더 행을 제외하고 데이터 행만 처리 (A열에 쉼표로 여러 이메일일 수 있음)
      // 시트 구조: 강사이메일 | 일정이름 | 날짜 | 유형
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const emailCell = (row[0] || '').trim();
        const summary = (row[1] || '').trim();
        const date = (row[2] || '').trim();
        const rawType = (row[3] || '').trim();
        const type = normalizeType(rawType, summary);

        const rowEmails = parseEmailCell(emailCell);
        const isMatch = rowEmails.some((e) => instructorEmailSet.has(e));
        if (isMatch && summary && date) {
          personalEvents.push({
            rowIndex: i + 1,
            summary,
            date,
            type,
          });
        }
      }

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
    console.error('Get instructor personal events API error:', error);
    return NextResponse.json(
      { error: '개인 일정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: EM이 특정 강사의 강의 불가 일정을 한 번에 반영
 * body: { instructorEmail, addDates: ['YYYY-MM-DD'], removeEvents: [{ rowIndex, summary, date }] }
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const instructorEmails = parseEmailCell((body.instructorEmail || '').trim());
    const targets: Array<{ rowIndex: number; summary: string; date: string }> = Array.isArray(body.removeEvents)
      ? body.removeEvents
      : [];
    const addDates: string[] = Array.from(
      new Set<string>(
        (Array.isArray(body.addDates) ? body.addDates : []).filter(
          (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
        )
      )
    );

    if (instructorEmails.length === 0 || (targets.length === 0 && addDates.length === 0)) {
      return NextResponse.json(
        { error: '강사 이메일과 변경할 일정이 필요합니다.' },
        { status: 400 }
      );
    }

    const instructorEmailSet = new Set(instructorEmails);
    const sheets = getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: PERSONAL_EVENTS_SPREADSHEET_ID,
      range: `${PERSONAL_EVENTS_SHEET_NAME}!A:D`,
    });
    const rows = response.data.values || [];

    // 조회 이후 시트가 바뀌어 행이 밀렸을 수 있으므로, 같은 강사·일정·날짜인 행만 삭제
    const rowIndexes = Array.from(
      new Set(
        targets
          .map((t) => Number(t.rowIndex))
          .filter((rowIndex, idx) => {
            if (!Number.isInteger(rowIndex) || rowIndex < 2) return false;
            const row = rows[rowIndex - 1];
            if (!row) return false;
            const target = targets[idx];
            const rowEmails = parseEmailCell((row[0] || '').trim());
            return (
              rowEmails.some((e) => instructorEmailSet.has(e)) &&
              (row[1] || '').trim() === String(target.summary || '').trim() &&
              (row[2] || '').trim() === String(target.date || '').trim()
            );
          })
      )
    ).sort((a, b) => b - a);

    if (rowIndexes.length !== targets.length) {
      return NextResponse.json(
        { error: '시트 내용이 변경되었습니다. 새로고침 후 다시 시도해주세요.' },
        { status: 409 }
      );
    }

    if (rowIndexes.length > 0) {
      const sheetId = await getSheetId(sheets, PERSONAL_EVENTS_SPREADSHEET_ID, PERSONAL_EVENTS_SHEET_NAME);

      // 아래 행부터 지워야 위쪽 행 번호가 밀리지 않음
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: PERSONAL_EVENTS_SPREADSHEET_ID,
        requestBody: {
          requests: rowIndexes.map((rowIndex) => ({
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
              },
            },
          })),
        },
      });
    }

    if (addDates.length > 0) {
      // 강사 본인 조회는 A열 이메일 중 하나와 로그인 이메일을 비교하므로 강사의 이메일을 모두 기록
      const emailCell = instructorEmails.join(', ');
      await sheets.spreadsheets.values.append({
        spreadsheetId: PERSONAL_EVENTS_SPREADSHEET_ID,
        range: `${PERSONAL_EVENTS_SHEET_NAME}!A:D`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: addDates.map((d) => [emailCell, '강의 불가', d, '강의 불가']),
        },
      });
    }

    return NextResponse.json({
      success: true,
      added: addDates.length,
      removed: rowIndexes.length,
      message: `강의 불가 ${addDates.length}건 추가, ${rowIndexes.length}건 해제되었습니다.`,
    });
  } catch (error) {
    console.error('Update instructor personal events API error:', error);
    return NextResponse.json(
      { error: '일정 반영 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

async function getSheetId(sheets: any, spreadsheetId: string, sheetName: string): Promise<number> {
  const response = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = response.data.sheets?.find((s: any) => s.properties.title === sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }
  return sheet.properties.sheetId;
}
