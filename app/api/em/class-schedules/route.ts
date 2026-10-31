import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getClassSchedules } from '@/lib/google-sheets';

/**
 * 교육 일정 조회 API
 * GET /api/em/class-schedules
 * 
 * Query Parameters:
 *   - year: 필터링할 연도 (기본값: 2026)
 *   - search: 고객사명 검색어 (선택사항)
 */
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

    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || '2026');
    const searchQuery = searchParams.get('search') || '';

    // 교육 일정 조회
    const schedules = await getClassSchedules(year);

    // 검색 필터링 (고객사명, 클래스명, 강사명, DRI)
    let filteredSchedules = schedules;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredSchedules = schedules.filter(
        (schedule) =>
          schedule.clientName.toLowerCase().includes(query) ||
          schedule.className.toLowerCase().includes(query) ||
          schedule.instructor.toLowerCase().includes(query) ||
          schedule.dri.toLowerCase().includes(query) ||
          schedule.coach.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({
      success: true,
      schedules: filteredSchedules,
    });
  } catch (error) {
    console.error('Class schedules API error:', error);
    return NextResponse.json(
      { error: '교육 일정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
