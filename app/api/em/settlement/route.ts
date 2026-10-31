import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllInstructorSettlements } from '@/lib/google-sheets';

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

    console.log('Fetching all instructor settlements for EM');

    // 모든 강사 정산 데이터 조회
    const allSettlements = await getAllInstructorSettlements();

    return NextResponse.json({
      success: true,
      settlements: allSettlements,
    });
  } catch (error) {
    console.error('EM Settlement API error:', error);
    return NextResponse.json(
      { error: '정산 데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


