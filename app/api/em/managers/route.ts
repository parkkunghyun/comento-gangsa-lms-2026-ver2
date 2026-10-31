import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllManagers } from '@/lib/google-sheets';

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

    // 모든 매니저 목록 조회
    const managers = await getAllManagers();

    return NextResponse.json({
      success: true,
      managers,
    });
  } catch (error) {
    console.error('Managers API error:', error);
    return NextResponse.json(
      { error: '매니저 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


