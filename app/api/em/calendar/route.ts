import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllEvents } from '@/lib/google-calendar';
import { getInstructorNamesByEmails } from '@/lib/google-sheets';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'c_434b3261f4e10e2caf2228a9f17b773c88a54e11c52d3ac541d8dd1ad323e01a@group.calendar.google.com';

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

    // 쿼리 파라미터에서 날짜 범위 가져오기
    const searchParams = request.nextUrl.searchParams;
    const timeMin = searchParams.get('timeMin') || undefined;
    const timeMax = searchParams.get('timeMax') || undefined;

    // 모든 일정 조회 (필터링 없음)
    const events = await getAllEvents(
      CALENDAR_ID,
      timeMin,
      timeMax
    );

    // 참석자 이메일 수집 후 강사 이름 매핑
    const attendeeEmails = new Set<string>();
    (events || []).forEach((event: { attendees?: Array<{ email?: string }> }) => {
      event.attendees?.forEach((a) => {
        const email = (a.email || '').trim().toLowerCase();
        if (email && email.includes('@')) attendeeEmails.add(email);
      });
    });

    const emailToName = await getInstructorNamesByEmails(Array.from(attendeeEmails));

    // 각 이벤트의 참석자에 강사 이름 부여
    const enrichedEvents = (events || []).map((event: { attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }> }) => {
      if (!event.attendees || event.attendees.length === 0) return event;
      const attendees = event.attendees.map((a) => {
        const email = (a.email || '').trim().toLowerCase();
        const instructorName = email ? emailToName[email] : undefined;
        return { ...a, instructorName: instructorName || undefined };
      });
      return { ...event, attendees };
    });

    return NextResponse.json({
      success: true,
      events: enrichedEvents,
    });
  } catch (error) {
    console.error('Calendar API error:', error);
    return NextResponse.json(
      { error: '일정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}



