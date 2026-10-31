import { NextRequest, NextResponse } from 'next/server';
import { findInstructorByEmail, updateInstructorPinCode } from '@/lib/google-sheets';
import { getVerificationCode, deleteVerificationCode } from '@/lib/verification-codes';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, verificationCode, newPinCode } = body;

    if (!email || !verificationCode || !newPinCode) {
      return NextResponse.json(
        { error: '모든 필드를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (newPinCode.length < 4 || newPinCode.length > 10) {
      return NextResponse.json(
        { error: '핀코드는 4자 이상 10자 이하여야 합니다.' },
        { status: 400 }
      );
    }

    // 인증 코드 확인
    const storedCode = getVerificationCode(email);
    if (!storedCode || storedCode !== verificationCode) {
      return NextResponse.json(
        { error: '인증 코드가 올바르지 않거나 만료되었습니다.' },
        { status: 400 }
      );
    }

    // 강사 정보 확인
    const instructor = await findInstructorByEmail(email);
    if (!instructor) {
      return NextResponse.json(
        { error: '강사 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 핀코드 업데이트
    await updateInstructorPinCode(instructor.rowIndex, newPinCode);

    // 인증 코드 삭제
    deleteVerificationCode(email);

    return NextResponse.json({
      success: true,
      message: '핀코드가 성공적으로 변경되었습니다.',
    });
  } catch (error) {
    console.error('Reset pin error:', error);
    return NextResponse.json(
      { error: '핀코드 재설정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
