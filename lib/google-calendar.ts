import { google } from 'googleapis';
import { getInstructorNamesByEmails } from './google-sheets';

/**
 * Google Calendar API 클라이언트를 생성합니다.
 */
export function getGoogleCalendarClient() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!serviceAccountEmail || !serviceAccountPrivateKey) {
    throw new Error('Google Service Account credentials are not configured');
  }

  // Private Key의 개행 문자를 처리
  const privateKey = serviceAccountPrivateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  });

  return google.calendar({ version: 'v3', auth });
}

/**
 * 캘린더 이벤트 타입
 */
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    instructorName?: string; // 강사 이름 (이메일로 조회)
  }>;
  location?: string;
  isPersonal?: boolean; // 개인 일정 여부
}

/**
 * 특정 강사의 이메일이 참석자로 포함된 일정을 조회합니다.
 * @param instructorEmail 강사 이메일
 * @param calendarId 캘린더 ID
 * @param timeMin 시작 시간 (ISO 8601)
 * @param timeMax 종료 시간 (ISO 8601)
 * @returns 일정 목록
 */
export async function getInstructorEvents(
  instructorEmail: string,
  calendarId: string,
  timeMin?: string,
  timeMax?: string
): Promise<CalendarEvent[]> {
  const calendar = getGoogleCalendarClient();

  try {
    const response = await calendar.events.list({
      calendarId,
      timeMin: timeMin || new Date().toISOString(),
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500, // 충분한 수의 이벤트 가져오기
    });

    const events = response.data.items || [];

    console.log(`[getInstructorEvents] 조회 강사 이메일: ${instructorEmail}`);
    console.log(`[getInstructorEvents] 전체 이벤트 개수: ${events.length}`);

    // 참석자 이메일 정규화 (Google API는 때때로 "mailto:xxx@xx.com" 형태로 반환)
    const normalizeAttendeeEmail = (raw: string | null | undefined): string => {
      if (!raw) return '';
      let e = raw.trim().toLowerCase();
      if (e.startsWith('mailto:')) e = e.slice(7).trim();
      return e;
    };

    // 참석자 이메일로 필터링
    const filteredEvents = events.filter((event) => {
      if (!event.attendees || event.attendees.length === 0) {
        return false;
      }
      
      const attendeeEmails = event.attendees
        .map((a) => normalizeAttendeeEmail(a.email))
        .filter(Boolean);
      
      const normalizedInstructorEmail = instructorEmail.trim().toLowerCase().replace(/^mailto:/, '').trim();
      const isMatch = attendeeEmails.some(
        (email) => email === normalizedInstructorEmail
      );
      
      if (isMatch) {
        console.log(`[getInstructorEvents] ✓ 매칭된 이벤트: ${event.summary} (참석자: ${attendeeEmails.join(', ')})`);
      }
      
      return isMatch;
    });

    console.log(`[getInstructorEvents] 필터링된 이벤트 개수: ${filteredEvents.length}`);

    // 모든 참석자 이메일 수집 (mailto: 제거한 형태로)
    const allAttendeeEmails = new Set<string>();
    filteredEvents.forEach((event) => {
      event.attendees?.forEach((attendee) => {
        const e = normalizeAttendeeEmail(attendee.email);
        if (e) allAttendeeEmails.add(e);
      });
    });

    console.log(`[강사 캘린더] 참석자 이메일 수집: ${allAttendeeEmails.size}개`);
    console.log(`[강사 캘린더] 참석자 이메일 목록:`, Array.from(allAttendeeEmails));

    // 강사 이름 일괄 조회
    const emailToNameMap = await getInstructorNamesByEmails(Array.from(allAttendeeEmails));
    
    console.log(`[강사 캘린더] 강사 이름 매핑 결과:`, emailToNameMap);

    // 이벤트 변환 및 강사 이름 추가
    const instructorEvents = filteredEvents.map((event) => ({
      id: event.id || '',
      summary: event.summary || '제목 없음',
      description: event.description || '',
      start: {
        dateTime: event.start?.dateTime || undefined,
        date: event.start?.date || undefined,
      },
      end: {
        dateTime: event.end?.dateTime || undefined,
        date: event.end?.date || undefined,
      },
      attendees: event.attendees?.map((a) => ({
        email: a.email || '',
        displayName: a.displayName || '',
        responseStatus: a.responseStatus || '',
        instructorName: a.email ? emailToNameMap[a.email.toLowerCase()] || undefined : undefined,
      })),
      location: event.location || '',
    }));

    return instructorEvents;
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
}

/**
 * 모든 일정을 조회합니다 (EM용 - 필터링 없음).
 * @param calendarId 캘린더 ID
 * @param timeMin 시작 시간 (ISO 8601)
 * @param timeMax 종료 시간 (ISO 8601)
 * @returns 일정 목록
 */
export async function getAllEvents(
  calendarId: string,
  timeMin?: string,
  timeMax?: string
): Promise<CalendarEvent[]> {
  const calendar = getGoogleCalendarClient();

  try {
    const response = await calendar.events.list({
      calendarId,
      timeMin: timeMin || new Date().toISOString(),
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500, // 충분한 수의 이벤트 가져오기
    });

    const events = response.data.items || [];

    // 모든 참석자 이메일 수집
    const allAttendeeEmails = new Set<string>();
    events.forEach((event) => {
      event.attendees?.forEach((attendee) => {
        if (attendee.email) {
          allAttendeeEmails.add(attendee.email.trim());
        }
      });
    });

    console.log(`[EM 캘린더] 참석자 이메일 수집: ${allAttendeeEmails.size}개`);
    console.log(`[EM 캘린더] 참석자 이메일 목록:`, Array.from(allAttendeeEmails));

    // 강사 이름 일괄 조회
    const emailToNameMap = await getInstructorNamesByEmails(Array.from(allAttendeeEmails));
    
    console.log(`[EM 캘린더] 강사 이름 매핑 결과:`, emailToNameMap);

    // 모든 이벤트를 변환 (필터링 없음) 및 강사 이름 추가
    const allEvents = events.map((event) => ({
      id: event.id || '',
      summary: event.summary || '제목 없음',
      description: event.description || '',
      start: {
        dateTime: event.start?.dateTime || undefined,
        date: event.start?.date || undefined,
      },
      end: {
        dateTime: event.end?.dateTime || undefined,
        date: event.end?.date || undefined,
      },
      attendees: event.attendees?.map((a) => ({
        email: a.email || '',
        displayName: a.displayName || '',
        responseStatus: a.responseStatus || '',
        instructorName: a.email ? emailToNameMap[a.email.toLowerCase()] || undefined : undefined,
      })),
      location: event.location || '',
    }));

    return allEvents;
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
}

/**
 * 캘린더에 일정을 생성합니다.
 * @param calendarId 캘린더 ID
 * @param summary 일정 제목
 * @param description 일정 설명
 * @param startDateTime 시작 시간 (ISO 8601)
 * @param endDateTime 종료 시간 (ISO 8601)
 * @param attendeeEmails 참석자 이메일 목록
 * @param location 장소
 * @returns 생성된 이벤트 ID
 */
export async function createCalendarEvent(
  calendarId: string,
  summary: string,
  description: string,
  startDateTime: string,
  endDateTime: string,
  attendeeEmails: string[],
  location?: string
): Promise<string> {
  const calendar = getGoogleCalendarClient();

  try {
    // 날짜 형식이 올바른지 확인 (ISO 8601 형식)
    const startDate = new Date(startDateTime);
    const endDate = new Date(endDateTime);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format');
    }

    // ISO 8601 형식으로 변환
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    const event: any = {
      summary,
      description: description || '',
      start: {
        dateTime: startISO,
        timeZone: 'Asia/Seoul',
      },
      end: {
        dateTime: endISO,
        timeZone: 'Asia/Seoul',
      },
    };

    // 참석자가 있는 경우에만 추가
    if (attendeeEmails && attendeeEmails.length > 0) {
      event.attendees = attendeeEmails.map((email) => ({ email }));
    }

    // 장소가 있는 경우에만 추가
    if (location) {
      event.location = location;
    }

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    return response.data.id || '';
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
}

/**
 * 캘린더 일정을 수정합니다.
 * @param calendarId 캘린더 ID
 * @param eventId 이벤트 ID
 * @param summary 일정 제목
 * @param description 일정 설명
 * @param startDateTime 시작 시간 (ISO 8601)
 * @param endDateTime 종료 시간 (ISO 8601)
 * @param attendeeEmails 참석자 이메일 목록
 * @param location 장소
 */
export async function updateCalendarEvent(
  calendarId: string,
  eventId: string,
  summary: string,
  description: string,
  startDateTime: string,
  endDateTime: string,
  attendeeEmails: string[],
  location?: string
): Promise<void> {
  const calendar = getGoogleCalendarClient();

  try {
    // 기존 이벤트 조회
    const existingEvent = await calendar.events.get({
      calendarId,
      eventId,
    });

    const event = {
      ...existingEvent.data,
      summary,
      description,
      start: {
        dateTime: startDateTime,
        timeZone: 'Asia/Seoul',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Asia/Seoul',
      },
      attendees: attendeeEmails.map((email) => ({ email })),
      location,
    };

    await calendar.events.update({
      calendarId,
      eventId,
      requestBody: event,
    });
  } catch (error) {
    console.error('Error updating calendar event:', error);
    throw error;
  }
}

/**
 * 캘린더 일정을 삭제합니다.
 * @param calendarId 캘린더 ID
 * @param eventId 이벤트 ID
 */
export async function deleteCalendarEvent(
  calendarId: string,
  eventId: string
): Promise<void> {
  const calendar = getGoogleCalendarClient();

  try {
    await calendar.events.delete({
      calendarId,
      eventId,
    });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    throw error;
  }
}

