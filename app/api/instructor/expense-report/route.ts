import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getGoogleSheetsClient } from '@/lib/google-sheets';

const EXPENSE_REPORT_SPREADSHEET_ID =
  process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID ||
  '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
const SHEET_NAME = '지출결의서관리';

interface ExpenseReportRow {
  email: string;
  name: string;
  month: string;
  uploadDate: string;
  fileName: string;
  fileId: string;
  webViewLink: string;
  type: string; // excel | zip
}

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const sheets = getGoogleSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: EXPENSE_REPORT_SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:H`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({
        months: [],
        reportsByMonth: {},
        totalReports: 0,
      });
    }

    const reports: ExpenseReportRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 8) continue;
      const email = (row[0] || '').toString().trim();
      if (email.toLowerCase() !== user.email.toLowerCase()) continue;
      reports.push({
        email,
        name: (row[1] || '').toString(),
        month: (row[2] || '').toString(),
        uploadDate: (row[3] || '').toString(),
        fileName: (row[4] || '').toString(),
        fileId: (row[5] || '').toString(),
        webViewLink: (row[6] || '').toString(),
        type: (row[7] || '').toString(),
      });
    }

    const reportsByMonth: Record<string, ExpenseReportRow[]> = {};
    reports.forEach((r) => {
      if (!reportsByMonth[r.month]) reportsByMonth[r.month] = [];
      reportsByMonth[r.month].push(r);
    });

    const months = Object.keys(reportsByMonth).sort().reverse();

    return NextResponse.json({
      months,
      reportsByMonth,
      totalReports: reports.length,
    });
  } catch (error: any) {
    console.error('Error fetching instructor expense reports:', error);
    return NextResponse.json(
      {
        error: '지출결의서 조회 중 오류가 발생했습니다.',
        details: error.message || '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

