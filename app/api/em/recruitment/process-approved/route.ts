import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { processApprovedRecruitment, processAllApprovedRecruitments } from '@/lib/google-sheets';

/**
 * 승인된 섭외 요청 처리 API
 * POST /api/em/recruitment/process-approved
 * 
 * Body (선택사항):
 *   - requestId: 특정 요청 ID (없으면 모든 승인된 요청 처리)
 * 
 * Response:
 *   - success: boolean
 *   - updatedCount: 업데이트된 일정 개수
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { requestId } = body;

    let updatedCount: number;

    if (requestId) {
      // 특정 요청 처리
      updatedCount = await processApprovedRecruitment(requestId);
    } else {
      // 모든 승인된 요청 처리
      updatedCount = await processAllApprovedRecruitments();
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      message: `${updatedCount}개의 일정이 업데이트되었습니다.`,
    });
  } catch (error) {
    console.error('Process approved recruitment API error:', error);
    return NextResponse.json(
      { error: '승인된 요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
