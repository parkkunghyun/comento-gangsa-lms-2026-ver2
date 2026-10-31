import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllCoachesWithEmail } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const coaches = await getAllCoachesWithEmail();

    return NextResponse.json({
      success: true,
      coaches,
    });
  } catch (error) {
    console.error('Coaches API error:', error);
    return NextResponse.json(
      { error: '실습코치 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
