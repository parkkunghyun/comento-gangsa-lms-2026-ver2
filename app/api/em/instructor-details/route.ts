import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllInstructorDetails } from '@/lib/google-sheets';

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

    // 강사 상세 정보 조회
    const details = await getAllInstructorDetails();

    return NextResponse.json({
      success: true,
      instructors: details,
    });
  } catch (error) {
    console.error('Instructor details API error:', error);
    return NextResponse.json(
      { error: '강사 상세 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
