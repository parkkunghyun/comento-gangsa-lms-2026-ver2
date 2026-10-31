import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getInstructorEvents, CalendarEvent } from '@/lib/google-calendar';
import { getGoogleSheetsClient, parseEmailCell } from '@/lib/google-sheets';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'c_434b3261f4e10e2caf2228a9f17b773c88a54e11c52d3ac541d8dd1ad323e01a@group.calendar.google.com';
const PERSONAL_EVENTS_SPREADSHEET_ID = process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
const PERSONAL_EVENTS_SHEET_NAME = '강사일정';

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

    // 쿼리 파라미터에서 강사 이메일과 날짜 범위 가져오기 (쉼표로 여러 이메일 가능)
    const searchParams = request.nextUrl.searchParams;
    const instructorEmailParam = searchParams.get('instructorEmail');
    const timeMin = searchParams.get('timeMin') || undefined;
    const timeMax = searchParams.get('timeMax') || undefined;

    if (!instructorEmailParam) {
      return NextResponse.json(
        { error: '강사 이메일이 필요합니다.' },
        { status: 400 }
      );
    }

    const instructorEmails = parseEmailCell(instructorEmailParam);

    // 강사 기업교육 일정 조회 (여러 이메일이면 각각 조회 후 합침)
    const calendarPromises = instructorEmails.map((email) =>
      getInstructorEvents(email, CALENDAR_ID, timeMin, timeMax)
    );
    const calendarResults = await Promise.all(calendarPromises);
    const seenEventIds = new Set<string>();
    const calendarEvents: CalendarEvent[] = [];
    for (const events of calendarResults) {
      for (const event of events) {
        if (event.id && !seenEventIds.has(event.id)) {
          seenEventIds.add(event.id);
          calendarEvents.push(event);
        }
      }
    }

    // 강사 개인 일정 조회
    const sheets = getGoogleSheetsClient();
    let personalEvents: CalendarEvent[] = [];
    
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: PERSONAL_EVENTS_SPREADSHEET_ID,
        range: `${PERSONAL_EVENTS_SHEET_NAME}!A:Z`,
      });

      const rows = response.data.values || [];
      
      // 헤더 행을 제외하고 데이터 행만 처리
      // 시트 구조: 강사이메일 | 일정이름 | 날짜 (A열에 쉼표로 여러 이메일일 수 있음)
      const instructorEmailSet = new Set(instructorEmails.map((e) => e.toLowerCase()));
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const emailCell = (row[0] || '').trim();
        const summary = (row[1] || '').trim();
        const date = (row[2] || '').trim();
        const rawType = (row[3] || '').trim();

        const rowEmails = parseEmailCell(emailCell);
        const isMatch = rowEmails.some((e) => instructorEmailSet.has(e));
        if (isMatch && summary && date) {
          const type =
            rawType === '강의 선호' || rawType === '강의 불가'
              ? rawType
              : summary.includes('선호')
              ? '강의 선호'
              : '강의 불가';
          // 날짜 파싱 (YYYY-MM-DD 형식)
          let dateObj: Date;
          if (date.includes('-')) {
            // YYYY-MM-DD 형식
            const [year, month, day] = date.split('-').map(Number);
            dateObj = new Date(year, month - 1, day);
          } else {
            dateObj = new Date(date);
          }
          
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          
          personalEvents.push({
            id: `personal-${date}-${summary}`,
            summary: summary,
            description: type,
            start: {
              dateTime: `${year}-${month}-${day}T09:00:00+09:00`,
            },
            end: {
              dateTime: `${year}-${month}-${day}T18:00:00+09:00`,
            },
            attendees: [
              {
                email: instructorEmails[0] ?? '',
                instructorName: '',
              },
            ],
            location: '',
            isPersonal: true, // 개인 일정 표시
          });
        }
      }
    } catch (error: any) {
      // 시트가 없으면 무시
      if (error.code !== 400 && !error.message?.includes('Unable to parse range')) {
        console.error('Error fetching personal events:', error);
      }
    }

    // 기업교육 일정과 개인 일정 합치기
    const allEvents = [...calendarEvents, ...personalEvents];

    console.log(`[EM 강사 캘린더 API] 강사 이메일: ${instructorEmails.join(', ')}`);
    console.log(`[EM 강사 캘린더 API] 기업교육 일정 개수: ${calendarEvents.length}`);
    console.log(`[EM 강사 캘린더 API] 기업교육 일정 목록:`, calendarEvents.map(e => ({ summary: e.summary, date: e.start.dateTime || e.start.date })));
    console.log(`[EM 강사 캘린더 API] 개인 일정 개수: ${personalEvents.length}`);
    console.log(`[EM 강사 캘린더 API] 전체 일정 개수: ${allEvents.length}`);

    return NextResponse.json({
      success: true,
      events: allEvents,
    });
  } catch (error) {
    console.error('Instructor calendar API error:', error);
    return NextResponse.json(
      { error: '일정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
