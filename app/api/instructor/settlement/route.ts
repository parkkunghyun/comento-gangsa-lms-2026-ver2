import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getInstructorSettlements } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    // 1. 로그인한 멘토명 수신
    const user = await getCurrentUser();
    if (!user || user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    console.log('Fetching settlements for user:', user.name);

    // 2-8. 정산 데이터 조회 (스프레드시트 오픈, 필터링, 그룹핑, 합계 계산 포함)
    const groupedSettlements = await getInstructorSettlements(user.name);

    // 8. 결과 JSON 반환
    return NextResponse.json({
      success: true,
      settlements: groupedSettlements,
      instructorName: user.name, // 디버깅용
    });
  } catch (error) {
    console.error('Settlement API error:', error);
    return NextResponse.json(
      { error: '정산 데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

