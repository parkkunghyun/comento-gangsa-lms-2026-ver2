import { NextRequest, NextResponse } from 'next/server';
import { findInstructorByEmail, updateInstructorPinCode } from '@/lib/google-sheets';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, newPinCode } = body;

    if (!email || !newPinCode) {
      return NextResponse.json(
        { error: '이메일과 새 핀코드를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (newPinCode.length < 4 || newPinCode.length > 10) {
      return NextResponse.json(
        { error: '핀코드는 4자 이상 10자 이하여야 합니다.' },
        { status: 400 }
      );
    }

    // 이메일로 강사 정보 확인
    const instructor = await findInstructorByEmail(email);
    if (!instructor) {
      return NextResponse.json(
        { error: '해당 이메일로 등록된 강사를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 핀코드 업데이트 (V열)
    await updateInstructorPinCode(instructor.rowIndex, newPinCode);

    return NextResponse.json({
      success: true,
      message: '핀코드가 성공적으로 변경되었습니다.',
    });
  } catch (error) {
    console.error('Reset pin simple error:', error);
    return NextResponse.json(
      { error: '핀코드 재설정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
