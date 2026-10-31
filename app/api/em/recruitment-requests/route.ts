import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRecruitmentRequests } from '@/lib/google-sheets';

/**
 * 섭외 요청 목록 조회 API
 * GET /api/em/recruitment-requests
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

    // 섭외 요청 목록 조회
    const requests = await getRecruitmentRequests();

    return NextResponse.json({
      success: true,
      requests,
    });
  } catch (error) {
    console.error('Recruitment requests API error:', error);
    return NextResponse.json(
      { error: '섭외 요청 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
