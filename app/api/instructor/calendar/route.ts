import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getInstructorEvents, CalendarEvent } from '@/lib/google-calendar';
import { getGoogleSheetsClient, getInstructorEmailCellByLoginEmail, parseEmailCell } from '@/lib/google-sheets';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'c_434b3261f4e10e2caf2228a9f17b773c88a54e11c52d3ac541d8dd1ad323e01a@group.calendar.google.com';
const PERSONAL_EVENTS_SPREADSHEET_ID = process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
const PERSONAL_EVENTS_SHEET_NAME = '강사일정';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const timeMin = searchParams.get('timeMin') || undefined;
    const timeMax = searchParams.get('timeMax') || undefined;

    // 강사정보 시트에서 해당 강사의 이메일 셀 조회 (A열 "a@x.com, b@y.com" 복수 이메일이면 모두 사용)
    const emailCell = await getInstructorEmailCellByLoginEmail(user.email);
    let instructorEmails = emailCell ? parseEmailCell(emailCell) : parseEmailCell(user.email);
    if (instructorEmails.length === 0) instructorEmails = [user.email.trim().toLowerCase()];

    // 참석자에 포함된 일정 = 해당 강사 교육일 → 각 이메일로 조회 후 합침
    const calendarPromises = instructorEmails.map((email) =>
      getInstructorEvents(email, CALENDAR_ID, timeMin, timeMax)
    );
    const calendarResults = await Promise.all(calendarPromises);
    const seenIds = new Set<string>();
    const calendarEvents: CalendarEvent[] = [];
    for (const events of calendarResults) {
      for (const e of events) {
        if (e.id && !seenIds.has(e.id)) {
          seenIds.add(e.id);
          calendarEvents.push(e);
        }
      }
    }

    // 강사일정 시트에서 강의 불가/선호 일정 조회 (A열이 해당 강사 이메일 중 하나와 일치)
    const sheets = getGoogleSheetsClient();
    let personalEvents: CalendarEvent[] = [];
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: PERSONAL_EVENTS_SPREADSHEET_ID,
        range: `${PERSONAL_EVENTS_SHEET_NAME}!A:Z`,
      });
      const rows = res.data.values || [];
      const instructorSet = new Set(instructorEmails.map((e) => e.toLowerCase()));
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const emailCellRow = (row[0] || '').trim();
        const summary = (row[1] || '').trim();
        const date = (row[2] || '').trim();
        const rawType = (row[3] || '').trim();
        const rowEmails = parseEmailCell(emailCellRow);
        const isMatch = rowEmails.some((e) => instructorSet.has(e));
        if (!isMatch || !summary || !date) continue;
        const type = rawType === '강의 선호' || rawType === '강의 불가' ? rawType : summary.includes('선호') ? '강의 선호' : '강의 불가';
        let y = 0, m = 0, d = 0;
        if (date.includes('-')) {
          const [yy, mm, dd] = date.split('-').map(Number);
          y = yy; m = mm; d = dd;
        } else {
          const dt = new Date(date);
          y = dt.getFullYear(); m = dt.getMonth() + 1; d = dt.getDate();
        }
        const monthStr = String(m).padStart(2, '0');
        const dayStr = String(d).padStart(2, '0');
        personalEvents.push({
          id: `personal-${date}-${summary}`,
          summary,
          description: type,
          start: { dateTime: `${y}-${monthStr}-${dayStr}T09:00:00+09:00` },
          end: { dateTime: `${y}-${monthStr}-${dayStr}T18:00:00+09:00` },
          attendees: [{ email: instructorEmails[0] ?? '', instructorName: '' }],
          location: '',
          isPersonal: true,
        });
      }
    } catch (_) {}

    const allEvents = [...calendarEvents, ...personalEvents];

    return NextResponse.json({
      success: true,
      events: allEvents,
    });
  } catch (error: any) {
    console.error('Instructor calendar API error:', error);
    return NextResponse.json(
      { error: '일정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

