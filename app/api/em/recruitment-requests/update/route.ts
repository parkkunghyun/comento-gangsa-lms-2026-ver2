import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getGoogleSheetsClient } from '@/lib/google-sheets';

/**
 * 섭외 요청 데이터 업데이트 API
 * PUT /api/em/recruitment-requests/update
 * 
 * Body: {
 *   rowIndex: number, // 시트의 행 번호 (1-based, 헤더 제외)
 *   columnIndex: number, // 컬럼 인덱스 (0-based: A=0, B=1, ...)
 *   value: string // 새로운 값
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { rowIndex, columnIndex, value } = body;

    if (typeof rowIndex !== 'number' || typeof columnIndex !== 'number') {
      return NextResponse.json(
        { error: 'rowIndex와 columnIndex는 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
    const sheetName = '외부강사_섭외_로그';

    // 컬럼 인덱스를 알파벳으로 변환 (A=0, B=1, ...)
    const columnLetter = String.fromCharCode(65 + columnIndex); // A=65

    // 행 번호는 1-based이고 헤더가 있으므로 +2 (헤더 1행 + 0-based to 1-based)
    const actualRow = rowIndex + 2;

    // 시트 업데이트
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!${columnLetter}${actualRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[value]],
      },
    });

    return NextResponse.json({
      success: true,
      message: '데이터가 업데이트되었습니다.',
    });
  } catch (error) {
    console.error('Update recruitment request API error:', error);
    return NextResponse.json(
      { error: '데이터 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
