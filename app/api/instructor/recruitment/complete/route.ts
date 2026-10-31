import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { logRecruitment } from '@/lib/google-sheets';

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getCurrentUser();
    if (!user || user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { projectName } = body;

    // 섭외 로그 기록
    await logRecruitment(user.name, user.email, projectName);

    return NextResponse.json({
      success: true,
      message: '섭외 완료가 기록되었습니다.',
    });
  } catch (error) {
    console.error('Recruitment complete API error:', error);
    return NextResponse.json(
      { error: '섭외 완료 기록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


