import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getInstructorRecruitmentStats, getOverallMonthlyRecruitmentStats } from '@/lib/google-sheets';

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

    // 강사별 섭외율 통계 조회
    const stats = await getInstructorRecruitmentStats();
    
    // 전체 월별 통계 조회
    const overallMonthlyStats = await getOverallMonthlyRecruitmentStats();

    return NextResponse.json({
      success: true,
      stats,
      overallMonthlyStats,
    });
  } catch (error) {
    console.error('Recruitment stats API error:', error);
    return NextResponse.json(
      { error: '섭외율 통계를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
