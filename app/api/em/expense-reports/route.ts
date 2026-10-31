import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getGoogleSheetsClient } from '@/lib/google-sheets';

const EXPENSE_REPORT_SPREADSHEET_ID = process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
const SHEET_NAME = '지출결의서관리';

interface ExpenseReport {
  email: string;
  name: string;
  month: string;
  uploadDate: string;
  fileName: string;
  fileId: string;
  webViewLink: string;
  type: string;
}

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const sheets = getGoogleSheetsClient();

    // 시트의 모든 데이터 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: EXPENSE_REPORT_SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:H`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ reports: [] });
    }

    // 헤더 제외하고 데이터 파싱
    const reports: ExpenseReport[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row && row.length >= 8) {
        reports.push({
          email: row[0] || '',
          name: row[1] || '',
          month: row[2] || '',
          uploadDate: row[3] || '',
          fileName: row[4] || '',
          fileId: row[5] || '',
          webViewLink: row[6] || '',
          type: row[7] || '',
        });
      }
    }

    // 강사별로 그룹화
    const groupedByInstructor: Record<string, Record<string, ExpenseReport[]>> = {};
    
    reports.forEach((report) => {
      if (!groupedByInstructor[report.email]) {
        groupedByInstructor[report.email] = {};
      }
      if (!groupedByInstructor[report.email][report.month]) {
        groupedByInstructor[report.email][report.month] = [];
      }
      groupedByInstructor[report.email][report.month].push(report);
    });

    // 강사별 요약 정보 생성
    const instructors = Object.keys(groupedByInstructor).map((email) => {
      const months = Object.keys(groupedByInstructor[email]);
      const firstReport = reports.find((r) => r.email === email);
      return {
        email,
        name: firstReport?.name || email.split('@')[0],
        months: months.sort().reverse(), // 최신 월부터
        totalReports: reports.filter((r) => r.email === email).length,
      };
    });

    return NextResponse.json({
      instructors,
      reportsByInstructor: groupedByInstructor,
    });
  } catch (error: any) {
    console.error('Error fetching expense reports:', error);
    return NextResponse.json(
      {
        error: '지출결의서 조회 중 오류가 발생했습니다.',
        details: error.message || '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
