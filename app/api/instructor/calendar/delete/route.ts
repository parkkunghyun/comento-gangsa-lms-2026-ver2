import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { deleteCalendarEvent } from '@/lib/google-calendar';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'c_434b3261f4e10e2caf2228a9f17b773c88a54e11c52d3ac541d8dd1ad323e01a@group.calendar.google.com';

export async function DELETE(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getCurrentUser();
    if (!user || user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json(
        { error: '이벤트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 일정 삭제
    await deleteCalendarEvent(CALENDAR_ID, eventId);

    return NextResponse.json({
      success: true,
      message: '일정이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('Delete calendar event API error:', error);
    return NextResponse.json(
      { error: '일정 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
