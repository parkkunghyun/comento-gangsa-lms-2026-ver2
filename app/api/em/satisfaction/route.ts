import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getGoogleSheetsClient } from '@/lib/google-sheets';

const SATISFACTION_SPREADSHEET_ID =
  process.env.GOOGLE_SATISFACTION_SPREADSHEET_ID ||
  '1qtyBpb2GHAJPDBfiQl3itPl73i0VuZlR8ZjUQUGBHxg';
const SATISFACTION_SHEET_NAME = '만족도';
const AGGREGATE_SHEET_NAME = '만족도 집계';

export interface SatisfactionRow {
  fileName: string;
  folderName: string;
  fileLink: string;
  surveyDate: string;
  instructor: string;
  satisfaction: string;
}

/** 강사명 -> 기업 교육 평균 만족도 (만족도 집계 시트) */
export type InstructorAverageMap = Record<string, string>;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const sheets = getGoogleSheetsClient();

    // 만족도 집계 시트: A=강사명, B=평균 만족도
    let instructorAverages: InstructorAverageMap = {};
    try {
      const aggRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SATISFACTION_SPREADSHEET_ID,
        range: `${AGGREGATE_SHEET_NAME}!A:B`,
      });
      const aggRows = aggRes.data.values || [];
      for (let i = 1; i < aggRows.length; i++) {
        const name = (aggRows[i][0] ?? '').trim();
        const avg = (aggRows[i][1] ?? '').trim();
        if (name) instructorAverages[name] = avg;
      }
    } catch {
      // 만족도 집계 시트 없거나 권한 없으면 무시
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SATISFACTION_SPREADSHEET_ID,
      range: `${SATISFACTION_SHEET_NAME}!A:F`,
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json({
        success: true,
        rows: [],
        instructors: [],
        instructorAverages,
      });
    }

    const data: SatisfactionRow[] = [];
    const instructorSet = new Set<string>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const folderName = (row[1] ?? '').trim();
      const instructor = (row[4] ?? '').trim();
      if (instructor) instructorSet.add(instructor);

      data.push({
        fileName: (row[0] ?? '').trim(),
        folderName,
        fileLink: (row[2] ?? '').trim(),
        surveyDate: (row[3] ?? '').trim(),
        instructor,
        satisfaction: (row[5] ?? '').trim(),
      });
    }

    const instructors = Array.from(instructorSet).filter(Boolean).sort();

    return NextResponse.json({
      success: true,
      rows: data,
      instructors,
      instructorAverages,
    });
  } catch (error) {
    console.error('Satisfaction API error:', error);
    return NextResponse.json(
      { error: '만족도 데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
