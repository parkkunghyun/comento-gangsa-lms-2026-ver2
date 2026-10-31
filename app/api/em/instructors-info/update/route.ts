import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateInstructorCell } from '@/lib/google-sheets';

/**
 * 강사 정보 업데이트 API
 * PUT /api/em/instructors-info/update
 */
export async function PUT(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getCurrentUser();
    if (!user || user.role !== 'EM') {
      return NextResponse.json(
        { error: '인증되지 않았거나 권한이 없습니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { rowIndex, columnIndex, value } = body;

    if (typeof rowIndex !== 'number' || typeof columnIndex !== 'number' || value === undefined) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 시트 업데이트
    await updateInstructorCell(rowIndex, columnIndex, String(value));

    return NextResponse.json({
      success: true,
      message: '강사 정보가 업데이트되었습니다.',
    });
  } catch (error) {
    console.error('Update instructor API error:', error);
    return NextResponse.json(
      { error: '강사 정보 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
