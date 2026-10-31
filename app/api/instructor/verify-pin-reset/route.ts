import { NextRequest, NextResponse } from 'next/server';
import { getVerificationCode } from '@/lib/verification-codes';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, verificationCode } = body;

    if (!email || !verificationCode) {
      return NextResponse.json(
        { error: '이메일과 인증 코드를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    // 저장된 인증 코드 확인
    const storedCode = getVerificationCode(email);

    if (!storedCode) {
      return NextResponse.json(
        { error: '인증 코드가 만료되었거나 존재하지 않습니다.' },
        { status: 400 }
      );
    }

    if (storedCode !== verificationCode) {
      return NextResponse.json(
        { error: '인증 코드가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // 인증 성공 시 코드는 유지 (핀코드 변경 시까지 필요)
    return NextResponse.json({
      success: true,
      message: '인증 코드가 확인되었습니다.',
    });
  } catch (error) {
    console.error('Verify pin reset error:', error);
    return NextResponse.json(
      { error: '인증 코드 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
