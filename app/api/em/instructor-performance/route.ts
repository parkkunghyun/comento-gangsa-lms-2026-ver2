import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getInstructorPerformance } from '@/lib/google-sheets';

/**
 * 강사 실적 조회 (강사 실적 시트: 고객사, 출강 횟수)
 * GET /api/em/instructor-performance
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const performance = await getInstructorPerformance();

    return NextResponse.json({
      success: true,
      performance,
    });
  } catch (error) {
    console.error('Instructor performance API error:', error);
    return NextResponse.json(
      { error: '강사 실적을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
