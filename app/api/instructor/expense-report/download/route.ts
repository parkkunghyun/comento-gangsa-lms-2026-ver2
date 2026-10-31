import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getGoogleSheetsClient } from '@/lib/google-sheets';
import { downloadFileFromDrive, getFileInfo } from '@/lib/google-drive';

const EXPENSE_REPORT_SPREADSHEET_ID =
  process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID ||
  '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
const SHEET_NAME = '지출결의서관리';

async function isFileOwnedByInstructor(email: string, fileId: string): Promise<boolean> {
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: EXPENSE_REPORT_SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:H`,
  });

  const rows = response.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 8) continue;
    const rowEmail = (row[0] || '').toString().trim();
    const rowFileId = (row[5] || '').toString().trim();
    if (rowEmail.toLowerCase() === email.toLowerCase() && rowFileId === fileId) {
      return true;
    }
  }
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    if (!fileId) {
      return NextResponse.json(
        { error: '파일 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const owned = await isFileOwnedByInstructor(user.email, fileId);
    if (!owned) {
      return NextResponse.json(
        { error: '본인 지출결의서 파일만 다운로드할 수 있습니다.' },
        { status: 403 }
      );
    }

    const fileInfo = await getFileInfo(fileId);
    const fileBuffer = await downloadFileFromDrive(fileId);

    const headers = new Headers();
    headers.set('Content-Type', fileInfo.mimeType);
    headers.set(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileInfo.name)}"`
    );
    headers.set('Content-Length', fileBuffer.length.toString());

    // NextResponse 타입(BodyInit) 호환을 위해 ArrayBuffer로 복사
    // (Node의 Buffer.buffer는 ArrayBuffer | SharedArrayBuffer 타입일 수 있음)
    const body = new Uint8Array(fileBuffer).buffer;

    return new NextResponse(body, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Error downloading instructor expense report file:', error);
    return NextResponse.json(
      {
        error: '파일 다운로드 중 오류가 발생했습니다.',
        details: error.message || '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

