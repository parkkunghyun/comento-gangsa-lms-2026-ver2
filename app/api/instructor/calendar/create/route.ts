import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createCalendarEvent } from '@/lib/google-calendar';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'c_434b3261f4e10e2caf2228a9f17b773c88a54e11c52d3ac541d8dd1ad323e01a@group.calendar.google.com';

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getCurrentUser();
    if (!user || user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { summary, description, startDateTime, endDateTime, attendeeEmails, location } = body;

    if (!summary || !startDateTime || !endDateTime) {
      return NextResponse.json(
        { error: '제목, 시작 시간, 종료 시간은 필수입니다.' },
        { status: 400 }
      );
    }

    // 강사 자신의 이메일을 참석자에 추가
    const attendees = attendeeEmails || [];
    if (!attendees.includes(user.email)) {
      attendees.push(user.email);
    }

    // 일정 생성
    const eventId = await createCalendarEvent(
      CALENDAR_ID,
      summary,
      description || '',
      startDateTime,
      endDateTime,
      attendees,
      location
    );

    return NextResponse.json({
      success: true,
      eventId,
      message: '일정이 생성되었습니다.',
    });
  } catch (error) {
    console.error('Create calendar event API error:', error);
    return NextResponse.json(
      { error: '일정 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
