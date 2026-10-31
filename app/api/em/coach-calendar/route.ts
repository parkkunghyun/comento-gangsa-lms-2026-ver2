import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getInstructorEvents, getAllEvents, CalendarEvent } from '@/lib/google-calendar';
import {
  getGoogleSheetsClient,
  parseEmailCell,
  getAllCoachesWithEmail,
  getCoachNamesByEmails,
} from '@/lib/google-sheets';

const CALENDAR_ID =
  process.env.GOOGLE_CALENDAR_ID ||
  'c_434b3261f4e10e2caf2228a9f17b773c88a54e11c52d3ac541d8dd1ad323e01a@group.calendar.google.com';
const PERSONAL_EVENTS_SPREADSHEET_ID =
  process.env.GOOGLE_RECRUITMENT_LOG_SPREADSHEET_ID || '1ygeuJ9dIVvbreU2CXTNDXonnew19EjWsJq7FJLMCLW0';
const PERSONAL_EVENTS_SHEET_NAME = '강사일정';

function normalizeAttendeeEmail(raw: string | null | undefined): string {
  if (!raw) return '';
  let e = raw.trim().toLowerCase();
  if (e.startsWith('mailto:')) e = e.slice(7).trim();
  return e;
}

async function fetchPersonalEventsForEmails(
  coachEmails: string[]
): Promise<CalendarEvent[]> {
  const sheets = getGoogleSheetsClient();
  const personalEvents: CalendarEvent[] = [];
  const coachEmailSet = new Set(coachEmails.map((e) => e.toLowerCase()));

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: PERSONAL_EVENTS_SPREADSHEET_ID,
      range: `${PERSONAL_EVENTS_SHEET_NAME}!A:Z`,
    });

    const rows = response.data.values || [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const emailCell = (row[0] || '').trim();
      const summary = (row[1] || '').trim();
      const date = (row[2] || '').trim();
      const rawType = (row[3] || '').trim();

      const rowEmails = parseEmailCell(emailCell);
      const isMatch = rowEmails.some((e) => coachEmailSet.has(e));
      if (!isMatch || !summary || !date) continue;

      const type =
        rawType === '강의 선호' || rawType === '강의 불가'
          ? rawType
          : summary.includes('선호')
          ? '강의 선호'
          : '강의 불가';

      let dateObj: Date;
      if (date.includes('-')) {
        const [y, m, d] = date.split('-').map(Number);
        dateObj = new Date(y, m - 1, d);
      } else {
        dateObj = new Date(date);
      }

      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');

      personalEvents.push({
        id: `personal-${date}-${summary}-${coachEmails[0]}`,
        summary,
        description: type,
        start: { dateTime: `${year}-${month}-${day}T09:00:00+09:00` },
        end: { dateTime: `${year}-${month}-${day}T18:00:00+09:00` },
        attendees: [{ email: coachEmails[0] ?? '', instructorName: '' }],
        location: '',
        isPersonal: true,
      });
    }
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    if (err.code !== 400 && !err.message?.includes('Unable to parse range')) {
      console.error('Error fetching coach personal events:', error);
    }
  }

  return personalEvents;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const coachEmailParam = searchParams.get('coachEmail');
    const timeMin = searchParams.get('timeMin') || undefined;
    const timeMax = searchParams.get('timeMax') || undefined;

    const allCoaches = await getAllCoachesWithEmail();
    const coachEmailSet = new Set(
      allCoaches.map((c) => c.email.trim().toLowerCase()).filter(Boolean)
    );

    if (coachEmailParam) {
      const coachEmails = parseEmailCell(coachEmailParam);

      const calendarPromises = coachEmails.map((email) =>
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

      const personalEvents = await fetchPersonalEventsForEmails(coachEmails);
      const allEvents = [...calendarEvents, ...personalEvents];

      const attendeeEmails = new Set<string>();
      allEvents.forEach((event) => {
        event.attendees?.forEach((a) => {
          const email = normalizeAttendeeEmail(a.email);
          if (email) attendeeEmails.add(email);
        });
      });
      const emailToName = await getCoachNamesByEmails(Array.from(attendeeEmails));
      const enrichedEvents = allEvents.map((event) => {
        if (!event.attendees?.length) return event;
        const attendees = event.attendees.map((a) => {
          const email = normalizeAttendeeEmail(a.email);
          const instructorName = email ? emailToName[email] : undefined;
          return { ...a, instructorName: instructorName || undefined };
        });
        return { ...event, attendees };
      });

      return NextResponse.json({ success: true, events: enrichedEvents });
    }

    // 전체 실습코치 일정: 캘린더에서 실습코치가 참석한 일정만
    const events = await getAllEvents(CALENDAR_ID, timeMin, timeMax);
    const filteredEvents = (events || []).filter((event) => {
      if (!event.attendees?.length) return false;
      return event.attendees.some((a) => {
        const email = normalizeAttendeeEmail(a.email);
        return email && coachEmailSet.has(email);
      });
    });

    const attendeeEmails = new Set<string>();
    filteredEvents.forEach((event) => {
      event.attendees?.forEach((a) => {
        const email = normalizeAttendeeEmail(a.email);
        if (email) attendeeEmails.add(email);
      });
    });
    const emailToName = await getCoachNamesByEmails(Array.from(attendeeEmails));

    const enrichedEvents = filteredEvents.map((event) => {
      if (!event.attendees?.length) return event;
      const attendees = event.attendees.map((a) => {
        const email = normalizeAttendeeEmail(a.email);
        const instructorName = email ? emailToName[email] : undefined;
        return { ...a, instructorName: instructorName || undefined };
      });
      return { ...event, attendees };
    });

    return NextResponse.json({ success: true, events: enrichedEvents });
  } catch (error) {
    console.error('Coach calendar API error:', error);
    return NextResponse.json(
      { error: '일정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
